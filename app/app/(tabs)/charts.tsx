// Charts (design.md 4, 10.3; plan A11). Header (title + gear); ONE row with the profile picker pill (the only
// profile control on this screen) and the chart-type chips Lagna · Moon · Sun · Chalit · D9 (scrolls horizontally);
// hero card = title, Lagna line with approx tag + Why?, the ⋮ menu (North/South/East radios + Legend), the Chart,
// the birth caption; Planets card (fixed-column table + Legend); Houses card (N6); Dasha card; Sade Sati card;
// "How this was computed". Unknown birth time (F2) switches the hero to "Moon chart · birth time unknown", hides the
// Lagna/Chalit chips, the Lagna row and the Houses card. Not rendered in Phase A because they are not built: the
// "14 more vargas" chip (B04), yogas (B04), Varshaphal/Prashna rows (B/C), "Share chart card" (B07).
// Every number is engine output for the chosen profile under the F19 settings; sheets never nest (one open at a time).
import type { ChartData, PlanetId } from '@shubhvela/engine';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, CapSheet, Chip, ChevronIcon, ComputedFooter, EmptyState, MoreIcon, Pressable44, Row, Screen, Txt, ApproxTag } from '../../src/components';
import { Chart, type ChartLongPressTarget } from '../../src/charts/Chart';
import { DashaCard } from '../../src/charts/DashaCard';
import { HousesCard } from '../../src/charts/HousesCard';
import { CHIP_KEY, approxRuleId, chartForChip, chipsFor, degreeText, fmtBirthDate, heroTitle, nakshatraName, planetName, PLANET_SLUG, shortPlace, signName, signSlug, type ChartVariantChip } from '../../src/charts/model';
import { PlanetTable, type TableSubject } from '../../src/charts/PlanetTable';
import { SadeSatiCard } from '../../src/charts/SadeSatiCard';
import { GlossarySheet, HouseSheet, LegendSheet, PlanetSheet, ProfileSheet, StyleMenu, profileLabel, type PlanetSheetSubject } from '../../src/charts/sheets';
import type { Profile } from '../../src/db/profiles';
import { getSetting, setSetting, type ChartStyle } from '../../src/db/settings';
import { chartFor, dashaFor, sadeSatiFor } from '../../src/engine-bridge/charts';
import { useLang } from '../../src/i18n';
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
  | { kind: 'pro' };

export interface ChartsScreenProps {
  /** Clock for tests; production uses Date.now(). */
  now?: () => number;
  /** Hero width for tests; measured by onLayout otherwise (card inner width). */
  chartWidth?: number;
}

/** Hero width before onLayout: 390 dp - 2 x 16 gutter - 2 x 16 card padding. */
const DEFAULT_CHART_WIDTH = 326;

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

export default function ChartsScreen({ now, chartWidth }: ChartsScreenProps) {
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
  // Settings (chart style, ayanamsa, node) may change on pushed screens: re-read on focus, together with the clock.
  // chartFor() is memoised per profile + settings, so the re-render picks up a recomputed chart (F19) by itself.
  useFocusEffect(
    useCallback(() => {
      setStyle(getSetting('chartStyle'));
      setNowMs(now ? now() : Date.now());
    }, [now]),
  );

  const profile: Profile | null = profiles.find((p) => p.id === selectedId) ?? self ?? profiles[0] ?? null;
  const width = chartWidth ?? measured ?? DEFAULT_CHART_WIDTH;

  const { chart: base, error } = safeChart(profile);
  const chips = base ? chipsFor(base) : [];
  const activeChip: ChartVariantChip = base && !chips.includes(chip) ? (base.moonChart ? 'moon' : 'lagna') : chip;
  // All three are memoised in their modules per chart object (and instant), so a re-render costs nothing.
  const hero = base ? chartForChip(base, activeChip) : null;
  const tree = base ? dashaFor(base) : null;
  const sade = base ? sadeSatiFor(base, nowMs) : null;

  const ayanamsaLabel = base ? shortValue(t(AYANAMSA_KEY[base.meta.ayanamsa])) : '';
  const nodeLabel = base ? shortValue(t(NODE_KEY[base.meta.node])) : '';
  const styleName = t(CHART_STYLE_KEY[style]);

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
    <Screen title={t('charts.title')} route="Charts" testID="charts-screen">
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

          <Card testID="planets-card">
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

          {!base.moonChart ? <HousesCard chart={base} onPressHouse={(n) => setSheet({ kind: 'house', n })} testID="houses-card" /> : null}

          {tree ? (
            <DashaCard
              chart={base}
              tree={tree}
              nowMs={nowMs}
              tz={profile.tz}
              ayanamsaLabel={ayanamsaLabel}
              onFullTree={() => router.push(`/charts/dasha-tree?profile=${profile.id}`)}
              onPressPro={() => setSheet({ kind: 'pro' })}
              testID="dasha-card"
            />
          ) : null}

          {sade ? <SadeSatiCard report={sade} tz={profile.tz} ayanamsaLabel={ayanamsaLabel} nowMs={nowMs} testID="sadesati-card" /> : null}

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
          {sheet?.kind === 'menu' ? <StyleMenu visible onClose={() => setSheet(null)} style={style} onSelectStyle={selectStyle} onLegend={() => setSheet({ kind: 'legend' })} /> : null}
          {sheet?.kind === 'pro' ? <CapSheet visible onClose={() => setSheet(null)} reason="pro_feature" /> : null}
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
