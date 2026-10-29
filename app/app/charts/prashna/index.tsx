// Prashna (F18, design.md 10.3; plan C04): route /charts/prashna?profile=<id>[&id=<history id>]. Behind the
// `prashna` key / Pro with the UnlockSheet (LockedFeature). A one-line question (<= 120 characters, required) and
// "Chart this moment" cast the chart of NOW at the current observer (device fix when Settings -> Location says so,
// else the self profile's place), show it with the same Chart component and read it in plain-language rows, each
// with its Why? (rule id + inputs + the corpus snippet it came from). The question, instant, coordinates and zone
// are saved to `prashna` so the history can re-render the identical reading; `?id=` opens a stored one. Every
// number is engine output; the stored row never carries interpretation text.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, InlineNotice, NavRow, PrimaryButton, Row, Screen, TextField, Txt } from '../../../src/components';
import { Chart } from '../../../src/charts/Chart';
import { LockedFeature, useMountClock } from '../../../src/charts/LockedFeature';
import { nakshatraName, planetName, shortPlace, signName } from '../../../src/charts/model';
import { castPrashna, currentObserver, PRASHNA_MAX, questionLength, validateQuestion, type PrashnaReading, type QuestionProblem } from '../../../src/charts/prashnaModel';
import { useRouteProfile } from '../../../src/charts/routeProfile';
import { profileLabel } from '../../../src/charts/sheets';
import { useFeatureAccess } from '../../../src/charts/unlockState';
import { getPrashna, insertPrashna, type PrashnaRow } from '../../../src/db/prashna';
import { getSelfProfile } from '../../../src/db/profiles';
import { getSetting } from '../../../src/db/settings';
import { useLang } from '../../../src/i18n';
import type { DeviceFix } from '../../../src/location/gps';
import { AYANAMSA_KEY, CHART_STYLE_KEY, NODE_KEY, nodeWord, shortValue } from '../../../src/settingsLabels';
import { fmtDate, fmtTime } from '../../../src/today/format';
import { RichText } from '../../../src/today/RichText';

export interface PrashnaScreenProps {
  now?: () => number;
  profileId?: number;
  /** Stored history entry to re-render (tests; the route reads `?id=`). */
  entryId?: number;
  chartWidth?: number;
  /** Device-fix provider (tests). */
  fix?: () => Promise<DeviceFix | null>;
}

const DEFAULT_CHART_WIDTH = 326;

type Shown = { reading: PrashnaReading; question: string; savedId: number | null; fallbackPlace: string | null };

export default function PrashnaScreen({ now, profileId, entryId, chartWidth, fix }: PrashnaScreenProps) {
  const { t, lang } = useLang();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const nowMs = useMountClock(now);
  const routeProfile = useRouteProfile(profileId);
  const profile = routeProfile ?? getSelfProfile();
  const access = useFeatureAccess('prashna', nowMs);
  const storedId = entryId ?? (params.id ? Number(params.id) : null);
  // A history entry: its reading is recomputed from the stored instant/place/zone (nothing interpretive is stored).
  const stored = useMemo<Shown | null>(() => {
    if (storedId == null || !Number.isFinite(storedId) || !access.allowed) return null;
    const row: PrashnaRow | null = getPrashna(storedId);
    if (!row) return null;
    try {
      const reading = castPrashna(Date.parse(row.ts), { lat: row.lat, lon: row.lon, tz: row.tz, placeName: null }, lang, t);
      return { reading, question: row.question, savedId: row.id, fallbackPlace: null };
    } catch (e) {
      if (__DEV__) console.warn('prashna history failed', e);
      return null;
    }
  }, [storedId, access.allowed, lang, t]);
  const [question, setQuestion] = useState(() => stored?.question ?? '');
  const [problem, setProblem] = useState<QuestionProblem | null>(null);
  const [busy, setBusy] = useState(false);
  const [cast_, setShown] = useState<Shown | null>(null);
  const shown = cast_ ?? stored;
  const [measured, setMeasured] = useState<number | null>(null);

  if (!profile) {
    return (
      <Screen title={t('prashna.title')} chrome="stack" testID="prashna-screen">
        <Txt kind="body" color="ink2">
          {t('charts.noProfile')}
        </Txt>
      </Screen>
    );
  }
  if (!access.allowed) {
    return (
      <Screen title={t('prashna.title')} chrome="stack" testID="prashna-screen">
        <LockedFeature feature="prashna" testID="prashna-locked" />
      </Screen>
    );
  }

  async function cast() {
    const p = validateQuestion(question);
    setProblem(p);
    if (p) return;
    setBusy(true);
    try {
      const self = getSelfProfile() ?? profile!;
      const { observer, fallback } = await currentObserver(self, { fix });
      const at = now ? now() : Date.now();
      const reading = castPrashna(at, observer, lang, t);
      const id = insertPrashna({ question, ts: new Date(at).toISOString(), lat: observer.lat, lon: observer.lon, tz: observer.tz });
      setShown({ reading, question: question.trim(), savedId: id, fallbackPlace: fallback ? shortPlace(self.placeName) : null });
    } catch (e) {
      if (__DEV__) console.warn('prashna failed', e);
      setShown(null);
      setProblem(null);
    } finally {
      setBusy(false);
    }
  }

  const left = PRASHNA_MAX - questionLength(question);
  const problemText = problem === 'empty' ? t('prashna.questionEmpty') : problem === 'tooLong' ? t('prashna.tooLong') : null;
  const style = getSetting('chartStyle');
  const width = chartWidth ?? measured ?? DEFAULT_CHART_WIDTH;
  const reading = shown?.reading ?? null;
  const ayanamsaLabel = reading ? shortValue(t(AYANAMSA_KEY[reading.chart.meta.ayanamsa])) : '';
  const nodeLabel = reading ? nodeWord(t(NODE_KEY[reading.chart.meta.node])) : '';

  return (
    <Screen title={t('prashna.title')} chrome="stack" subtitle={<Txt kind="caption" color="ink2">{t('prashna.rowBody')}</Txt>} testID="prashna-screen">
      <Card testID="prashna-ask-card">
        <TextField
          label={t('prashna.rowTitle')}
          value={question}
          onChangeText={(v) => {
            setQuestion(v);
            if (problem) setProblem(validateQuestion(v) === 'tooLong' ? 'tooLong' : null);
          }}
          placeholder={t('prashna.fieldHint')}
          maxLength={PRASHNA_MAX + 20}
          multiline
          error={problemText}
          hint={t('prashna.charsLeft', { count: Math.max(0, left) })}
          testID="prashna-question"
        />
        <PrimaryButton label={t('prashna.chartThisMoment')} onPress={() => void cast()} disabled={busy} style={styles.cta} testID="prashna-cast" />
        <Txt kind="caption" color="ink3" style={styles.private}>
          {t('prashna.private')}
        </Txt>
      </Card>

      {reading && shown ? (
        <Card testID="prashna-reading-card">
          <Txt kind="heading" accessibilityRole="header">
            {t('prashna.reading')}
          </Txt>
          <Txt kind="body" color="ink2" testID="prashna-shown-question">
            {shown.question}
          </Txt>
          <RichText kind="caption" color="ink2" text={`${fmtDate(reading.utcMs, reading.observer.tz, lang)} · ${t('prashna.castAt', { time: fmtTime(reading.utcMs, reading.observer.tz), place: reading.observer.placeName ? shortPlace(reading.observer.placeName) : `${reading.observer.lat.toFixed(2)}, ${reading.observer.lon.toFixed(2)}` })}`} testID="prashna-cast-line" />
          {shown.fallbackPlace ? <InlineNotice>{t('today.locationFallback', { place: shown.fallbackPlace })}</InlineNotice> : null}
          <View style={styles.chartBox} onLayout={(e) => setMeasured(Math.round(e.nativeEvent.layout.width))}>
            <Chart style={style} chart={reading.chart} width={width} styleName={t(CHART_STYLE_KEY[style])} centreLines={style === 'north' ? undefined : [profileLabel(profile, t), fmtTime(reading.utcMs, reading.observer.tz)]} testID="prashna-chart" />
          </View>
          <Txt kind="caption" color="ink2" testID="prashna-summary">
            {`${t('prashna.lagnaNow', { sign: signName(lang, reading.lagnaSign) })} · ${t('prashna.moonNow', { sign: signName(lang, reading.moon.sign), nakshatra: `${nakshatraName(lang, reading.moon.nakshatra)} ${reading.moon.pada}` })}${reading.hora ? ` · ${t('prashna.horaNow', { planet: planetName(lang, reading.hora) })}` : ''}`}
          </Txt>
          {reading.rows.map((r, i) => (
            <Row key={r.testID} ruleId={r.ruleId} text={r.text} inputs={r.inputs} glossary={r.glossary} explanation={r.explanation} explanationTitle={r.explanationTitle} divider={i < reading.rows.length - 1} testID={r.testID}>
              <Txt kind="body">{r.text}</Txt>
            </Row>
          ))}
        </Card>
      ) : null}

      {reading ? (
        <Txt kind="caption" color="ink3" testID="prashna-how">
          {t('prashna.howComputed', { time: fmtTime(reading.utcMs, reading.observer.tz), lat: reading.observer.lat.toFixed(2), lon: reading.observer.lon.toFixed(2), tz: reading.observer.tz, ayanamsa: ayanamsaLabel, node: nodeLabel })}
        </Txt>
      ) : null}

      <Card flush>
        <NavRow title={t('prashna.history')} onPress={() => router.push('/charts/prashna/history')} divider={false} testID="prashna-history-row" />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cta: { marginTop: 12 },
  private: { marginTop: 8 },
  chartBox: { alignSelf: 'stretch', alignItems: 'center', marginTop: 8 },
});
