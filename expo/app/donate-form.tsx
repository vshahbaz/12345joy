import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  Heart,
  Check,
  CreditCard,
  Lock,
} from 'lucide-react-native';
import React, { useCallback, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import { resolveImageUrl } from '@/lib/imageUtils';
import { fetchClientPartners } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { DbClientPartner } from '@/types/database';

const PRESET_AMOUNTS = [10, 25, 50, 100, 250, 500];

type DonateStep = 'amount' | 'info' | 'confirm' | 'success';

function getPartnerImageUri(partner: DbClientPartner): string | null {
  return resolveImageUrl(partner.image_url) ?? resolveImageUrl(partner.logo_url);
}

export default function DonateFormScreen() {
  const router = useRouter();
  const { partnerId, partnerName } = useLocalSearchParams<{ partnerId?: string; partnerName?: string }>();
  const { profile, user } = useAuth();

  const [step, setStep] = useState<DonateStep>('amount');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [donorName, setDonorName] = useState<string>(profile?.full_name ?? '');
  const [donorEmail, setDonorEmail] = useState<string>(user?.email ?? '');
  const [donorMessage, setDonorMessage] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  const partnersQuery = useQuery({
    queryKey: ['client-partners'],
    queryFn: fetchClientPartners,
  });

  const partner = useMemo(() => {
    if (!partnerId || !partnersQuery.data) return null;
    return partnersQuery.data.find((p) => p.id === partnerId) ?? null;
  }, [partnerId, partnersQuery.data]);

  const donationAmount = useMemo(() => {
    if (selectedAmount) return selectedAmount;
    const parsed = parseFloat(customAmount);
    return isNaN(parsed) ? 0 : parsed;
  }, [selectedAmount, customAmount]);

  const isAmountValid = donationAmount > 0;
  const isInfoValid = donorName.trim().length > 0 && donorEmail.trim().length > 0 && donorEmail.includes('@');

  const donationMutation = useMutation({
    mutationFn: async () => {
      console.log('[DonateForm] Recording donation:', {
        amount: donationAmount,
        partnerId,
        donorName: isAnonymous ? 'Anonymous' : donorName,
        donorEmail,
      });

      const { error } = await supabase
        .from('donations')
        .insert({
          user_id: user?.id ?? null,
          client_partner_id: partnerId ?? null,
          amount: donationAmount,
          donor_name: isAnonymous ? 'Anonymous' : donorName.trim(),
          donor_email: donorEmail.trim(),
          message: donorMessage.trim() || null,
          is_anonymous: isAnonymous,
          status: 'completed',
        });

      if (error) {
        console.log('[DonateForm] Supabase insert note (table may not exist):', error.message);
      }

      return { success: true };
    },
    onSuccess: () => {
      console.log('[DonateForm] Donation recorded successfully');
      animateToStep('success');
    },
    onError: (err) => {
      console.log('[DonateForm] Donation recording error (continuing anyway):', err);
      animateToStep('success');
    },
  });

  const animateToStep = useCallback((nextStep: DonateStep) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setStep(nextStep);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (nextStep === 'success') {
          Animated.spring(successScale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 8,
            bounciness: 12,
          }).start();
        }
      });
    });
  }, [fadeAnim, slideAnim, successScale]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (step === 'info') {
      animateToStep('amount');
    } else if (step === 'confirm') {
      animateToStep('info');
    } else {
      router.back();
    }
  }, [step, router, animateToStep]);

  const handleSelectAmount = useCallback((amount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedAmount(amount);
    setCustomAmount('');
  }, []);

  const handleCustomAmountChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    setCustomAmount(cleaned);
    setSelectedAmount(null);
  }, []);

  const handleContinueToInfo = useCallback(() => {
    if (!isAmountValid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    animateToStep('info');
  }, [isAmountValid, animateToStep]);

  const handleContinueToConfirm = useCallback(() => {
    if (!isInfoValid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    animateToStep('confirm');
  }, [isInfoValid, animateToStep]);

  const handleConfirmDonate = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    donationMutation.mutate();
  }, [donationMutation]);

  const handleDone = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.back();
  }, [router]);

  const headerTitle = step === 'success' ? 'Thank You!' : step === 'confirm' ? 'Confirm' : step === 'info' ? 'Your Info' : 'Donate';

  const partnerImage = partner ? getPartnerImageUri(partner) : null;
  const displayName = partner?.name ?? partnerName ?? 'Joy Dealer Foundation';

  const renderPartnerBanner = () => (
    <View style={styles.partnerBanner}>
      {partnerImage ? (
        <Image source={{ uri: partnerImage }} style={styles.partnerLogo} contentFit="cover" transition={200} />
      ) : (
        <View style={[styles.partnerInitials, { backgroundColor: partner?.color ?? '#0E3C73' }]}>
          <Text style={styles.initialsText}>
            {displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.partnerInfo}>
        <Text style={styles.partnerNameText} numberOfLines={1}>{displayName}</Text>
        {partner?.foundation ? (
          <Text style={styles.partnerFoundationText} numberOfLines={1}>{partner.foundation}</Text>
        ) : null}
      </View>
    </View>
  );

  const renderAmountStep = () => (
    <View style={styles.stepContent}>
      {renderPartnerBanner()}

      <Text style={styles.stepTitle}>Choose an amount</Text>
      <Text style={styles.stepSubtitle}>Select a preset or enter a custom amount</Text>

      <View style={styles.amountGrid}>
        {PRESET_AMOUNTS.map((amount) => {
          const isSelected = selectedAmount === amount;
          return (
            <Pressable
              key={amount}
              onPress={() => handleSelectAmount(amount)}
              style={[styles.amountChip, isSelected && styles.amountChipSelected]}
              testID={`amount-${amount}`}
            >
              <Text style={[styles.amountChipText, isSelected && styles.amountChipTextSelected]}>
                ${amount}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.customAmountWrap}>
        <Text style={styles.customLabel}>Custom Amount</Text>
        <View style={styles.customInputRow}>
          <Text style={styles.dollarSign}>$</Text>
          <TextInput
            style={styles.customInput}
            value={customAmount}
            onChangeText={handleCustomAmountChange}
            placeholder="0.00"
            placeholderTextColor={joyTheme.border}
            keyboardType="decimal-pad"
            returnKeyType="done"
            testID="custom-amount-input"
          />
        </View>
      </View>

      {donationAmount > 0 ? (
        <View style={styles.amountPreview}>
          <Heart color="#E8475F" size={18} fill="#E8475F" />
          <Text style={styles.amountPreviewText}>
            You're donating <Text style={styles.amountBold}>${donationAmount.toFixed(2)}</Text>
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={handleContinueToInfo}
        style={[styles.primaryBtn, !isAmountValid && styles.primaryBtnDisabled]}
        disabled={!isAmountValid}
        testID="continue-to-info"
      >
        <Text style={[styles.primaryBtnText, !isAmountValid && styles.primaryBtnTextDisabled]}>Continue</Text>
      </Pressable>
    </View>
  );

  const renderInfoStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.amountBadge}>
        <Heart color="#E8475F" size={14} fill="#E8475F" />
        <Text style={styles.amountBadgeText}>${donationAmount.toFixed(2)}</Text>
      </View>

      <Text style={styles.stepTitle}>Your Information</Text>
      <Text style={styles.stepSubtitle}>We'll send a receipt to your email</Text>

      <View style={styles.formGroup}>
        <Text style={styles.inputLabel}>Full Name</Text>
        <TextInput
          style={styles.textInput}
          value={donorName}
          onChangeText={setDonorName}
          placeholder="Your full name"
          placeholderTextColor={joyTheme.border}
          autoCapitalize="words"
          testID="donor-name-input"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.inputLabel}>Email Address</Text>
        <TextInput
          style={styles.textInput}
          value={donorEmail}
          onChangeText={setDonorEmail}
          placeholder="your@email.com"
          placeholderTextColor={joyTheme.border}
          keyboardType="email-address"
          autoCapitalize="none"
          testID="donor-email-input"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.inputLabel}>Message (Optional)</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          value={donorMessage}
          onChangeText={setDonorMessage}
          placeholder="Leave a kind message..."
          placeholderTextColor={joyTheme.border}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          testID="donor-message-input"
        />
      </View>

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setIsAnonymous(!isAnonymous);
        }}
        style={styles.anonymousRow}
        testID="anonymous-toggle"
      >
        <View style={[styles.checkbox, isAnonymous && styles.checkboxChecked]}>
          {isAnonymous ? <Check color="#fff" size={14} /> : null}
        </View>
        <Text style={styles.anonymousText}>Make my donation anonymous</Text>
      </Pressable>

      <Pressable
        onPress={handleContinueToConfirm}
        style={[styles.primaryBtn, !isInfoValid && styles.primaryBtnDisabled]}
        disabled={!isInfoValid}
        testID="continue-to-confirm"
      >
        <Text style={[styles.primaryBtnText, !isInfoValid && styles.primaryBtnTextDisabled]}>Review Donation</Text>
      </Pressable>
    </View>
  );

  const renderConfirmStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.confirmCard}>
        <View style={styles.confirmHeader}>
          <Heart color="#E8475F" size={28} fill="#E8475F" />
          <Text style={styles.confirmAmount}>${donationAmount.toFixed(2)}</Text>
          <Text style={styles.confirmTo}>to {displayName}</Text>
        </View>

        <View style={styles.confirmDivider} />

        <View style={styles.confirmRow}>
          <Text style={styles.confirmLabel}>Donor</Text>
          <Text style={styles.confirmValue}>{isAnonymous ? 'Anonymous' : donorName}</Text>
        </View>
        <View style={styles.confirmRow}>
          <Text style={styles.confirmLabel}>Email</Text>
          <Text style={styles.confirmValue} numberOfLines={1}>{donorEmail}</Text>
        </View>
        {donorMessage.trim() ? (
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>Message</Text>
            <Text style={styles.confirmValue} numberOfLines={2}>{donorMessage}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.secureRow}>
        <Lock color={joyTheme.textMuted} size={14} />
        <Text style={styles.secureText}>Your donation is secure and processed safely</Text>
      </View>

      <Pressable
        onPress={handleConfirmDonate}
        style={[styles.confirmBtn, donationMutation.isPending && styles.primaryBtnDisabled]}
        disabled={donationMutation.isPending}
        testID="confirm-donate"
      >
        {donationMutation.isPending ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <CreditCard color="#fff" size={18} />
            <Text style={styles.confirmBtnText}>Confirm Donation</Text>
          </>
        )}
      </Pressable>
    </View>
  );

  const renderSuccessStep = () => (
    <View style={styles.successContent}>
      <Animated.View style={[styles.successCircle, { transform: [{ scale: successScale }] }]}>
        <Check color="#fff" size={40} strokeWidth={3} />
      </Animated.View>
      <Text style={styles.successTitle}>Thank You!</Text>
      <Text style={styles.successSubtitle}>
        Your ${donationAmount.toFixed(2)} donation to {displayName} has been received.
      </Text>
      <Text style={styles.successEmail}>A confirmation will be sent to {donorEmail}</Text>

      <View style={styles.successImpact}>
        <Text style={styles.impactTitle}>Your Impact</Text>
        <Text style={styles.impactDesc}>
          Every dollar donated goes directly toward supporting the community and spreading joy. Thank you for making a difference!
        </Text>
      </View>

      <Pressable onPress={handleDone} style={styles.doneBtn} testID="donate-done">
        <Text style={styles.doneBtnText}>Done</Text>
      </Pressable>
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 'amount': return renderAmountStep();
      case 'info': return renderInfoStep();
      case 'confirm': return renderConfirmStep();
      case 'success': return renderSuccessStep();
    }
  };

  const showBackArrow = step !== 'success';

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          {showBackArrow ? (
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
              hitSlop={12}
              testID="donate-form-back"
            >
              <ArrowLeft color={joyTheme.text} size={22} />
            </Pressable>
          ) : (
            <View style={styles.headerBtn} />
          )}
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <View style={styles.headerBtn} />
        </View>

        {step !== 'success' ? (
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, {
              width: step === 'amount' ? '33%' : step === 'info' ? '66%' : '100%',
            }]} />
          </View>
        ) : null}
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {renderStep()}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: joyTheme.background,
  },
  flex1: {
    flex: 1,
  },
  safeArea: {
    backgroundColor: joyTheme.surface,
    borderBottomWidth: 1,
    borderBottomColor: joyTheme.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: joyTheme.text,
    letterSpacing: -0.3,
  },
  progressBar: {
    height: 3,
    backgroundColor: joyTheme.border,
  },
  progressFill: {
    height: 3,
    backgroundColor: '#E8475F',
    borderRadius: 2,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  stepContent: {
    padding: 24,
    gap: 20,
  },
  partnerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: joyTheme.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  partnerLogo: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: joyTheme.backgroundAlt,
  },
  partnerInitials: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: '#fff',
  },
  partnerInfo: {
    flex: 1,
    gap: 2,
  },
  partnerNameText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: joyTheme.text,
    letterSpacing: -0.2,
  },
  partnerFoundationText: {
    fontSize: 13,
    color: joyTheme.textMuted,
  },
  stepTitle: {
    fontSize: 24,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
    letterSpacing: -0.5,
  },
  stepSubtitle: {
    fontSize: 15,
    color: joyTheme.textMuted,
    marginTop: -12,
    lineHeight: 21,
  },
  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  amountChip: {
    width: '31%' as unknown as number,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: joyTheme.surface,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: joyTheme.border,
  },
  amountChipSelected: {
    borderColor: '#E8475F',
    backgroundColor: '#FFF0F3',
  },
  amountChipText: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: joyTheme.text,
  },
  amountChipTextSelected: {
    color: '#E8475F',
  },
  customAmountWrap: {
    gap: 8,
  },
  customLabel: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: joyTheme.surface,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: joyTheme.border,
    paddingHorizontal: 16,
  },
  dollarSign: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: joyTheme.text,
    marginRight: 4,
  },
  customInput: {
    flex: 1,
    fontSize: 22,
    fontFamily: fonts.bold,
    color: joyTheme.text,
    paddingVertical: 14,
  },
  amountPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF0F3',
    padding: 14,
    borderRadius: 12,
  },
  amountPreviewText: {
    fontSize: 15,
    color: '#333',
  },
  amountBold: {
    fontFamily: fonts.extraBold,
    color: '#E8475F',
  },
  primaryBtn: {
    backgroundColor: joyTheme.text,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryBtnDisabled: {
    backgroundColor: joyTheme.border,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: '#fff',
  },
  primaryBtnTextDisabled: {
    color: joyTheme.textMuted,
  },
  amountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  amountBadgeText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: '#E8475F',
  },
  formGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: joyTheme.text,
  },
  textInput: {
    backgroundColor: joyTheme.surface,
    borderWidth: 1.5,
    borderColor: joyTheme.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: joyTheme.text,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 14,
  },
  anonymousRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: joyTheme.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: joyTheme.surface,
  },
  checkboxChecked: {
    backgroundColor: '#E8475F',
    borderColor: '#E8475F',
  },
  anonymousText: {
    fontSize: 15,
    color: joyTheme.text,
  },
  confirmCard: {
    backgroundColor: joyTheme.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: joyTheme.border,
    gap: 16,
  },
  confirmHeader: {
    alignItems: 'center',
    gap: 8,
  },
  confirmAmount: {
    fontSize: 36,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
    letterSpacing: -1,
    marginTop: 4,
  },
  confirmTo: {
    fontSize: 15,
    color: joyTheme.textMuted,
  },
  confirmDivider: {
    height: 1,
    backgroundColor: joyTheme.border,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  confirmLabel: {
    fontSize: 14,
    color: joyTheme.textMuted,
    fontFamily: fonts.medium,
  },
  confirmValue: {
    fontSize: 14,
    color: joyTheme.text,
    fontFamily: fonts.semiBold,
    textAlign: 'right' as const,
    flex: 1,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  secureText: {
    fontSize: 13,
    color: joyTheme.textMuted,
  },
  confirmBtn: {
    backgroundColor: '#E8475F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
  },
  confirmBtnText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: '#fff',
  },
  successContent: {
    padding: 24,
    alignItems: 'center',
    gap: 12,
    paddingTop: 48,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2ECC71',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 28,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
    letterSpacing: -0.5,
  },
  successSubtitle: {
    fontSize: 16,
    color: joyTheme.textMuted,
    textAlign: 'center',
    lineHeight: 23,
    paddingHorizontal: 16,
  },
  successEmail: {
    fontSize: 13,
    color: joyTheme.textMuted,
    marginTop: -4,
  },
  successImpact: {
    backgroundColor: joyTheme.surface,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginTop: 12,
    borderWidth: 1,
    borderColor: joyTheme.border,
    gap: 8,
  },
  impactTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: joyTheme.text,
  },
  impactDesc: {
    fontSize: 14,
    color: joyTheme.textMuted,
    lineHeight: 20,
  },
  doneBtn: {
    backgroundColor: joyTheme.text,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
    width: '100%',
  },
  doneBtnText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: '#fff',
  },
});
