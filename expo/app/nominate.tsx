import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Star,
  User,
  Mail,
  ChevronDown,
  FileText,
  Send,
  CheckCircle,
} from 'lucide-react-native';
import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';

import { fonts } from '@/constants/fonts';
import { joyTheme } from '@/constants/joyTheme';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';

const CATEGORIES = [
  'Innovation',
  'Leadership',
  'Community Impact',
  'Outstanding Volunteer',
  'Mentorship',
  'Other',
] as const;

type NominationCategory = (typeof CATEGORIES)[number];

interface NominationForm {
  name: string;
  email: string;
  category: NominationCategory | '';
  reason: string;
}

async function submitNomination(form: NominationForm, nominatorId: string) {
  console.log('[NominateScreen] Submitting nomination:', JSON.stringify(form));
  const { error } = await supabase.from('nominations').insert({
    nominee_name: form.name,
    nominee_email: form.email,
    category: form.category,
    reason: form.reason,
    nominated_by: nominatorId,
  });
  if (error) {
    console.error('[NominateScreen] Supabase insert error:', error);
    throw new Error(error.message);
  }
  return true;
}

export default function NominateScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [form, setForm] = useState<NominationForm>({
    name: '',
    email: '',
    category: '',
    reason: '',
  });
  const [showCategoryPicker, setShowCategoryPicker] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);

  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const nominateMutation = useMutation({
    mutationFn: () => submitNomination(form, user?.id ?? ''),
    onSuccess: () => {
      console.log('[NominateScreen] Nomination submitted successfully');
      setSubmitted(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Animated.parallel([
        Animated.spring(successScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 60,
          friction: 8,
        }),
        Animated.timing(successOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    },
    onError: (error: Error) => {
      console.error('[NominateScreen] Nomination failed:', error.message);
      Alert.alert('Error', 'Failed to submit nomination. Please try again.');
    },
  });

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.back();
  }, [router]);

  const handleFieldChange = useCallback((field: keyof NominationForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleCategorySelect = useCallback((cat: NominationCategory) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setForm((prev) => ({ ...prev, category: cat }));
    setShowCategoryPicker(false);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!form.name.trim()) {
      Alert.alert('Missing Name', 'Please enter the nominee\'s name.');
      return;
    }
    if (!form.email.trim()) {
      Alert.alert('Missing Email', 'Please enter the nominee\'s email.');
      return;
    }
    if (!form.category) {
      Alert.alert('Missing Category', 'Please select a nomination category.');
      return;
    }
    if (!form.reason.trim()) {
      Alert.alert('Missing Reason', 'Please provide a reason for this nomination.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    nominateMutation.mutate();
  }, [form, nominateMutation]);

  const handleNewNomination = useCallback(() => {
    setForm({ name: '', email: '', category: '', reason: '' });
    setSubmitted(false);
    successScale.setValue(0);
    successOpacity.setValue(0);
  }, [successScale, successOpacity]);

  if (submitted) {
    return (
      <View style={styles.root}>
        <LinearGradient
          colors={['#FF8C42', '#FF6B2C', '#E05518']}
          style={StyleSheet.absoluteFillObject}
        />
        <SafeAreaView style={styles.successSafeArea} edges={['top', 'bottom']}>
          <Animated.View
            style={[
              styles.successContainer,
              {
                opacity: successOpacity,
                transform: [{ scale: successScale }],
              },
            ]}
          >
            <View style={styles.successIconWrap}>
              <CheckCircle color="#fff" size={64} />
            </View>
            <Text style={styles.successTitle}>Nomination Sent!</Text>
            <Text style={styles.successSubtitle}>
              Thank you for recognizing someone's impact. Your nomination has been submitted successfully.
            </Text>
            <View style={styles.successActions}>
              <Pressable
                onPress={handleNewNomination}
                style={({ pressed }) => [styles.successBtn, pressed && { opacity: 0.85 }]}
              >
                <Star color="#FF6B2C" size={18} />
                <Text style={styles.successBtnText}>Nominate Another</Text>
              </Pressable>
              <Pressable
                onPress={handleBack}
                style={({ pressed }) => [styles.successBtnOutline, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.successBtnOutlineText}>Back to Profile</Text>
              </Pressable>
            </View>
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="nominate-screen">
      <SafeAreaView style={styles.safeHeader} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
            hitSlop={12}
            testID="nominate-back"
          >
            <ArrowLeft color={joyTheme.text} size={24} />
          </Pressable>
          <Text style={styles.headerTitle}>Nominate</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heroSection}>
            <LinearGradient
              colors={['#FFF4ED', '#FFE8D6', '#FFF9F4']}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.heroIconWrap}>
              <Star color="#FF8C42" size={32} fill="#FF8C42" />
            </View>
            <Text style={styles.heroTitle}>Recognize Someone Special</Text>
            <Text style={styles.heroSubtitle}>
              Know a volunteer making a difference? Nominate them for recognition in our community.
            </Text>
          </View>

          <View style={styles.formSection}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nominee's Name</Text>
              <View style={styles.inputWrap}>
                <User color={joyTheme.textMuted} size={18} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter their full name"
                  placeholderTextColor={joyTheme.textMuted + '80'}
                  value={form.name}
                  onChangeText={(v) => handleFieldChange('name', v)}
                  autoCapitalize="words"
                  testID="nominate-name-input"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nominee's Email</Text>
              <View style={styles.inputWrap}>
                <Mail color={joyTheme.textMuted} size={18} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter their email address"
                  placeholderTextColor={joyTheme.textMuted + '80'}
                  value={form.email}
                  onChangeText={(v) => handleFieldChange('email', v)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  testID="nominate-email-input"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category</Text>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setShowCategoryPicker(true);
                }}
                style={styles.inputWrap}
                testID="nominate-category-picker"
              >
                <Star color={form.category ? '#FF8C42' : joyTheme.textMuted} size={18} />
                <Text
                  style={[
                    styles.pickerText,
                    !form.category && styles.pickerPlaceholder,
                  ]}
                >
                  {form.category || 'Select a category'}
                </Text>
                <ChevronDown color={joyTheme.textMuted} size={18} />
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Reason for Nomination</Text>
              <View style={[styles.inputWrap, styles.textAreaWrap]}>
                <FileText
                  color={joyTheme.textMuted}
                  size={18}
                  style={styles.textAreaIcon}
                />
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Tell us why this person deserves recognition..."
                  placeholderTextColor={joyTheme.textMuted + '80'}
                  value={form.reason}
                  onChangeText={(v) => handleFieldChange('reason', v)}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  testID="nominate-reason-input"
                />
              </View>
            </View>
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={nominateMutation.isPending}
            style={({ pressed }) => [
              styles.submitBtn,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              nominateMutation.isPending && { opacity: 0.7 },
            ]}
            testID="nominate-submit"
          >
            <LinearGradient
              colors={['#FF8C42', '#FF6B2C', '#E05518']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Send color="#fff" size={20} />
            <Text style={styles.submitBtnText}>
              {nominateMutation.isPending ? 'Submitting...' : 'Submit Nomination'}
            </Text>
          </Pressable>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showCategoryPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCategoryPicker(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Category</Text>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => handleCategorySelect(cat)}
                style={({ pressed }) => [
                  styles.categoryOption,
                  form.category === cat && styles.categoryOptionActive,
                  pressed && { opacity: 0.7 },
                ]}
                testID={`nominate-category-${cat}`}
              >
                <Text
                  style={[
                    styles.categoryOptionText,
                    form.category === cat && styles.categoryOptionTextActive,
                  ]}
                >
                  {cat}
                </Text>
                {form.category === cat && (
                  <CheckCircle color="#FF8C42" size={20} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: joyTheme.background,
  },
  safeHeader: {
    backgroundColor: joyTheme.surface,
    borderBottomWidth: 1,
    borderBottomColor: joyTheme.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: joyTheme.text,
    letterSpacing: -0.3,
  },
  keyboardView: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 28,
    overflow: 'hidden',
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
    marginBottom: 8,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 15,
    color: joyTheme.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  formSection: {
    paddingHorizontal: 20,
    gap: 18,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: joyTheme.text,
    marginLeft: 4,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: joyTheme.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: joyTheme.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: joyTheme.text,
    fontFamily: fonts.medium,
    padding: 0,
  },
  textAreaWrap: {
    alignItems: 'flex-start',
    minHeight: 130,
  },
  textAreaIcon: {
    marginTop: 2,
  },
  textArea: {
    minHeight: 100,
  },
  pickerText: {
    flex: 1,
    fontSize: 15,
    color: joyTheme.text,
    fontFamily: fonts.medium,
  },
  pickerPlaceholder: {
    color: joyTheme.textMuted + '80',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 28,
    borderRadius: 16,
    overflow: 'hidden',
    paddingVertical: 18,
  },
  submitBtnText: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: '#fff',
  },
  bottomSpacer: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalContent: {
    backgroundColor: joyTheme.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    gap: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: joyTheme.background,
  },
  categoryOptionActive: {
    backgroundColor: '#FFF0E0',
    borderWidth: 1,
    borderColor: '#FF8C42' + '40',
  },
  categoryOptionText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: joyTheme.text,
  },
  categoryOptionTextActive: {
    color: '#E05518',
    fontFamily: fonts.bold,
  },
  successSafeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  successIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 28,
    fontFamily: fonts.black,
    color: '#fff',
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 24,
  },
  successActions: {
    gap: 12,
    width: '100%',
    marginTop: 16,
  },
  successBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
  },
  successBtnText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: '#FF6B2C',
  },
  successBtnOutline: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  successBtnOutlineText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: '#fff',
  },
});
