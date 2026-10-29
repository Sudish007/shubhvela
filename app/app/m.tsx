// Deep link shubhvela://m?<M8 query> (F37, F30): a matching payload from the web /m/ page. Valid -> the payload is
// handed to the matching screen as side B (the same in-memory hand-off the QR scanner uses) and the screen opens;
// extras (ay/nd/st/n) are refused on /m/ (M8). Invalid -> the inline error screen with "Open on the web instead".
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { InvalidLinkScreen } from '../src/deeplink/LinkScreens';
import { parseDeepLink, queryFromParams, routeForTarget } from '../src/deeplinks';
import { setScanResult } from '../src/share/scanResult';

export default function MatchLinkRoute() {
  const params = useLocalSearchParams<Record<string, string | string[] | undefined>>();
  const router = useRouter();
  const key = JSON.stringify(params);
  const query = queryFromParams(params);
  const target = useMemo(() => parseDeepLink(`shubhvela://m?${query}`), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (target.kind !== 'm') return;
    setScanResult('b', target.code, 'link');
    router.replace(routeForTarget(target) ?? '/');
  }, [target, router]);
  if (target.kind === 'invalid') return <InvalidLinkScreen target={target} webPath={`m/?${query}`} />;
  return <View />;
}
