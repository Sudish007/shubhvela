// PDF creation and hand-off (design.md 10.6, M9): expo-print printToFileAsync renders the report HTML to a PDF file
// in the app cache, then expo-sharing opens the system share sheet (save to Files, WhatsApp, mail). Dependencies are
// injectable so the preview screen's flows are unit-tested without native modules; the default binding is lazy so the
// HTML builders never load expo-print under Jest.
import { File, Paths } from 'expo-file-system';

export interface PdfFile {
  uri: string;
  pages: number;
}

export interface PdfDeps {
  /** Renders HTML to a PDF file (default expo-print). */
  print?: (html: string) => Promise<PdfFile>;
  /** Opens the system share sheet for the file (default expo-sharing). */
  share?: (uri: string, title: string) => Promise<void>;
  /** Moves the printed file to a readable name inside the cache (default expo-file-system). */
  rename?: (uri: string, fileName: string) => Promise<string>;
  /** Reads the finished file so the page count shown to the user comes from the PDF itself (default expo-file-system). */
  readBytes?: (uri: string) => Promise<Uint8Array>;
}

/**
 * Page count read from the PDF bytes: the number of "/Type /Page" page objects (not "/Pages"). B08 found expo-print's
 * `numberOfPages` on Android to be the WebView print adapter's estimate (23 and 85 for 9-page files), and "PDF created
 * · N pages" must be a true number. Android's print pipeline writes plain object headers, so the scan is exact; 0 means
 * the structure was not recognised and the caller falls back to the printer's figure.
 */
export function countPdfPages(bytes: Uint8Array): number {
  const TYPE = [0x2f, 0x54, 0x79, 0x70, 0x65]; // "/Type"
  const PAGE = [0x2f, 0x50, 0x61, 0x67, 0x65]; // "/Page"
  let n = 0;
  for (let i = 0; i + 5 <= bytes.length; i++) {
    if (bytes[i] !== 0x2f || !TYPE.every((b, k) => bytes[i + k] === b)) continue;
    let j = i + 5;
    while (j < bytes.length && (bytes[j] === 0x20 || bytes[j] === 0x0a || bytes[j] === 0x0d || bytes[j] === 0x09)) j++;
    if (PAGE.every((b, k) => bytes[j + k] === b) && bytes[j + 5] !== 0x73) n++;
  }
  return n;
}

async function defaultPrint(html: string): Promise<PdfFile> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Print = require('expo-print') as typeof import('expo-print');
  const r = await Print.printToFileAsync({ html, base64: false });
  return { uri: r.uri, pages: r.numberOfPages };
}

async function defaultShare(uri: string, title: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sharing = require('expo-sharing') as typeof import('expo-sharing');
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: title, UTI: 'com.adobe.pdf' });
}

async function defaultRename(uri: string, fileName: string): Promise<string> {
  const dest = new File(Paths.cache, fileName);
  if (dest.exists) dest.delete();
  await new File(uri).move(dest);
  return dest.uri;
}

/** Creates the PDF (named after the report) and returns its URI and page count; throws on any failure. */
export async function createPdf(html: string, fileName: string, deps: PdfDeps = {}): Promise<PdfFile> {
  const printed = await (deps.print ?? defaultPrint)(html);
  let uri = printed.uri;
  try {
    uri = await (deps.rename ?? defaultRename)(printed.uri, fileName);
  } catch {
    // Keep expo-print's own file name when the move fails; the PDF itself is fine.
  }
  let pages = printed.pages;
  try {
    const counted = countPdfPages(await (deps.readBytes ?? ((u: string) => new File(u).bytes()))(uri));
    if (counted > 0) pages = counted;
  } catch {
    // Unreadable file: the printer's figure stands rather than failing a PDF that exists.
  }
  return { uri, pages };
}

/** Hands a PDF to the system share sheet. */
export async function sharePdf(file: PdfFile, title: string, deps: PdfDeps = {}): Promise<void> {
  await (deps.share ?? defaultShare)(file.uri, title);
}
