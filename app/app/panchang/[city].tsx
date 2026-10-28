// Deep link shubhvela://panchang/<city-slug> (F37): one of the 331 web-companion cities -> Today with that city as the
// observer (?city= consumed by the Today tab); an unknown slug -> the inline error "No city named ... in the almanac".
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { InvalidLinkScreen } from '../../src/deeplink/LinkScreens';
import { parseDeepLink, routeForTarget } from '../../src/deeplinks';

export default function PanchangLinkRoute() {
  const { city = '' } = useLocalSearchParams<{ city?: string }>();
  const router = useRouter();
  const target = useMemo(() => parseDeepLink(`shubhvela://panchang/${encodeURIComponent(city)}`), [city]);
  useEffect(() => {
    if (target.kind !== 'panchang') return;
    router.replace(routeForTarget(target) ?? '/');
  }, [target, router]);
  if (target.kind === 'invalid') return <InvalidLinkScreen target={target} webPath={city ? `panchang/${encodeURIComponent(city)}/` : null} />;
  return <View />;
}
