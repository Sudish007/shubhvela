// Matching pick screen (F29/F30, design.md 10.6; plan B06): route /family/match. Two PickerAB blocks (A = vara side,
// B = kanya side for the ordered kootas, with Swap), each a profile, the "Enter details" form, a scanned code or a typed
// code; "Match" validates both sides and pushes the result route with the sides as params. The scan route hands its
// code back through src/share/scanResult.ts when this screen regains focus. Nothing here is saved.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMountClock } from '../../../src/charts/LockedFeature';
import { Card, InlineNotice, PrimaryButton, Screen, TextButton, Txt } from '../../../src/components';
import { getSetting } from '../../../src/db/settings';
import { useLang } from '../../../src/i18n';
import { draftToSide, sameProfile, type SideDraft } from '../../../src/match/draft';
import { sidesToParams, type MatchSideKey } from '../../../src/match/model';
import { PickerAB } from '../../../src/match/PickerAB';
import { useProfiles } from '../../../src/profiles/useProfiles';
import { takeScanResult } from '../../../src/share/scanResult';

export interface MatchPickScreenProps {
  now?: () => number;
  /** Initial drafts (tests). */
  initial?: { a?: SideDraft | null; b?: SideDraft | null };
}

export default function MatchPickScreen({ now, initial }: MatchPickScreenProps) {
  const { t, lang } = useLang();
  const router = useRouter();
  const nowMs = useMountClock(now);
  const { profiles, self } = useProfiles();
  const [a, setA] = useState<SideDraft | null>(() => initial?.a ?? (self ? { mode: 'profile', id: self.id } : null));
  const [b, setB] = useState<SideDraft | null>(() => initial?.b ?? null);
  const [problem, setProblem] = useState<'sides' | 'same' | 'fix' | null>(null);
  const defaults = { tradition: getSetting('traditionDefault'), pdfLanguage: lang };

  // The scan route stores its decoded code and goes back; consume it for the side that asked.
  useFocusEffect(
    useCallback(() => {
      const r = takeScanResult();
      if (!r) return;
      const set = r.side === 'a' ? setA : setB;
      set(r.via ? { mode: 'scan', code: r.code, via: r.via } : { mode: 'scan', code: r.code });
      setProblem(null);
    }, []),
  );

  function scan(side: MatchSideKey) {
    router.push(`/family/scan?side=${side}`);
  }

  function match() {
    if (!a || !b) return setProblem('sides');
    if (sameProfile(a, b)) return setProblem('same');
    const ra = draftToSide(a, new Date(nowMs));
    const rb = draftToSide(b, new Date(nowMs));
    if (!ra.ok) setA(ra.draft);
    if (!rb.ok) setB(rb.draft);
    if (!ra.ok || !rb.ok) return setProblem('fix');
    setProblem(null);
    router.push({ pathname: '/family/match/result', params: sidesToParams(ra.side, rb.side) });
  }

  function swap() {
    setA(b);
    setB(a);
    setProblem(null);
  }

  return (
    <Screen title={t('match.title')} chrome="stack" testID="match-pick" stickyCta={<PrimaryButton label={t('match.compute')} onPress={match} testID="match-go" />}>
      <Card>
        <PickerAB
          side="a"
          profiles={profiles}
          draft={a}
          onChange={(d) => {
            setA(d);
            setProblem(null);
          }}
          onScan={() => scan('a')}
          defaults={defaults}
          nowMs={nowMs}
          testID="side-a"
        />
      </Card>
      <View style={styles.swapRow}>
        <Txt kind="caption" color="ink3" style={styles.orderNote}>
          {t('match.orderNote')}
        </Txt>
        <TextButton label={t('match.swap')} onPress={swap} testID="match-swap" />
      </View>
      <Card>
        <PickerAB
          side="b"
          profiles={profiles}
          draft={b}
          onChange={(d) => {
            setB(d);
            setProblem(null);
          }}
          onScan={() => scan('b')}
          defaults={defaults}
          nowMs={nowMs}
          testID="side-b"
        />
      </Card>
      {problem === 'sides' ? <InlineNotice tone="error">{t('match.sideNeeded')}</InlineNotice> : null}
      {problem === 'same' ? <InlineNotice tone="error">{t('match.sameProfile')}</InlineNotice> : null}
      {problem === 'fix' ? <InlineNotice tone="error">{t('errors.invalidInput')}</InlineNotice> : null}
      <Txt kind="caption" color="ink3" testID="match-privacy">
        {t('share.codeContains')}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  swapRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  orderNote: { flex: 1 },
});
