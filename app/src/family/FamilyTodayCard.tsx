// F24 Family Today (design.md 10.4): card at the top of Family with one Row per profile: "Name · Moon Nth from natal
// Moon · Tara: X" and a one-line note (the corpus Chandra bala fragment, which states Chandrashtama plainly: "routine
// tasks today, new starts tomorrow"), each with "Why?" (ruleId family-today, inputs = the engine params). Every value is
// engine.familyToday output for the shown day at the observer's place.
import { interpolate, lookup } from '@shubhvela/content';
import type { FamilyTodayRow } from '@shubhvela/engine';
import { StyleSheet, View } from 'react-native';
import { Card } from '../components/Card';
import { Latin } from '../components/Num';
import { Row } from '../components/Row';
import { Txt } from '../components/Txt';
import type { WhyInputValue } from '../components/WhySheet';
import { useLang, type Lang, type TFn } from '../i18n';
import { fmtTime, nakshatraName, ordinal, signName } from '../today/format';
import { RichText } from '../today/RichText';

export interface FamilyTodayCardProps {
  rows: readonly FamilyTodayRow[];
  tz: string;
  /** Transit Moon sign (1-12) for the card caption. */
  moonSign?: number;
  /** Profile id of the self profile: its note keeps the second person, other members get the third-person fragment. */
  selfId?: string;
  testID?: string;
}

/** Head line of a row: profile name, Moon house from the natal Moon, tara name (engine params only). */
export function familyTodayHead(row: FamilyTodayRow, t: TFn, lang: Lang): { name: string; rest: string } {
  const p = row.params;
  const name = row.name ?? t('today.yourDayNoName');
  const house = ordinal(p.house as number, lang);
  const tara = t(`note.tara.${p.taraKey as string}`);
  const MARK = '\u0000';
  const line = t('family.todayLine', { name: MARK, house, tara });
  const [, rest = ''] = line.split(MARK);
  return { name, rest };
}

/**
 * One-line note: the corpus Chandra bala fragment of the row (chandra-bala-<house>), interpolated. The `daily` fragments
 * speak to the reader ("your birth Moon"); for another member with a name the third-person `daily-third` variant
 * (carry-over B-REVIEW-MEDIUM-2, same ids, `{name}`) is used, falling back to the second-person text when absent.
 */
export function familyTodayNote(row: FamilyTodayRow, lang: Lang, isSelf = true): string | null {
  const key = row.keys.find((k) => k.startsWith('chandra-bala-'));
  if (!key) return null;
  const third = !isSelf && row.name ? lookup('daily-third', key, lang)?.text : undefined;
  const text = third ?? lookup('daily', key, lang)?.text;
  if (!text) return null;
  const params: Record<string, string | number | boolean | null | undefined> = {};
  for (const [k, v] of Object.entries(row.params)) if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') params[k] = v;
  return interpolate(text, params);
}

export function familyTodayInputs(row: FamilyTodayRow, tz: string, t: TFn, lang: Lang): Record<string, WhyInputValue> {
  const p = row.params;
  const out: Record<string, WhyInputValue> = {
    [t('note.row.family-today')]: row.name ?? t('today.yourDayNoName'),
    natalMoonSign: typeof p.natalMoonSign === 'number' ? signName(lang, p.natalMoonSign) : null,
    transitMoonSign: typeof p.transitMoonSign === 'number' ? signName(lang, p.transitMoonSign) : null,
    house: typeof p.house === 'number' ? ordinal(p.house, lang) : null,
    chandrashtama: p.chandrashtama ? t('common.yes') : t('common.no'),
    moonSignEndsAt: typeof p.moonSignEndsAt === 'number' ? fmtTime(p.moonSignEndsAt, tz) : null,
    natalNakshatra: typeof p.natalNakshatra === 'number' ? nakshatraName(lang, p.natalNakshatra) : null,
    dayNakshatra: typeof p.dayNakshatra === 'number' ? nakshatraName(lang, p.dayNakshatra) : null,
    tara: typeof p.taraKey === 'string' ? t(`note.tara.${p.taraKey}`) : null,
    nakshatraEndsAt: typeof p.nakshatraEndsAt === 'number' ? fmtTime(p.nakshatraEndsAt, tz) : null,
  };
  return out;
}

export function FamilyTodayCard({ rows, tz, moonSign, selfId, testID }: FamilyTodayCardProps) {
  const { t, lang } = useLang();
  return (
    <Card testID={testID}>
      <View style={styles.head}>
        <Txt kind="heading" accessibilityRole="header">
          {t('family.familyToday')}
        </Txt>
        {moonSign ? (
          <Txt kind="caption" color="ink3">
            {t('panchang.moonIn', { sign: signName(lang, moonSign) })}
          </Txt>
        ) : null}
      </View>
      {rows.length === 0 ? (
        <Txt kind="body" color="ink2">
          {t('family.noMembers')}
        </Txt>
      ) : (
        rows.map((row, i) => {
          const head = familyTodayHead(row, t, lang);
          const note = familyTodayNote(row, lang, selfId === undefined || row.profileId === selfId);
          const plain = `${head.name}${head.rest}`;
          return (
            <Row
              key={row.profileId}
              ruleId={row.ruleId}
              text={plain}
              inputs={familyTodayInputs(row, tz, t, lang)}
              glossary={row.keys.filter((k) => k === 'chandra-bala-8').map(() => 'chandrashtama')}
              divider={i < rows.length - 1}
              caption={note ? <RichText kind="caption" color="ink2" text={note} /> : undefined}
              testID={`family-today-${row.profileId}`}
            >
              <Txt kind="body">
                <Latin kind="body" weight={600}>
                  {head.name}
                </Latin>
                <RichText kind="body" text={head.rest} />
              </Txt>
            </Row>
          );
        })
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4 },
});
