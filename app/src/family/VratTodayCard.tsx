// F22 "vrat today" card on Today (today.html, design.md 3): one row per occurrence of an ENABLED vrat family falling on
// the shown day: "<name> today" with the computed time that matters and a "What to do" control that opens the vrat
// detail. Rendered only when such an occurrence exists (quiet by default: families the user never switched on do not
// appear). Every time is engine output at the Today observer.
import type { VratOccurrence } from '@shubhvela/engine';
import { useRouter } from 'expo-router';
import { Card } from '../components/Card';
import { Row } from '../components/Row';
import { SecondaryButton } from '../components/Button';
import { Txt } from '../components/Txt';
import { useLang } from '../i18n';
import { RichText } from '../today/RichText';
import { vratKeyTimeText, vratName } from './format';

export interface VratTodayCardProps {
  occurrences: readonly VratOccurrence[];
  tz: string;
  placeName: string;
  testID?: string;
}

export function VratTodayCard({ occurrences, tz, placeName, testID }: VratTodayCardProps) {
  const { t } = useLang();
  const router = useRouter();
  if (!occurrences.length) return null;
  return (
    <Card testID={testID}>
      {occurrences.map((o, i) => {
        const title = t('today.vratToday', { name: vratName(t, o.name) });
        const detail = `${vratKeyTimeText(t, o.keyTime, tz)} · ${placeName}`;
        return (
          <Row
            key={`${o.family}-${o.date}`}
            ruleId={o.ruleId}
            text={title}
            divider={i < occurrences.length - 1}
            caption={<RichText kind="caption" color="ink2" text={detail} />}
            control={<SecondaryButton label={t('today.whatToDo')} onPress={() => router.push(`/family/vrat/${o.family}`)} testID={`vrat-today-open-${o.family}`} />}
            testID={`vrat-today-${o.family}`}
          >
            <Txt kind="body" weight={600}>
              {title}
            </Txt>
          </Row>
        );
      })}
    </Card>
  );
}
