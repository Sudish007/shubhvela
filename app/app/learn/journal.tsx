// Journal (F34, design.md 10.7 / 6): title "Journal · for reflection"; today's two-tap entry (JournalToday); the month grid
// with the engine's Moon-house numbers and dasha-change hairlines (JournalMonth), legend ending "for reflection, not proof".
// Route Journal is not on the banner allow-list (no strip, N11). Days are civil dates in the self profile's zone; without a
// profile the grid shows entries only and says why the numbers are missing. Entries live in SQLite (table journal) and are
// part of the encrypted backup (C04).
import { localDateOf } from '@shubhvela/engine';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, InlineNotice, Screen, Txt } from '../../src/components';
import { getSelfProfile } from '../../src/db/profiles';
import { listJournalMonth } from '../../src/db/journal';
import { canSeeFeature } from '../../src/entitlements';
import { chartFor } from '../../src/engine-bridge/charts';
import { useLang } from '../../src/i18n';
import { journalMonth, shiftYearMonth, yearMonthOf } from '../../src/learn/journalModel';
import { JournalMonth } from '../../src/learn/JournalMonth';
import { JournalToday } from '../../src/learn/JournalToday';

export interface JournalScreenProps {
  /** Clock for tests. */
  now?: () => number;
}

export default function JournalScreen({ now }: JournalScreenProps) {
  const { t } = useLang();
  const [nowMs] = useState(() => (now ? now() : Date.now()));
  const self = getSelfProfile();
  const tz = self?.tz ?? 'UTC';
  const today = localDateOf(nowMs, tz);
  const [yearMonth, setYearMonth] = useState(() => yearMonthOf(today));
  const [entries, setEntries] = useState(() => listJournalMonth(yearMonth));
  const showMonth = (ym: string) => {
    setYearMonth(ym);
    setEntries(listJournalMonth(ym));
  };

  let chart = null;
  if (self) {
    try {
      chart = chartFor(self);
    } catch (e) {
      if (__DEV__) console.warn('chart failed', e);
    }
  }
  const geo = self ? { lat: self.lat, lon: self.lon } : { lat: 0, lon: 0 };
  const model = journalMonth(yearMonth, { chart, geo, tz, entries, nowMs, withPratyantar: canSeeFeature('dasha_pratyantar', new Date(nowMs)).allowed });

  return (
    <Screen title={t('journal.title')} chrome="stack" route="Journal" testID="journal-screen">
      <JournalToday day={today} onChange={() => setEntries(listJournalMonth(yearMonth))} testID="journal-today" />
      {!self ? <InlineNotice>{t('learn.noProfile')}</InlineNotice> : null}
      <Card testID="journal-month-card">
        <JournalMonth model={model} onPrev={() => showMonth(shiftYearMonth(yearMonth, -1))} onNext={() => showMonth(shiftYearMonth(yearMonth, 1))} testID="journal-month" />
      </Card>
      <View style={styles.footer}>
        <Txt kind="caption" color="ink3" testID="journal-export-note">
          {t('journal.exportNote')}
        </Txt>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { paddingHorizontal: 4 },
});
