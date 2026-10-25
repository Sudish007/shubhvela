// Shraddha record editor (F21, design.md 10.4, M16): name, relation, lunar month of passing (Hindu month picker in the
// self profile's month-naming tradition), paksha, tithi, optional year. /family/ancestor/new creates, /family/ancestor/<id>
// edits or deletes. A record is NOT a profile: no birth chart, no profile slot; it creates one barsi series (yearly barsi
// + the Pitru Paksha day) that counts once toward the reminder cap when switched on. Card copy avoids euphemism and
// fear language; the screen states plainly which month names it uses.
import { locale } from '@shubhvela/engine';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Chip, PrimaryButton, Screen, SecondaryButton, Segmented, Sheet, TextField, Txt } from '../../../src/components';
import { deleteAncestor, getAncestor, insertAncestor, updateAncestor, type AncestorInput, type Paksha } from '../../../src/db/ancestors';
import { getSelfProfile } from '../../../src/db/profiles';
import { getSetting } from '../../../src/db/settings';
import { useLang } from '../../../src/i18n';
import { replanAll } from '../../../src/notifications/schedule';
import { tithiName } from '../../../src/today/format';

/** Relations offered for an ancestor record (reuses the family.relation.* strings). */
export const ANCESTOR_RELATIONS = ['grandmother', 'grandfather', 'mother', 'father', 'spouse', 'brother', 'sister', 'other'] as const;

export interface AncestorEditorProps {
  /** Route id for tests ('new' or an ancestor id). */
  ancestorId?: string;
  /** Scheduler injection for tests. */
  replan?: () => Promise<unknown>;
}

interface Form {
  name: string;
  relation: string;
  deathMonth: number | null;
  paksha: Paksha;
  tithi: number | null;
  year: string;
}

const EMPTY: Form = { name: '', relation: 'grandfather', deathMonth: null, paksha: 'krishna', tithi: null, year: '' };

export function validateAncestor(f: Form, t: (k: string, p?: Record<string, string | number>) => string, maxYear: number): { errors: Partial<Record<keyof Form, string>>; value: AncestorInput | null } {
  const errors: Partial<Record<keyof Form, string>> = {};
  const name = f.name.trim();
  if (!name) errors.name = t('family.nameRequired');
  else if (name.length > 40) errors.name = t('onboarding.nameError');
  if (f.deathMonth === null) errors.deathMonth = t('common.required');
  if (f.tithi === null) errors.tithi = t('common.required');
  let year: number | null = null;
  if (f.year.trim()) {
    const y = Number(f.year.trim());
    if (!Number.isInteger(y) || y < 1900 || y > maxYear) errors.year = t('family.yearRange', { min: 1900, max: maxYear });
    else year = y;
  }
  if (Object.keys(errors).length || f.deathMonth === null || f.tithi === null) return { errors, value: null };
  return { errors, value: { name, relation: f.relation, deathMonth: f.deathMonth, paksha: f.paksha, tithi: f.tithi, year } };
}

export default function AncestorEditor({ ancestorId, replan }: AncestorEditorProps) {
  const { t, lang } = useLang();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = ancestorId ?? params.id ?? 'new';
  const isNew = id === 'new';
  const existing = isNew ? null : getAncestor(Number(id));
  const tradition = getSelfProfile()?.tradition ?? getSetting('traditionDefault');
  const [form, setForm] = useState<Form>(() =>
    existing ? { name: existing.name, relation: existing.relation, deathMonth: existing.deathMonth, paksha: existing.paksha, tithi: existing.tithi, year: existing.year ? String(existing.year) : '' } : EMPTY,
  );
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const doReplan = replan ?? (() => replanAll());

  function save() {
    const { errors: e, value } = validateAncestor(form, t, new Date().getFullYear());
    setErrors(e);
    if (!value) return;
    if (existing) updateAncestor(existing.id, value);
    else insertAncestor(value);
    void doReplan();
    router.back();
  }

  function remove() {
    if (!existing) return;
    deleteAncestor(existing.id);
    setConfirmDelete(false);
    void doReplan();
    router.back();
  }

  if (!isNew && !existing) {
    return (
      <Screen title={t('family.editAncestor')} chrome="stack" testID="ancestor-editor">
        <Txt kind="body" color="ink2">
          {t('family.noAncestors')}
        </Txt>
      </Screen>
    );
  }

  const months = locale.lunarMonthNames[lang];
  const tithis = Array.from({ length: 15 }, (_, i) => i + 1);
  const systemName = tradition === 'amanta' ? t('panchang.amanta') : t('panchang.purnimanta');

  return (
    <Screen title={isNew ? t('family.addShraddha') : t('family.editAncestor')} chrome="stack" testID="ancestor-editor" stickyCta={<PrimaryButton label={t('common.save')} onPress={save} testID="ancestor-save" />}>
      <Txt kind="body" color="ink2">
        {t('family.ancestorNote')}
      </Txt>
      <Card>
        <TextField label={t('family.ancestorName')} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} error={errors.name} maxLength={40} testID="ancestor-name" />
        <Txt kind="label" color="ink2" weight={400} style={styles.label}>
          {t('family.relation')}
        </Txt>
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('family.relation')}>
          {ANCESTOR_RELATIONS.map((r) => (
            <Chip key={r} label={t(`family.relation.${r}`)} selected={form.relation === r} onPress={() => setForm({ ...form, relation: r })} testID={`relation-${r}`} />
          ))}
        </View>
      </Card>
      <Card>
        <Txt kind="heading">{t('family.deathTithi')}</Txt>
        <Txt kind="caption" color="ink3">
          {t('family.monthNamesNote', { system: systemName })}
        </Txt>
        <Txt kind="label" color="ink2" weight={400} style={styles.label}>
          {t('family.deathMonth')}
        </Txt>
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('family.deathMonth')}>
          {months.map((m, i) => (
            <Chip key={m} label={m} selected={form.deathMonth === i} onPress={() => setForm({ ...form, deathMonth: i })} testID={`month-${i}`} />
          ))}
        </View>
        {errors.deathMonth ? (
          <Txt kind="caption" color="accent" accessibilityLiveRegion="polite">
            {errors.deathMonth}
          </Txt>
        ) : null}
        <Txt kind="label" color="ink2" weight={400} style={styles.label}>
          {t('family.deathPaksha')}
        </Txt>
        <Segmented<Paksha>
          options={[
            { value: 'shukla', label: t('panchang.shukla') },
            { value: 'krishna', label: t('panchang.krishna') },
          ]}
          value={form.paksha}
          onChange={(v) => setForm({ ...form, paksha: v })}
          accessibilityLabel={t('family.deathPaksha')}
          testID="paksha"
        />
        <Txt kind="label" color="ink2" weight={400} style={styles.label}>
          {t('panchang.tithi')}
        </Txt>
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('panchang.tithi')}>
          {tithis.map((n) => (
            <Chip key={n} label={tithiName(lang, n - 1 + (form.paksha === 'krishna' ? 15 : 0))} selected={form.tithi === n} onPress={() => setForm({ ...form, tithi: n })} testID={`tithi-${n}`} />
          ))}
        </View>
        {errors.tithi ? (
          <Txt kind="caption" color="accent" accessibilityLiveRegion="polite">
            {errors.tithi}
          </Txt>
        ) : null}
        <View style={styles.label}>
          <TextField label={t('family.yearOptional')} value={form.year} onChangeText={(v) => setForm({ ...form, year: v.replace(/[^\d]/g, '').slice(0, 4) })} error={errors.year} keyboardType="number-pad" numeric testID="ancestor-year" />
        </View>
      </Card>
      {existing ? <SecondaryButton label={t('family.deleteAncestor')} onPress={() => setConfirmDelete(true)} testID="ancestor-delete" /> : null}
      <Sheet
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('family.deleteAncestor')}
        footer={
          <View style={styles.confirm}>
            <PrimaryButton label={t('common.delete')} onPress={remove} testID="ancestor-delete-confirm" />
            <SecondaryButton label={t('common.cancel')} onPress={() => setConfirmDelete(false)} />
          </View>
        }
      >
        <Txt kind="body">{t('family.deleteAncestorConfirm', { name: existing?.name ?? '' })}</Txt>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  confirm: { gap: 8 },
});
