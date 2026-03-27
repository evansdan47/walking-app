import { useSignUp } from '@clerk/expo';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';

import { SsoButtons } from '@/components/sso-buttons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SignUpScreen() {
  const { signUp } = useSignUp();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    setLoading(true);
    try {
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0] ?? '';
      const lastName = nameParts.slice(1).join(' ') || undefined;
      const { error: createError } = await signUp.password({
        emailAddress: email,
        password,
        firstName,
        ...(lastName !== undefined ? { lastName } : {}),
      });
      if (createError) {
        Alert.alert('Sign Up Failed', createError.longMessage ?? createError.message);
        return;
      }
      const { error: sendError } = await signUp.verifications.sendEmailCode();
      if (sendError) {
        Alert.alert('Sign Up Failed', sendError.longMessage ?? sendError.message);
        return;
      }
      setPendingVerification(true);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    try {
      const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code });
      if (verifyError) {
        Alert.alert('Verification Failed', verifyError.longMessage ?? verifyError.message);
        return;
      }
      // Guard then finalise — converts completed sign-up to an active session
      if (signUp.status !== 'complete') {
        Alert.alert('Verification', 'Additional steps required.');
        return;
      }
      const { error: finalizeError } = await signUp.finalize();
      if (finalizeError) {
        Alert.alert('Sign Up Failed', finalizeError.longMessage ?? finalizeError.message);
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

  if (pendingVerification) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.logoHeader}>
          <Image source={require('@/assets/images/splash-icon.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.formWrapper}
        >
          <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
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
              onPress={handleVerify}
              disabled={loading || !code}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText type="bodySemiBold" style={styles.buttonText}>
                  Verify Email
                </ThemedText>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.logoHeader}>
        <Image source={require('@/assets/images/splash-icon.png')} style={styles.logo} resizeMode="contain" />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.formWrapper}
      >
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <ThemedText type="title" style={styles.heading}>
          Create account
        </ThemedText>
        <ThemedText type="body" style={[styles.subheading, { color: colors.textMuted }]}>
          Start recording your walks
        </ThemedText>

        <TextInput
          style={inputStyle}
          placeholder="Full name"
          placeholderTextColor={colors.textMuted}
          autoComplete="name"
          value={name}
          onChangeText={setName}
        />

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
          autoComplete="new-password"
          value={password}
          onChangeText={setPassword}
        />

        <Pressable
          style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
          onPress={handleSignUp}
          disabled={loading || !email || !password || !name}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText type="bodySemiBold" style={styles.buttonText}>
              Create Account
            </ThemedText>
          )}
        </Pressable>

        <SsoButtons />

        <Link href="/(auth)/sign-in" asChild>
          <Pressable style={styles.linkRow}>
            <ThemedText type="body" style={{ color: colors.textMuted }}>
              Already have an account?{' '}
            </ThemedText>
            <ThemedText type="bodyMed" style={{ color: colors.primary }}>
              Sign in
            </ThemedText>
          </Pressable>
        </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  logoHeader: {
    backgroundColor: '#122518',
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 220,
    height: 56,
  },
  formWrapper: {
    flex: 1,
  },
  inner: {
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
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
