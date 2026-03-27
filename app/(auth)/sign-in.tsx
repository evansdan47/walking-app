import { useSignIn } from '@clerk/expo';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    TextInput,
} from 'react-native';

import { SsoButtons } from '@/components/sso-buttons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SignInScreen() {
  const { signIn } = useSignIn();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pendingSecondFactor, setPendingSecondFactor] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      const { error: passwordError } = await signIn.password({ identifier: email, password });
      if (passwordError) {
        Alert.alert('Sign In Failed', passwordError.longMessage ?? passwordError.message);
        return;
      }
      if (signIn.status === 'needs_second_factor') {
        // Use the dedicated MFA namespace for second-factor email codes
        const { error: sendError } = await signIn.mfa.sendEmailCode();
        if (sendError) {
          Alert.alert('Sign In Failed', sendError.longMessage ?? sendError.message);
          return;
        }
        setPendingSecondFactor(true);
        return;
      }
      if (signIn.status !== 'complete') {
        Alert.alert('Sign In Failed', `Unexpected status: ${signIn.status}`);
        return;
      }
      const { error: finalizeError } = await signIn.finalize();
      if (finalizeError) {
        Alert.alert('Sign In Failed', finalizeError.longMessage ?? finalizeError.message);
        return;
      }
      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setLoading(true);
    try {
      const { error: verifyError } = await signIn.mfa.verifyEmailCode({ code });
      if (verifyError) {
        Alert.alert('Verification Failed', verifyError.longMessage ?? verifyError.message);
        return;
      }
      if (signIn.status !== 'complete') {
        Alert.alert('Sign In Failed', `Unexpected status: ${signIn.status}`);
        return;
      }
      const { error: finalizeError } = await signIn.finalize();
      if (finalizeError) {
        Alert.alert('Sign In Failed', finalizeError.longMessage ?? finalizeError.message);
        return;
      }
      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.backgroundCard,
      borderColor: colors.border,
      color: colors.text,
      fontFamily: Typography.fontRegular,
    },
  ];

  if (pendingSecondFactor) {
    return (
      <ThemedView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.inner}
        >
          <ThemedText type="title" style={styles.heading}>
            Check your email
          </ThemedText>
          <ThemedText type="body" style={[styles.subheading, { color: colors.textMuted }]}>
            We sent a verification code to {email}
          </ThemedText>

          <TextInput
            style={inputStyle}
            placeholder="Verification code"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
          />

          <Pressable
            style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
            onPress={handleVerifyCode}
            disabled={loading || !code}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText type="bodySemiBold" style={styles.buttonText}>
                Verify &amp; Sign In
              </ThemedText>
            )}
          </Pressable>

          <Pressable style={styles.linkRow} onPress={() => { setPendingSecondFactor(false); setCode(''); }}>
            <ThemedText type="bodyMed" style={{ color: colors.primary }}>
              Back to sign in
            </ThemedText>
          </Pressable>
        </KeyboardAvoidingView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <ThemedText type="title" style={styles.heading}>
          Welcome back
        </ThemedText>
        <ThemedText type="body" style={[styles.subheading, { color: colors.textMuted }]}>
          Sign in to access your walks
        </ThemedText>

        <TextInput
          style={inputStyle}
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={inputStyle}
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          autoComplete="current-password"
          value={password}
          onChangeText={setPassword}
        />

        <Pressable
          style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={loading || !email || !password}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText type="bodySemiBold" style={styles.buttonText}>
              Sign In
            </ThemedText>
          )}
        </Pressable>

        <SsoButtons />

        <Link href="/(auth)/sign-up" asChild>
          <Pressable style={styles.linkRow}>
            <ThemedText type="body" style={{ color: colors.textMuted }}>
              Don&apos;t have an account?{' '}
            </ThemedText>
            <ThemedText type="bodyMed" style={{ color: colors.primary }}>
              Sign up
            </ThemedText>
          </Pressable>
        </Link>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  heading: {
    marginBottom: Spacing.sm,
  },
  subheading: {
    marginBottom: Spacing.xl,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    fontSize: Typography.sizes.base,
    marginBottom: Spacing.md,
  },
  button: {
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
