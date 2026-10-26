// "Beyond gun milan" (design.md 10.6 F29): four rows - 7th house lords, Venus, Moon-sign relationship, dasha overlap
// over the next five years - each a tone WORD (harmonious / mixed / challenging, never a score) with a Why? carrying
// the engine inputs; an approx tag when a Lagna-based row was read from the Moon chart. The overlap periods are listed
// under the dasha row (first five, "All N periods" expands).
import type { BeyondGunMilanReport, BeyondRow, DashaOverlap } from '@shubhvela/engine';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { TextButton } from '../components/Button';
import { Row } from '../components/Row';
import { ApproxTag } from '../components/Tag';
import { Txt } from '../components/Txt';
import { useLang, type Lang, type TFn } from '../i18n';
import { fmtDate, planetName, signName } from '../today/format';
import type { ResolvedSide } from './model';

export interface BeyondSectionProps {
  beyond: BeyondGunMilanReport;
  a: ResolvedSide;
  b: ResolvedSide;
  testID?: string;
}

const TITLE_KEY: Record<BeyondRow['id'], string> = {
  'seventh-lords': 'match.beyond.seventhLords',
  venus: 'match.beyond.venus',
  'moon-sign-relation': 'match.beyond.moonSignRelation',
  'dasha-overlap': 'match.beyond.dashaOverlap',
};

type PlanetArg = Parameters<typeof planetName>[1];

/** Display form of a row's params: planet ids and sign numbers become names; relations and dignities stay words. */
export function beyondInputs(row: BeyondRow, t: TFn, lang: Lang): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(row.params)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      out[k] = v.join(', ');
      continue;
    }
    if (/Sign$/.test(k) && typeof v === 'number') out[k] = signName(lang, v);
    else if (/Lord$|MahaNow$/.test(k) && typeof v === 'string') out[k] = planetName(lang, v as PlanetArg);
    else out[k] = v;
  }
  return out;
}

export function overlapLine(o: DashaOverlap, tz: string, t: TFn, lang: Lang): string {
  return t('match.overlapLine', {
    from: fmtDate(o.start, tz, lang),
    to: fmtDate(o.end, tz, lang),
    aMaha: planetName(lang, o.aMaha as PlanetArg),
    aAntar: planetName(lang, o.aAntar as PlanetArg),
    bMaha: planetName(lang, o.bMaha as PlanetArg),
    bAntar: planetName(lang, o.bAntar as PlanetArg),
  });
}

const FIRST = 5;

export function BeyondSection({ beyond, a, b, testID }: BeyondSectionProps) {
  const { t, lang } = useLang();
  const [all, setAll] = useState(false);
  const tz = a.chart.meta.tz;
  const overlaps = all ? beyond.dashaOverlaps : beyond.dashaOverlaps.slice(0, FIRST);
  return (
    <View testID={testID} style={styles.section}>
      <Txt kind="heading" accessibilityRole="header">
        {t('match.beyondTitle')}
      </Txt>
      <Txt kind="caption" color="ink3">
        {t('match.beyondNote')}
      </Txt>
      {beyond.rows.map((row, i) => {
        const text = `${t(TITLE_KEY[row.id])}: ${t(`match.tone.${row.tone}`)}`;
        return (
          <Row key={row.id} ruleId={row.ruleId} text={text} inputs={{ ...beyondInputs(row, t, lang), ...(row.id === 'seventh-lords' ? { A: a.label, B: b.label } : {}) }} divider={i < beyond.rows.length - 1} testID={`beyond-${row.id}`}>
            <View style={styles.head}>
              <Txt kind="body" style={styles.flex}>
                {text}
              </Txt>
              {row.approx ? <ApproxTag /> : null}
            </View>
            {row.id === 'dasha-overlap' ? (
              <View style={styles.overlaps}>
                {overlaps.map((o, j) => (
                  <Txt key={`${o.start}-${j}`} kind="caption" color="ink2" testID={`overlap-${j}`}>
                    {overlapLine(o, tz, t, lang)}
                  </Txt>
                ))}
                {beyond.dashaOverlaps.length > FIRST ? (
                  <TextButton label={all ? t('match.fewerOverlaps') : t('match.allOverlaps', { n: beyond.dashaOverlaps.length })} onPress={() => setAll((v) => !v)} style={styles.more} testID="overlaps-toggle" />
                ) : null}
              </View>
            ) : null}
          </Row>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 4 },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  flex: { flexShrink: 1 },
  overlaps: { marginTop: 4, gap: 2 },
  more: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
