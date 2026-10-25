// Today shell (A09). The F1 first value is real: "Your Moon: <sign> · <nakshatra>" from engine.computeChart for the
// self profile (N6), with the approx. tag when F2 applies. The good-hours band, daily note, upcoming strip and panchang
// sheet are A10's; until then the screen says so plainly instead of showing placeholder numbers.
import { StyleSheet, View } from 'react-native';
import { Card, EmptyState, ApproxTag, NoBreak, Screen, Txt } from '../../src/components';
import { chartFor, moonLine } from '../../src/engine-bridge/charts';
import { useLang } from '../../src/i18n';
import { useProfiles } from '../../src/profiles/useProfiles';

export default function TodayScreen() {
  const { t, lang } = useLang();
  const { self } = useProfiles();
  let moon: ReturnType<typeof moonLine> | null = null;
  let chartError = false;
  if (self) {
    try {
      moon = moonLine(chartFor(self), lang);
    } catch (e) {
      if (__DEV__) console.warn('chart failed', e);
      chartError = true;
    }
  }
  // The nakshatra + pada pair is a NoBreak run inside the sentence (N4): split the template around its placeholder.
  const MARK = '\u0000';
  const [before = '', after = ''] = moon ? t('today.yourMoon', { sign: moon.sign, nakshatra: MARK }).split(MARK) : ['', ''];
  return (
    <Screen title={t('today.title')} route="Today" testID="today-screen">
      {self && moon ? (
        <Card>
          <View style={styles.moonRow}>
            <Txt kind="heading" testID="today-moon-line">
              {before}
              <NoBreak kind="heading">{`${moon.nakshatra} ${moon.pada}`}</NoBreak>
              {after}
            </Txt>
            {moon.approx ? <ApproxTag minutes={self.timeApproxMinutes || undefined} /> : null}
          </View>
          {moon.moonChart ? (
            <Txt kind="caption" color="ink2">
              {t('charts.moonUnknownTime')}
            </Txt>
          ) : null}
        </Card>
      ) : null}
      {chartError ? (
        <Card>
          <Txt kind="body" color="accent">
            {t('errors.chart')}
          </Txt>
        </Card>
      ) : null}
      <EmptyState title={t('today.notYetTitle')} body={t('today.notYetBody')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  moonRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
});
