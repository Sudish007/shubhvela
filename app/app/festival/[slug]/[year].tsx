// Deep link shubhvela://festival/<slug>/<year> (F37): the slug must be one of the engine's festival rules and the year
// inside the tz table's range; valid -> the festival detail route (which recomputes the date for the user's place),
// invalid -> the inline error ("No festival named ..." / "The year ... is outside the range").
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { InvalidLinkScreen } from '../../../src/deeplink/LinkScreens';
import { parseDeepLink, routeForTarget } from '../../../src/deeplinks';

export default function FestivalLinkRoute() {
  const { slug = '', year = '' } = useLocalSearchParams<{ slug?: string; year?: string }>();
  const router = useRouter();
  const target = useMemo(() => parseDeepLink(`shubhvela://festival/${encodeURIComponent(slug)}/${encodeURIComponent(year)}`), [slug, year]);
  useEffect(() => {
    if (target.kind !== 'festival') return;
    router.replace(routeForTarget(target) ?? '/');
  }, [target, router]);
  if (target.kind === 'invalid') return <InvalidLinkScreen target={target} webPath={slug && year ? `festival/${encodeURIComponent(slug)}/${encodeURIComponent(year)}/` : null} />;
  return <View />;
}
