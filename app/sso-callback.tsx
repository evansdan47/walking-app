import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

// This page is the redirect target for Clerk OAuth flows on Android.
// Chrome Custom Tabs fires a deep-link to rambleio://sso-callback, the OS
// opens the app here, and maybeCompleteAuthSession() closes the Custom Tab
// so the startSSOFlow() promise in SsoButtons can resolve with the session.
WebBrowser.maybeCompleteAuthSession();

export default function SsoCallbackScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
