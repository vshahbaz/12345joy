import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fonts } from '@/constants/fonts';
import { joyTheme } from '@/constants/joyTheme';
import { resetPassword } from '@/lib/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [error, setError] = useState<string>('');

  const resetMutation = useMutation({
    mutationFn: (emailAddr: string) => resetPassword(emailAddr),
    onError: (err: Error) => {
      console.error('[ForgotPassword] Error:', err.message);
      setError(err.message || 'Failed to send reset email.');
    },
  });

  const handleReset = useCallback(() => {
    setError('');
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    resetMutation.mutate(email.trim());
  }, [email, resetMutation]);

  if (resetMutation.isSuccess) {
    return (
      <View style={styles.screen}>
        <LinearGradient
          colors={['#0865C2', '#0A84FF', '#64B5FF']}
          style={styles.gradient}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 0.5 }}
        />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.successContainer}>
            <View style={styles.successIconWrap}>
              <CheckCircle color="#2BB673" size={56} />
            </View>
            <Text style={styles.successTitle}>Check your email</Text>
            <Text style={styles.successText}>
              We sent a password reset link to {email}. Click the link in the email to reset your password.
            </Text>
            <Pressable
              onPress={() => router.replace('/welcome')}
              style={styles.successButton}
            >
              <Text style={styles.successButtonText}>Back to Sign In</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={['#0865C2', '#0A84FF', '#64B5FF']}
        style={styles.gradient}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 0.5 }}
      />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable onPress={() => router.back()} style={styles.backButton} testID="forgot-back">
              <ArrowLeft color="#FFFFFF" size={22} />
            </Pressable>

            <View style={styles.headerSection}>
              <Text style={styles.title}>Reset password</Text>
              <Text style={styles.subtitle}>
                Enter the email associated with your account and we'll send a reset link.
              </Text>
            </View>

            <View style={styles.formCard}>
              {error ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <View style={styles.inputWrap}>
                  <Mail color={joyTheme.textMuted} size={18} />
                  <TextInput
                    style={styles.input}
                    placeholder="you@example.com"
                    placeholderTextColor={joyTheme.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    testID="forgot-email"
                  />
                </View>
              </View>

              <Pressable
                onPress={handleReset}
                disabled={resetMutation.isPending}
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && { opacity: 0.9 },
                  resetMutation.isPending && { opacity: 0.6 },
                ]}
                testID="forgot-submit"
              >
                {resetMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Send Reset Link</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.footerSection}>
              <Pressable onPress={() => router.push('/welcome')} style={styles.switchLink}>
                <Text style={styles.switchText}>Remember your password? </Text>
                <Text style={styles.switchTextBold}>Sign in</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: joyTheme.background },
  flex: { flex: 1 },
  gradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 280 },
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  backButton: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  headerSection: { paddingTop: 32, paddingBottom: 28, gap: 8 },
  title: { fontSize: 32, fontFamily: fonts.black, color: '#FFFFFF', letterSpacing: -0.8 },
  subtitle: { fontSize: 16, lineHeight: 24, color: 'rgba(255,255,255,0.78)' },
  formCard: {
    backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24, gap: 20,
    shadowColor: 'rgba(0,0,0,0.1)', shadowOpacity: 1, shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 }, elevation: 8,
  },
  errorBanner: {
    backgroundColor: '#FFF0F0', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#FFD4D4',
  },
  errorText: { color: '#C23B22', fontSize: 14, fontFamily: fonts.semiBold, lineHeight: 20 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontFamily: fonts.bold, color: joyTheme.text, paddingLeft: 4 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: joyTheme.background, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    borderWidth: 1, borderColor: joyTheme.border,
  },
  input: { flex: 1, fontSize: 16, color: joyTheme.text, padding: 0 },
  submitButton: {
    backgroundColor: joyTheme.primary, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontFamily: fonts.extraBold },
  footerSection: { alignItems: 'center', paddingTop: 24 },
  switchLink: { flexDirection: 'row', paddingVertical: 12 },
  switchText: { fontSize: 15, color: joyTheme.textMuted },
  switchTextBold: { fontSize: 15, fontFamily: fonts.extraBold, color: joyTheme.primary },
  successContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 32, gap: 16,
  },
  successIconWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(43,182,115,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  successTitle: {
    fontSize: 28, fontFamily: fonts.black, color: '#FFFFFF', textAlign: 'center',
  },
  successText: {
    fontSize: 16, lineHeight: 24, color: 'rgba(255,255,255,0.8)', textAlign: 'center',
  },
  successButton: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 32, marginTop: 8,
  },
  successButtonText: {
    fontSize: 16, fontFamily: fonts.extraBold, color: joyTheme.primaryDark,
  },
});
