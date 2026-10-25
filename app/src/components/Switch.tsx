// Switch (design.md 2.1 / 8): track + knob + the visible word "On"/"Off" inside the 44 dp box, so the state is
// carried by position AND text in both themes; accessibilityRole switch with accessibilityState.checked.
import { StyleSheet, View } from 'react-native';
import { useLang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { Pressable44 } from './Pressable44';
import { Txt } from './Txt';

export interface SwitchProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
}

export function Switch({ value, onValueChange, accessibilityLabel, disabled, testID }: SwitchProps) {
  const { colors } = useTokens();
  const { t } = useLang();
  return (
    <Pressable44
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={styles.box}
      pressedStyle={styles.pressed}
    >
      <Txt kind="micro" weight={600} color={value ? 'accent' : 'ink2'} latin>
        {value ? t('common.on') : t('common.off')}
      </Txt>
      <View
        style={[
          styles.track,
          { backgroundColor: value ? colors.accent : colors.neutral, borderColor: value ? colors.accent : colors.hair2 },
          disabled && styles.disabled,
        ]}
      >
        <View style={[styles.knob, { backgroundColor: value ? colors.accentInk : colors.surface, borderColor: colors.hair2 }, value ? styles.knobOn : styles.knobOff]} />
      </View>
    </Pressable44>
  );
}

const TRACK_W = 36;
const TRACK_H = 20;
const KNOB = 14;

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  pressed: { opacity: 0.8 },
  track: { width: TRACK_W, height: TRACK_H, borderRadius: TRACK_H / 2, borderWidth: 1, justifyContent: 'center' },
  knob: { width: KNOB, height: KNOB, borderRadius: KNOB / 2, borderWidth: StyleSheet.hairlineWidth, position: 'absolute' },
  knobOn: { right: 2 },
  knobOff: { left: 2 },
  disabled: { opacity: 0.5 },
});
