// Event cards for tithi birthdays (F20) and shraddha / barsi (F21), design.md 10.4 and family.html: a micro kind label
// ("Tithi birthday · Mother · in 6 days" - the relationship lives here, N5), the title (profile or ancestor name), the
// tabular detail line (tithi text · date · Nth year; barsi cards add the Pitru Paksha day), the On/Off series Switch and
// a "Why?" row for the recurrence rule (month system, Adhik rule, kshaya rule). A "not scheduled" tag appears when the
// OS refused the series' notifications in the last re-plan. Every value is engine output.
import { StyleSheet, View } from 'react-native';
import { Card } from '../components/Card';
import { Latin } from '../components/Num';
import { Pressable44 } from '../components/Pressable44';
import { Row } from '../components/Row';
import { Switch } from '../components/Switch';
import { Tag } from '../components/Tag';
import { Txt } from '../components/Txt';
import type { WhyInputValue } from '../components/WhySheet';
import { useLang, type Lang, type TFn } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { fmtCivilDate, lunarMonthName } from '../today/format';
import { RichText } from '../today/RichText';
import { daysUntil, inDaysText, systemName, tithiText } from './format';
import type { FamilyEvent } from './model';

export interface EventCardProps {
  event: FamilyEvent;
  /** Civil date of today at the observer's place. */
  today: string;
  enabled: boolean;
  notScheduled: boolean;
  onToggle: (next: boolean) => void;
  onOpen?: () => void;
  testID?: string;
}

export interface EventCardText {
  kind: string;
  title: string;
  detail: string;
  switchLabel: string;
  note: string;
  inputs: Record<string, WhyInputValue>;
}

/** Every string of a tithi-birthday / barsi card from the engine facts (exported for tests). */
export function eventCardText(e: FamilyEvent, today: string, t: TFn, lang: Lang): EventCardText {
  const days = daysUntil(today, e.date);
  const when = inDaysText(t, days);
  const tithi = e.tithi ? tithiText(t, lang, e.tithi.month, e.tithi.adhik, e.tithi.paksha, e.tithi.tithi) : '';
  const system = e.tithi ? systemName(t, e.tithi.system) : '';
  const date = fmtCivilDate(e.date, lang);
  const conventionKey = e.convention.startsWith('aparahna') ? 'aparahna' : e.convention.endsWith('begin-day') ? 'begin' : 'udaya';
  const inputs: Record<string, WhyInputValue> = {
    [t('panchang.tithi')]: tithi,
    [t('panchang.month')]: system,
    [t('events.whyDate')]: t('events.conventionLine', { convention: t(`events.convention.${conventionKey}`), system }),
    [t('calendar.convention')]: e.convention,
    [t('common.today')]: fmtCivilDate(today, lang),
  };
  if (e.kind === 'tithi_birthday' && e.profile) {
    const p = e.profile;
    const relation = p.isSelf ? t('family.relation.self') : t(`family.relation.${p.relationship}`);
    const name = p.name ?? relation;
    const dateLine = typeof e.nth === 'number' ? t('events.dateYear', { date, n: e.nth }) : date;
    if (e.tithi?.adhik) inputs[t('events.adhikLabel')] = t('events.adhikNote', { month: lunarMonthName(lang, e.tithi.month, false) });
    if (e.convention.endsWith('begin-day')) inputs[t('events.kshayaLabel')] = t('events.kshayaNote');
    return {
      kind: `${t('family.tithiBirthday')} · ${relation} · ${when}`,
      title: t('events.janmaTithiOf', { name }),
      detail: `${tithi} · ${dateLine}`,
      switchLabel: t('events.reminderSwitchFor', { name }),
      note: t('events.recurrenceNote', { system }),
      inputs,
    };
  }
  const a = e.ancestor!;
  const relation = t(`family.relation.${a.relation}`);
  const dateLine = typeof e.nth === 'number' ? t('events.dateYear', { date, n: e.nth }) : date;
  let pitru = '';
  if (e.pitruPakshaDay) {
    const pDate = fmtCivilDate(e.pitruPakshaDay, lang);
    pitru = e.pitruPakshaDay < today ? t('events.pitruPakshaDayPassed', { date: pDate }) : t('family.pitruPakshaDay', { date: pDate });
    inputs[t('events.pitruPaksha')] = pDate;
  }
  return {
    kind: `${t('events.shraddhaKind')} · ${when}`,
    title: t('events.ancestorNameRelation', { name: a.name, relation }),
    detail: pitru ? `${tithi} · ${dateLine} · ${pitru}` : `${tithi} · ${dateLine}`,
    switchLabel: t('events.reminderSwitchBarsi', { name: a.name }),
    note: t('events.barsiNote'),
    inputs,
  };
}

export function EventCard({ event, today, enabled, notScheduled, onToggle, onOpen, testID }: EventCardProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const text = eventCardText(event, today, t, lang);
  const head = (
    <View style={styles.headText}>
      <Txt kind="micro" color="ink3" style={styles.kind}>
        {text.kind}
      </Txt>
      <Txt kind="body" weight={600}>
        <Latin kind="body" weight={600}>
          {text.title}
        </Latin>
      </Txt>
      <RichText kind="label" weight={400} color="ink2" text={text.detail} />
      {notScheduled ? <Tag variant="kind">{t('events.notScheduled')}</Tag> : null}
    </View>
  );
  return (
    <Card testID={testID} accessibilityLabel={text.title}>
      <View style={[styles.head, { borderBottomColor: colors.hair }]}>
        {onOpen ? (
          <Pressable44 accessibilityLabel={`${t('common.edit')}: ${text.title}`} onPress={onOpen} style={styles.open} pressedStyle={styles.pressed} testID={testID ? `${testID}-open` : undefined}>
            {head}
          </Pressable44>
        ) : (
          head
        )}
        <Switch value={enabled} onValueChange={onToggle} accessibilityLabel={text.switchLabel} testID={testID ? `${testID}-switch` : undefined} />
      </View>
      <Row ruleId={event.ruleId} text={text.note} inputs={text.inputs} glossary={['tithi', 'adhik-maas', 'kshaya-tithi']} divider={false}>
        <Txt kind="caption" color="ink2">
          {text.note}
        </Txt>
      </Row>
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
