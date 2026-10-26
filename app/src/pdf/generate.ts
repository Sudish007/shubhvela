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
  return { uri, pages: printed.pages };
}

/** Hands a PDF to the system share sheet. */
export async function sharePdf(file: PdfFile, title: string, deps: PdfDeps = {}): Promise<void> {
  await (deps.share ?? defaultShare)(file.uri, title);
}
