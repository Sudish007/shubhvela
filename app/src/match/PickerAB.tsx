// PickerAB (design.md 10.6 F29 "pick A and B (profile or 'enter details' form)" + F30 "Scan a code" / "Type a code"):
// one block per side with a chip row (every profile, then Enter details, Scan a code, Type a code) and the body of
// the chosen mode under it. The chips are a radiogroup; the chosen chip shows its state (accentTint + underline).
import { formatShareCode } from '@shubhvela/engine';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Chip } from '../components/Chip';
import { InlineNotice } from '../components/Notices';
import { Txt } from '../components/Txt';
import type { Profile } from '../db/profiles';
import type { Tradition } from '../db/settings';
import { useLang } from '../i18n';
import { profileLabel } from '../muhurat/ForField';
import { TypeCodeField } from '../share/TypeCodeField';
import { emptyEnterDraft, type SideDraft } from './draft';
import { EnterDetailsForm } from './EnterDetailsForm';
import type { MatchSideKey } from './model';

export interface PickerABProps {
  side: MatchSideKey;
  profiles: readonly Profile[];
  draft: SideDraft | null;
  onChange: (next: SideDraft | null) => void;
  /** Opens the camera route for this side. */
  onScan: () => void;
  defaults: { tradition: Tradition; pdfLanguage: 'en' | 'hi' | 'bho' };
  nowMs: number;
  testID?: string;
}

export function PickerAB({ side, profiles, draft, onChange, onScan, defaults, nowMs, testID }: PickerABProps) {
  const { t } = useLang();
  const title = t(side === 'a' ? 'match.pickA' : 'match.pickB');
  const is = (mode: SideDraft['mode']) => draft?.mode === mode;
  return (
    <View testID={testID} style={styles.block}>
      <Txt kind="label" weight={600} accessibilityRole="header">
        {title}
      </Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={title} testID={`${testID}-chips`}>
        {profiles.map((p) => (
          <Chip key={p.id} label={profileLabel(p, t)} selected={draft?.mode === 'profile' && draft.id === p.id} onPress={() => onChange({ mode: 'profile', id: p.id })} testID={`${testID}-profile-${p.id}`} />
        ))}
        <Chip label={t('match.enterDetails')} selected={is('enter')} onPress={() => (is('enter') ? null : onChange(emptyEnterDraft(defaults)))} testID={`${testID}-enter`} />
        <Chip
          label={t('share.scan')}
          selected={is('scan')}
          onPress={() => {
            if (!is('scan')) onChange({ mode: 'scan', code: null });
            onScan();
          }}
          testID={`${testID}-scan`}
        />
        <Chip label={t('share.type')} selected={is('type')} onPress={() => (is('type') ? null : onChange({ mode: 'type', text: '', touched: false }))} testID={`${testID}-type`} />
      </ScrollView>

      {draft?.mode === 'enter' ? <EnterDetailsForm value={draft.form} errors={draft.errors} onChange={(form) => onChange({ ...draft, form, errors: {} })} testID={`${testID}-form`} /> : null}
      {draft?.mode === 'type' ? (
        <TypeCodeField value={draft.text} touched={draft.touched} onChangeText={(text) => onChange({ ...draft, text, touched: false })} onBlur={() => onChange({ ...draft, touched: true })} nowMs={nowMs} testID={`${testID}-code`} />
      ) : null}
      {draft?.mode === 'scan' ? (
        draft.code ? (
          <View style={styles.scanned} testID={`${testID}-scanned`}>
            <Txt kind="caption" color="ink2">{`${t('match.useScanned')} · ${formatShareCode(draft.code)}`}</Txt>
            <Txt kind="caption" color="ink3">
              {t('share.decoded')}
            </Txt>
          </View>
        ) : (
          <InlineNotice>{t('share.scanning')}</InlineNotice>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  chips: { gap: 8, paddingRight: 16 },
  scanned: { gap: 2 },
});
