// F20 "Today is <name>'s janma tithi" (design.md 10.2): shown above the note when any profile's janma tithi recurs
// today (engine tithiEventDates for the current year at the current place). A Row with ruleId 'janma-tithi' so the
// recurrence convention (udaya tithi, Adhik skipped) is one Why? away.
import { Card } from '../components/Card';
import { Latin } from '../components/Num';
import { Row } from '../components/Row';
import { Txt } from '../components/Txt';
import { useLang } from '../i18n';
import { fmtCivilDate, lunarMonthName, tithiName } from './format';
import type { TithiTodayRow as TithiTodayModel } from './model';

export interface TodayTithiRowProps {
  rows: readonly TithiTodayModel[];
  testID?: string;
}

const MARK = '\u0000';

export function TodayTithiRow({ rows, testID }: TodayTithiRowProps) {
  const { t, lang } = useLang();
  if (!rows.length) return null;
  return (
    <Card testID={testID}>
      {rows.map((r, i) => {
        const name = r.name ?? t('today.yourDayNoName');
        const [before = '', after = ''] = t('today.janmaTithiToday', { name: MARK }).split(MARK);
        const tithi = tithiName(lang, (r.params.tithi as number) - 1 + (r.params.paksha === 'krishna' ? 15 : 0));
        const month = lunarMonthName(lang, r.params.month as number, Boolean(r.params.adhik));
        const paksha = t(r.params.paksha === 'krishna' ? 'panchang.krishna' : 'panchang.shukla');
        const system = r.params.system === 'amanta' ? t('panchang.amanta') : t('panchang.purnimanta');
        const inputs = {
          [t('panchang.month')]: `${month} (${system})`,
          [t('panchang.tithi')]: `${paksha} ${tithi}`,
          [t('common.today')]: fmtCivilDate(String(r.params.date), lang),
          [t('events.whyDate')]: t('events.conventionLine', { convention: t(`events.convention.${r.params.convention as string}`), system }),
        };
        return (
          <Row key={r.profileId} ruleId={r.ruleId} text={`${before}${name}${after}`} inputs={inputs} glossary={['janma-tithi']} divider={i < rows.length - 1} testID={`tithi-today-${r.profileId}`}>
            <Txt kind="body">
              {before}
              <Latin kind="body">{name}</Latin>
              {after}
            </Txt>
          </Row>
        );
      })}
    </Card>
  );
}
