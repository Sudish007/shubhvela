// Entry: the consent gate decides between onboarding and the Today tab (src/gate.ts).
import { Redirect } from 'expo-router';
import { needsOnboarding } from '../src/gate';

export default function Index() {
  return <Redirect href={needsOnboarding() ? '/onboarding/consent' : '/(tabs)/today'} />;
}
