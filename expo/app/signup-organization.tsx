import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ArrowLeft, Eye, EyeOff, Building2, Mail, Lock, MapPin, Phone, Globe, User, FileText } from 'lucide-react-native';
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

export default function SignUpOrganizationScreen() {
  const router = useRouter();
  const { signUpOrg, isSigningUp } = useAuth();

  const [orgName, setOrgName] = useState<string>('');
  const [contactName, setContactName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [state, setState] = useState<string>('');
  const [website, setWebsite] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleSignUp = useCallback(async () => {
    console.log('[SignUpOrg] Attempting organization signup');
    setError('');

    if (!orgName.trim()) {
      setError('Please enter your organization name.');
      return;
    }
    if (!contactName.trim()) {
      setError('Please enter a contact person name.');
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
      await signUpOrg({
        email: email.trim(),
        password,
        orgName: orgName.trim(),
        contactName: contactName.trim(),
        phone: phone.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        website: website.trim() || undefined,
        description: description.trim() || undefined,
      });
      console.log('[SignUpOrg] Signup successful');
      Alert.alert(
        'Organization Registered!',
        'Your account has been created. Check your email to verify, then sign in.',
        [{ text: 'Got it', onPress: () => router.replace('/welcome' as never) }]
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign up failed. Please try again.';
      console.error('[SignUpOrg] Signup error:', message);
      setError(message);
    }
  }, [orgName, contactName, email, password, phone, city, state, website, description, signUpOrg, router]);

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={['#0B2A4F', '#0E3C73', '#164D8F']}
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
            <Pressable onPress={() => router.back()} style={styles.backButton} testID="signup-org-back">
              <ArrowLeft color="#FFFFFF" size={22} />
            </Pressable>

            <View style={styles.headerSection}>
              <View style={styles.badge}>
                <Building2 color="#FFD84D" size={14} />
                <Text style={styles.badgeText}>Organization</Text>
              </View>
              <Text style={styles.title}>Register your organization</Text>
              <Text style={styles.subtitle}>
                Create events, manage volunteers, and measure your community impact.
              </Text>
            </View>

            <View style={styles.formCard}>
              {error ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Organization Name *</Text>
                <View style={styles.inputWrap}>
                  <Building2 color={joyTheme.textMuted} size={18} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Camillus House"
                    placeholderTextColor={joyTheme.textMuted}
                    value={orgName}
                    onChangeText={setOrgName}
                    testID="signup-org-name"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Contact Person *</Text>
                <View style={styles.inputWrap}>
                  <User color={joyTheme.textMuted} size={18} />
                  <TextInput
                    style={styles.input}
                    placeholder="Full name of primary contact"
                    placeholderTextColor={joyTheme.textMuted}
                    value={contactName}
                    onChangeText={setContactName}
                    autoCapitalize="words"
                    testID="signup-org-contact"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email *</Text>
                <View style={styles.inputWrap}>
                  <Mail color={joyTheme.textMuted} size={18} />
                  <TextInput
                    style={styles.input}
                    placeholder="org@example.com"
                    placeholderTextColor={joyTheme.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    testID="signup-org-email"
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
                    testID="signup-org-password"
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

              <View style={styles.divider} />
              <Text style={styles.sectionLabel}>Optional Details</Text>

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
                    testID="signup-org-phone"
                  />
                </View>
              </View>

              <View style={styles.rowInputs}>
                <View style={[styles.inputGroup, styles.halfInput]}>
                  <Text style={styles.label}>City</Text>
                  <View style={styles.inputWrap}>
                    <MapPin color={joyTheme.textMuted} size={18} />
                    <TextInput
                      style={styles.input}
                      placeholder="City"
                      placeholderTextColor={joyTheme.textMuted}
                      value={city}
                      onChangeText={setCity}
                      testID="signup-org-city"
                    />
                  </View>
                </View>
                <View style={[styles.inputGroup, styles.halfInput]}>
                  <Text style={styles.label}>State</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.input}
                      placeholder="FL"
                      placeholderTextColor={joyTheme.textMuted}
                      value={state}
                      onChangeText={setState}
                      autoCapitalize="characters"
                      testID="signup-org-state"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Website</Text>
                <View style={styles.inputWrap}>
                  <Globe color={joyTheme.textMuted} size={18} />
                  <TextInput
                    style={styles.input}
                    placeholder="https://yourorg.org"
                    placeholderTextColor={joyTheme.textMuted}
                    value={website}
                    onChangeText={setWebsite}
                    keyboardType="url"
                    autoCapitalize="none"
                    testID="signup-org-website"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>About your organization</Text>
                <View style={[styles.inputWrap, styles.textAreaWrap]}>
                  <FileText color={joyTheme.textMuted} size={18} style={styles.textAreaIcon} />
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Briefly describe your mission and what you do..."
                    placeholderTextColor={joyTheme.textMuted}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    testID="signup-org-description"
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
                testID="signup-org-submit"
              >
                {isSigningUp ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Register Organization</Text>
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
    height: 340,
  },
  accentOrb: {
    position: 'absolute',
    top: 60,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,216,77,0.1)',
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
    backgroundColor: 'rgba(255,255,255,0.12)',
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
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 13,
    fontFamily: fonts.extraBold,
    color: '#FFD84D',
  },
  title: {
    fontSize: 28,
    fontFamily: fonts.black,
    color: '#FFFFFF',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.72)',
    maxWidth: 320,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    gap: 18,
    shadowColor: 'rgba(0,0,0,0.12)',
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
  divider: {
    height: 1,
    backgroundColor: joyTheme.border,
    marginVertical: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: fonts.extraBold,
    color: joyTheme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
  textAreaWrap: {
    alignItems: 'flex-start',
    minHeight: 100,
  },
  textAreaIcon: {
    marginTop: 2,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: joyTheme.text,
    padding: 0,
  },
  textArea: {
    minHeight: 72,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  submitButton: {
    backgroundColor: joyTheme.cardAlt,
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
