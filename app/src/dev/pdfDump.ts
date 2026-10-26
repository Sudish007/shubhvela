// Screenshot-build dev action (plan B07 findings for B08): `shubhvela://dev/state?sample=1&pdf_dump=1` builds the
// three reports for the seeded household (Janam Patri for Priya, Matching Priya x Amma, Varshaphal for Priya's next
// year), prints each to a PDF with the SAME pipeline the preview uses and writes the HTML beside it in the cache
// directory, so B08 can `adb pull` the files and check page counts and sizes. Never compiled into behaviour outside
// the dev route; nothing here is shown to a user.
import { File, Paths } from 'expo-file-system';
import { listProfiles } from '../db/profiles';
import { getSetting } from '../db/settings';
import { chartFor, vedicYearAt } from '../engine-bridge/charts';
import { makeT, type Lang } from '../i18n';
import { fontCssFor } from '../pdf/fonts';
import { createPdf } from '../pdf/generate';
import { buildReport, type ReportParams } from '../pdf/report';

export interface DumpResult {
  kind: string;
  pdf: string;
  html: string;
  pages: number;
  sections: readonly string[];
}

/** Report params for the seeded household (self + the second profile). */
export function dumpParams(nowMs: number): ReportParams[] {
  const profiles = listProfiles();
  const self = profiles.find((p) => p.isSelf) ?? profiles[0];
  if (!self) return [];
  const other = profiles.find((p) => p.id !== self.id);
  const out: ReportParams[] = [{ kind: 'janam_patri', profileId: self.id }];
  if (other) out.push({ kind: 'matching', a: { kind: 'profile', id: self.id }, b: { kind: 'profile', id: other.id } });
  out.push({ kind: 'varshaphal', profileId: self.id, year: vedicYearAt(chartFor(self), nowMs).nextYear });
  return out;
}

export async function dumpReports(uiLang: Lang, nowMs = Date.now()): Promise<DumpResult[]> {
  const t = makeT(uiLang);
  const profiles = listProfiles();
  const style = getSetting('chartStyle');
  const results: DumpResult[] = [];
  for (const params of dumpParams(nowMs)) {
    const probe = buildReport(params, { profiles, t, uiLang, style, fontCss: '', nowMs });
    const fontCss = await fontCssFor(probe.lang);
    const built = buildReport(params, { profiles, t, uiLang, style, fontCss, nowMs });
    const html = new File(Paths.cache, `dump-${built.kind}.html`);
    if (html.exists) html.delete();
    await html.write(built.html);
    const pdf = await createPdf(built.html, `dump-${built.kind}.pdf`);
    results.push({ kind: built.kind, pdf: pdf.uri, html: html.uri, pages: pdf.pages, sections: built.sections });
  }
  return results;
}
