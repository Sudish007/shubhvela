// Settings -> Disclaimers (spec section 10): the three statements in ALL THREE languages at once, whatever the UI
// language, so the legal text is always readable to a household that shares the phone.
import { StyleSheet, View } from 'react-native';
import { Card, Screen, Txt } from '../../src/components';
import { LANGS, makeT, useLang } from '../../src/i18n';
import { textStyle } from '../../src/theme/typography';
import { useTokens } from '../../src/theme/ThemeProvider';

export default function DisclaimersScreen() {
  const { t } = useLang();
  const { colors } = useTokens();
  return (
    <Screen title={t('disclaimer.title')} chrome="stack" testID="disclaimers-screen">
      {LANGS.map((l) => {
        const tl = makeT(l);
        return (
          <Card key={l}>
            <View style={styles.block}>
              <Txt kind="micro" weight={600} color="ink3">
                {tl(`settings.lang.${l}`)}
              </Txt>
              {(['disclaimer.reflection', 'disclaimer.notAdvice', 'disclaimer.noGuarantee'] as const).map((k) => (
                // Each language keeps its own body face regardless of the UI language.
                <Txt key={k} style={[textStyle('body', l), { color: colors.ink }]}>
                  {tl(k)}
                </Txt>
              ))}
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({ block: { gap: 8 } });
