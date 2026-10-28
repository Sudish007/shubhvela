// Charts (design.md 4, 10.3; plan A11). Header (title + gear); ONE row with the profile picker pill (the only
// profile control on this screen) and the chart-type chips Lagna · Moon · Sun · Chalit · D9 (scrolls horizontally);
// hero card = title, Lagna line with approx tag + Why?, the ⋮ menu (North/South/East radios + Legend), the Chart,
// the birth caption; Planets card (fixed-column table + Legend); Houses card (N6); Dasha card (F14: Pro gets the
// pratyantar row + "Dasha change alerts" switch, default Off); Yogas card (F16); Sade Sati card; the Varshaphal card
// (F17, only in the 30 days before the next solar return); "More from this chart" (one row per unlock key, M14);
// "Timing and documents" (M3, rows only once B05/B07 routes exist); "How this was computed". Unknown birth time (F2)
// switches the hero to "Moon chart · birth time unknown", hides the Lagna/Chalit chips, the Lagna row and the Houses
// card. B04: the "14 more vargas" chip (lock icon on the free tier; "till <time> tomorrow" after a rewarded unlock)
// opens the vargas sheet; a chosen varga swaps the hero ChartData for the same Chart component (F12). Still not
// rendered because not built: Prashna / Ask my chart rows (C04). B07: "Share chart card" (⋮ menu + Timing row) opens the
// F36 preview sheet with the KundliCard of the hero chart; "Janam Patri PDF" pushes the report preview. C03: a lesson's
// "Try it on your chart" arrives with `?card=planets|houses|sadesati|yogas` and the screen scrolls to that card once
// (src/learn/arrival: the param is cleared after the scroll).
// Every number is engine output for the chosen profile under the F19 settings; sheets never nest (one open at a time).
import type { ChartData, DivisionalChartId, PlanetId } from '@shubhvela/engine';
import { useFocusEffect, useRouter } from 'expo-router';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type ScrollViewInstance } from 'react-native';
import { Card, CapSheet, Chip, ChevronIcon, ComputedFooter, EmptyState, LockIcon, MoreIcon, Pressable44, Row, Screen, Txt, ApproxTag } from '../../src/components';
import { Chart, type ChartLongPressTarget } from '../../src/charts/Chart';
import { DashaCard } from '../../src/charts/DashaCard';
import { HousesCard } from '../../src/charts/HousesCard';
import { CHIP_KEY, approxRuleId, chartForChip, chipsFor, degreeText, fmtBirthDate, heroTitle, isLockedVarga, nakshatraName, planetName, PLANET_SLUG, shortPlace, signName, signSlug, vargaLabel, type ChartVariantChip } from '../../src/charts/model';
import { MoreFromChartCard } from '../../src/charts/MoreFromChartCard';
import { PlanetTable, type TableSubject } from '../../src/charts/PlanetTable';
import { TIMING_ROUTES } from '../../src/charts/routeFlags';
import { KundliCard } from '../../src/share/cards/KundliCard';
import type { CardView } from '../../src/share/ShareCard';
import { SharePreviewSheet } from '../../src/share/SharePreviewSheet';
import { SadeSatiCard } from '../../src/charts/SadeSatiCard';
import { GlossarySheet, HouseSheet, LegendSheet, PlanetSheet, ProfileSheet, StyleMenu, profileLabel, type PlanetSheetSubject } from '../../src/charts/sheets';
import { TimingDocumentsCard } from '../../src/charts/TimingDocumentsCard';
import { UnlockSheet } from '../../src/charts/UnlockSheet';
import { chipTillText, useFeatureAccess, type UnlockKey } from '../../src/charts/unlockState';
import { VargaSheet } from '../../src/charts/VargaSheet';
import { VarshaphalCard } from '../../src/charts/VarshaphalCard';
import { varshaphalPromoted } from '../../src/charts/varshaphalModel';
import { YogasCard } from '../../src/charts/YogasCard';
import type { Profile } from '../../src/db/profiles';
import { getDashaAlertsEnabled, getYearBeginsEnabled, setDashaAlertsEnabled, setYearBeginsEnabled } from '../../src/db/reminderSettings';
import { getSetting, setSetting, type ChartStyle } from '../../src/db/settings';
import { chartFor, dashaFor, sadeSatiFor, vedicYearAt, yogasFor } from '../../src/engine-bridge/charts';
import { useLang } from '../../src/i18n';
import { TRY_IT_CARDS, useArrivalParam, type TryItCard } from '../../src/learn/arrival';
import { getPermissionState, requestPermission, type PermissionState } from '../../src/notifications/permissions';
import { replanAll } from '../../src/notifications/schedule';
import { useProfiles } from '../../src/profiles/useProfiles';
import { AYANAMSA_KEY, CHART_STYLE_KEY, NODE_KEY, shortValue } from '../../src/settingsLabels';
import { useTokens } from '../../src/theme/ThemeProvider';
import { radius } from '../../src/theme/tokens';
import { RichText } from '../../src/today/RichText';

type SheetState =
  | null
  | { kind: 'planet'; subject: PlanetSheetSubject }
  | { kind: 'house'; n: number }
  | { kind: 'legend' }
  | { kind: 'glossary'; id: string; term: string }
  | { kind: 'menu' }
  | { kind: 'profiles' }
  | { kind: 'pro' }
  | { kind: 'vargas' }
  | { kind: 'unlock'; feature: UnlockKey }
  | { kind: 'shareCard' };

export interface ChartsScreenProps {
  /** Clock for tests; production uses Date.now(). */
  now?: () => number;
  /** Hero width for tests; measured by onLayout otherwise (card inner width). */
  chartWidth?: number;
  /** Injection for tests (notification permission flow behind the two toggles). */
  getPermission?: () => Promise<PermissionState>;
  requestPermission?: () => Promise<PermissionState>;
  replan?: () => Promise<unknown>;
  /** `?card=` override for tests (a lesson's "Try it on your chart" target). */
  card?: TryItCard;
}

/** Hero width before onLayout: 390 dp - 2 x 16 gutter - 2 x 16 card padding. */
const DEFAULT_CHART_WIDTH = 326;
/** The scrolled-to card sits this far below the top edge (the content's own top padding). */
const CARD_SCROLL_MARGIN = 8;

/** The memoised chart, or an error flag when the birth details cannot be computed (design.md 11: errors.chart). */
function safeChart(profile: Profile | null): { chart: ChartData | null; error: boolean } {
  if (!profile) return { chart: null, error: false };
  try {
    return { chart: chartFor(profile), error: false };
  } catch (e) {
    if (__DEV__) console.warn('chart failed', e);
    return { chart: null, error: true };
  }
}

export default function ChartsScreen({ now, chartWidth, getPermission = getPermissionState, requestPermission: askPermission = requestPermission, replan = () => replanAll(), card }: ChartsScreenProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const router = useRouter();
  const { profiles, self } = useProfiles();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [chip, setChip] = useState<ChartVariantChip>('lagna');
  const [style, setStyle] = useState<ChartStyle>(() => getSetting('chartStyle'));
  const [sheet, setSheet] = useState<SheetState>(null);
  const [measured, setMeasured] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => (now ? now() : Date.now()));
  const [dashaAlerts, setDashaAlerts] = useState(() => getDashaAlertsEnabled());
  const [yearBegins, setYearBegins] = useState(() => getYearBeginsEnabled());
  // Settings (chart style, ayanamsa, node, notification toggles) may change on pushed screens: re-read on focus,
  // together with the clock. chartFor() is memoised per profile + settings, so the re-render picks up a recomputed
  // chart (F19) by itself.
  useFocusEffect(
    useCallback(() => {
      setStyle(getSetting('chartStyle'));
      setNowMs(now ? now() : Date.now());
      setDashaAlerts(getDashaAlertsEnabled());
      setYearBegins(getYearBeginsEnabled());
    }, [now]),
  );
  // "Try it on your chart" (F32): scroll once to the card named by ?card= as soon as its layout is known, then clear the
  // param. Anchors record their y inside the Screen's content, so a param arriving after layout scrolls at once; a param
  // arriving before layout is kept in pendingCard until that card's onLayout. Nothing here needs a re-render (refs only).
  const { value: arrivalCard, consume: consumeArrival } = useArrivalParam('card', TRY_IT_CARDS, card);
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const cardY = useRef<Partial<Record<TryItCard, number>>>({});
  const pendingCard = useRef<TryItCard | null>(null);
  const scrollToCard = useCallback((key: TryItCard): boolean => {
    const y = cardY.current[key];
    if (y == null) return false;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - CARD_SCROLL_MARGIN), animated: true });
    return true;
  }, []);
  useEffect(() => {
    if (!arrivalCard) return;
    pendingCard.current = arrivalCard;
    if (scrollToCard(arrivalCard)) {
      pendingCard.current = null;
      consumeArrival();
    }
  }, [arrivalCard, consumeArrival, scrollToCard]);
  const onAnchorLayout = useCallback(
    (key: TryItCard, e: LayoutChangeEvent) => {
      cardY.current[key] = e.nativeEvent.layout.y;
      if (pendingCard.current === key && scrollToCard(key)) {
        pendingCard.current = null;
        consumeArrival();
      }
    },
    [consumeArrival, scrollToCard],
  );
  // Unlock keys (M14): live state, re-rendered on every entitlement change (unlock granted, Pro restored).
  const accessVargas = useFeatureAccess('vargas', nowMs);
  const accessAshtakavarga = useFeatureAccess('ashtakavarga', nowMs);
  const accessKp = useFeatureAccess('kp', nowMs);
  const accessVarshaphal = useFeatureAccess('varshaphal', nowMs);
  const accessPrashna = useFeatureAccess('prashna', nowMs);
  const accessPratyantar = useFeatureAccess('dasha_pratyantar', nowMs);
  const access = { vargas: accessVargas, ashtakavarga: accessAshtakavarga, kp: accessKp, varshaphal: accessVarshaphal, prashna: accessPrashna };

  const profile: Profile | null = profiles.find((p) => p.id === selectedId) ?? self ?? profiles[0] ?? null;
  const width = chartWidth ?? measured ?? DEFAULT_CHART_WIDTH;

  const { chart: base, error } = safeChart(profile);
  const chips = base ? chipsFor(base) : [];
  // A locked varga stays the hero only while the key is open; otherwise fall back to the row chips (M14 honesty).
  const vargaActive = isLockedVarga(chip) && accessVargas.allowed;
  const activeChip: ChartVariantChip = base && !vargaActive && !(chips as readonly string[]).includes(chip) ? (base.moonChart ? 'moon' : 'lagna') : chip;
  const selectedVarga: DivisionalChartId | null = isLockedVarga(activeChip) ? activeChip : null;
  // All of these are memoised in their modules per chart object (and instant), so a re-render costs nothing.
  const hero = base ? chartForChip(base, activeChip) : null;
  const tree = base ? dashaFor(base) : null;
  const yogaReport = base ? yogasFor(base) : null;
  const sade = base ? sadeSatiFor(base, nowMs) : null;
  const vedicYear = base ? vedicYearAt(base, nowMs) : null;
  const promoted = vedicYear ? varshaphalPromoted(vedicYear, nowMs) : false;

  const ayanamsaLabel = base ? shortValue(t(AYANAMSA_KEY[base.meta.ayanamsa])) : '';
  const nodeLabel = base ? shortValue(t(NODE_KEY[base.meta.node])) : '';
  const styleName = t(CHART_STYLE_KEY[style]);

  /** Both notification toggles: On needs the OS permission first (asked on the spot); every change re-plans. */
  async function setToggle(on: boolean, write: (v: boolean) => void, setLocal: (v: boolean) => void) {
    if (on) {
      let perm = await getPermission();
      if (perm !== 'granted') perm = await askPermission();
      if (perm !== 'granted') return;
    }
    write(on);
    setLocal(on);
    await replan();
  }
  const toggleDashaAlerts = (on: boolean) => void setToggle(on, setDashaAlertsEnabled, setDashaAlerts);
  const toggleYearBegins = (on: boolean) => void setToggle(on, setYearBeginsEnabled, setYearBegins);

  const openFeature = (key: UnlockKey) => {
    if (!profile || !vedicYear) return;
    switch (key) {
      case 'vargas':
        setSheet({ kind: 'vargas' });
        return;
      case 'ashtakavarga':
        router.push(`/charts/ashtakavarga?profile=${profile.id}`);
        return;
      case 'kp':
        router.push(`/charts/kp?profile=${profile.id}`);
        return;
      case 'varshaphal':
        router.push(`/charts/varshaphal?profile=${profile.id}&year=${vedicYear.runningYear}`);
        return;
      default:
        return;
    }
  };

  const vargaChipLabel = selectedVarga ? vargaLabel(selectedVarga, t) : t('charts.moreVargas_chip');
  const vargaChipCaption = accessVargas.until && profile ? chipTillText(accessVargas.until, nowMs, profile.tz, lang, t) : undefined;

  const pillStyle = [styles.pill, { borderColor: colors.hair2, backgroundColor: colors.surface }];
  const pickerRow = profile ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} accessibilityLabel={t('charts.chipRowLabel')} testID="chip-row">
      <Pressable44 accessibilityLabel={t('charts.profilePicker', { name: profileLabel(profile, t) })} accessibilityState={{ expanded: sheet?.kind === 'profiles' }} onPress={() => setSheet({ kind: 'profiles' })} style={pillStyle} testID="profile-pill">
        <View style={[styles.initial, { backgroundColor: colors.accentTint, borderColor: colors.accent }]}>
          <Txt kind="micro" weight={600} color="accent" latin>
            {profileLabel(profile, t).slice(0, 1).toUpperCase()}
          </Txt>
        </View>
        <Txt kind="label" weight={600} latin>
          {profileLabel(profile, t)}
        </Txt>
        <ChevronIcon color={colors.ink} size={18} />
      </Pressable44>
      {chips.map((c) => (
        <Chip key={c} label={t(CHIP_KEY[c])} selected={c === activeChip} onPress={() => setChip(c)} testID={`chip-${c}`} />
      ))}
      <Chip
        label={vargaChipLabel}
        caption={vargaChipCaption}
        icon={accessVargas.allowed ? undefined : <LockIcon color={colors.ink} size={18} />}
        accessibilityLabel={accessVargas.allowed ? (vargaChipCaption ? `${vargaChipLabel}, ${vargaChipCaption}` : vargaChipLabel) : t('charts.moreVargasA11y')}
        selected={!!selectedVarga}
        onPress={() => setSheet({ kind: 'vargas' })}
        testID="chip-vargas"
      />
    </ScrollView>
  ) : null;

  const openPlanet = (id: PlanetId) => setSheet({ kind: 'planet', subject: { kind: 'planet', id } });
  const openRow = (s: TableSubject) => setSheet({ kind: 'planet', subject: s });
  const onLongPress = (target: ChartLongPressTarget) => {
    if (target.kind === 'planet') setSheet({ kind: 'glossary', id: PLANET_SLUG[target.id], term: planetName(lang, target.id) });
    else setSheet({ kind: 'glossary', id: signSlug(target.sign), term: signName(lang, target.sign) });
  };
  const selectStyle = (s: ChartStyle) => {
    setSetting('chartStyle', s);
    setStyle(s);
    setSheet(null);
  };

  const lagnaRow =
    base && hero && !base.moonChart && base.lagna ? (
      <Row
        ruleId="lagna"
        text={`${t('charts.lagnaLine', { sign: signName(lang, base.lagna.sign) })} ${degreeText(base.lagna, t)}`}
        inputs={{
          [t('onboarding.birthTime')]: profile?.birthTime ?? '',
          [t('onboarding.place')]: profile ? shortPlace(profile.placeName) : '',
          [t('charts.lagna')]: `${signName(lang, base.lagna.sign)} ${degreeText(base.lagna, t)}`,
          [t('charts.nakshatra_col')]: `${nakshatraName(lang, base.lagna.nakshatra)} ${base.lagna.pada}`,
        }}
        glossary={['lagna', ...(base.lagna.approx ? [approxRuleId(profile?.timeApproxMinutes ?? 0)] : [])]}
        divider={false}
        caption={base.lagna.approx ? <ApproxTag minutes={profile?.timeApproxMinutes || undefined} /> : undefined}
        testID="lagna-row"
      >
        <Txt kind="body">
          {t('charts.lagnaLine', { sign: signName(lang, base.lagna.sign) })}{' '}
          <Txt kind="body" color="ink2" latin tabular>
            {degreeText(base.lagna, t)}
          </Txt>
        </Txt>
      </Row>
    ) : base && base.moonChart ? (
      <Row ruleId="moon-chart" text={t('charts.moonChartNote')} glossary={['chandra-kundli']} divider={false} testID="moon-chart-row">
        <Txt kind="body" color="ink2">
          {t('charts.moonChartNote')}
        </Txt>
      </Row>
    ) : null;

  const bornCaption =
    base && profile ? (
      <View style={styles.bornRow} testID="born-caption">
        <RichText
          kind="caption"
          color="ink2"
          text={t(profile.timeUnknown ? 'charts.bornLineUnknown' : 'charts.bornLine', {
            date: fmtBirthDate(profile.birthDate, lang),
            time: profile.birthTime ?? '',
            place: shortPlace(profile.placeName),
            style: styleName,
            ayanamsa: ayanamsaLabel,
            node: nodeLabel,
          })}
        />
        {!profile.timeUnknown && profile.timeApproxMinutes > 0 ? <ApproxTag minutes={profile.timeApproxMinutes} /> : null}
      </View>
    ) : null;

  return (
    <Screen title={t('charts.title')} route="Charts" scrollRef={scrollRef} testID="charts-screen">
      {!profile ? <EmptyState title={t('charts.title')} body={t('charts.noProfile')} /> : null}
      {pickerRow}
      {error ? (
        <Card>
          <Txt kind="body" color="accent">
            {t('errors.chart')}
          </Txt>
        </Card>
      ) : null}
      {base && hero && profile ? (
        <>
          <Card testID="hero-card">
            <View style={styles.heroHead}>
              <View style={styles.heroTitle}>
                <Txt kind="heading" accessibilityRole="header" testID="hero-title">
                  {heroTitle(activeChip, base, t)}
                </Txt>
              </View>
              <Pressable44
                accessibilityLabel={t('charts.optionsA11y')}
                accessibilityState={{ expanded: sheet?.kind === 'menu' }}
                onPress={() => setSheet({ kind: 'menu' })}
                style={[styles.menuButton, sheet?.kind === 'menu' && { borderColor: colors.accent, backgroundColor: colors.accentTint }]}
                testID="style-menu-button"
              >
                <MoreIcon color={colors.ink} />
              </Pressable44>
            </View>
            {lagnaRow}
            <View style={styles.chartBox} onLayout={(e) => setMeasured(Math.round(e.nativeEvent.layout.width))}>
              <Chart
                style={style}
                chart={hero}
                width={width}
                styleName={styleName}
                centreLines={style === 'north' ? undefined : [profileLabel(profile, t), `${ayanamsaLabel} · ${nodeLabel}`]}
                onPressPlanet={(id) => openPlanet(id)}
                onPressHouse={(n) => setSheet({ kind: 'house', n })}
                onLongPress={onLongPress}
                testID="chart"
              />
            </View>
            {bornCaption}
            <Txt kind="caption" color="ink3" style={styles.hint}>
              {t('charts.tapHint')}
            </Txt>
          </Card>

          <Card testID="planets-card" onLayout={(e) => onAnchorLayout('planets', e)}>
            <View style={styles.heroHead}>
              <Txt kind="heading" accessibilityRole="header" style={styles.heroTitle}>
                {t('charts.planets')}
              </Txt>
              <Pressable44 accessibilityLabel={t('charts.legendTitle')} onPress={() => setSheet({ kind: 'legend' })} style={styles.link} testID="legend-button">
                <Txt kind="label" weight={600} color="accent">
                  {t('charts.legend')}
                </Txt>
              </Pressable44>
            </View>
            <PlanetTable chart={base} approxMinutes={profile.timeApproxMinutes} onPressRow={openRow} testID="planet-table" />
            <Txt kind="caption" color="ink3" style={styles.hint}>
              {t('charts.approxFooter')}
            </Txt>
          </Card>

          {!base.moonChart ? (
            <View onLayout={(e) => onAnchorLayout('houses', e)} testID="houses-anchor">
              <HousesCard chart={base} onPressHouse={(n) => setSheet({ kind: 'house', n })} testID="houses-card" />
            </View>
          ) : null}

          {tree ? (
            <DashaCard
              chart={base}
              tree={tree}
              nowMs={nowMs}
              tz={profile.tz}
              ayanamsaLabel={ayanamsaLabel}
              onFullTree={() => router.push(`/charts/dasha-tree?profile=${profile.id}`)}
              onPressPro={() => setSheet({ kind: 'pro' })}
              alerts={accessPratyantar.allowed ? { pro: true, on: dashaAlerts, onToggle: toggleDashaAlerts } : undefined}
              testID="dasha-card"
            />
          ) : null}

          {yogaReport ? (
            <View onLayout={(e) => onAnchorLayout('yogas', e)} testID="yogas-anchor">
              <YogasCard report={yogaReport} testID="yogas-card" />
            </View>
          ) : null}

          {sade ? (
            <View onLayout={(e) => onAnchorLayout('sadesati', e)} testID="sadesati-anchor">
              <SadeSatiCard report={sade} tz={profile.tz} ayanamsaLabel={ayanamsaLabel} nowMs={nowMs} testID="sadesati-card" />
            </View>
          ) : null}

          {vedicYear && promoted ? (
            <VarshaphalCard
              vedicYear={vedicYear}
              nowMs={nowMs}
              tz={profile.tz}
              access={accessVarshaphal}
              notifyOn={yearBegins}
              onToggleNotify={toggleYearBegins}
              onOpen={() => (accessVarshaphal.allowed ? router.push(`/charts/varshaphal?profile=${profile.id}&year=${vedicYear.nextYear}`) : setSheet({ kind: 'unlock', feature: 'varshaphal' }))}
              testID="varshaphal-card"
            />
          ) : null}

          {vedicYear ? (
            <MoreFromChartCard access={access} nowMs={nowMs} tz={profile.tz} vedicYearStart={vedicYear.runningStart} onOpen={openFeature} onUnlock={(key) => setSheet({ kind: 'unlock', feature: key })} testID="more-card" />
          ) : null}

          <TimingDocumentsCard
            onMuhurat={() => router.push(TIMING_ROUTES.muhuratFinder)}
            onJanamPatri={() => router.push(`${TIMING_ROUTES.janamPatriPdf}?profile=${profile.id}`)}
            onShareCard={() => setSheet({ kind: 'shareCard' })}
            testID="timing-card"
          />

          <ComputedFooter
            ayanamsa={`${ayanamsaLabel} (${base.meta.ayanamsaDegrees.toFixed(4)}°)`}
            node={base.meta.nodeMethod}
            ephemeris={t('panchang.ephemeris', { ephemeris: base.meta.ephemeris })}
            tz={base.meta.tz}
            rounding={t('charts.rounding')}
            extra={[
              t('charts.housesLine', { system: t('charts.houseSystem.whole-sign') }),
              t('charts.orbsLine', {
                orbs: Object.entries(base.meta.combustionOrbs)
                  .map(([k, v]) => `${k} ${v}`)
                  .join(', '),
              }),
            ]}
          />

          {sheet?.kind === 'planet' ? <PlanetSheet visible onClose={() => setSheet(null)} chart={base} subject={sheet.subject} approxMinutes={profile.timeApproxMinutes} /> : null}
          {sheet?.kind === 'house' ? <HouseSheet visible onClose={() => setSheet(null)} chart={base} house={sheet.n} onPressPlanet={openPlanet} /> : null}
          {sheet?.kind === 'legend' ? <LegendSheet visible onClose={() => setSheet(null)} /> : null}
          {sheet?.kind === 'glossary' ? <GlossarySheet visible onClose={() => setSheet(null)} id={sheet.id} term={sheet.term} /> : null}
          {sheet?.kind === 'menu' ? <StyleMenu visible onClose={() => setSheet(null)} style={style} onSelectStyle={selectStyle} onLegend={() => setSheet({ kind: 'legend' })} onShareCard={() => setSheet({ kind: 'shareCard' })} /> : null}
          {sheet?.kind === 'pro' ? <CapSheet visible onClose={() => setSheet(null)} reason="pro_feature" /> : null}
          {sheet?.kind === 'vargas' ? (
            <VargaSheet
              visible
              onClose={() => setSheet(null)}
              access={accessVargas}
              selected={selectedVarga}
              onSelect={(id) => {
                setChip(id);
                setSheet(null);
              }}
              onUnlocked={() => setNowMs(now ? now() : Date.now())}
              onOpenFull={(id) => {
                setSheet(null);
                router.push(`/charts/vargas?profile=${profile.id}&varga=${id}`);
              }}
              nowMs={nowMs}
              tz={profile.tz}
            />
          ) : null}
          {sheet?.kind === 'shareCard' ? (
            <SharePreviewSheet
              visible
              onClose={() => setSheet(null)}
              title={t('share.cardKundli')}
              hasBirthTime
              renderCard={(ref: RefObject<CardView | null>, showBirthTime: boolean) => <KundliCard ref={ref} profile={profile} chart={hero} style={style} label={profileLabel(profile, t)} showBirthTime={showBirthTime} />}
            />
          ) : null}
          {sheet?.kind === 'unlock' ? <UnlockSheet visible onClose={() => setSheet(null)} feature={sheet.feature} onUnlocked={() => setNowMs(now ? now() : Date.now())} /> : null}
        </>
      ) : null}
      {sheet?.kind === 'profiles' && profile ? (
        <ProfileSheet
          visible
          onClose={() => setSheet(null)}
          profiles={profiles}
          selectedId={profile.id}
          onSelect={(id) => {
            setSelectedId(id);
            setSheet(null);
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 16 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: radius.pill, paddingLeft: 8, paddingRight: 10 },
  initial: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  heroHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heroTitle: { flex: 1, minWidth: 0 },
  menuButton: { borderWidth: 1, borderColor: 'transparent', borderRadius: radius.button },
  link: { paddingHorizontal: 8 },
  chartBox: { alignSelf: 'stretch', alignItems: 'center', marginTop: 8 },
  bornRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 12 },
  hint: { marginTop: 8 },
});
