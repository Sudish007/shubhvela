// Expanded segment list (design.md 10.2 / 6): "All 13 segments" expands in place; every row is a 44 dp tappable row
// with a chevron that opens the same Why? sheet as the Now line; EXACTLY ONE verdict chip per row, taken from the
// engine (the UI never classifies). A row whose own nature is overridden reads "Shubh choghadiya · overridden by
// Yamaganda" (chip avoid); a Chal segment partly lifted reads "<sub-range> lifted by Abhijit" (chip neutral); Bhadra and
// Panchak appear as text "flag: …" on the affected rows. Tonight lists the night choghadiya; the hora grid closes
// the list (night cells indigo-tint). Brahma muhurat is the 13th day row ("before next sunrise").
import type { GoodHours, GoodHoursSegment, HoraSlot } from '@shubhvela/engine';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ChevronIcon } from '../components/icons';
import { Num } from '../components/Num';
import { Pressable44 } from '../components/Pressable44';
import { Tag } from '../components/Tag';
import { Txt } from '../components/Txt';
import { WhySheet, type WhyInputValue } from '../components/WhySheet';
import { useLang, type Lang, type TFn } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { fmtRange, fmtTime, fmtTimeOrDayTime, glueRanges, planetName, segmentName, segmentNameById, verdictTag, weekdayName } from './format';
import { RichText } from './RichText';

export interface SegmentListProps {
  gh: GoodHours;
  nowMs: number;
  testID?: string;
}

/** The 13 named daytime segments (Rahu Kaal, Yamaganda, Gulika, Abhijit, 8 choghadiya) + Brahma muhurat, in start order. */
export function dayRows(gh: Pick<GoodHours, 'segments'>): GoodHoursSegment[] {
  const rows = gh.segments.filter((s) => !s.night || s.kind === 'brahma');
  return rows.sort((a, b) => (a.kind === 'brahma' ? 1 : 0) - (b.kind === 'brahma' ? 1 : 0) || a.start - b.start || a.end - b.end);
}

/** The night choghadiya ("Tonight"). */
export function nightRows(gh: Pick<GoodHours, 'segments'>): GoodHoursSegment[] {
  return gh.segments.filter((s) => s.night && s.kind === 'choghadiya').sort((a, b) => a.start - b.start);
}

/** The micro notes under a row title: overridden / lifted / includes / flags / before-next-sunrise. */
export function rowNotes(seg: GoodHoursSegment, gh: GoodHours, t: TFn, lang: Lang): string[] {
  const tz = gh.tz;
  const notes: string[] = [];
  if (seg.kind === 'brahma') notes.push(t('today.beforeNextSunrise'));
  if (seg.overriddenBy?.length) notes.push(t('today.overriddenBy', { name: seg.overriddenBy.map((id) => segmentNameById(t, gh, id)).join(', ') }));
  for (const p of seg.parts ?? []) {
    if (p.kind === 'lifted') notes.push(t('today.liftedBy', { from: fmtTime(p.start, tz), to: fmtTime(p.end, tz), name: p.by.map((id) => segmentNameById(t, gh, id)).join(', ') }));
    if (p.kind === 'overridden') notes.push(`${fmtRange(p.start, p.end, tz)} ${t('today.overriddenBy', { name: p.by.map((id) => segmentNameById(t, gh, id)).join(', ') })}`);
  }
  if (seg.liftedBy?.length && !seg.parts?.some((p) => p.kind === 'own')) notes.push(t('today.liftedBy', { from: fmtTime(seg.start, tz), to: fmtTime(seg.end, tz), name: seg.liftedBy.map((id) => segmentNameById(t, gh, id)).join(', ') }));
  for (const id of seg.includes ?? []) {
    const inc = gh.segments.find((s) => s.id === id);
    if (inc) notes.push(t('today.includes', { name: segmentName(t, inc), from: fmtTime(inc.start, tz), to: fmtTime(inc.end, tz) }));
  }
  for (const f of seg.flags) {
    const name = t(`band.${f}`);
    const win = f === 'bhadra' ? gh.flags.bhadra : gh.flags.panchak;
    if (!win) notes.push(t('today.flagPlain', { flag: name }));
    else if (win.start > seg.start) notes.push(t('today.flagFrom', { flag: name, time: fmtTimeOrDayTime(win.start, tz, lang, gh.day) }));
    else if (win.end < seg.end) notes.push(t('today.flagTill', { flag: name, time: fmtTimeOrDayTime(win.end, tz, lang, gh.day) }));
    else notes.push(t('today.flagPlain', { flag: name }));
  }
  // "{from}–{to} lifted by …" and "includes … {from}–{to}" carry ranges inside prose: glue them (N4).
  return notes.map(glueRanges);
}

/** Why? inputs of a segment row: weekday, sunrise/sunset, its own range, its slot number, what changed its verdict. */
export function segmentInputsFor(seg: GoodHoursSegment, gh: GoodHours, t: TFn, lang: Lang): Record<string, WhyInputValue> {
  const tz = gh.tz;
  const ticks = gh.ticks;
  const out: Record<string, WhyInputValue> = {
    [t('today.segment')]: segmentName(t, seg),
    [t('today.timeRange')]: `${fmtTime(seg.start, tz)}–${fmtTime(seg.end, tz)}`,
    [t('panchang.vara')]: weekdayName(lang, gh.vara),
    [t('band.sunrise')]: ticks ? fmtTime(ticks.sunrise, tz) : null,
    [t('band.sunset')]: ticks ? fmtTime(ticks.sunset, tz) : null,
  };
  if (seg.overriddenBy?.length) out[t('today.overriddenBy', { name: '' }).trim()] = seg.overriddenBy.map((id) => segmentNameById(t, gh, id)).join(', ');
  if (seg.flags.length) out[t('today.flags')] = seg.flags.map((f) => t(`band.${f}`)).join(', ');
  return out;
}

function SegmentRow({ seg, gh, bare, onPress }: { seg: GoodHoursSegment; gh: GoodHours; bare: boolean; onPress: () => void }) {
  const { colors } = useTokens();
  const { t, lang } = useLang();
  const title = segmentName(t, seg, bare);
  const notes = rowNotes(seg, gh, t, lang);
  const range = fmtRange(seg.start, seg.end, gh.tz);
  const chip = verdictTag(t, seg.verdict);
  return (
    <Pressable44
      accessibilityLabel={`${title}, ${range}, ${chip}${notes.length ? `, ${notes.join(', ')}` : ''}`}
      onPress={onPress}
      style={[styles.row, { borderTopColor: colors.hair }]}
      testID={`segment-row-${seg.id}`}
    >
      <View style={styles.rowText}>
        <Txt kind="label" weight={400}>
          {title}
        </Txt>
        {notes.map((n, i) => (
          <RichText key={i} kind="micro" color="ink3" text={n} />
        ))}
      </View>
      <View style={styles.rowRight}>
        <Num kind="caption" color="ink3">
          {range}
        </Num>
        <Tag variant="kind" style={[styles.chip, seg.verdict === 'avoid' ? styles.chipAvoid : null, seg.verdict === 'good' ? { borderColor: colors.good } : null]} accessibilityLabel={chip}>
          <Txt kind="micro" weight={600} color="ink2" testID="verdict-chip">
            {chip}
          </Txt>
        </Tag>
      </View>
      <ChevronIcon color={colors.accent} size={20} />
    </Pressable44>
  );
}

function HoraGrid({ gh, nowMs }: { gh: GoodHours; nowMs: number }) {
  const { colors } = useTokens();
  const { t, lang } = useLang();
  const cells: HoraSlot[] = gh.hora;
  return (
    <View style={styles.hora} accessibilityRole="list">
      {cells.map((h) => {
        const now = h.start <= nowMs && nowMs < h.end;
        const text = t(now ? 'today.horaNow' : 'today.horaCell', { time: fmtTime(h.start, gh.tz), planet: planetName(lang, h.lord) });
        return (
          <View key={h.n} style={[styles.horaCell, { borderTopColor: colors.hair, backgroundColor: h.night ? colors.indigoTint : 'transparent' }]} testID={`hora-${h.n}`}>
            <RichText kind="caption" weight={now ? 600 : 400} color={now ? 'accent' : 'ink2'} text={text} />
          </View>
        );
      })}
    </View>
  );
}

export function SegmentList({ gh, nowMs, testID }: SegmentListProps) {
  const { colors } = useTokens();
  const { t, lang } = useLang();
  const [open, setOpen] = useState<GoodHoursSegment | null>(null);
  const day = dayRows(gh);
  const night = nightRows(gh);
  return (
    <View testID={testID} style={[styles.root, { borderTopColor: colors.hair }]}>
      <Txt kind="caption" weight={600} color="ink3" style={styles.h3}>
        {t('today.daySegments', { count: day.length })}
      </Txt>
      {day.map((seg) => (
        <SegmentRow key={seg.id} seg={seg} gh={gh} bare={false} onPress={() => setOpen(seg)} />
      ))}
      <Txt kind="caption" weight={600} color="ink3" style={styles.h3}>
        {t('today.tonight')}
      </Txt>
      {night.map((seg) => (
        <SegmentRow key={seg.id} seg={seg} gh={gh} bare onPress={() => setOpen(seg)} />
      ))}
      <Txt kind="caption" weight={600} color="ink3" style={styles.h3}>
        {t('today.horaTitle', { weekday: weekdayName(lang, gh.vara) })}
      </Txt>
      <HoraGrid gh={gh} nowMs={nowMs} />
      <Txt kind="caption" color="ink3" style={styles.footer}>
        {t('today.segmentsFooter')}
      </Txt>
      {open ? (
        <WhySheet
          ruleId={open.ruleId}
          title={segmentName(t, open)}
          inputs={segmentInputsFor(open, gh, t, lang)}
          glossary={open.kind === 'brahma' ? ['brahma-muhurta'] : open.kind === 'choghadiya' ? ['choghadiya'] : []}
          visible
          onClose={() => setOpen(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, alignSelf: 'stretch' },
  h3: { textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, alignSelf: 'stretch', justifyContent: 'flex-start' },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  chip: { alignSelf: 'flex-end' },
  chipAvoid: { borderStyle: 'dashed' },
  hora: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
  horaCell: { width: '48%', paddingVertical: 3, paddingHorizontal: 4, borderTopWidth: StyleSheet.hairlineWidth },
  footer: { marginTop: 8 },
});
