// Deep link shubhvela://kundli?<M8 query> (F37): expo-router lands here with the query split into params; the M8
// parser (engine, shared with the web kundli page) validates it and the "Chart from a link" screen shows the birth form
// pre-filled with what parsed (inline errors on the rest) and "Save as profile" / Discard.
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { KundliLinkScreen } from '../src/deeplink/LinkScreens';
import { parseDeepLink, queryFromParams } from '../src/deeplinks';

export default function KundliLinkRoute() {
  const params = useLocalSearchParams<Record<string, string | string[] | undefined>>();
  const key = JSON.stringify(params);
  const target = useMemo(() => parseDeepLink(`shubhvela://kundli?${queryFromParams(params)}`), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (target.kind !== 'kundli' && target.kind !== 'invalid') return null;
  return <KundliLinkScreen target={target} />;
}
