// Naamkaran helper (F28, design.md 10.5 F28; plan B05): route /family/naamkaran?profile=<id>. Profile chips (preselects
// the route profile, else the youngest profile under one year, else the self profile); the card "Suggested starting
// syllables · <nakshatra> <pada> → <syllables>" lists the pada's syllable first and the nakshatra's other three as
// chips; tapping a chip lists that syllable's names from corpus/naamkaran-names in Devanagari + Latin (no meanings
// claimed); "Why?" opens the nakshatra-pada -> syllable rule with the Moon inputs. Reached from the Family tools card
// (B06) and from a newborn profile's editor. Every syllable is engine.syllablesForChart() output.
import { naamkaranNames } from '@shubhvela/content';
import { syllablesForChart, type NaamkaranResult } from '@shubhvela/engine';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useMountClock } from '../../src/charts/LockedFeature';
import { ApproxTag, Card, Chip, EmptyState, Latin, Row, Screen, Txt } from '../../src/components';
import { chartFor, moonLine } from '../../src/engine-bridge/charts';
import { isNewborn, preselect, syllableOrder } from '../../src/family/naamkaranModel';
import { useLang } from '../../src/i18n';
import { profileLabel } from '../../src/muhurat/ForField';
import { useProfiles } from '../../src/profiles/useProfiles';
import { nakshatraName } from '../../src/today/format';

export interface NaamkaranScreenProps {
  now?: () => number;
  profileId?: number;
}

export default function NaamkaranScreen({ now, profileId }: NaamkaranScreenProps) {
  const { t, lang } = useLang();
  const nowMs = useMountClock(now);
  const params = useLocalSearchParams<{ profile?: string }>();
  const routeId = profileId ?? (params.profile ? Number(params.profile) : NaN);
  const { profiles } = useProfiles();
  const [chosenId, setChosenId] = useState<number | null>(() => preselect(profiles, Number.isFinite(routeId) ? routeId : null, nowMs)?.id ?? null);
  const [padaOpen, setPadaOpen] = useState<number | null>(null);
  const profile = profiles.find((p) => p.id === chosenId) ?? null;

  if (!profile) {
    return (
      <Screen title={t('naamkaran.title')} chrome="stack" testID="naamkaran-screen">
        <EmptyState title={t('naamkaran.title')} body={t('charts.noProfile')} />
      </Screen>
    );
  }

  let result: NaamkaranResult | null = null;
  let moon: ReturnType<typeof moonLine> | null = null;
  try {
    const chart = chartFor(profile);
    result = syllablesForChart(chart);
    moon = moonLine(chart, lang);
  } catch (e) {
    if (__DEV__) console.warn('naamkaran failed', e);
  }
  const order = result ? syllableOrder(result) : [];
  const openPada = padaOpen ?? result?.pada ?? null;
  const names = result && openPada ? naamkaranNames(result.nakshatra, openPada, lang) : null;
  const nak = result ? nakshatraName(lang, result.nakshatra) : '';
  const cardTitle = result ? t('naamkaran.cardTitle', { nakshatra: nak, pada: result.pada, syllables: order.map((s) => `${s.devanagari} (${s.latin})`).join(', ') }) : '';

  return (
    <Screen title={t('naamkaran.title')} chrome="stack" testID="naamkaran-screen">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('naamkaran.pickProfile')} testID="naamkaran-profiles">
        {profiles.map((p) => (
          <Chip
            key={p.id}
            label={profileLabel(p, t)}
            caption={isNewborn(p, nowMs) ? t('naamkaran.newborn') : undefined}
            selected={p.id === profile.id}
            onPress={() => {
              setChosenId(p.id);
              setPadaOpen(null);
            }}
            testID={`naamkaran-profile-${p.id}`}
          />
        ))}
      </ScrollView>

      {result && moon ? (
        <Card testID="naamkaran-card">
          <Row
            ruleId={result.ruleId}
            text={cardTitle}
            inputs={{
              [t('naamkaran.forProfile', { name: profileLabel(profile, t), nakshatra: nak, pada: result.pada })]: `${nak} ${result.pada}`,
              [t('panchang.nakshatra')]: nak,
              [t('naamkaran.padaSyllable', { pada: result.pada })]: `${result.syllable.devanagari} (${result.syllable.latin})`,
              [t('naamkaran.otherSyllables', { nakshatra: nak })]: order.slice(1).map((s) => `${s.devanagari} (${s.latin})`).join(', '),
            }}
            glossary={['nakshatra', 'pada', 'naamkaran']}
            divider={false}
            testID="naamkaran-row"
          >
            <Txt kind="heading" accessibilityRole="header">
              {t('naamkaran.syllables')}
            </Txt>
            <View style={styles.forRow}>
              <Txt kind="label" weight={400} color="ink2" testID="naamkaran-for">
                {t('naamkaran.forProfile', { name: profileLabel(profile, t), nakshatra: nak, pada: result.pada })}
              </Txt>
              {moon.approx ? <ApproxTag minutes={profile.timeApproxMinutes || undefined} /> : null}
            </View>
          </Row>
          <View style={styles.syllables} accessibilityRole="radiogroup" accessibilityLabel={t('naamkaran.syllables')}>
            {order.map((s) => (
              <Chip
                key={s.pada}
                label={`${s.devanagari} · ${s.latin}`}
                caption={s.pada === result.pada ? t('naamkaran.padaSyllable', { pada: s.pada }) : undefined}
                selected={s.pada === openPada}
                onPress={() => setPadaOpen(s.pada)}
                accessibilityLabel={t('naamkaran.syllableA11y', { dev: s.devanagari, lat: s.latin })}
                testID={`syllable-${s.pada}`}
              />
            ))}
          </View>
          {names && openPada ? (
            <View style={styles.names} testID="naamkaran-names">
              <Txt kind="label" weight={600}>
                {t('naamkaran.namesFor', { syllable: `${names.item.syllable.dev} (${names.item.syllable.lat})` })}
              </Txt>
              {names.item.names.map((n, i) => (
                <View key={`${n.lat}-${i}`} style={styles.nameRow} testID={`name-${openPada}-${i}`}>
                  <Txt kind="body" weight={600}>
                    {n.dev}
                  </Txt>
                  <Latin kind="body" color="ink2">
                    {n.lat}
                  </Latin>
                </View>
              ))}
              {names.item.note ? (
                <Txt kind="caption" color="ink3">
                  {`${t('naamkaran.note')}: ${names.item.note}`}
                </Txt>
              ) : null}
              <Txt kind="caption" color="ink3" testID="naamkaran-no-meaning">
                {t('naamkaran.noMeaning')}
              </Txt>
            </View>
          ) : null}
        </Card>
      ) : (
        <Card>
          <Txt kind="body" color="accent">
            {t('errors.chart')}
          </Txt>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { gap: 8, paddingRight: 16 },
  forRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 2 },
  syllables: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  names: { marginTop: 12, gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
});
