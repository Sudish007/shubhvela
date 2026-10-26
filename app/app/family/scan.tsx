// Scan route (F30): /family/scan?side=a|b. The camera screen decodes the QR locally, stores the code for the asking
// side (src/share/scanResult.ts) and goes back to the matching pick screen, which consumes it on focus.
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { MatchSideKey } from '../../src/match/model';
import { setScanResult } from '../../src/share/scanResult';
import { ScanScreen } from '../../src/share/ScanScreen';

export default function ScanRoute() {
  const router = useRouter();
  const { side } = useLocalSearchParams<{ side?: string }>();
  const key: MatchSideKey = side === 'b' ? 'b' : 'a';
  return (
    <ScanScreen
      onDecoded={(code) => {
        setScanResult(key, code);
        router.back();
      }}
      onTypeInstead={() => router.back()}
    />
  );
}
