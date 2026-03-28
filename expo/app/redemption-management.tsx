import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  MessageCircle,
  Package,
  ShoppingBag,
  X,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import { useAuth } from '@/providers/AuthProvider';
import {
  fetchOrgRedemptions,
  updateRedemptionStatus,
  fetchRedemptionMessages,
  sendRedemptionMessage,
} from '@/lib/api';
import type { DbRedemption, DbRedemptionMessage } from '@/types/database';

type FilterType = 'all' | 'pending' | 'approved' | 'fulfilled' | 'rejected';

interface RedemptionWithProfile extends DbRedemption {
  profiles?: {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'pending': return '#FFB020';
    case 'approved': return '#0A84FF';
    case 'fulfilled': return '#2BB673';
    case 'rejected': return '#FF3B30';
    default: return joyTheme.textMuted;
  }
}

function getStatusBg(status: string): string {
  switch (status) {
    case 'pending': return '#FFF3E0';
    case 'approved': return '#EEF4FF';
    case 'fulfilled': return '#E8F8EE';
    case 'rejected': return '#FFF0F0';
    default: return joyTheme.backgroundAlt;
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function RedemptionManagementScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { organization, adminUser } = useAuth();
  const orgId = organization?.id ?? adminUser?.organization_id ?? '';

  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedRedemption, setSelectedRedemption] = useState<RedemptionWithProfile | null>(null);
  const [messageText, setMessageText] = useState<string>('');
  const [showMessages, setShowMessages] = useState<boolean>(false);

  const redemptionsQuery = useQuery({
    queryKey: ['org-redemptions', orgId],
    queryFn: () => fetchOrgRedemptions(orgId),
    enabled: !!orgId,
  });

  const messagesQuery = useQuery({
    queryKey: ['redemption-messages', selectedRedemption?.id],
    queryFn: () => fetchRedemptionMessages(selectedRedemption?.id ?? ''),
    enabled: !!selectedRedemption?.id && showMessages,
  });

  const redemptions = useMemo(() => (redemptionsQuery.data ?? []) as RedemptionWithProfile[], [redemptionsQuery.data]);

  const filteredRedemptions = useMemo(() => {
    if (filter === 'all') return redemptions;
    return redemptions.filter((r) => r.status === filter);
  }, [redemptions, filter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0, pending: 0, approved: 0, fulfilled: 0, rejected: 0 };
    redemptions.forEach((r) => {
      counts.all++;
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    });
    return counts;
  }, [redemptions]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateRedemptionStatus(id, status),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void queryClient.invalidateQueries({ queryKey: ['org-redemptions', orgId] });
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const sendMessageMutation = useMutation({
    mutationFn: () => {
      if (!selectedRedemption || !adminUser) return Promise.resolve(null);
      return sendRedemptionMessage(
        selectedRedemption.id,
        adminUser.id,
        messageText.trim(),
        'admin'
      );
    },
    onSuccess: () => {
      setMessageText('');
      void queryClient.invalidateQueries({ queryKey: ['redemption-messages', selectedRedemption?.id] });
    },
    onError: (err: Error) => Alert.alert('Error', err.message ?? 'Failed to send message'),
  });

  const handleStatusUpdate = useCallback((redemption: RedemptionWithProfile, newStatus: string) => {
    const statusLabel = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
    Alert.alert(
      `${statusLabel} Redemption`,
      `Mark this redemption as ${newStatus}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: statusLabel,
          onPress: () => updateStatusMutation.mutate({ id: redemption.id, status: newStatus }),
        },
      ]
    );
  }, [updateStatusMutation]);

  const handleOpenMessages = useCallback((redemption: RedemptionWithProfile) => {
    setSelectedRedemption(redemption);
    setShowMessages(true);
  }, []);

  if (redemptionsQuery.isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color="#0E3C73" />
        <Text style={styles.loadingText}>Loading redemptions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen} testID="redemption-management-screen">
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.back();
            }}
            style={styles.headerBtn}
            hitSlop={12}
          >
            <ArrowLeft color={joyTheme.text} size={22} />
          </Pressable>
          <Text style={styles.headerTitle}>Redemptions</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {(['all', 'pending', 'approved', 'fulfilled', 'rejected'] as FilterType[]).map((f) => (
            <Pressable
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
              {statusCounts[f] > 0 && (
                <View style={[styles.filterCount, filter === f && styles.filterCountActive]}>
                  <Text style={[styles.filterCountText, filter === f && styles.filterCountTextActive]}>
                    {statusCounts[f]}
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {filteredRedemptions.length === 0 && (
            <View style={styles.emptyState}>
              <ShoppingBag color={joyTheme.textMuted} size={40} />
              <Text style={styles.emptyText}>No redemptions found</Text>
            </View>
          )}

          {filteredRedemptions.map((redemption) => {
            const profileData = redemption.profiles;
            const shopItem = redemption.shop_items;
            const initials = (profileData?.full_name ?? 'U')
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

            return (
              <View key={redemption.id} style={styles.redemptionCard}>
                <View style={styles.redemptionTop}>
                  {resolveImageUrl(profileData?.avatar_url) ? (
                    <Image source={{ uri: resolveImageUrl(profileData?.avatar_url)! }} style={styles.avatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                  )}
                  <View style={styles.redemptionInfo}>
                    <Text style={styles.redemptionName} numberOfLines={1}>
                      {profileData?.full_name ?? 'User'}
                    </Text>
                    <Text style={styles.redemptionItem} numberOfLines={1}>
                      {shopItem?.name ?? 'Shop Item'}
                    </Text>
                    <Text style={styles.redemptionMeta}>
                      {redemption.points_spent} pts · {formatDate(redemption.created_at)}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: getStatusBg(redemption.status) }]}>
                    <Text style={[styles.statusPillText, { color: getStatusColor(redemption.status) }]}>
                      {redemption.status}
                    </Text>
                  </View>
                </View>

                {redemption.notes && (
                  <View style={styles.notesBanner}>
                    <Text style={styles.notesText}>Note: {redemption.notes}</Text>
                  </View>
                )}

                <View style={styles.redemptionActions}>
                  {redemption.status === 'pending' && (
                    <>
                      <Pressable
                        style={styles.approveBtn}
                        onPress={() => handleStatusUpdate(redemption, 'approved')}
                      >
                        <Check color="#fff" size={14} />
                        <Text style={styles.approveBtnText}>Approve</Text>
                      </Pressable>
                      <Pressable
                        style={styles.rejectBtn}
                        onPress={() => handleStatusUpdate(redemption, 'rejected')}
                      >
                        <X color="#FF3B30" size={14} />
                        <Text style={styles.rejectBtnText}>Reject</Text>
                      </Pressable>
                    </>
                  )}
                  {redemption.status === 'approved' && (
                    <Pressable
                      style={styles.fulfillBtn}
                      onPress={() => handleStatusUpdate(redemption, 'fulfilled')}
                    >
                      <Package color="#fff" size={14} />
                      <Text style={styles.fulfillBtnText}>Mark Fulfilled</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={styles.messageBtn}
                    onPress={() => handleOpenMessages(redemption)}
                  >
                    <MessageCircle color={joyTheme.primary} size={14} />
                    <Text style={styles.messageBtnText}>Message</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <Modal visible={showMessages} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.messagesOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.messagesSheet}>
            <View style={styles.messagesHeader}>
              <Text style={styles.messagesTitle}>Messages</Text>
              <Pressable onPress={() => { setShowMessages(false); setSelectedRedemption(null); }} hitSlop={12}>
                <X color={joyTheme.textMuted} size={22} />
              </Pressable>
            </View>

            <ScrollView style={styles.messagesList}>
              {messagesQuery.isLoading && (
                <ActivityIndicator color={joyTheme.primary} style={{ marginTop: 20 }} />
              )}
              {(messagesQuery.data ?? []).map((msg: DbRedemptionMessage) => (
                <View
                  key={msg.id}
                  style={[
                    styles.messageBubble,
                    msg.sender_type === 'admin' ? styles.messageBubbleAdmin : styles.messageBubbleUser,
                  ]}
                >
                  <Text style={[
                    styles.messageBubbleText,
                    msg.sender_type === 'admin' ? styles.messageBubbleTextAdmin : styles.messageBubbleTextUser,
                  ]}>
                    {msg.message}
                  </Text>
                  <Text style={styles.messageTime}>{formatDate(msg.created_at)}</Text>
                </View>
              ))}
              {!messagesQuery.isLoading && (messagesQuery.data ?? []).length === 0 && (
                <Text style={styles.noMessagesText}>No messages yet</Text>
              )}
            </ScrollView>

            <View style={styles.messageInputRow}>
              <TextInput
                style={styles.messageInput}
                placeholder="Type a message..."
                placeholderTextColor={joyTheme.textMuted}
                value={messageText}
                onChangeText={setMessageText}
                multiline
              />
              <Pressable
                style={[styles.sendBtn, !messageText.trim() && { opacity: 0.4 }]}
                onPress={() => sendMessageMutation.mutate()}
                disabled={!messageText.trim() || sendMessageMutation.isPending}
              >
                {sendMessageMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.sendBtnText}>Send</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: joyTheme.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 15, fontFamily: fonts.semiBold, color: joyTheme.textMuted },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
    borderBottomColor: joyTheme.border, backgroundColor: '#fff',
  },
  headerBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: fonts.extraBold, color: joyTheme.text, letterSpacing: -0.3 },
  filterScroll: {
    paddingHorizontal: 16, paddingVertical: 12, gap: 8,
  },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: '#fff', borderWidth: 1, borderColor: joyTheme.border, marginRight: 8,
  },
  filterChipActive: { backgroundColor: '#0E3C73', borderColor: '#0E3C73' },
  filterChipText: { fontSize: 13, fontFamily: fonts.bold, color: joyTheme.text },
  filterChipTextActive: { color: '#fff' },
  filterCount: {
    backgroundColor: joyTheme.backgroundAlt, borderRadius: 8, minWidth: 20, height: 20,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  filterCountActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  filterCountText: { fontSize: 11, fontFamily: fonts.extraBold, color: joyTheme.text },
  filterCountTextActive: { color: '#fff' },
  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40, gap: 10 },
  emptyState: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  emptyText: { fontSize: 15, fontFamily: fonts.semiBold, color: joyTheme.textMuted },
  redemptionCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 14, gap: 12,
    borderWidth: 1, borderColor: joyTheme.border,
  },
  redemptionTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 14 },
  avatarPlaceholder: { backgroundColor: joyTheme.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontFamily: fonts.extraBold, color: joyTheme.primaryDark },
  redemptionInfo: { flex: 1, gap: 2 },
  redemptionName: { fontSize: 14, fontFamily: fonts.bold, color: joyTheme.text },
  redemptionItem: { fontSize: 13, fontFamily: fonts.semiBold, color: joyTheme.primaryDark },
  redemptionMeta: { fontSize: 11, fontFamily: fonts.medium, color: joyTheme.textMuted },
  statusPill: {
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  statusPillText: { fontSize: 11, fontFamily: fonts.bold, textTransform: 'capitalize' as const },
  notesBanner: {
    backgroundColor: '#FFF8E1', borderRadius: 10, padding: 10,
  },
  notesText: { fontSize: 12, fontFamily: fonts.medium, color: '#7A6200' },
  redemptionActions: { flexDirection: 'row', gap: 8 },
  approveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, backgroundColor: '#2BB673', borderRadius: 12, paddingVertical: 10,
  },
  approveBtnText: { fontSize: 13, fontFamily: fonts.bold, color: '#fff' },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, backgroundColor: '#FFF0F0', borderRadius: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: '#FFD4D4',
  },
  rejectBtnText: { fontSize: 13, fontFamily: fonts.bold, color: '#FF3B30' },
  fulfillBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, backgroundColor: '#0A84FF', borderRadius: 12, paddingVertical: 10,
  },
  fulfillBtnText: { fontSize: 13, fontFamily: fonts.bold, color: '#fff' },
  messageBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, backgroundColor: joyTheme.primarySoft, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  messageBtnText: { fontSize: 13, fontFamily: fonts.bold, color: joyTheme.primaryDark },
  messagesOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  messagesSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '75%', paddingBottom: 24,
  },
  messagesHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: joyTheme.border,
  },
  messagesTitle: { fontSize: 18, fontFamily: fonts.extraBold, color: joyTheme.text },
  messagesList: { maxHeight: 300, paddingHorizontal: 20, paddingTop: 12 },
  messageBubble: {
    maxWidth: '80%', borderRadius: 16, padding: 12, marginBottom: 8,
  },
  messageBubbleAdmin: { backgroundColor: '#0E3C73', alignSelf: 'flex-end' },
  messageBubbleUser: { backgroundColor: joyTheme.backgroundAlt, alignSelf: 'flex-start' },
  messageBubbleText: { fontSize: 14, lineHeight: 20 },
  messageBubbleTextAdmin: { color: '#fff' },
  messageBubbleTextUser: { color: joyTheme.text },
  messageTime: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  noMessagesText: {
    fontSize: 14, fontFamily: fonts.medium, color: joyTheme.textMuted,
    textAlign: 'center', paddingVertical: 20,
  },
  messageInputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 20, paddingTop: 12,
  },
  messageInput: {
    flex: 1, backgroundColor: joyTheme.background, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: joyTheme.text,
    maxHeight: 100, borderWidth: 1, borderColor: joyTheme.border,
  },
  sendBtn: {
    backgroundColor: '#0E3C73', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12,
  },
  sendBtnText: { fontSize: 14, fontFamily: fonts.bold, color: '#fff' },
  bottomSpacer: { height: 24 },
});
