// Full Vimshottari tree (F14, design.md 10.3 M13): pinned "You are here · <date> · <maha> – <antar>" header, then an
// accordion maha -> antar -> pratyantar with exact dates in tabular numerals. The running maha and antar start expanded.
// Pratyantar rows are free-tier locked: the lord order is listed with a Pro tag and no dates; tapping one opens the
// honest "Pro is not in this build yet" sheet until B03 (entitlements.canSeeFeature is the only gate).
import { current, type DashaNode } from '@shubhvela/engine';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, CapSheet, ChevronIcon, Num, Pressable44, Screen, Tag, Txt } from '../../src/components';
import { dateRange, planetName } from '../../src/charts/model';
import { getProfile } from '../../src/db/profiles';
import { canSeeFeature } from '../../src/entitlements';
import { chartFor, dashaFor } from '../../src/engine-bridge/charts';
import { useLang } from '../../src/i18n';
import { useTokens } from '../../src/theme/ThemeProvider';
import { fmtDate } from '../../src/today/format';
import { RichText } from '../../src/today/RichText';

export interface DashaTreeScreenProps {
  /** Clock for tests. */
  now?: () => number;
  /** Profile id for tests (production reads the route param). */
  profileId?: number;
}

export default function DashaTreeScreen({ now, profileId }: DashaTreeScreenProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const params = useLocalSearchParams<{ profile?: string }>();
  const id = profileId ?? Number(params.profile);
  const profile = Number.isFinite(id) ? getProfile(id) : null;
  const [nowMs] = useState(() => (now ? now() : Date.now()));
  const [capOpen, setCapOpen] = useState(false);
  const [openMaha, setOpenMaha] = useState<string | null>(null);
  const [openAntar, setOpenAntar] = useState<string | null>(null);

  if (!profile) {
    return (
      <Screen title={t('dasha.treeTitle')} chrome="stack" testID="dasha-tree-screen">
        <Txt kind="body" color="ink2">
          {t('charts.noProfile')}
        </Txt>
      </Screen>
    );
  }
  const chart = chartFor(profile);
  const tree = dashaFor(chart);
  const cur = current(tree, nowMs);
  const tz = profile.tz;
  const pratyantarAllowed = canSeeFeature('dasha_pratyantar', new Date(nowMs)).allowed;
  const keyOf = (n: DashaNode) => `${n.level}-${n.lord}-${n.start}`;
  const mahaOpen = openMaha ?? (cur ? keyOf(cur.maha) : null);
  const antarOpen = openAntar ?? (cur ? keyOf(cur.antar) : null);

  const pinned = cur ? (
    <View testID="dasha-here">
      <RichText kind="label" weight={600} color="accent" text={t('dasha.youAreHere', { date: fmtDate(nowMs, tz, lang) })} />
      <Txt kind="caption" color="ink2">
        {t('dasha.pair', { maha: planetName(lang, cur.maha.lord), antar: planetName(lang, cur.antar.lord) })}
        {pratyantarAllowed ? ` – ${planetName(lang, cur.pratyantar.lord)}` : ''}
      </Txt>
    </View>
  ) : null;

  const divider = { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hair };

  return (
    <Screen title={t('charts.treeFor', { name: profile.name ?? t(`family.relation.${profile.relationship}`) })} chrome="stack" pinned={pinned} testID="dasha-tree-screen">
      <Card flush>
        {tree.mahas.map((m, mi) => {
          const mk = keyOf(m);
          const isOpen = mahaOpen === mk;
          const isCur = cur ? cur.maha === m : false;
          return (
            <View key={mk} style={mi < tree.mahas.length - 1 ? divider : undefined}>
              <Pressable44
                accessibilityLabel={`${t('dasha.lordOf', { lord: planetName(lang, m.lord), level: t('dasha.levelMaha') })}, ${fmtDate(m.start, tz, lang)} – ${fmtDate(m.end, tz, lang)}`}
                accessibilityHint={t('dasha.expandA11y', { lord: planetName(lang, m.lord) })}
                accessibilityState={{ expanded: isOpen }}
                onPress={() => setOpenMaha(isOpen ? '' : mk)}
                style={[styles.row, isCur && { backgroundColor: colors.accentTint }]}
                testID={`maha-${m.lord}`}
              >
                <View style={styles.rowText}>
                  <Txt kind="label" weight={600}>
                    {t('dasha.lordOf', { lord: planetName(lang, m.lord), level: t('dasha.levelMaha') })}
                    {isCur ? <Txt kind="label" weight={400} color="accent">{` ${t('dasha.current')}`}</Txt> : null}
                  </Txt>
                  <Num kind="caption" color="ink2">
                    {dateRange(m.start, m.end, tz, lang, t)}
                  </Num>
                </View>
                <View style={isOpen ? styles.chevronOpen : undefined}>
                  <ChevronIcon color={colors.ink3} />
                </View>
              </Pressable44>
              {isOpen
                ? (m.children ?? []).map((a, ai) => {
                    const ak = keyOf(a);
                    const aOpen = antarOpen === ak;
                    const aCur = cur ? cur.antar === a : false;
                    return (
                      <View key={ak} style={[styles.antar, { borderLeftColor: colors.hair2 }, ai < (m.children?.length ?? 0) - 1 && divider]}>
                        <Pressable44
                          accessibilityLabel={`${t('dasha.lordOf', { lord: planetName(lang, a.lord), level: t('dasha.levelAntar') })}, ${fmtDate(a.start, tz, lang)} – ${fmtDate(a.end, tz, lang)}`}
                          accessibilityHint={t('dasha.expandAntarA11y', { lord: planetName(lang, a.lord) })}
                          accessibilityState={{ expanded: aOpen }}
                          onPress={() => setOpenAntar(aOpen ? '' : ak)}
                          style={[styles.row, aCur && { backgroundColor: colors.accentTint }]}
                          testID={`antar-${m.lord}-${a.lord}`}
                        >
                          <View style={styles.rowText}>
                            <Txt kind="label" weight={aCur ? 600 : 400}>
                              {t('dasha.pair', { maha: planetName(lang, m.lord), antar: planetName(lang, a.lord) })}
                              {aCur ? <Txt kind="label" weight={400} color="accent">{` ${t('dasha.current')}`}</Txt> : null}
                            </Txt>
                            <Num kind="caption" color="ink2">
                              {dateRange(a.start, a.end, tz, lang, t)}
                            </Num>
                          </View>
                          <View style={aOpen ? styles.chevronOpen : undefined}>
                            <ChevronIcon color={colors.ink3} />
                          </View>
                        </Pressable44>
                        {aOpen
                          ? (a.children ?? []).map((p) =>
                              pratyantarAllowed ? (
                                <View key={keyOf(p)} style={[styles.pratyantar, { borderLeftColor: colors.hair }]} testID={`pratyantar-${a.lord}-${p.lord}`}>
                                  <Txt kind="caption" weight={cur && cur.pratyantar === p ? 600 : 400} style={styles.rowText}>
                                    {planetName(lang, p.lord)}
                                  </Txt>
                                  <Num kind="caption" color="ink2">
                                    {dateRange(p.start, p.end, tz, lang, t)}
                                  </Num>
                                </View>
                              ) : (
                                <Pressable44
                                  key={keyOf(p)}
                                  accessibilityLabel={t('dasha.pratyantarLocked', { lord: planetName(lang, a.lord) })}
                                  onPress={() => setCapOpen(true)}
                                  style={[styles.pratyantar, { borderLeftColor: colors.hair }]}
                                  testID={`pratyantar-${a.lord}-${p.lord}`}
                                >
                                  <Txt kind="caption" color="ink2" style={styles.rowText}>
                                    {t('dasha.lordOf', { lord: planetName(lang, p.lord), level: t('dasha.levelPratyantar') })}
                                  </Txt>
                                  <Tag variant="kind">{t('dasha.pro_tag')}</Tag>
                                </Pressable44>
                              ),
                            )
                          : null}
                      </View>
                    );
                  })
                : null}
            </View>
          );
        })}
      </Card>
      <Txt kind="caption" color="ink3">
        {t('dasha.balance', { lord: planetName(lang, tree.balanceAtBirth.lord), years: tree.balanceAtBirth.years.toFixed(2) })}
      </Txt>
      <CapSheet visible={capOpen} onClose={() => setCapOpen(false)} reason="pro_feature" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'stretch' },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  antar: { marginLeft: 16, borderLeftWidth: 2 },
  pratyantar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginLeft: 16, paddingLeft: 16, paddingRight: 16, paddingVertical: 8, borderLeftWidth: 1, alignSelf: 'stretch' },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
});
