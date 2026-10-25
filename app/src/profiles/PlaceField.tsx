// Place of birth (design.md 10.1 F1): on submit the typed name queries the bundled gazetteer (rows 48 dp: town, state,
// country, zone); a "Search online" row appears only when offline results < 3 AND the device is online, and only that
// explicit tap sends the typed name to Nominatim (errors inline, offline list kept). "Advanced" takes manual lat/lon
// with range checks and derives the zone with tz-lookup -> engine canonicalZone. The hint under the field shows the
// resolved zone and offset, including the 1942-45 war-time note.
import { canonicalZone, type Place } from '@shubhvela/engine';
import { getNetworkStateAsync } from 'expo-network';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import tzLookup from 'tz-lookup';
import { Checkbox } from '../components/Checkbox';
import { InlineNotice } from '../components/Notices';
import { Pressable44 } from '../components/Pressable44';
import { SecondaryButton } from '../components/Button';
import { TextField } from '../components/TextField';
import { Txt } from '../components/Txt';
import { searchGazetteer } from '../db/gazetteer';
import { formatPlace, zoneHint } from '../format';
import { useLang } from '../i18n';
import { searchNominatim, type OnlinePlace } from '../location/nominatim';
import { useTokens } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { isValidLat, isValidLon, parseCoord, type PlaceChoice } from './validate';

export const ONLINE_THRESHOLD = 3;

export interface PlaceFieldProps {
  value: PlaceChoice | null;
  onChange: (p: PlaceChoice | null) => void;
  error?: string | null;
  /** For the zone/offset hint (war-time note depends on the date). */
  birthDate: string | null;
  birthTime: string | null;
}

export async function deviceOnline(): Promise<boolean> {
  try {
    const s = await getNetworkStateAsync();
    return (s.isInternetReachable ?? s.isConnected) === true;
  } catch {
    return false;
  }
}

function fromGazetteer(p: Place): PlaceChoice {
  return { name: p.name, admin1: p.admin1 ?? '', country: p.countryName, lat: p.lat, lon: p.lon, tz: p.tz, source: 'gazetteer' };
}

function fromOnline(p: OnlinePlace): PlaceChoice {
  return { name: p.name, admin1: p.admin1, country: p.country, lat: p.lat, lon: p.lon, tz: p.tz, source: 'online' };
}

export function PlaceField({ value, onChange, error, birthDate, birthTime }: PlaceFieldProps) {
  const { t } = useLang();
  const { colors } = useTokens();
  const [query, setQuery] = useState(value ? value.name : '');
  const [results, setResults] = useState<PlaceChoice[]>([]);
  const [searched, setSearched] = useState(false);
  const [online, setOnline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(value?.source === 'manual');
  const [latText, setLatText] = useState(value?.source === 'manual' ? String(value.lat) : '');
  const [lonText, setLonText] = useState(value?.source === 'manual' ? String(value.lon) : '');
  const [manualError, setManualError] = useState<string | null>(null);

  async function submit() {
    const q = query.trim();
    setNotice(null);
    if (!q) return;
    setBusy(true);
    try {
      const rows = (await searchGazetteer(q, 20)).map(fromGazetteer);
      setResults(rows);
      setSearched(true);
      setOnline(rows.length < ONLINE_THRESHOLD ? await deviceOnline() : false);
    } catch (e) {
      if (__DEV__) console.warn('gazetteer search failed', e);
      setResults([]);
      setSearched(true);
      setNotice(t('errors.dbOpen'));
    } finally {
      setBusy(false);
    }
  }

  async function searchOnline() {
    setBusy(true);
    setNotice(null);
    try {
      const rows = await searchNominatim(query);
      if (rows.length === 0) setNotice(t('errors.placeEmpty'));
      // Online rows are appended under the offline list, which stays (design.md 11).
      setResults((prev) => [...prev.filter((p) => p.source !== 'online'), ...rows.map(fromOnline)]);
    } catch (e) {
      if (__DEV__) console.warn('nominatim failed', e);
      setNotice(t('errors.nominatim'));
    } finally {
      setBusy(false);
    }
  }

  function choose(p: PlaceChoice) {
    onChange(p);
    setResults([]);
    setSearched(false);
    setQuery(p.name);
  }

  function applyManual() {
    const lat = parseCoord(latText);
    const lon = parseCoord(lonText);
    if (lat === null || !isValidLat(lat)) return setManualError(t('onboarding.latError'));
    if (lon === null || !isValidLon(lon)) return setManualError(t('onboarding.lonError'));
    let zone: string | undefined;
    try {
      zone = canonicalZone(tzLookup(lat, lon));
    } catch {
      zone = undefined;
    }
    if (!zone) return setManualError(t('errors.tzUnknown'));
    setManualError(null);
    onChange({ name: query.trim() || `${lat.toFixed(2)}, ${lon.toFixed(2)}`, admin1: '', country: '', lat, lon, tz: zone, source: 'manual' });
  }

  const hint = value ? zoneHint(value.tz, birthDate, birthTime) : null;
  const hintText = value && hint ? `${formatPlace(value)} · ${hint.zone} · ${hint.offset}${hint.warTime ? ` · ${t('onboarding.warTimeNote')}` : ''}` : null;

  return (
    <View style={styles.wrap}>
      <TextField
        label={t('onboarding.place')}
        placeholder={t('onboarding.placeHint')}
        value={query}
        onChangeText={(s) => {
          setQuery(s);
          if (value) onChange(null);
        }}
        onSubmitEditing={submit}
        returnKeyType="search"
        autoCapitalize="words"
        autoCorrect={false}
        error={error}
        hint={hintText}
      />
      <SecondaryButton label={busy ? t('onboarding.searching') : t('common.search')} onPress={submit} disabled={busy || !query.trim()} testID="place-search" />
      {notice ? <InlineNotice tone="error">{notice}</InlineNotice> : null}
      {searched && results.length === 0 && !notice ? <InlineNotice>{t('errors.placeEmpty')}</InlineNotice> : null}
      {results.length ? (
        <View style={[styles.list, { borderColor: colors.hair, backgroundColor: colors.surface }]} accessibilityRole="list">
          {results.map((p, i) => (
            <Pressable44
              key={`${p.source}-${p.lat}-${p.lon}-${i}`}
              accessibilityLabel={t('onboarding.placeResult', { town: p.name, admin: p.admin1, country: p.country, tz: p.tz })}
              onPress={() => choose(p)}
              style={[styles.resultRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hair }]}
            >
              <View style={styles.resultText}>
                <Txt kind="label" weight={600}>
                  {p.name}
                </Txt>
                <Txt kind="caption" color="ink2">
                  {[p.admin1, p.country].filter(Boolean).join(', ')}
                  {p.admin1 || p.country ? ' · ' : ''}
                  {p.tz}
                </Txt>
              </View>
            </Pressable44>
          ))}
        </View>
      ) : null}
      {searched && results.filter((p) => p.source !== 'online').length < ONLINE_THRESHOLD && online ? (
        <Pressable44 accessibilityLabel={t('onboarding.searchOnline')} onPress={searchOnline} disabled={busy} style={[styles.onlineRow, { borderColor: colors.hair2 }]} testID="place-search-online">
          <View style={styles.resultText}>
            <Txt kind="label" weight={600} color="accent">
              {t('onboarding.searchOnline')}
            </Txt>
            <Txt kind="caption" color="ink3">
              {t('onboarding.searchOnlineHint')}
            </Txt>
          </View>
        </Pressable44>
      ) : null}
      <Checkbox label={t('onboarding.advanced')} checked={advanced} onChange={setAdvanced} testID="place-advanced" />
      {advanced ? (
        <View style={styles.advanced}>
          <TextField label={t('onboarding.latitude')} value={latText} onChangeText={setLatText} keyboardType="numbers-and-punctuation" numeric placeholder="26.85" />
          <TextField label={t('onboarding.longitude')} value={lonText} onChangeText={setLonText} keyboardType="numbers-and-punctuation" numeric placeholder="80.95" error={manualError} />
          <SecondaryButton label={t('onboarding.useCoordinates')} onPress={applyManual} testID="place-manual-apply" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  list: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.button, overflow: 'hidden' },
  resultRow: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'flex-start', justifyContent: 'center', alignSelf: 'stretch' },
  resultText: { flex: 1, alignSelf: 'stretch' },
  onlineRow: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.button, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'flex-start', alignSelf: 'stretch' },
  advanced: { gap: 8 },
});
