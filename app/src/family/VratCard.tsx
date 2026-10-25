// F22 vrat card (design.md 10.4, family.html): "Vrat · in N days" / the occurrence name / the computed time that
// matters (parana window, moonrise, pradosh kala, sunset-to-sunrise, nishita ...) with the place name, an On/Off switch
// that toggles the WHOLE family (all Ekadashis = one series) and a "What to do" row (corpus/vrats text in the resolved
// language) whose Why? carries the family's timing rule. Tapping the head opens the vrat detail screen.
import { lookup } from '@shubhvela/content';
import type { VratFamily, VratOccurrence } from '@shubhvela/engine';
import { StyleSheet, View } from 'react-native';
import { Card } from '../components/Card';
import { Pressable44 } from '../components/Pressable44';
import { Row } from '../components/Row';
import { Switch } from '../components/Switch';
import { Tag } from '../components/Tag';
import { Txt } from '../components/Txt';
import type { WhyInputValue } from '../components/WhySheet';
import { useLang, type Lang, type TFn } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { fmtCivilDate, fmtTimeOrDayTime, tithiName } from '../today/format';
import { RichText } from '../today/RichText';
import { daysUntil, inDaysText, tithiText, vratKeyTimeText, vratName } from './format';

export interface VratCardProps {
  family: VratFamily;
  occurrence: VratOccurrence;
  today: string;
  tz: string;
  placeName: string;
  enabled: boolean;
  notScheduled: boolean;
  onToggle: (next: boolean) => void;
  onOpen?: () => void;
  testID?: string;
}

export interface VratText {
  kind: string;
  title: string;
  detail: string;
  switchLabel: string;
  whatToDo: string | null;
  inputs: Record<string, WhyInputValue>;
}

/** Every string of a vrat card from the engine occurrence (exported for tests and the detail screen). */
export function vratText(family: VratFamily, o: VratOccurrence, today: string, tz: string, placeName: string, t: TFn, lang: Lang): VratText {
  const days = daysUntil(today, o.date);
  const when = inDaysText(t, days);
  const keyTime = vratKeyTimeText(t, o.keyTime, tz);
  const familyName = t(`vrat.family.${family}`);
  const tithi = tithiText(t, lang, o.month.purnimanta.index, o.month.purnimanta.adhik, o.paksha, o.tithi);
  const inputs: Record<string, WhyInputValue> = {
    [t('panchang.tithi')]: tithi,
    [t('vrat.tithiEnds')]: fmtTimeOrDayTime(o.tithiSpan.end, tz, lang, o.date),
    [t('vrat.keyTime')]: keyTime,
    [t('calendar.convention')]: o.convention,
    [t('today.yourLocation')]: placeName,
  };
  const ex = o.extra ?? {};
  if (typeof ex.vaishnavaDate === 'string' && ex.vaishnavaDate !== o.date) inputs[t('vrat.vaishnavaLabel')] = fmtCivilDate(ex.vaishnavaDate, lang);
  if (typeof ex.hariVasaraEnd === 'number') inputs[t('vrat.hariVasaraLabel')] = fmtTimeOrDayTime(ex.hariVasaraEnd, tz, lang, o.date);
  if (typeof ex.dwadashiEnd === 'number') inputs[t('vrat.dwadashiLabel')] = fmtTimeOrDayTime(ex.dwadashiEnd, tz, lang, o.date);
  if (typeof ex.day === 'number') inputs[t('vrat.family.navratri')] = t('vrat.navratriDay', { n: ex.day });
  if (typeof ex.nahayKhay === 'string') inputs[t('vrat.chhath.nahayKhay')] = fmtCivilDate(ex.nahayKhay, lang);
  if (typeof ex.kharna === 'string') inputs[t('vrat.chhath.kharna')] = fmtCivilDate(ex.kharna, lang);
  if (typeof ex.ushaArghya === 'string') inputs[t('vrat.chhath.ushaArghya')] = fmtCivilDate(ex.ushaArghya, lang);
  const dateLine = `${fmtCivilDate(o.date, lang)} · ${keyTime} · ${placeName}`;
  return {
    kind: `${t('upcoming.vrat')} · ${when}`,
    title: vratName(t, o.name),
    detail: `${dateLine} · ${tithiName(lang, o.tithi - 1 + (o.paksha === 'krishna' ? 15 : 0))} ${t('common.till', { time: fmtTimeOrDayTime(o.tithiSpan.end, tz, lang, o.date) })}`,
    switchLabel: t('events.reminderSwitchVrat', { family: familyName }),
    whatToDo: lookup('vrats', o.ruleId, lang)?.text ?? null,
    inputs,
  };
}

export function VratCard({ family, occurrence, today, tz, placeName, enabled, notScheduled, onToggle, onOpen, testID }: VratCardProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const text = vratText(family, occurrence, today, tz, placeName, t, lang);
  const head = (
    <View style={styles.headText}>
      <Txt kind="micro" color="ink3" style={styles.kind}>
        {text.kind}
      </Txt>
      <Txt kind="body" weight={600}>
        {text.title}
      </Txt>
      <RichText kind="label" weight={400} color="ink2" text={text.detail} />
      {notScheduled ? <Tag variant="kind">{t('events.notScheduled')}</Tag> : null}
    </View>
  );
  return (
    <Card testID={testID} accessibilityLabel={text.title}>
      <View style={[styles.head, { borderBottomColor: colors.hair }]}>
        {onOpen ? (
          <Pressable44 accessibilityLabel={`${text.title}: ${t('vrat.whatToDo')}`} onPress={onOpen} style={styles.open} pressedStyle={styles.pressed} testID={testID ? `${testID}-open` : undefined}>
            {head}
          </Pressable44>
        ) : (
          head
        )}
        <Switch value={enabled} onValueChange={onToggle} accessibilityLabel={text.switchLabel} testID={testID ? `${testID}-switch` : undefined} />
      </View>
      {text.whatToDo ? (
        <Row ruleId={occurrence.ruleId} text={text.whatToDo} inputs={text.inputs} glossary={[family.toLowerCase()]} divider={false}>
          <Txt kind="caption" color="ink2">
            <Txt kind="caption" weight={600} color="ink2">{`${t('vrat.whatToDo')}: `}</Txt>
            {text.whatToDo}
          </Txt>
        </Row>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  headText: { flex: 1, minWidth: 0, gap: 2, alignItems: 'flex-start' },
  open: { flex: 1, alignItems: 'stretch', justifyContent: 'flex-start' },
  pressed: { opacity: 0.85 },
  kind: { textTransform: 'uppercase', letterSpacing: 0.5 },
});
