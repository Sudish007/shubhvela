// Encrypted backup container (spec section 10, design.md 10.1, plan C04, N9): AES-256-GCM with a key derived from
// the passphrase by PBKDF2-HMAC-SHA256, 600,000 iterations, a 16-byte random salt and a 12-byte random IV.
// File layout (.svb, big-endian):
//   magic 'SVB1' (4) | iterations u32 (4) | salt (16) | iv (12) | tag (16) | ciphertext (rest)
// The passphrase is never stored or logged; a wrong passphrase fails the GCM tag and surfaces as BackupError
// 'passphrase' (design.md 11). The primitives come through CryptoProvider so the format is unit-tested with Node's
// `crypto` and runs on the phone with react-native-quick-crypto (same algorithms, same bytes).
export const BACKUP_MAGIC = 'SVB1';
export const PBKDF2_ITERATIONS = 600_000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
export const TAG_BYTES = 16;
export const KEY_BYTES = 32;
export const HEADER_BYTES = 4 + 4 + SALT_BYTES + IV_BYTES + TAG_BYTES;
/** Design.md 11: the passphrase is at least 8 characters (code points). */
export const PASSPHRASE_MIN = 8;

export type BackupErrorCode = 'passphrase' | 'format' | 'newer' | 'passphraseShort';

export class BackupError extends Error {
  constructor(
    public readonly code: BackupErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BackupError';
  }
}

export interface CipherLike {
  update(data: Uint8Array): Uint8Array;
  final(): Uint8Array;
  getAuthTag(): Uint8Array;
}

export interface DecipherLike {
  setAuthTag(tag: Uint8Array): void;
  update(data: Uint8Array): Uint8Array;
  final(): Uint8Array;
}

export interface CryptoProvider {
  randomBytes(n: number): Uint8Array;
  pbkdf2Sha256(passphrase: string, salt: Uint8Array, iterations: number, keyLength: number): Uint8Array;
  createAesGcmCipher(key: Uint8Array, iv: Uint8Array): CipherLike;
  createAesGcmDecipher(key: Uint8Array, iv: Uint8Array): DecipherLike;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function passphraseLength(p: string): number {
  return Array.from(p).length;
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function u32be(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, false);
  return b;
}

/** Encrypts a UTF-8 document; the passphrase is used once for the key derivation and not retained. */
export function encryptBackup(plaintext: string, passphrase: string, crypto: CryptoProvider, iterations: number = PBKDF2_ITERATIONS): Uint8Array {
  if (passphraseLength(passphrase) < PASSPHRASE_MIN) throw new BackupError('passphraseShort', `passphrase shorter than ${PASSPHRASE_MIN}`);
  const salt = crypto.randomBytes(SALT_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const key = crypto.pbkdf2Sha256(passphrase, salt, iterations, KEY_BYTES);
  const cipher = crypto.createAesGcmCipher(key, iv);
  const body = concat(cipher.update(enc.encode(plaintext)), cipher.final());
  const tag = cipher.getAuthTag();
  if (tag.length !== TAG_BYTES) throw new BackupError('format', `unexpected tag length ${tag.length}`);
  key.fill(0);
  return concat(enc.encode(BACKUP_MAGIC), u32be(iterations), salt, iv, tag, body);
}

export interface BackupHeader {
  iterations: number;
  salt: Uint8Array;
  iv: Uint8Array;
  tag: Uint8Array;
  body: Uint8Array;
}

/** Splits the container; throws 'format' when the magic or the length is wrong (not a Shubhvela backup). */
export function readHeader(file: Uint8Array): BackupHeader {
  if (file.length < HEADER_BYTES || dec.decode(file.subarray(0, 4)) !== BACKUP_MAGIC) throw new BackupError('format', 'not an SVB1 file');
  const iterations = new DataView(file.buffer, file.byteOffset + 4, 4).getUint32(0, false);
  if (iterations < 1 || iterations > 10_000_000) throw new BackupError('format', `implausible iteration count ${iterations}`);
  let o = 8;
  const salt = file.subarray(o, (o += SALT_BYTES));
  const iv = file.subarray(o, (o += IV_BYTES));
  const tag = file.subarray(o, (o += TAG_BYTES));
  return { iterations, salt, iv, tag, body: file.subarray(o) };
}

/** Decrypts to the UTF-8 document; a wrong passphrase (GCM tag failure) throws BackupError 'passphrase'. */
export function decryptBackup(file: Uint8Array, passphrase: string, crypto: CryptoProvider): string {
  const h = readHeader(file);
  const key = crypto.pbkdf2Sha256(passphrase, h.salt, h.iterations, KEY_BYTES);
  try {
    const d = crypto.createAesGcmDecipher(key, h.iv);
    d.setAuthTag(h.tag);
    const plain = concat(d.update(h.body), d.final());
    return dec.decode(plain);
  } catch {
    throw new BackupError('passphrase', 'authentication failed');
  } finally {
    key.fill(0);
  }
}

/** Lazily binds react-native-quick-crypto (never loaded under Jest, where tests inject Node's crypto). */
export function quickCryptoProvider(): CryptoProvider {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const qc = require('react-native-quick-crypto') as {
    randomBytes(n: number): Uint8Array;
    pbkdf2Sync(pass: string, salt: Uint8Array, iterations: number, keylen: number, digest: string): Uint8Array;
    createCipheriv(alg: string, key: Uint8Array, iv: Uint8Array): { update(d: Uint8Array): Uint8Array; final(): Uint8Array; getAuthTag(): Uint8Array };
    createDecipheriv(alg: string, key: Uint8Array, iv: Uint8Array): { setAuthTag(t: Uint8Array): unknown; update(d: Uint8Array): Uint8Array; final(): Uint8Array };
  };
  const bytes = (b: Uint8Array) => new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  return {
    randomBytes: (n) => bytes(qc.randomBytes(n)),
    pbkdf2Sha256: (pass, salt, iterations, keyLength) => bytes(qc.pbkdf2Sync(pass, salt, iterations, keyLength, 'sha256')),
    createAesGcmCipher: (key, iv) => {
      const c = qc.createCipheriv('aes-256-gcm', key, iv);
      return { update: (d) => bytes(c.update(d)), final: () => bytes(c.final()), getAuthTag: () => bytes(c.getAuthTag()) };
    },
    createAesGcmDecipher: (key, iv) => {
      const d = qc.createDecipheriv('aes-256-gcm', key, iv);
      return { setAuthTag: (t) => void d.setAuthTag(t), update: (x) => bytes(d.update(x)), final: () => bytes(d.final()) };
    },
  };
}
