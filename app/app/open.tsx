// Deep link shubhvela://open (F37, design.md 9 M9): the web companion's plain "Open in the app" / "Get the Android app"
// buttons (home, download, kundli result) send intent://open. Same gate as index: onboarding until consent + a self
// profile exist, else the Today tab. Without this route expo-router showed its "Unmatched Route" screen.
import { Redirect } from 'expo-router';
import { needsOnboarding } from '../src/gate';

export default function OpenLinkRoute() {
  return <Redirect href={needsOnboarding() ? '/onboarding/consent' : '/(tabs)/today'} />;
}
