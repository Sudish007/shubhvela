// Settings -> About: version + versionCode (from app.json via expo-constants), the "screenshot build" tag when
// EXPO_PUBLIC_SCREENSHOT_MODE=1 (P12), what the app is, licences incl. GeoNames CC BY 4.0 (P16), links, and the
// "How this was computed" defaults from the F19 settings.
import { EPHEMERIS, MEAN_NODE_METHOD, TRUE_NODE_METHOD } from '@shubhvela/engine';
import { Linking, StyleSheet, View } from 'react-native';
import { Card, ComputedFooter, Screen, Tag, TextButton, Txt } from '../../src/components';
import { getSelfProfile } from '../../src/db/profiles';
import { getSetting } from '../../src/db/settings';
import { useLang } from '../../src/i18n';
import { appVersion, isScreenshotBuild, SOURCE_URL, versionCode, webBase } from '../../src/legal';
import { AYANAMSA_KEY, shortValue } from '../../src/settingsLabels';

export default function AboutScreen() {
  const { t } = useLang();
  const ayanamsa = getSetting('ayanamsa');
  const node = getSetting('node');
  const tz = getSelfProfile()?.tz ?? 'Asia/Kolkata';
  return (
    <Screen title={t('about.title')} chrome="stack" testID="about-screen">
      <Card>
        <View style={styles.block}>
          <View style={styles.row}>
            <Txt kind="heading">{t('common.appName')}</Txt>
            {isScreenshotBuild() ? <Tag variant="kind">{t('about.screenshotBuild')}</Tag> : null}
          </View>
          <Txt kind="body" color="ink2" latin tabular>
            {t('about.version', { version: appVersion(), build: versionCode() })}
          </Txt>
          <Txt kind="body">{t('about.whatItIs')}</Txt>
          <Txt kind="caption" color="ink2">
            {t('about.engine')}
          </Txt>
        </View>
      </Card>
      <Card>
        <View style={styles.block}>
          <Txt kind="heading">{t('about.licences')}</Txt>
          <Txt kind="body" color="ink2">
            {t('about.licenceList')}
          </Txt>
          <Txt kind="caption" color="ink3">
            {t('about.geonames')}
          </Txt>
        </View>
      </Card>
      <Card>
        <View style={styles.block}>
          <TextButton label={t('about.website')} onPress={() => Linking.openURL(webBase())} />
          <TextButton label={t('about.sourceCode')} onPress={() => Linking.openURL(SOURCE_URL)} />
        </View>
      </Card>
      <Card>
        <ComputedFooter
          ayanamsa={shortValue(t(AYANAMSA_KEY[ayanamsa]))}
          node={node === 'true' ? TRUE_NODE_METHOD : MEAN_NODE_METHOD}
          ephemeris={EPHEMERIS}
          tz={tz}
          rounding={t('about.rounding')}
          extra={[t('settings.kpHouses')]}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
