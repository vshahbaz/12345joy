import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Award,
  CheckCircle,
  Circle,
  Clock,
  Filter,
  Gift,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Mail,
  Send,
  ShoppingBag,
  Sparkles,
  Tag,
  Star,
  Truck,
  User,
  X,
  Shirt,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
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
import { useAuth } from '@/providers/AuthProvider';
import {
  fetchShopItems,
  fetchUserRedemptions,
  redeemShopItem,
  fetchProfileById,
  fetchRedemptionMessages,
  sendRedemptionMessage,
} from '@/lib/api';
import type { DbShopItem, DbRedemption, DbRedemptionMessage } from '@/types/database';

type ShopTab = 'shop' | 'redeemed';
type ModalStep = 'details' | 'form';

const ALL_CATEGORY = 'All';

interface RedemptionFormData {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  size: string;
  notes: string;
}

const INITIAL_FORM: RedemptionFormData = {
  fullName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  size: '',
  notes: '',
};

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

function getCategoryIcon(category: string | null | undefined) {
  switch ((category ?? '').toLowerCase()) {
    case 'merch':
    case 'merchandise':
      return { Icon: ShoppingBag, color: '#0A84FF', bg: '#EEF4FF' };
    case 'experience':
    case 'experiences':
      return { Icon: Sparkles, color: '#8B5CF6', bg: '#F5F0FF' };
    case 'gift card':
    case 'gift_card':
      return { Icon: Gift, color: '#FF8C42', bg: '#FFF5EC' };
    case 'donation':
      return { Icon: Award, color: '#2BB673', bg: '#F0FFF5' };
    default:
      return { Icon: Package, color: joyTheme.primary, bg: '#EEF4FF' };
  }
}

function getItemImage(item: DbShopItem | null | undefined): string {
  if (!item) return 'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&w=400&q=80';
  const resolved = resolveImageUrl(item.image_url);
  if (resolved) return resolved;
  switch ((item.category ?? '').toLowerCase()) {
    case 'merch':
    case 'merchandise':
      return 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=400&q=80';
    case 'experience':
    case 'experiences':
      return 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=400&q=80';
    case 'gift card':
    case 'gift_card':
      return 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=400&q=80';
    default:
      return 'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&w=400&q=80';
  }
}

function isMerchCategory(category: string | null | undefined): boolean {
  const cat = (category ?? '').toLowerCase();
  return cat === 'merch' || cat === 'merchandise';
}

function RedemptionForm({
  item,
  form,
  setForm,
  onSubmit,
  onBack,
  isSubmitting,
  availablePoints,
}: {
  item: DbShopItem;
  form: RedemptionFormData;
  setForm: React.Dispatch<React.SetStateAction<RedemptionFormData>>;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
  availablePoints: number;
}) {
  const pointsCost = item.points_cost ?? 0;
  const showSize = isMerchCategory(item.category);

  const isValid = form.fullName.trim().length > 0 && form.email.trim().length > 0;

  return (
    <View style={formStyles.container}>
      <View style={formStyles.header}>
        <Pressable onPress={onBack} style={formStyles.backBtn} hitSlop={12}>
          <ArrowLeft color={joyTheme.text} size={20} />
        </Pressable>
        <View style={formStyles.headerCenter}>
          <Text style={formStyles.headerTitle}>Complete Redemption</Text>
          <Text style={formStyles.headerSub}>{item.title}</Text>
        </View>
        <View style={formStyles.backBtn} />
      </View>

      <View style={formStyles.costSummary}>
        <Award color="#FF8C42" size={18} />
        <Text style={formStyles.costText}>
          {pointsCost.toLocaleString()} points
        </Text>
        <View style={formStyles.costDivider} />
        <Text style={formStyles.balanceText}>
          Balance: {availablePoints.toLocaleString()}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={formStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={formStyles.section}>
          <Text style={formStyles.sectionTitle}>Contact Information</Text>

          <View style={formStyles.inputGroup}>
            <View style={formStyles.inputIcon}>
              <User color="#5F7795" size={16} />
            </View>
            <TextInput
              style={formStyles.input}
              placeholder="Full Name *"
              placeholderTextColor="#A0AEC0"
              value={form.fullName}
              onChangeText={(v) => setForm((prev) => ({ ...prev, fullName: v }))}
              autoCapitalize="words"
            />
          </View>

          <View style={formStyles.inputGroup}>
            <View style={formStyles.inputIcon}>
              <Mail color="#5F7795" size={16} />
            </View>
            <TextInput
              style={formStyles.input}
              placeholder="Email Address *"
              placeholderTextColor="#A0AEC0"
              value={form.email}
              onChangeText={(v) => setForm((prev) => ({ ...prev, email: v }))}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={formStyles.inputGroup}>
            <View style={formStyles.inputIcon}>
              <Phone color="#5F7795" size={16} />
            </View>
            <TextInput
              style={formStyles.input}
              placeholder="Phone Number"
              placeholderTextColor="#A0AEC0"
              value={form.phone}
              onChangeText={(v) => setForm((prev) => ({ ...prev, phone: v }))}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={formStyles.section}>
          <Text style={formStyles.sectionTitle}>Shipping Address</Text>

          <View style={formStyles.inputGroup}>
            <View style={formStyles.inputIcon}>
              <MapPin color="#5F7795" size={16} />
            </View>
            <TextInput
              style={formStyles.input}
              placeholder="Street Address"
              placeholderTextColor="#A0AEC0"
              value={form.address}
              onChangeText={(v) => setForm((prev) => ({ ...prev, address: v }))}
            />
          </View>

          <View style={formStyles.rowInputs}>
            <View style={[formStyles.inputGroup, { flex: 2 }]}>
              <TextInput
                style={formStyles.inputSmall}
                placeholder="City"
                placeholderTextColor="#A0AEC0"
                value={form.city}
                onChangeText={(v) => setForm((prev) => ({ ...prev, city: v }))}
              />
            </View>
            <View style={[formStyles.inputGroup, { flex: 1 }]}>
              <TextInput
                style={formStyles.inputSmall}
                placeholder="State"
                placeholderTextColor="#A0AEC0"
                value={form.state}
                onChangeText={(v) => setForm((prev) => ({ ...prev, state: v }))}
                autoCapitalize="characters"
                maxLength={2}
              />
            </View>
            <View style={[formStyles.inputGroup, { flex: 1 }]}>
              <TextInput
                style={formStyles.inputSmall}
                placeholder="Zip"
                placeholderTextColor="#A0AEC0"
                value={form.zipCode}
                onChangeText={(v) => setForm((prev) => ({ ...prev, zipCode: v }))}
                keyboardType="number-pad"
                maxLength={5}
              />
            </View>
          </View>
        </View>

        {showSize && (
          <View style={formStyles.section}>
            <View style={formStyles.sectionTitleRow}>
              <Shirt color="#5F7795" size={16} />
              <Text style={formStyles.sectionTitle}>Select Size</Text>
            </View>
            <View style={formStyles.sizeGrid}>
              {SIZES.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setForm((prev) => ({ ...prev, size: s }));
                  }}
                  style={[
                    formStyles.sizeChip,
                    form.size === s && formStyles.sizeChipActive,
                  ]}
                >
                  <Text style={[
                    formStyles.sizeChipText,
                    form.size === s && formStyles.sizeChipTextActive,
                  ]}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={formStyles.section}>
          <Text style={formStyles.sectionTitle}>Additional Notes</Text>
          <TextInput
            style={formStyles.textArea}
            placeholder="Any special requests or notes..."
            placeholderTextColor="#A0AEC0"
            value={form.notes}
            onChangeText={(v) => setForm((prev) => ({ ...prev, notes: v }))}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      <View style={formStyles.footer}>
        <Pressable
          onPress={onSubmit}
          disabled={!isValid || isSubmitting}
          style={({ pressed }) => [
            formStyles.submitBtn,
            !isValid && formStyles.submitBtnDisabled,
            pressed && isValid && { opacity: 0.85 },
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={[
              formStyles.submitBtnText,
              !isValid && formStyles.submitBtnTextDisabled,
            ]}>
              Confirm & Redeem for {pointsCost.toLocaleString()} Points
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function ItemDetailModal({
  item,
  visible,
  onClose,
  availablePoints,
  onRedeem,
  isRedeeming,
  alreadyRedeemed,
  profileName,
  profileEmail,
}: {
  item: DbShopItem | null;
  visible: boolean;
  onClose: () => void;
  availablePoints: number;
  onRedeem: (item: DbShopItem, formData: RedemptionFormData) => void;
  isRedeeming: boolean;
  alreadyRedeemed: boolean;
  profileName: string;
  profileEmail: string;
}) {
  const [step, setStep] = useState<ModalStep>('details');
  const [form, setForm] = useState<RedemptionFormData>({
    ...INITIAL_FORM,
    fullName: profileName,
    email: profileEmail,
  });

  const handleClose = useCallback(() => {
    setStep('details');
    setForm({ ...INITIAL_FORM, fullName: profileName, email: profileEmail });
    onClose();
  }, [onClose, profileName, profileEmail]);

  const handleStartRedeem = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setForm((prev) => ({
      ...prev,
      fullName: prev.fullName || profileName,
      email: prev.email || profileEmail,
    }));
    setStep('form');
  }, [profileName, profileEmail]);

  const handleSubmitForm = useCallback(() => {
    if (!item) return;
    console.log('[Shop] Submitting redemption form for:', item.title, form);
    onRedeem(item, form);
    setTimeout(() => {
      setStep('details');
      setForm({ ...INITIAL_FORM, fullName: profileName, email: profileEmail });
    }, 500);
  }, [item, form, onRedeem, profileName, profileEmail]);

  if (!item) return null;

  const pointsCost = item.points_cost ?? 0;
  const canAfford = availablePoints >= pointsCost;
  const outOfStock = item.inventory !== null && item.inventory <= 0;
  const { Icon: CatIcon, color: catColor, bg: catBg } = getCategoryIcon(item.category);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={modalStyles.backdrop}
      >
        <Pressable style={modalStyles.backdropTouch} onPress={handleClose} />
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />

          <Pressable
            onPress={handleClose}
            style={modalStyles.closeBtn}
            hitSlop={12}
          >
            <X color={joyTheme.textMuted} size={22} />
          </Pressable>

          {step === 'details' ? (
            <>
              <ScrollView
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={modalStyles.scrollContent}
              >
                <View style={modalStyles.imageWrap}>
                  <Image
                    source={{ uri: getItemImage(item) }}
                    style={modalStyles.image}
                    contentFit="cover"
                  />
                  {outOfStock && (
                    <View style={modalStyles.stockOverlay}>
                      <Text style={modalStyles.stockOverlayText}>Out of Stock</Text>
                    </View>
                  )}
                  {item.inventory !== null && item.inventory > 0 && item.inventory <= 5 && (
                    <View style={modalStyles.limitedBadge}>
                      <Star color="#FFD700" size={12} />
                      <Text style={modalStyles.limitedText}>Only {item.inventory} left</Text>
                    </View>
                  )}
                </View>

                <View style={modalStyles.body}>
                  {item.category ? (
                    <View style={[modalStyles.categoryPill, { backgroundColor: catBg }]}>
                      <CatIcon color={catColor} size={13} />
                      <Text style={[modalStyles.categoryText, { color: catColor }]}>{item.category}</Text>
                    </View>
                  ) : null}

                  <Text style={modalStyles.name}>{item.title}</Text>

                  <View style={modalStyles.pointsRow}>
                    <View style={modalStyles.pointsChip}>
                      <Award color="#FF8C42" size={18} />
                      <Text style={modalStyles.pointsValue}>{pointsCost.toLocaleString()}</Text>
                      <Text style={modalStyles.pointsLabel}>points</Text>
                    </View>
                    {alreadyRedeemed && (
                      <View style={modalStyles.redeemedChip}>
                        <CheckCircle color="#2BB673" size={14} />
                        <Text style={modalStyles.redeemedChipText}>Previously Redeemed</Text>
                      </View>
                    )}
                  </View>

                  {item.description ? (
                    <View style={modalStyles.descriptionSection}>
                      <Text style={modalStyles.descriptionTitle}>Description</Text>
                      <Text style={modalStyles.description}>{item.description}</Text>
                    </View>
                  ) : null}

                  <View style={modalStyles.detailsGrid}>
                    <View style={modalStyles.detailItem}>
                      <Text style={modalStyles.detailLabel}>Your Points</Text>
                      <Text style={modalStyles.detailValue}>{availablePoints.toLocaleString()}</Text>
                    </View>
                    <View style={modalStyles.detailDivider} />
                    <View style={modalStyles.detailItem}>
                      <Text style={modalStyles.detailLabel}>Cost</Text>
                      <Text style={modalStyles.detailValue}>{pointsCost.toLocaleString()}</Text>
                    </View>
                    <View style={modalStyles.detailDivider} />
                    <View style={modalStyles.detailItem}>
                      <Text style={modalStyles.detailLabel}>After</Text>
                      <Text style={[
                        modalStyles.detailValue,
                        !canAfford && { color: '#EF4444' },
                        canAfford && { color: '#2BB673' },
                      ]}>
                        {canAfford ? (availablePoints - pointsCost).toLocaleString() : `-${(pointsCost - availablePoints).toLocaleString()}`}
                      </Text>
                    </View>
                  </View>

                  {item.inventory !== null && (
                    <View style={modalStyles.stockRow}>
                      <Package color={joyTheme.textMuted} size={14} />
                      <Text style={modalStyles.stockText}>
                        {item.inventory > 0 ? `${item.inventory} remaining in stock` : 'Currently out of stock'}
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>

              <View style={modalStyles.footer}>
                <Pressable
                  onPress={handleStartRedeem}
                  disabled={!canAfford || outOfStock || isRedeeming}
                  style={({ pressed }) => [
                    modalStyles.redeemBtn,
                    outOfStock && modalStyles.redeemBtnDisabled,
                    !canAfford && !outOfStock && modalStyles.redeemBtnCantAfford,
                    pressed && !outOfStock && canAfford && { opacity: 0.85 },
                  ]}
                >
                  {isRedeeming ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={[
                      modalStyles.redeemBtnText,
                      (outOfStock || !canAfford) && modalStyles.redeemBtnTextDisabled,
                    ]}>
                      {outOfStock
                        ? 'Out of Stock'
                        : canAfford
                          ? `Redeem for ${pointsCost.toLocaleString()} Points`
                          : `Need ${(pointsCost - availablePoints).toLocaleString()} More Points`}
                    </Text>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <RedemptionForm
              item={item}
              form={form}
              setForm={setForm}
              onSubmit={handleSubmitForm}
              onBack={() => setStep('details')}
              isSubmitting={isRedeeming}
              availablePoints={availablePoints}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const STATUS_STEPS = [
  { key: 'pending', label: 'Pending', icon: Clock, color: '#FFB020', bg: '#FFF8E6' },
  { key: 'processing', label: 'Processing', icon: Package, color: '#0A84FF', bg: '#EEF4FF' },
  { key: 'shipped', label: 'Shipped', icon: Truck, color: '#8B5CF6', bg: '#F5F0FF' },
  { key: 'fulfilled', label: 'Fulfilled', icon: CheckCircle, color: '#2BB673', bg: '#F0FFF5' },
] as const;

function getStatusIndex(status: string): number {
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

function RedemptionDetailModal({
  redemption,
  visible,
  onClose,
  userId,
}: {
  redemption: DbRedemption | null;
  visible: boolean;
  onClose: () => void;
  userId: string;
}) {
  const [chatMessage, setChatMessage] = useState<string>('');
  const [localMessages, setLocalMessages] = useState<DbRedemptionMessage[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const queryClient = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: ['redemption-messages', redemption?.id],
    queryFn: () => fetchRedemptionMessages(redemption!.id),
    enabled: !!redemption?.id && visible,
    refetchInterval: visible ? 10000 : false,
  });

  const sendMutation = useMutation({
    mutationFn: async (msg: string) => {
      const result = await sendRedemptionMessage(redemption!.id, userId, msg, 'user');
      if (!result) {
        throw new Error('Chat is not available at this time. Please try again later.');
      }
      return result;
    },
    onSuccess: (data) => {
      setLocalMessages((prev) => [...prev, data]);
      void queryClient.invalidateQueries({ queryKey: ['redemption-messages', redemption?.id] });
      setChatMessage('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    },
    onError: (err: Error) => {
      Alert.alert('Unable to Send', err.message || 'Failed to send message. Please try again.');
    },
  });

  React.useEffect(() => {
    if (messagesQuery.data) {
      setLocalMessages(messagesQuery.data);
    }
  }, [messagesQuery.data]);

  React.useEffect(() => {
    if (!visible) {
      setLocalMessages([]);
      setChatMessage('');
    }
  }, [visible]);

  const handleSend = useCallback(() => {
    const trimmed = chatMessage.trim();
    if (!trimmed || !redemption) return;
    console.log('[Shop] Sending chat message for redemption:', redemption.id);
    sendMutation.mutate(trimmed);
  }, [chatMessage, redemption, sendMutation]);

  if (!redemption) return null;

  const rawItem = redemption.shop_items;
  const item: DbShopItem | null = rawItem && typeof rawItem === 'object' && !Array.isArray(rawItem) ? rawItem as DbShopItem : null;
  const status = (redemption.status ?? 'pending') || 'pending';
  const statusIdx = getStatusIndex(status);
  const imgUri = item ? getItemImage(item) : 'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&w=400&q=80';
  const { Icon: CatIcon, color: catColor, bg: catBg } = getCategoryIcon(item?.category);

  const parsedNotes = (redemption.notes ?? '').split('\n').filter(Boolean);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={rdStyles.backdrop}
      >
        <Pressable style={rdStyles.backdropTouch} onPress={onClose} />
        <View style={rdStyles.sheet}>
          <View style={rdStyles.handle} />
          <Pressable onPress={onClose} style={rdStyles.closeBtn} hitSlop={12}>
            <X color={joyTheme.textMuted} size={22} />
          </Pressable>

          <ScrollView
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={rdStyles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={rdStyles.itemHeader}>
              <Image
                source={{ uri: imgUri }}
                style={rdStyles.itemThumb}
                contentFit="cover"
              />
              <View style={rdStyles.itemHeaderInfo}>
                {item?.category ? (
                  <View style={[rdStyles.catPill, { backgroundColor: catBg }]}>
                    <CatIcon color={catColor} size={11} />
                    <Text style={[rdStyles.catText, { color: catColor }]}>{item.category}</Text>
                  </View>
                ) : null}
                <Text style={rdStyles.itemName} numberOfLines={2}>{item?.title ?? 'Reward'}</Text>
                <View style={rdStyles.pointsRow}>
                  <Award color="#FF8C42" size={14} />
                  <Text style={rdStyles.pointsText}>{(redemption.points_spent ?? 0).toLocaleString()} pts</Text>
                  <Text style={rdStyles.dateText}>
                    {redemption.redeemed_at ? new Date(redemption.redeemed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                  </Text>
                </View>
              </View>
            </View>

            <View style={rdStyles.statusSection}>
              <Text style={rdStyles.sectionLabel}>Order Status</Text>
              <View style={rdStyles.timeline}>
                {STATUS_STEPS.map((step, i) => {
                  const isCompleted = i <= statusIdx;
                  const isCurrent = i === statusIdx;
                  const StepIcon = step.icon;
                  return (
                    <View key={step.key} style={rdStyles.timelineRow}>
                      <View style={rdStyles.timelineLeft}>
                        <View style={[
                          rdStyles.timelineDot,
                          isCompleted && { backgroundColor: step.color },
                          !isCompleted && { backgroundColor: '#E8EDF2' },
                          isCurrent && { borderWidth: 3, borderColor: step.color + '40' },
                        ]}>
                          {isCompleted ? (
                            <StepIcon color="#fff" size={14} />
                          ) : (
                            <Circle color="#C4CDD5" size={10} />
                          )}
                        </View>
                        {i < STATUS_STEPS.length - 1 && (
                          <View style={[
                            rdStyles.timelineLine,
                            i < statusIdx && { backgroundColor: STATUS_STEPS[i + 1].color },
                          ]} />
                        )}
                      </View>
                      <View style={[
                        rdStyles.timelineContent,
                        isCurrent && { backgroundColor: step.bg, borderColor: step.color + '30' },
                      ]}>
                        <Text style={[
                          rdStyles.timelineLabel,
                          isCompleted && { color: step.color, fontFamily: fonts.bold },
                          !isCompleted && { color: '#A0AEC0' },
                        ]}>{step.label}</Text>
                        {isCurrent && (
                          <Text style={[rdStyles.timelineSub, { color: step.color }]}>Current Status</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {parsedNotes.length > 0 && (
              <View style={rdStyles.notesSection}>
                <Text style={rdStyles.sectionLabel}>Order Details</Text>
                <View style={rdStyles.notesCard}>
                  {parsedNotes.map((line, i) => (
                    <Text key={i} style={rdStyles.noteLine}>{line}</Text>
                  ))}
                </View>
              </View>
            )}

            <View style={rdStyles.chatSection}>
              <View style={rdStyles.chatHeader}>
                <MessageCircle color={joyTheme.primary} size={18} />
                <Text style={rdStyles.sectionLabel}>Chat with Support</Text>
              </View>
              <View style={rdStyles.chatBox}>
                {localMessages.length === 0 && !messagesQuery.isLoading && (
                  <View style={rdStyles.chatEmpty}>
                    <MessageCircle color="#D1D5DB" size={28} />
                    <Text style={rdStyles.chatEmptyText}>No messages yet</Text>
                    <Text style={rdStyles.chatEmptyHint}>Send a message to ask about your order status</Text>
                  </View>
                )}
                {messagesQuery.isLoading && localMessages.length === 0 && (
                  <View style={rdStyles.chatEmpty}>
                    <ActivityIndicator color={joyTheme.primary} size="small" />
                    <Text style={rdStyles.chatEmptyText}>Loading messages...</Text>
                  </View>
                )}
                {localMessages.map((msg) => {
                  const isUser = msg.sender_type === 'user';
                  return (
                    <View
                      key={msg.id}
                      style={[
                        rdStyles.chatBubble,
                        isUser ? rdStyles.chatBubbleUser : rdStyles.chatBubbleAdmin,
                      ]}
                    >
                      {!isUser && (
                        <View style={rdStyles.adminLabel}>
                          <View style={rdStyles.adminDot} />
                          <Text style={rdStyles.adminLabelText}>Support</Text>
                        </View>
                      )}
                      <Text style={[
                        rdStyles.chatBubbleText,
                        isUser ? rdStyles.chatBubbleTextUser : rdStyles.chatBubbleTextAdmin,
                      ]}>{msg.message}</Text>
                      <Text style={[
                        rdStyles.chatTime,
                        isUser ? rdStyles.chatTimeUser : rdStyles.chatTimeAdmin,
                      ]}>
                        {msg.created_at
                          ? new Date(msg.created_at).toLocaleString('en-US', {
                              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                            })
                          : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View style={rdStyles.chatInputBar}>
            <TextInput
              style={rdStyles.chatInput}
              placeholder="Type a message..."
              placeholderTextColor="#A0AEC0"
              value={chatMessage}
              onChangeText={setChatMessage}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              blurOnSubmit
            />
            <Pressable
              onPress={handleSend}
              disabled={!chatMessage.trim() || sendMutation.isPending}
              style={({ pressed }) => [
                rdStyles.sendBtn,
                (!chatMessage.trim() || sendMutation.isPending) && rdStyles.sendBtnDisabled,
                pressed && chatMessage.trim() && { opacity: 0.8 },
              ]}
            >
              {sendMutation.isPending ? (
                <ActivityIndicator color="#fff" size={16} />
              ) : (
                <Send color={chatMessage.trim() ? '#fff' : '#A0AEC0'} size={18} />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ShopItemCard({
  item,
  availablePoints,
  onPress,
  alreadyRedeemed,
}: {
  item: DbShopItem;
  availablePoints: number;
  onPress: (item: DbShopItem) => void;
  alreadyRedeemed: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pointsCost = item.points_cost ?? 0;
  const canAfford = availablePoints >= pointsCost;
  const outOfStock = item.inventory !== null && item.inventory <= 0;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  return (
    <Animated.View style={[styles.itemCard, { transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPress(item);
        }}
        style={styles.itemCardInner}
      >
        <View style={styles.itemImageWrap}>
          <Image
            source={{ uri: getItemImage(item) }}
            style={styles.itemImage}
            contentFit="cover"
          />
          {alreadyRedeemed && (
            <View style={styles.redeemedBadge}>
              <CheckCircle color="#fff" size={12} />
              <Text style={styles.redeemedBadgeText}>Redeemed</Text>
            </View>
          )}
          <View style={styles.pointsBadge}>
            <Award color="#fff" size={12} />
            <Text style={styles.pointsBadgeText}>{pointsCost.toLocaleString()}</Text>
          </View>
          {outOfStock && (
            <View style={styles.outOfStockBadge}>
              <Text style={styles.outOfStockText}>Out of Stock</Text>
            </View>
          )}
          {item.inventory !== null && item.inventory > 0 && item.inventory <= 5 && (
            <View style={styles.limitedBadge}>
              <Star color="#FFD700" size={10} />
              <Text style={styles.limitedBadgeText}>Only {item.inventory} left</Text>
            </View>
          )}
        </View>
        <View style={styles.itemInfo}>
          <View style={styles.itemCategoryRow}>
            {item.category ? (() => {
              const { Icon, color, bg } = getCategoryIcon(item.category);
              return (
                <View style={[styles.categoryPill, { backgroundColor: bg }]}>
                  <Icon color={color} size={11} />
                  <Text style={[styles.categoryPillText, { color }]}>{item.category}</Text>
                </View>
              );
            })() : null}
          </View>
          <Text style={styles.itemName} numberOfLines={2}>{item.title}</Text>
          {item.description ? (
            <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
          ) : null}
          <View style={styles.itemFooter}>
            <View style={[
              styles.redeemCardBtn,
              outOfStock && styles.redeemCardBtnDisabled,
              !canAfford && !outOfStock && !alreadyRedeemed && styles.redeemCardBtnCantAfford,
              alreadyRedeemed && !outOfStock && styles.redeemCardBtnRedeemed,
            ]}>
              <Text style={[
                styles.redeemCardBtnText,
                alreadyRedeemed && !outOfStock && styles.redeemCardBtnRedeemedText,
                (!canAfford || outOfStock) && !alreadyRedeemed && styles.redeemCardBtnTextDisabled,
              ]}>
                {outOfStock
                  ? 'Out of Stock'
                  : alreadyRedeemed
                    ? 'Redeem Again'
                    : canAfford
                      ? 'View & Redeem'
                      : `Need ${(pointsCost - availablePoints).toLocaleString()} more`}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function ShopScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? '';
  const [activeTab, setActiveTab] = useState<ShopTab>('shop');
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORY);
  const [selectedItem, setSelectedItem] = useState<DbShopItem | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [selectedRedemption, setSelectedRedemption] = useState<DbRedemption | null>(null);
  const [redemptionModalVisible, setRedemptionModalVisible] = useState<boolean>(false);

  const profileQuery = useQuery({
    queryKey: ['profile-points', userId],
    queryFn: () => fetchProfileById(userId),
    enabled: !!userId,
  });

  const liveProfile = profileQuery.data ?? profile;
  const availablePoints = (liveProfile?.total_points ?? 0) - (liveProfile?.redeemed_points ?? 0);

  const shopQuery = useQuery({
    queryKey: ['shop-items'],
    queryFn: fetchShopItems,
  });

  const redemptionsQuery = useQuery({
    queryKey: ['redemptions', userId],
    queryFn: () => fetchUserRedemptions(userId),
    enabled: !!userId,
  });

  const redeemMutation = useMutation({
    mutationFn: ({ itemId, cost, notes }: { itemId: string; cost: number; notes: string }) =>
      redeemShopItem(userId, itemId, cost, notes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['redemptions', userId] });
      void queryClient.invalidateQueries({ queryKey: ['shop-items'] });
      void queryClient.invalidateQueries({ queryKey: ['profile-points', userId] });
      void queryClient.invalidateQueries({ queryKey: ['user-rank', userId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setModalVisible(false);
      setTimeout(() => setSelectedItem(null), 300);
      Alert.alert('Redeemed!', 'Your reward has been claimed. We\'ll use your info to get it to you!');
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message || 'Failed to redeem item.');
    },
  });

  const shopItems = useMemo(() => {
    const items = shopQuery.data ?? [];
    return Array.isArray(items) ? items : [];
  }, [shopQuery.data]);
  const redemptions = useMemo(() => {
    const items = redemptionsQuery.data ?? [];
    return Array.isArray(items) ? items : [];
  }, [redemptionsQuery.data]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    shopItems.forEach((item) => {
      if (item.category) cats.add(item.category);
    });
    return [ALL_CATEGORY, ...Array.from(cats)];
  }, [shopItems]);

  const redeemedItemIds = useMemo(() => {
    const ids = new Set<string>();
    redemptions.forEach((r) => ids.add(r.shop_item_id));
    return ids;
  }, [redemptions]);

  const filteredItems = useMemo(() => {
    if (selectedCategory === ALL_CATEGORY) return shopItems;
    return shopItems.filter((item) => item.category === selectedCategory);
  }, [shopItems, selectedCategory]);

  const featuredItems = useMemo(() => {
    return shopItems.filter((item) => item.active && (item.inventory === null || item.inventory > 0)).slice(0, 3);
  }, [shopItems]);

  const handleOpenItem = useCallback((item: DbShopItem) => {
    console.log('[Shop] Opening item detail:', item.title);
    setSelectedItem(item);
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setTimeout(() => setSelectedItem(null), 300);
  }, []);

  const handleRedeem = useCallback((item: DbShopItem, formData: RedemptionFormData) => {
    console.log('[Shop] Redeem with form data for:', item.title, formData);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    const cost = item.points_cost ?? 0;
    if (availablePoints < cost) {
      Alert.alert('Not Enough Points', `You need ${cost - availablePoints} more points to redeem this reward.`);
      return;
    }

    const noteParts: string[] = [];
    if (formData.fullName) noteParts.push(`Name: ${formData.fullName}`);
    if (formData.email) noteParts.push(`Email: ${formData.email}`);
    if (formData.phone) noteParts.push(`Phone: ${formData.phone}`);
    if (formData.address || formData.city || formData.state || formData.zipCode) {
      const addrParts = [formData.address, formData.city, formData.state, formData.zipCode].filter(Boolean);
      noteParts.push(`Address: ${addrParts.join(', ')}`);
    }
    if (formData.size) noteParts.push(`Size: ${formData.size}`);
    if (formData.notes) noteParts.push(`Notes: ${formData.notes}`);

    const notes = noteParts.join('\n');

    redeemMutation.mutate({ itemId: item.id, cost, notes });
  }, [availablePoints, redeemMutation]);

  const handleOpenRedemption = useCallback((redemption: DbRedemption) => {
    console.log('[Shop] Opening redemption detail:', redemption.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedRedemption(redemption);
    setRedemptionModalVisible(true);
  }, []);

  const handleCloseRedemptionModal = useCallback(() => {
    setRedemptionModalVisible(false);
    setTimeout(() => setSelectedRedemption(null), 300);
  }, []);

  const shopRefetch = shopQuery.refetch;
  const redemptionsRefetch = redemptionsQuery.refetch;
  const profileRefetch = profileQuery.refetch;

  const handleRefresh = useCallback(() => {
    void shopRefetch();
    void redemptionsRefetch();
    void profileRefetch();
  }, [shopRefetch, redemptionsRefetch, profileRefetch]);

  return (
    <View style={styles.screen} testID="shop-screen">
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.back();
            }}
            style={styles.backButton}
            hitSlop={12}
          >
            <ArrowLeft color={joyTheme.text} size={22} />
          </Pressable>
          <Text style={styles.headerTitle}>Joy Shop</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={shopQuery.isRefetching || redemptionsQuery.isRefetching}
              onRefresh={handleRefresh}
              tintColor={joyTheme.primary}
            />
          }
        >
          <View style={styles.pointsBanner}>
            <LinearGradient
              colors={['#FF8C42', '#FF6B2C', '#E05518']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.pointsBannerContent}>
              <View style={styles.pointsBannerLeft}>
                <View style={styles.pointsIconWrap}>
                  <Award color="#fff" size={24} />
                </View>
                <View>
                  <Text style={styles.pointsBannerLabel}>Available Points</Text>
                  <Text style={styles.pointsBannerValue}>{availablePoints.toLocaleString()}</Text>
                </View>
              </View>
              <View style={styles.pointsBreakdown}>
                <Text style={styles.pointsBreakdownText}>
                  {profile?.total_points ?? 0} earned · {profile?.redeemed_points ?? 0} spent
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.tabBar}>
            <Pressable
              onPress={() => setActiveTab('shop')}
              style={[styles.tab, activeTab === 'shop' && styles.tabActive]}
            >
              <Tag color={activeTab === 'shop' ? joyTheme.primary : joyTheme.textMuted} size={16} />
              <Text style={[styles.tabText, activeTab === 'shop' && styles.tabTextActive]}>
                All Rewards ({shopItems.length})
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('redeemed')}
              style={[styles.tab, activeTab === 'redeemed' && styles.tabActive]}
            >
              <CheckCircle color={activeTab === 'redeemed' ? joyTheme.primary : joyTheme.textMuted} size={16} />
              <Text style={[styles.tabText, activeTab === 'redeemed' && styles.tabTextActive]}>
                Redeemed ({redemptions.length})
              </Text>
            </Pressable>
          </View>

          {activeTab === 'shop' && (
            <>
              {shopQuery.isLoading && (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color={joyTheme.primary} size="large" />
                  <Text style={styles.loadingText}>Loading rewards...</Text>
                </View>
              )}

              {!shopQuery.isLoading && shopItems.length === 0 && (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconWrap}>
                    <ShoppingBag color={joyTheme.textMuted} size={40} />
                  </View>
                  <Text style={styles.emptyTitle}>Shop coming soon</Text>
                  <Text style={styles.emptyText}>
                    Keep earning points! Exciting rewards will be available here soon.
                  </Text>
                </View>
              )}

              {!shopQuery.isLoading && shopItems.length > 0 && (
                <>
                  {featuredItems.length > 0 && (
                    <View style={styles.featuredSection}>
                      <View style={styles.sectionHeader}>
                        <Sparkles color="#FF8C42" size={18} />
                        <Text style={styles.sectionTitle}>Featured Rewards</Text>
                      </View>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.featuredScroll}
                      >
                        {featuredItems.map((item) => (
                          <Pressable
                            key={item.id}
                            style={styles.featuredCard}
                            onPress={() => handleOpenItem(item)}
                          >
                            <Image
                              source={{ uri: getItemImage(item) }}
                              style={styles.featuredImage}
                              contentFit="cover"
                            />
                            <LinearGradient
                              colors={['transparent', 'rgba(0,0,0,0.7)']}
                              style={styles.featuredGradient}
                            />
                            <View style={styles.featuredInfo}>
                              <Text style={styles.featuredName} numberOfLines={1}>{item.title}</Text>
                              <View style={styles.featuredPointsRow}>
                                <Award color="#FFD700" size={14} />
                                <Text style={styles.featuredPointsText}>{(item.points_cost ?? 0).toLocaleString()} pts</Text>
                              </View>
                            </View>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {categories.length > 2 && (
                    <View style={styles.categoryFilterSection}>
                      <View style={styles.sectionHeader}>
                        <Filter color={joyTheme.textMuted} size={16} />
                        <Text style={styles.sectionTitleSmall}>Filter by Category</Text>
                      </View>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoryScroll}
                      >
                        {categories.map((cat) => {
                          const isActive = selectedCategory === cat;
                          const catInfo = cat === ALL_CATEGORY
                            ? { Icon: Tag, color: joyTheme.primary, bg: joyTheme.primarySoft }
                            : getCategoryIcon(cat);
                          return (
                            <Pressable
                              key={cat}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                setSelectedCategory(cat);
                              }}
                              style={[
                                styles.categoryChip,
                                isActive && { backgroundColor: catInfo.color },
                              ]}
                            >
                              <catInfo.Icon
                                color={isActive ? '#fff' : catInfo.color}
                                size={14}
                              />
                              <Text style={[
                                styles.categoryChipText,
                                { color: isActive ? '#fff' : catInfo.color },
                              ]}>
                                {cat}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  <View style={styles.sectionHeader}>
                    <ShoppingBag color={joyTheme.text} size={18} />
                    <Text style={styles.sectionTitle}>
                      {selectedCategory === ALL_CATEGORY ? 'All Rewards' : selectedCategory}
                    </Text>
                    <Text style={styles.itemCount}>{filteredItems.length} items</Text>
                  </View>

                  {filteredItems.length === 0 && (
                    <View style={styles.emptyFilterState}>
                      <Text style={styles.emptyFilterText}>No items in this category</Text>
                    </View>
                  )}

                  <View style={styles.itemGrid}>
                    {filteredItems.map((item) => (
                      <ShopItemCard
                        key={item.id}
                        item={item}
                        availablePoints={availablePoints}
                        onPress={handleOpenItem}
                        alreadyRedeemed={redeemedItemIds.has(item.id)}
                      />
                    ))}
                  </View>
                </>
              )}
            </>
          )}

          {activeTab === 'redeemed' && (
            <>
              {redemptionsQuery.isLoading && (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color={joyTheme.primary} size="large" />
                  <Text style={styles.loadingText}>Loading redemptions...</Text>
                </View>
              )}

              {!redemptionsQuery.isLoading && redemptions.length === 0 && (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconWrap}>
                    <Gift color={joyTheme.textMuted} size={40} />
                  </View>
                  <Text style={styles.emptyTitle}>No redemptions yet</Text>
                  <Text style={styles.emptyText}>
                    Redeem your joy points for amazing rewards!
                  </Text>
                </View>
              )}

              <View style={styles.itemGrid}>
                {redemptions.map((redemption: DbRedemption) => {
                  const rawItem = redemption.shop_items;
                  const item: DbShopItem | null = rawItem && typeof rawItem === 'object' && !Array.isArray(rawItem) ? rawItem as DbShopItem : null;
                  const status = (redemption.status ?? 'pending') || 'pending';
                  const statusLabel =
                    status === 'fulfilled' ? 'Fulfilled' :
                    status === 'pending' ? 'Pending' :
                    status === 'shipped' ? 'Shipped' :
                    status.charAt(0).toUpperCase() + status.slice(1);
                  const statusStyle =
                    status === 'fulfilled' ? styles.statusFulfilled :
                    status === 'pending' ? styles.statusPending :
                    status === 'shipped' ? styles.statusShipped : styles.statusDefault;
                  const statusTextStyle =
                    status === 'fulfilled' ? styles.statusFulfilledText :
                    status === 'pending' ? styles.statusPendingText :
                    status === 'shipped' ? styles.statusShippedText : styles.statusDefaultText;

                  const imgUri = item ? getItemImage(item) : 'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&w=400&q=80';

                  return (
                    <Pressable
                      key={redemption.id}
                      style={styles.redeemedCard}
                      onPress={() => handleOpenRedemption(redemption)}
                    >
                      <Image
                        source={{ uri: imgUri }}
                        style={styles.redeemedImage}
                        contentFit="cover"
                      />
                      <View style={styles.redeemedOverlay}>
                        <View style={[styles.statusPill, statusStyle]}>
                          <Text style={[styles.statusPillText, statusTextStyle]}>{statusLabel}</Text>
                        </View>
                      </View>
                      <View style={styles.redeemedInfo}>
                        {item?.category ? (() => {
                          const { Icon, color, bg } = getCategoryIcon(item.category);
                          return (
                            <View style={[styles.categoryPill, { backgroundColor: bg }]}>
                              <Icon color={color} size={11} />
                              <Text style={[styles.categoryPillText, { color }]}>{item.category}</Text>
                            </View>
                          );
                        })() : null}
                        <Text style={styles.redeemedName} numberOfLines={2}>
                          {item?.title ?? 'Reward'}
                        </Text>
                        {item?.description && (
                          <Text style={styles.redeemedDesc} numberOfLines={2}>{item.description}</Text>
                        )}
                        <View style={styles.redeemedFooter}>
                          <View style={styles.itemPointsRow}>
                            <Award color="#FF8C42" size={14} />
                            <Text style={styles.itemPointsText}>{(redemption.points_spent ?? 0).toLocaleString()} pts</Text>
                          </View>
                          <Text style={styles.redeemedDate}>
                            {redemption.redeemed_at ? new Date(redemption.redeemed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <RedemptionDetailModal
        redemption={selectedRedemption}
        visible={redemptionModalVisible}
        onClose={handleCloseRedemptionModal}
        userId={userId}
      />

      <ItemDetailModal
        item={selectedItem}
        visible={modalVisible}
        onClose={handleCloseModal}
        availablePoints={availablePoints}
        onRedeem={handleRedeem}
        isRedeeming={redeemMutation.isPending}
        alreadyRedeemed={selectedItem ? redeemedItemIds.has(selectedItem.id) : false}
        profileName={liveProfile?.full_name ?? ''}
        profileEmail={liveProfile?.email ?? ''}
      />
    </View>
  );
}

const formStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F5',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: '#10233D',
  },
  headerSub: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: '#5F7795',
    marginTop: 2,
  },
  costSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#FFF9F5',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE8D4',
  },
  costText: {
    fontSize: 15,
    fontFamily: fonts.extraBold,
    color: '#FF8C42',
  },
  costDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  balanceText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: '#5F7795',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 20,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: '#5F7795',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8EDF2',
  },
  inputIcon: {
    paddingLeft: 14,
    paddingRight: 2,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: '#10233D',
  },
  inputSmall: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: '#10233D',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  sizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sizeChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F5F5F7',
    borderWidth: 1.5,
    borderColor: '#E8EDF2',
  },
  sizeChipActive: {
    backgroundColor: '#0A84FF',
    borderColor: '#0A84FF',
  },
  sizeChipText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: '#5F7795',
  },
  sizeChipTextActive: {
    color: '#FFFFFF',
  },
  textArea: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8EDF2',
    padding: 14,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: '#10233D',
    minHeight: 80,
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F5',
  },
  submitBtn: {
    backgroundColor: '#0A84FF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#E8EDF2',
  },
  submitBtnText: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: '#FFFFFF',
  },
  submitBtnTextDisabled: {
    color: '#5F7795',
  },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    minHeight: 400,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 16,
  },
  imageWrap: {
    width: '100%',
    height: 240,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  stockOverlay: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  stockOverlayText: {
    fontSize: 12,
    fontFamily: fonts.extraBold,
    color: '#FFFFFF',
  },
  limitedBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,215,0,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  limitedText: {
    fontSize: 12,
    fontFamily: fonts.extraBold,
    color: '#4A3500',
  },
  body: {
    padding: 20,
    gap: 14,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  name: {
    fontSize: 24,
    fontFamily: fonts.extraBold,
    color: '#10233D',
    letterSpacing: -0.4,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  pointsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF5EC',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFD4B0',
  },
  pointsValue: {
    fontSize: 18,
    fontFamily: fonts.black,
    color: '#FF8C42',
  },
  pointsLabel: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: '#FF8C42',
    opacity: 0.8,
  },
  redeemedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FFF5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  redeemedChipText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: '#2BB673',
  },
  descriptionSection: {
    gap: 6,
    marginTop: 4,
  },
  descriptionTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: '#5F7795',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: '#10233D',
    lineHeight: 23,
  },
  detailsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E8EDF2',
    marginTop: 4,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  detailDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E8EDF2',
  },
  detailLabel: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: '#5F7795',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  detailValue: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: '#10233D',
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  stockText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: '#5F7795',
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F5',
  },
  redeemBtn: {
    backgroundColor: '#0A84FF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redeemBtnDisabled: {
    backgroundColor: '#E8EDF2',
  },
  redeemBtnCantAfford: {
    backgroundColor: '#FFF5EC',
    borderWidth: 1,
    borderColor: '#FFD4B0',
  },
  redeemBtnText: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: '#FFFFFF',
  },
  redeemBtnTextDisabled: {
    color: '#5F7795',
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: joyTheme.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: joyTheme.border,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
    letterSpacing: -0.3,
  },
  content: {
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
  },
  pointsBanner: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: 22,
    marginHorizontal: 16,
  },
  pointsBannerContent: {
    gap: 14,
  },
  pointsBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  pointsIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsBannerLabel: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: 'rgba(255,255,255,0.8)',
  },
  pointsBannerValue: {
    fontSize: 32,
    fontFamily: fonts.black,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  pointsBreakdown: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  pointsBreakdownText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: 'rgba(255,255,255,0.9)',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: joyTheme.border,
    marginHorizontal: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: joyTheme.primarySoft,
  },
  tabText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
  },
  tabTextActive: {
    color: joyTheme.primaryDark,
  },
  loadingWrap: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 30,
    gap: 12,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: joyTheme.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: joyTheme.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  featuredSection: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
    flex: 1,
  },
  sectionTitleSmall: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
  },
  itemCount: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  featuredScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  featuredCard: {
    width: 220,
    height: 140,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  featuredGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  featuredInfo: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
  },
  featuredName: {
    fontSize: 15,
    fontFamily: fonts.extraBold,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  featuredPointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featuredPointsText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: '#FFD700',
  },
  categoryFilterSection: {
    gap: 10,
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F5F5F7',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  categoryChipText: {
    fontSize: 13,
    fontFamily: fonts.bold,
  },
  emptyFilterState: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyFilterText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  itemGrid: {
    gap: 14,
    paddingHorizontal: 16,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: joyTheme.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  itemCardInner: {
    overflow: 'hidden',
    borderRadius: 22,
  },
  itemImageWrap: {
    position: 'relative',
  },
  itemImage: {
    width: '100%',
    height: 170,
  },
  pointsBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pointsBadgeText: {
    fontSize: 12,
    fontFamily: fonts.extraBold,
    color: '#FFFFFF',
  },
  outOfStockBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  outOfStockText: {
    fontSize: 11,
    fontFamily: fonts.extraBold,
    color: '#FFFFFF',
  },
  limitedBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,215,0,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  limitedBadgeText: {
    fontSize: 10,
    fontFamily: fonts.extraBold,
    color: '#4A3500',
  },
  redeemedBadge: {
    position: 'absolute' as const,
    bottom: 12,
    left: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: '#2BB673',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  redeemedBadgeText: {
    fontSize: 11,
    fontFamily: fonts.extraBold,
    color: '#FFFFFF',
  },
  itemInfo: {
    padding: 16,
    gap: 8,
  },
  itemCategoryRow: {
    flexDirection: 'row',
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  categoryPillText: {
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  itemName: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
    letterSpacing: -0.2,
  },
  itemDesc: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: joyTheme.textMuted,
    lineHeight: 20,
  },
  itemFooter: {
    marginTop: 4,
  },
  itemPointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  itemPointsText: {
    fontSize: 15,
    fontFamily: fonts.extraBold,
    color: '#FF8C42',
  },
  redeemCardBtn: {
    backgroundColor: joyTheme.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  redeemCardBtnRedeemed: {
    backgroundColor: '#F0FFF5',
    borderWidth: 1,
    borderColor: '#2BB673',
  },
  redeemCardBtnCantAfford: {
    backgroundColor: '#FFF5EC',
    borderWidth: 1,
    borderColor: '#FFD4B0',
  },
  redeemCardBtnDisabled: {
    backgroundColor: joyTheme.backgroundAlt,
  },
  redeemCardBtnText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  redeemCardBtnRedeemedText: {
    color: '#2BB673',
  },
  redeemCardBtnTextDisabled: {
    color: joyTheme.textMuted,
  },
  redeemedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: joyTheme.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  redeemedImage: {
    width: '100%',
    height: 130,
  },
  redeemedOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  redeemedInfo: {
    padding: 16,
    gap: 8,
  },
  redeemedName: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
    letterSpacing: -0.2,
  },
  redeemedDesc: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: joyTheme.textMuted,
    lineHeight: 20,
  },
  redeemedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  redeemedDate: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusPending: {
    backgroundColor: '#FFF8E6',
  },
  statusFulfilled: {
    backgroundColor: '#F0FFF5',
  },
  statusShipped: {
    backgroundColor: '#EEF4FF',
  },
  statusDefault: {
    backgroundColor: joyTheme.backgroundAlt,
  },
  statusPillText: {
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  statusPendingText: {
    color: '#FFB020',
  },
  statusFulfilledText: {
    color: '#2BB673',
  },
  statusShippedText: {
    color: '#0A84FF',
  },
  statusDefaultText: {
    color: joyTheme.textMuted,
  },
  bottomSpacer: {
    height: 20,
  },
});

const rdStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    minHeight: 400,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 16,
  },
  itemHeader: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 28,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F5',
  },
  itemThumb: {
    width: 80,
    height: 80,
    borderRadius: 16,
  },
  itemHeaderInfo: {
    flex: 1,
    gap: 6,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  catText: {
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  itemName: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: '#10233D',
    letterSpacing: -0.3,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pointsText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: '#FF8C42',
  },
  dateText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: '#A0AEC0',
    marginLeft: 4,
  },
  statusSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 14,
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: '#5F7795',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  timeline: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 56,
  },
  timelineLeft: {
    width: 36,
    alignItems: 'center',
  },
  timelineDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 26,
    backgroundColor: '#E8EDF2',
    marginTop: -2,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 12,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 4,
  },
  timelineLabel: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: '#10233D',
  },
  timelineSub: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    marginTop: 2,
  },
  notesSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 10,
  },
  notesCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E8EDF2',
  },
  noteLine: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: '#10233D',
    lineHeight: 20,
  },
  chatSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    minHeight: 120,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E8EDF2',
  },
  chatEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  chatEmptyText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: '#A0AEC0',
  },
  chatEmptyHint: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: '#C4CDD5',
    textAlign: 'center',
  },
  chatBubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    gap: 4,
  },
  chatBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#0A84FF',
    borderBottomRightRadius: 4,
  },
  chatBubbleAdmin: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E8EDF2',
  },
  adminLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  adminDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2BB673',
  },
  adminLabelText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: '#2BB673',
  },
  chatBubbleText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    lineHeight: 20,
  },
  chatBubbleTextUser: {
    color: '#FFFFFF',
  },
  chatBubbleTextAdmin: {
    color: '#10233D',
  },
  chatTime: {
    fontSize: 10,
    fontFamily: fonts.medium,
  },
  chatTimeUser: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right' as const,
  },
  chatTimeAdmin: {
    color: '#A0AEC0',
  },
  chatInputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F5',
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#F5F5F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: '#10233D',
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#E8EDF2',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0A84FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#E8EDF2',
  },
});
