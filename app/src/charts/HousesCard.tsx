// Houses card (N6): 12 rows "House n · <sign>" with "Lord: <planet>" and the occupants, each with a Why? bound to the
// house-lord rule (inputs: house, sign, lord, occupants). Not rendered in Moon-chart mode (design 4: house lords are
// Lagna-dependent). Tapping the sentence opens the HouseSheet.
import type { ChartData } from '@shubhvela/engine';
import { StyleSheet, View } from 'react-native';
import { Card } from '../components/Card';
import { Pressable44 } from '../components/Pressable44';
import { Row } from '../components/Row';
import { Txt } from '../components/Txt';
import { useLang } from '../i18n';
import { planetName, signName } from './model';

export interface HousesCardProps {
  chart: ChartData;
  onPressHouse: (n: number) => void;
  testID?: string;
}

export function HousesCard({ chart, onPressHouse, testID }: HousesCardProps) {
  const { t, lang } = useLang();
  return (
    <Card testID={testID}>
      <Txt kind="heading" accessibilityRole="header">
        {t('charts.houses')}
      </Txt>
      <View style={styles.rows}>
        {chart.houses.map((h, i) => {
          const sign = signName(lang, h.sign);
          const lord = planetName(lang, h.lord);
          const occupants = h.occupants.length ? t('charts.houseOccupants', { planets: h.occupants.map((p) => planetName(lang, p)).join(', ') }) : t('charts.houseEmpty');
          const title = t('charts.houseRow', { n: h.n, sign });
          const caption = `${t('charts.houseLord', { planet: lord })} · ${occupants}`;
          return (
            <Row
              key={h.n}
              ruleId="house-lord"
              text={`${title}. ${caption}`}
              inputs={{ house: h.n, sign, lord, occupants: h.occupants.map((p) => planetName(lang, p)).join(', ') || t('common.none') }}
              glossary={['bhava', 'house-lord']}
              divider={i < chart.houses.length - 1}
              testID={`house-row-${h.n}`}
            >
              <Pressable44 accessibilityLabel={`${title}. ${caption}`} onPress={() => onPressHouse(h.n)} style={styles.text} testID={`house-open-${h.n}`}>
                <Txt kind="label" weight={600}>
                  {title}
                </Txt>
                <Txt kind="caption" color="ink2">
                  {caption}
                </Txt>
              </Pressable44>
            </Row>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  rows: { marginTop: 8 },
  text: { alignItems: 'flex-start', justifyContent: 'center', alignSelf: 'stretch' },
});
