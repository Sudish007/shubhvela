// Bootstrap placeholder route (A01). Honest by rule: it states that the app is not built
// yet instead of showing any mock value. A09 onwards replaces it with onboarding and tabs.
import { StyleSheet, Text, View } from 'react-native';

export default function Index() {
  return (
    <View style={styles.screen} accessibilityRole="summary">
      <Text style={styles.title}>Shubhvela</Text>
      <Text style={styles.body}>Development build. The app screens are not built yet.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#FAF7F2',
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    color: '#1C1A17',
  },
  body: {
    marginTop: 8,
    fontSize: 17,
    lineHeight: 26,
    color: '#5B554C',
    textAlign: 'center',
  },
});
