import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ArrowLeft, Eye, EyeOff, User, Mail, Lock, MapPin, Phone } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useAuth } from '@/providers/AuthProvider';

export default function SignUpVolunteerScreen() {
  const router = useRouter();
  const { signUpVolunteer, isSigningUp } = useAuth();

  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleSignUp = useCallback(async () => {
    console.log('[SignUpVolunteer] Attempting signup');
    setError('');

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await signUpVolunteer({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        city: city.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      console.log('[SignUpVolunteer] Signup successful');
      Alert.alert(
        'Welcome aboard!',
        'Your account has been created. Check your email to verify, then sign in.',
        [{ text: 'Got it', onPress: () => router.replace('/welcome' as never) }]
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign up failed. Please try again.';
      console.error('[SignUpVolunteer] Signup error:', message);
      setError(message);
    }
  }, [fullName, email, password, city, phone, signUpVolunteer, router]);

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={['#0865C2', '#0A84FF', '#4DA8FF']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.6 }}
      />
      <View style={styles.accentOrb} />
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
            <Pressable onPress={() => router.back()} style={styles.backButton} testID="signup-vol-back">
              <ArrowLeft color="#FFFFFF" size={22} />
            </Pressable>

            <View style={styles.headerSection}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Volunteer</Text>
              </View>
              <Text style={styles.title}>Join the movement</Text>
              <Text style={styles.subtitle}>
                Sign up to discover events, earn points, and connect with your community.
              </Text>
            </View>

            <View style={styles.formCard}>
              {error ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name *</Text>
                <View style={styles.inputWrap}>
                  <User color={joyTheme.textMuted} size={18} />
                  <TextInput
                    style={styles.input}
                    placeholder="Your full name"
                    placeholderTextColor={joyTheme.textMuted}
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                    testID="signup-vol-name"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email *</Text>
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
                    testID="signup-vol-email"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password *</Text>
                <View style={styles.inputWrap}>
                  <Lock color={joyTheme.textMuted} size={18} />
                  <TextInput
                    style={styles.input}
                    placeholder="Min 6 characters"
                    placeholderTextColor={joyTheme.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    testID="signup-vol-password"
                  />
                  <Pressable onPress={() => setShowPassword((p) => !p)} hitSlop={12}>
                    {showPassword ? (
                      <EyeOff color={joyTheme.textMuted} size={18} />
                    ) : (
                      <Eye color={joyTheme.textMuted} size={18} />
                    )}
                  </Pressable>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>City</Text>
                <View style={styles.inputWrap}>
                  <MapPin color={joyTheme.textMuted} size={18} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Miami"
                    placeholderTextColor={joyTheme.textMuted}
                    value={city}
                    onChangeText={setCity}
                    testID="signup-vol-city"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone</Text>
                <View style={styles.inputWrap}>
                  <Phone color={joyTheme.textMuted} size={18} />
                  <TextInput
                    style={styles.input}
                    placeholder="(555) 123-4567"
                    placeholderTextColor={joyTheme.textMuted}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    testID="signup-vol-phone"
                  />
                </View>
              </View>

              <Pressable
                onPress={handleSignUp}
                disabled={isSigningUp}
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && styles.submitButtonPressed,
                  isSigningUp && styles.submitButtonDisabled,
                ]}
                testID="signup-vol-submit"
              >
                {isSigningUp ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Create Account</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.footerSection}>
              <Pressable onPress={() => router.push('/welcome' as never)} style={styles.switchLink}>
                <Text style={styles.switchText}>Already have an account? </Text>
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
  screen: {
    flex: 1,
    backgroundColor: joyTheme.background,
  },
  flex: {
    flex: 1,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 320,
  },
  accentOrb: {
    position: 'absolute',
    top: 40,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,216,77,0.14)',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  headerSection: {
    paddingTop: 24,
    paddingBottom: 24,
    gap: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 13,
    fontFamily: fonts.extraBold,
    color: '#FFFFFF',
  },
  title: {
    fontSize: 30,
    fontFamily: fonts.black,
    color: '#FFFFFF',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.78)',
    maxWidth: 320,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    gap: 18,
    shadowColor: 'rgba(0,0,0,0.1)',
    shadowOpacity: 1,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  errorBanner: {
    backgroundColor: '#FFF0F0',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FFD4D4',
  },
  errorText: {
    color: '#C23B22',
    fontSize: 14,
    fontFamily: fonts.semiBold,
    lineHeight: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: joyTheme.text,
    paddingLeft: 4,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: joyTheme.background,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: joyTheme.text,
    padding: 0,
  },
  submitButton: {
    backgroundColor: joyTheme.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonPressed: {
    opacity: 0.9,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: fonts.extraBold,
  },
  footerSection: {
    alignItems: 'center',
    paddingTop: 24,
  },
  switchLink: {
    flexDirection: 'row',
    paddingVertical: 12,
  },
  switchText: {
    fontSize: 15,
    color: joyTheme.textMuted,
  },
  switchTextBold: {
    fontSize: 15,
    fontFamily: fonts.extraBold,
    color: joyTheme.primary,
  },
});
