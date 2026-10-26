// Saved muhurats (F26 "save to Upcoming"; plan B05): route /charts/muhurat/saved. One row per saved_muhurats row in
// start order: activity name, "<day> · <from>–<to>", "N/10 rules met" (the saved engine breakdown), ".ics" (Pro:
// exports the saved window; free: opens the Pro screen) and Remove. The Upcoming strip's "Saved muhurat" card opens
// this list. Not on the banner allow-list (M5) so no strip is drawn.
import type { MuhuratWindow } from '@shubhvela/engine';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useProStatus } from '../../../src/billing/ui';
import { useMountClock } from '../../../src/charts/LockedFeature';
import { Card, EmptyState, InlineNotice, NoBreak, Num, Screen, SecondaryButton, Txt } from '../../../src/components';
import { deleteSavedMuhurat, listSavedMuhurats, type SavedMuhuratRow } from '../../../src/db/savedMuhurats';
import { useLang } from '../../../src/i18n';
import { exportIcs, type IcsExportDeps } from '../../../src/muhurat/ics';
import { activityName, subLine } from '../../../src/muhurat/model';
import { useProfiles } from '../../../src/profiles/useProfiles';
import { fmtDayShort, fmtRange } from '../../../src/today/format';

export interface SavedMuhuratsProps {
  now?: () => number;
  icsDeps?: IcsExportDeps;
}

function safeList(): SavedMuhuratRow[] {
  try {
    return listSavedMuhurats();
  } catch {
    return [];
  }
}

export default function SavedMuhurats({ now, icsDeps }: SavedMuhuratsProps) {
  const { t, lang } = useLang();
  const router = useRouter();
  const nowMs = useMountClock(now);
  const { pro } = useProStatus();
  const { self } = useProfiles();
  const tz = self?.tz ?? 'UTC';
  const [rows, setRows] = useState<SavedMuhuratRow[]>(safeList);
  const [icsError, setIcsError] = useState(false);

  function remove(id: number) {
    deleteSavedMuhurat(id);
    setRows(safeList());
  }
  function ics(w: MuhuratWindow) {
    if (!pro) {
      router.push('/pro');
      return;
    }
    setIcsError(false);
    exportIcs(w, lang, t, tz, self?.placeName ?? null, { ...icsDeps, nowMs }).catch((e) => {
      if (__DEV__) console.warn('ics failed', e);
      setIcsError(true);
    });
  }

  return (
    <Screen title={t('muhurat.savedTitle')} chrome="stack" testID="saved-muhurats-screen">
      {icsError ? <InlineNotice tone="error">{t('errors.generic')}</InlineNotice> : null}
      {rows.length === 0 ? <EmptyState title={t('muhurat.savedTitle')} body={t('muhurat.noSaved')} /> : null}
      {rows.map((r) => (
        <Card key={r.id} testID={`saved-${r.id}`}>
          <Txt kind="heading" accessibilityRole="header">
            {activityName(r.activity, lang)}
          </Txt>
          <NoBreak kind="resultWhen" numeric style={styles.when}>
            {`${fmtDayShort(r.start, tz, lang)} · ${fmtRange(r.start, r.end, tz)}`}
          </NoBreak>
          <Txt kind="label" weight={400} color="ink2">
            {subLine(r.window, lang, t)}
          </Txt>
          <Num kind="caption" color="ink2" accessibilityLabel={t('muhurat.rulesMetA11y', { met: r.window.met, of: r.window.of })} testID={`saved-met-${r.id}`}>
            {t('muhurat.rulesMet', { met: r.window.met, of: r.window.of })}
          </Num>
          <View style={styles.actions}>
            <SecondaryButton label={pro ? t('muhurat.ics') : t('muhurat.icsPro')} accessibilityLabel={t('muhurat.icsExport')} onPress={() => ics(r.window)} style={styles.action} testID={`saved-ics-${r.id}`} />
            <SecondaryButton label={t('common.remove')} onPress={() => remove(r.id)} style={styles.action} testID={`saved-remove-${r.id}`} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  when: { marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  action: { alignSelf: 'auto' },
});
