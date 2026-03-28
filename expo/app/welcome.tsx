import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  Building2,
  Eye,
  EyeOff,
  User,
  Lock,
  Star,
} from 'lucide-react-native';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
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

import { JOY_DEALERS_LOGO_URL, JOY_SMILEY } from '@/constants/branding';
import { joyTheme } from '@/constants/joyTheme';
import { useAuth } from '@/providers/AuthProvider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_WIDTH = (SCREEN_WIDTH - 48 - 8) / 2;

type AuthTab = 'volunteer' | 'organization';

export default function WelcomeScreen() {
  const router = useRouter();
  const { signIn, isSigningIn } = useAuth();

  const [activeTab, setActiveTab] = useState<AuthTab>('volunteer');
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    console.log('[WelcomeScreen] Mounting tabbed auth screen');
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const switchTab = useCallback((tab: AuthTab) => {
    console.log('[WelcomeScreen] Switching to tab:', tab);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setActiveTab(tab);
    setError('');
    Animated.spring(tabIndicatorAnim, {
      toValue: tab === 'volunteer' ? 0 : 1,
      useNativeDriver: true,
      tension: 68,
      friction: 10,
    }).start();
  }, [tabIndicatorAnim]);

  const handleLogin = useCallback(async () => {
    console.log('[WelcomeScreen] Attempting login');
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter your email/username and password.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await signIn({ email: email.trim(), password, loginType: activeTab });
      console.log('[WelcomeScreen] Login successful');
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign in failed. Please try again.';
      console.error('[WelcomeScreen] Login error:', message);
      setError(message);
      Alert.alert('Sign In Failed', message);
    }
  }, [email, password, signIn, router, activeTab]);

  const handleVolunteer = useCallback(() => {
    console.log('[WelcomeScreen] Navigate to volunteer signup');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push('/signup-volunteer');
  }, [router]);


  const indicatorTranslateX = tabIndicatorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TAB_WIDTH],
  });

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={['#111111', '#1C1C1E', '#2C2C2E']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />

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
            <Animated.View style={[styles.headerSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <Image
                source={JOY_SMILEY}
                style={styles.smileyIcon}
                contentFit="contain"
                tintColor={joyTheme.gold}
              />
              <Image
                source={{ uri: JOY_DEALERS_LOGO_URL }}
                style={styles.logoImage}
                contentFit="contain"
              />
              <Text style={styles.subtitle}>
                Volunteer. Earn. Unlock Exclusives.
              </Text>
            </Animated.View>

            <Animated.View style={[styles.cardContainer, { opacity: fadeAnim }]}>
              <View style={styles.tabBar}>
                <Animated.View
                  style={[
                    styles.tabIndicator,
                    { transform: [{ translateX: indicatorTranslateX }] },
                  ]}
                />
                <Pressable
                  onPress={() => switchTab('volunteer')}
                  style={styles.tabButton}
                  testID="auth-tab-volunteer"
                >
                  <View style={styles.tabInner}>
                    <Star color={activeTab === 'volunteer' ? joyTheme.gold : joyTheme.textMuted} size={16} />
                    <Text style={[styles.tabText, activeTab === 'volunteer' && styles.tabTextActive]}>
                      Volunteer
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => switchTab('organization')}
                  style={styles.tabButton}
                  testID="auth-tab-organization"
                >
                  <View style={styles.tabInner}>
                    <Building2 color={activeTab === 'organization' ? joyTheme.gold : joyTheme.textMuted} size={16} />
                    <Text style={[styles.tabText, activeTab === 'organization' && styles.tabTextActive]}>
                      Organization
                    </Text>
                  </View>
                </Pressable>
              </View>

              <View style={styles.formSection}>
                  {error ? (
                    <View style={styles.errorBanner}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      {activeTab === 'volunteer' ? 'Email or Username' : 'Organization Email'}
                    </Text>
                    <View style={styles.inputWrap}>
                      <User color={joyTheme.textMuted} size={18} />
                      <TextInput
                        style={styles.input}
                        placeholder={activeTab === 'volunteer' ? 'Email or username' : 'Organization email'}
                        placeholderTextColor={joyTheme.textMuted}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="default"
                        autoCapitalize="none"
                        autoCorrect={false}
                        testID="login-email-input"
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Password</Text>
                    <View style={styles.inputWrap}>
                      <Lock color={joyTheme.textMuted} size={18} />
                      <TextInput
                        style={styles.input}
                        placeholder="Your password"
                        placeholderTextColor={joyTheme.textMuted}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        testID="login-password-input"
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

                  <Pressable
                    onPress={handleLogin}
                    disabled={isSigningIn}
                    style={({ pressed }) => [
                      styles.submitButton,
                      activeTab === 'organization' && styles.submitButtonOrg,
                      pressed && styles.submitButtonPressed,
                      isSigningIn && styles.submitButtonDisabled,
                    ]}
                    testID="login-submit-btn"
                  >
                    {isSigningIn ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.submitButtonText}>
                        Sign In as {activeTab === 'volunteer' ? 'Volunteer' : 'Organization'}
                      </Text>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => router.push('/forgot-password' as never)}
                    style={styles.forgotLink}
                  >
                    <Text style={styles.forgotText}>Forgot your password?</Text>
                  </Pressable>
                </View>

                {activeTab === 'volunteer' && (
                  <View style={styles.signupFooter}>
                    <View style={styles.signupDividerRow}>
                      <View style={styles.loginHintDivider} />
                      <Text style={styles.loginHintText}>New here?</Text>
                      <View style={styles.loginHintDivider} />
                    </View>
                    <View style={styles.signupLinkRow}>
                      <Text style={styles.signupLinkLabel}>Don't have an account?</Text>
                      <Pressable
                        onPress={handleVolunteer}
                        hitSlop={8}
                        testID="welcome-signup-link"
                      >
                        <Text style={styles.signupLinkText}>Sign Up</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  orbTop: {
    position: 'absolute',
    top: -60,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(200,162,77,0.08)',
  },
  orbBottom: {
    position: 'absolute',
    bottom: 80,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  smileyIcon: {
    width: 64,
    height: 64,
    marginBottom: 4,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 32,
    gap: 12,
  },
  logoImage: {
    width: 160,
    height: 120,
    tintColor: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400' as const,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: 'rgba(0,0,0,0.15)',
    shadowOpacity: 1,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F2EFE8',
    borderRadius: 16,
    margin: 16,
    marginBottom: 0,
    padding: 4,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: TAB_WIDTH,
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: 'rgba(0,0,0,0.1)',
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: joyTheme.textMuted,
  },
  tabTextActive: {
    color: joyTheme.text,
    fontWeight: '800' as const,
  },
  formSection: {
    padding: 24,
    paddingTop: 20,
    gap: 18,
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
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: joyTheme.text,
    paddingLeft: 4,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: joyTheme.background,
    borderRadius: 14,
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
    backgroundColor: joyTheme.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#1A1A2E',
    fontSize: 16,
    fontWeight: '800' as const,
  },
  forgotLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: joyTheme.gold,
  },
  signupSection: {
    padding: 24,
    paddingTop: 20,
    gap: 14,
  },
  signupPrompt: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: joyTheme.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: joyTheme.background,
    borderRadius: 20,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  roleCardOrg: {
    backgroundColor: joyTheme.cardAlt,
    borderColor: joyTheme.cardAlt,
  },
  roleCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  roleIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconWrapOrg: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  roleTextWrap: {
    flex: 1,
    gap: 3,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: joyTheme.text,
  },
  roleTitleOrg: {
    color: '#FFFFFF',
  },
  roleDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: joyTheme.textMuted,
  },
  roleDescriptionOrg: {
    color: 'rgba(255,255,255,0.7)',
  },
  roleArrow: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(10,132,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleArrowOrg: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  roleArrowText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: joyTheme.primary,
  },
  roleArrowTextOrg: {
    color: joyTheme.accent,
  },
  loginHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  loginHintDivider: {
    flex: 1,
    height: 1,
    backgroundColor: joyTheme.border,
  },
  loginHintText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: joyTheme.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  loginBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  loginBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: joyTheme.primarySoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  loginBadgeOrg: {
    backgroundColor: joyTheme.cardAlt,
  },
  loginBadgeText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: joyTheme.primary,
  },
  loginBadgeTextOrg: {
    color: '#FFFFFF',
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  submitButtonOrg: {
    backgroundColor: '#111111',
  },
  signupFooter: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 4,
    gap: 14,
  },
  signupDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  signupLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  signupLinkLabel: {
    fontSize: 14,
    color: joyTheme.textMuted,
  },
  signupLinkText: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: joyTheme.gold,
  },
});
