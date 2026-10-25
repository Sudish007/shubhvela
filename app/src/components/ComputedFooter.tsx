// "How this was computed" footer (design.md 6): 13 sp caption lines naming ayanamsa, node method, ephemeris, time-zone
// source, rounding and any extra convention. Every report/sheet that shows computed values ends with one.
import { TZDB_VERSION } from '@shubhvela/engine';
import { StyleSheet, View } from 'react-native';
import { useLang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { Txt } from './Txt';

export interface ComputedFooterProps {
  /** Display names, already localised (e.g. "Lahiri", "mean node (Meeus)"). */
  ayanamsa: string;
  node: string;
  ephemeris: string;
  /** Zone id used; the footer adds the bundled tzdb release. */
  tz: string;
  /** Rounding statement (e.g. "times to the minute, degrees to the arc-minute"). */
  rounding: string;
  /** Extra lines (candidate-window rule, house system, combustion orbs ...). */
  extra?: readonly string[];
}

export function ComputedFooter({ ayanamsa, node, ephemeris, tz, rounding, extra = [] }: ComputedFooterProps) {
  const { t } = useLang();
  const { colors } = useTokens();
  const lines = [
    `${t('settings.ayanamsa')}: ${ayanamsa}`,
    `${t('settings.nodes')}: ${node}`,
    ephemeris,
    `${t('onboarding.timezone')}: ${tz} · tzdb ${TZDB_VERSION}`,
    rounding,
    ...extra,
  ];
  return (
    <View style={[styles.footer, { borderTopColor: colors.hair }]} accessibilityRole="summary">
      <Txt kind="caption" weight={600} color="ink2">
        {t('common.howComputed')}
      </Txt>
      {lines.map((l, i) => (
        <Txt key={i} kind="caption" color="ink3">
          {l}
        </Txt>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, marginTop: 8, gap: 2 },
});
