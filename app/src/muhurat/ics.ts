// .ics export (F26 ".ics Pro", design.md 10.5): engine.toIcs() writes one VEVENT with the rule summary; the file goes
// to the cache directory and out through the system share sheet (expo-sharing). The caller gates on entitlements
// (isPro) - this module never decides the tier.
import { toIcs, type MuhuratRuleId, type MuhuratWindow } from '@shubhvela/engine';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Lang, TFn } from '../i18n';

export interface IcsExportDeps {
  /** Writes the text and returns a file URI (default: expo-file-system cache). */
  writeFile?: (name: string, text: string) => Promise<string>;
  /** Hands the URI to the share sheet (default: expo-sharing). */
  share?: (uri: string) => Promise<void>;
  nowMs?: number;
}

const RULE_IDS: readonly MuhuratRuleId[] = ['tithi', 'nakshatra', 'vara', 'chandra-bala', 'tara-bala', 'rahu-kaal', 'bhadra', 'panchak', 'abhijit', 'choghadiya'];

/** Rule labels in the UI language for the VEVENT description. */
export function icsRuleLabels(t: TFn): Record<MuhuratRuleId, string> {
  return Object.fromEntries(RULE_IDS.map((id) => [id, t(`muhurat.rule.${id}`)])) as Record<MuhuratRuleId, string>;
}

/** File name "muhurat-<activity>-<yyyymmdd>-<hhmm>.ics" (UTC parts of the start). */
export function icsFileName(w: MuhuratWindow): string {
  const d = new Date(w.start);
  const p = (n: number): string => (n < 10 ? `0${n}` : String(n));
  return `muhurat-${w.activity}-${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}.ics`;
}

/** The VCALENDAR text of a window (pure; tested without the file system). */
export function icsText(w: MuhuratWindow, lang: Lang, t: TFn, tz: string, place: string | null, nowMs?: number): string {
  return toIcs(w, { lang, ruleLabels: icsRuleLabels(t), tz, place: place ?? undefined, nowMs });
}

async function defaultWrite(name: string, text: string): Promise<string> {
  const file = new File(Paths.cache, name);
  if (!file.exists) file.create();
  await file.write(text);
  return file.uri;
}

async function defaultShare(uri: string): Promise<void> {
  await Sharing.shareAsync(uri, { mimeType: 'text/calendar', dialogTitle: 'muhurat.ics', UTI: 'public.calendar-event' });
}

/** Writes and shares the .ics of a window; returns the file URI. */
export async function exportIcs(w: MuhuratWindow, lang: Lang, t: TFn, tz: string, place: string | null, deps: IcsExportDeps = {}): Promise<string> {
  const text = icsText(w, lang, t, tz, place, deps.nowMs);
  const uri = await (deps.writeFile ?? defaultWrite)(icsFileName(w), text);
  await (deps.share ?? defaultShare)(uri);
  return uri;
}
