// Chart sheets (F13 basic, design.md 4 / 10.3). ONE Sheet is open at a time (the Charts screen keeps a single
// `sheet` state), so no Modal ever nests another: the Why? inside the planet sheet expands in place and the house sheet
// swaps to the planet sheet. Snippets come from the corpus in the resolved language (bho -> hi -> en, carry-over
// A-INFO-1) and every snippet shows its rule id; the Why? reveals the rule sentence, the inputs and the source.
import { glossaryTerm, lookup, ruleText, type CorpusLookup } from '@shubhvela/content';
import type { ChartData, ChartPlanet, PlanetId } from '@shubhvela/engine';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Profile } from '../db/profiles';
import type { ChartStyle } from '../db/settings';
import { Num, NoBreak } from '../components/Num';
import { ChevronIcon } from '../components/icons';
import { RadioRow } from '../components/ListRows';
import { Pressable44 } from '../components/Pressable44';
import { Sheet } from '../components/Sheet';
import { Tag, ApproxTag } from '../components/Tag';
import { Txt } from '../components/Txt';
import { useLang, type TFn } from '../i18n';
import { CHART_STYLE_KEY } from '../settingsLabels';
import { useTokens } from '../theme/ThemeProvider';
import { approxRuleId, degreeText, lagnaId, nakshatraName, padaText, planetHouseId, planetName, planetSignId, signName, tagsFor } from './model';

// ---- shared pieces ----

interface SnippetBlockProps {
  heading: string;
  snippet: CorpusLookup | null;
  /** Rules-corpus id whose sentence the Why? shows; falls back to the snippet's own `rule` field. */
  ruleId: string;
  inputs?: Record<string, string | number>;
  testID?: string;
}

/** Heading + corpus text + "Rule <id>" caption + a 44 dp Why? that expands the rule sentence and source in place. */
function SnippetBlock({ heading, snippet, ruleId, inputs, testID }: SnippetBlockProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const [open, setOpen] = useState(false);
  const rule = ruleText(ruleId, lang);
  const ruleSentence = rule?.text ?? snippet?.snippet.rule ?? null;
  const source = rule?.snippet.source ?? snippet?.snippet.source;
  return (
    <View style={styles.block} testID={testID}>
      <View style={styles.blockHead}>
        <Txt kind="label" weight={600} style={styles.blockTitle}>
          {heading}
        </Txt>
        <Pressable44 accessibilityLabel={`${t('common.why')} ${heading}`} accessibilityState={{ expanded: open }} onPress={() => setOpen((o) => !o)} style={styles.why} testID={testID ? `${testID}-why` : undefined}>
          <Txt kind="label" weight={600} color="accent">
            {open ? t('common.less') : t('common.why')}
          </Txt>
        </Pressable44>
      </View>
      <Txt kind="body">{snippet?.text ?? ruleSentence ?? ruleId}</Txt>
      <Num kind="micro" color="ink3">
        {t('charts.ruleLabel', { id: snippet?.snippet.id ?? ruleId })}
      </Num>
      {open ? (
        <View style={[styles.whyBox, { borderColor: colors.hair, backgroundColor: colors.paper }]} testID={testID ? `${testID}-rule` : undefined}>
          <Txt kind="micro" weight={600} color="ink3">
            {t('common.rule')}
          </Txt>
          <Txt kind="caption">{ruleSentence ?? ruleId}</Txt>
          {inputs && Object.keys(inputs).length ? (
            <>
              <Txt kind="micro" weight={600} color="ink3" style={styles.whyLabel}>
                {t('common.inputs')}
              </Txt>
              {Object.entries(inputs).map(([k, v]) => (
                <Txt key={k} kind="caption" color="ink2">
                  {`${k}: ${v}`}
                </Txt>
              ))}
            </>
          ) : null}
          <Txt kind="micro" weight={600} color="ink3" style={styles.whyLabel}>
            {t('common.source')}
          </Txt>
          <Txt kind="caption" color="ink2">
            {source && source !== 'convention' ? source : t('common.sourceConvention')}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

/** "Mars in the 1st house (Meena)" (planet) or "Lagna Meena". */
export function planetSheetTitle(subject: PlanetSheetSubject, chart: ChartData, t: TFn, lang: 'en' | 'hi' | 'bho'): string {
  if (subject.kind === 'lagna') return t('charts.lagnaLine', { sign: signName(lang, chart.lagna?.sign ?? chart.firstHouseSign) });
  const p = chart.planets.find((x) => x.id === subject.id);
  if (!p) return planetName(lang, subject.id);
  if (chart.moonChart) return t('charts.planetInSign', { planet: planetName(lang, p.id), sign: signName(lang, p.sign) });
  return t('charts.planetSheetTitle', { planet: planetName(lang, p.id), house: t(`charts.houseOrdinal.${p.house}`), sign: signName(lang, p.sign) });
}

export type PlanetSheetSubject = { kind: 'planet'; id: PlanetId } | { kind: 'lagna' };

export interface PlanetSheetProps {
  visible: boolean;
  onClose: () => void;
  chart: ChartData;
  subject: PlanetSheetSubject;
  approxMinutes: number;
}

export function PlanetSheet({ visible, onClose, chart, subject, approxMinutes }: PlanetSheetProps) {
  const { t, lang } = useLang();
  const title = planetSheetTitle(subject, chart, t, lang);
  const point: ChartPlanet | ChartData['lagna'] = subject.kind === 'lagna' ? chart.lagna : chart.planets.find((x) => x.id === subject.id);
  if (!point) return null;
  const tags = subject.kind === 'planet' ? tagsFor(point as ChartPlanet) : point.approx ? ['approx'] : [];
  const position = t('charts.positionLine', { sign: signName(lang, point.sign), degree: degreeText(point, t), nakshatra: padaText(point, lang, t) });
  const commonInputs = { [t('charts.sign_col')]: `${signName(lang, point.sign)} ${degreeText(point, t)}`, [t('charts.nakshatra_col')]: `${nakshatraName(lang, point.nakshatra)} ${point.pada}` };

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.position}>
        <Txt kind="label" weight={400} color="ink2" accessibilityLabel={position} testID="sheet-position">
          {signName(lang, point.sign)}{' '}
          <Num kind="label" weight={400} color="ink2">
            {degreeText(point, t)}
          </Num>
          {' · '}
          <NoBreak kind="label" weight={400} color="ink2">
            {padaText(point, lang, t)}
          </NoBreak>
        </Txt>
        {tags.length ? (
          <View style={styles.tags}>
            {tags.map((tag) => (tag === 'approx' ? <ApproxTag key={tag} minutes={approxMinutes || undefined} /> : <Tag key={tag} variant="dignity">{t(`dignity.${tag}`)}</Tag>))}
          </View>
        ) : null}
      </View>
      {subject.kind === 'lagna' ? (
        <SnippetBlock heading={t('charts.lagna')} snippet={lookup('lagna', lagnaId(point.sign), lang)} ruleId="lagna" inputs={commonInputs} testID="sheet-lagna" />
      ) : (
        <>
          <SnippetBlock
            heading={t('charts.planetInSign', { planet: planetName(lang, subject.id), sign: signName(lang, point.sign) })}
            snippet={lookup('planet-sign', planetSignId(subject.id, point.sign), lang)}
            ruleId={`dignity-${(point as ChartPlanet).tags.find((x) => ['exalted', 'debilitated', 'own', 'friend', 'enemy', 'neutral'].includes(x)) ?? 'neutral'}`}
            inputs={commonInputs}
            testID="sheet-planet-sign"
          />
          {chart.moonChart ? (
            <Txt kind="caption" color="ink2" testID="sheet-moon-note">
              {t('charts.moonChartNote')}
            </Txt>
          ) : (
            <SnippetBlock
              heading={t('charts.planetInHouse', { planet: planetName(lang, subject.id), house: t(`charts.houseOrdinal.${(point as ChartPlanet).house}`) })}
              snippet={lookup('planet-house', planetHouseId(subject.id, (point as ChartPlanet).house), lang)}
              ruleId="house-lord"
              inputs={{ ...commonInputs, [t('charts.houses')]: (point as ChartPlanet).house }}
              testID="sheet-planet-house"
            />
          )}
        </>
      )}
      {tags.length ? (
        <View style={styles.block}>
          <Txt kind="micro" weight={600} color="ink3">
            {t('charts.dignityHeading')}
          </Txt>
          {tags.map((tag) =>
            tag === 'approx' ? (
              <SnippetBlock
                key={tag}
                heading={t('dignity.approx')}
                snippet={lookup('dignity', subject.kind === 'lagna' ? 'approx-lagna' : 'approx-planet', lang)}
                ruleId={approxRuleId(approxMinutes)}
                inputs={approxMinutes ? { [t('onboarding.timeApprox')]: `±${approxMinutes} min` } : undefined}
                testID={`sheet-tag-${tag}`}
              />
            ) : (
              <SnippetBlock key={tag} heading={t(`dignity.${tag}`)} snippet={lookup('dignity', tag, lang)} ruleId={`dignity-${tag}`} inputs={commonInputs} testID={`sheet-tag-${tag}`} />
            ),
          )}
        </View>
      ) : null}
    </Sheet>
  );
}

// ---- house sheet ----

export interface HouseSheetProps {
  visible: boolean;
  onClose: () => void;
  chart: ChartData;
  house: number;
  onPressPlanet: (id: PlanetId) => void;
}

export function HouseSheet({ visible, onClose, chart, house, onPressPlanet }: HouseSheetProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const h = chart.houses.find((x) => x.n === house);
  if (!h) return null;
  const planets = chart.planets.filter((p) => p.house === house);
  return (
    <Sheet visible={visible} onClose={onClose} title={t('charts.houseSheetTitle', { n: h.n, sign: signName(lang, h.sign) })}>
      {!chart.moonChart ? (
        <Txt kind="label" weight={400} color="ink2" testID="house-sheet-lord">
          {t('charts.houseLord', { planet: planetName(lang, h.lord) })}
        </Txt>
      ) : null}
      {planets.length === 0 ? (
        <Txt kind="body" color="ink2" testID="house-sheet-empty">
          {t('charts.houseEmpty')}
        </Txt>
      ) : (
        planets.map((p, i) => (
          <Pressable44
            key={p.id}
            accessibilityLabel={`${planetName(lang, p.id)}, ${signName(lang, p.sign)} ${degreeText(p, t)}`}
            onPress={() => onPressPlanet(p.id)}
            style={[styles.houseRow, i < planets.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hair }]}
            testID={`house-sheet-planet-${p.id}`}
          >
            <View style={styles.houseRowText}>
              <Txt kind="label" weight={600}>
                {planetName(lang, p.id)}
              </Txt>
              <Txt kind="caption" color="ink2">
                {signName(lang, p.sign)}{' '}
                <Num kind="caption" color="ink2">
                  {degreeText(p, t)}
                </Num>
                {' · '}
                <NoBreak kind="caption" color="ink2">
                  {padaText(p, lang, t)}
                </NoBreak>
              </Txt>
            </View>
            <ChevronIcon color={colors.ink3} />
          </Pressable44>
        ))
      )}
    </Sheet>
  );
}

// ---- legend sheet ----

export const LEGEND_KEYS = ['exalted', 'debilitated', 'own', 'friend', 'enemy', 'neutral', 'combust', 'retro', 'vargottama', 'approx'] as const;

export function LegendSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useLang();
  const { colors } = useTokens();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('charts.legendTitle')}>
      {LEGEND_KEYS.map((k, i) => (
        <View key={k} style={[styles.legendRow, i < LEGEND_KEYS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hair }]} testID={`legend-item-${k}`}>
          {k === 'approx' ? <ApproxTag /> : <Tag variant="dignity">{t(`dignity.${k}`)}</Tag>}
          <Txt kind="caption" color="ink2" style={styles.legendText}>
            {t(`dignity.${k}Desc`)}
          </Txt>
        </View>
      ))}
      <Txt kind="caption" color="ink3">
        {t('charts.legendFooter')}
      </Txt>
    </Sheet>
  );
}

// ---- glossary one-liner (long-press) ----

export interface GlossarySheetProps {
  visible: boolean;
  onClose: () => void;
  /** Glossary id (planet or sign slug) and the display term used when the glossary has no entry. */
  id: string;
  term: string;
}

export function GlossarySheet({ visible, onClose, id, term }: GlossarySheetProps) {
  const { t, lang } = useLang();
  const entry = glossaryTerm(id, lang)?.item ?? null;
  return (
    <Sheet visible={visible} onClose={onClose} title={entry ? `${entry.term_dev} (${entry.term_lat})` : term}>
      <Txt kind="body" testID="glossary-text">
        {entry ? entry.meaning : t('charts.glossaryNone', { term })}
      </Txt>
      <Txt kind="caption" color="ink3">
        {t('common.glossary')}
      </Txt>
    </Sheet>
  );
}

// ---- style menu (the "⋮" overflow of the hero card, M2) ----

export interface StyleMenuProps {
  visible: boolean;
  onClose: () => void;
  style: ChartStyle;
  onSelectStyle: (s: ChartStyle) => void;
  onLegend: () => void;
}

export const STYLE_ORDER: readonly ChartStyle[] = ['north', 'south', 'east'];

export function StyleMenu({ visible, onClose, style, onSelectStyle, onLegend }: StyleMenuProps) {
  const { t } = useLang();
  const { colors } = useTokens();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('charts.options')}>
      <Txt kind="micro" weight={600} color="ink3">
        {t('charts.styleHeading')}
      </Txt>
      <View style={[styles.menuGroup, { borderColor: colors.hair }]} accessibilityRole="radiogroup">
        {STYLE_ORDER.map((s, i) => (
          <RadioRow key={s} title={t(CHART_STYLE_KEY[s])} selected={s === style} onPress={() => onSelectStyle(s)} divider={i < STYLE_ORDER.length - 1} testID={`style-${s}`} />
        ))}
      </View>
      <Pressable44 accessibilityRole="menuitem" accessibilityLabel={t('charts.legendTitle')} onPress={onLegend} style={styles.menuRow} testID="menu-legend">
        <Txt kind="label" weight={400} style={styles.menuRowText}>
          {t('charts.legendTitle')}
        </Txt>
        <ChevronIcon color={colors.ink3} />
      </Pressable44>
    </Sheet>
  );
}

// ---- profile picker sheet ----

export interface ProfileSheetProps {
  visible: boolean;
  onClose: () => void;
  profiles: readonly Profile[];
  selectedId: number;
  onSelect: (id: number) => void;
}

export function profileLabel(p: Profile, t: TFn): string {
  return p.name ?? t(`family.relation.${p.relationship}`);
}

export function ProfileSheet({ visible, onClose, profiles, selectedId, onSelect }: ProfileSheetProps) {
  const { t } = useLang();
  const { colors } = useTokens();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('charts.pickProfile')}>
      <View style={[styles.menuGroup, { borderColor: colors.hair }]} accessibilityRole="radiogroup">
        {profiles.map((p, i) => (
          <RadioRow
            key={p.id}
            title={profileLabel(p, t)}
            caption={`${p.birthDate}${p.timeUnknown ? ` · ${t('charts.moonUnknownTime')}` : ''} · ${p.placeName.split(',')[0]}`}
            selected={p.id === selectedId}
            onPress={() => onSelect(p.id)}
            divider={i < profiles.length - 1}
            testID={`pick-profile-${p.id}`}
          />
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  position: { gap: 6 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  block: { gap: 4 },
  blockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  blockTitle: { flex: 1 },
  why: { paddingHorizontal: 8 },
  whyBox: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 10, gap: 2, marginTop: 4 },
  whyLabel: { marginTop: 6 },
  houseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 8, alignSelf: 'stretch' },
  houseRowText: { flex: 1, minWidth: 0, gap: 2 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  legendText: { flex: 1 },
  menuGroup: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 10, alignSelf: 'stretch' },
  menuRowText: { flex: 1 },
});
