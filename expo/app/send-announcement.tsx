import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Megaphone,
  ChevronLeft,
  Check,
  Calendar,
  Users,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
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
  fetchOrgEventsList,
  fetchEventSignupCounts,
  sendAnnouncement,
  fetchAnnouncementHistory,
} from '@/lib/api';
import type { DbEvent, DbNotification } from '@/types/database';

type AnnouncementTarget = 'upcoming' | 'past' | 'custom';

export default function SendAnnouncementScreen() {
  const router = useRouter();
  const { organization } = useAuth();
  const orgId = organization?.id ?? '';
  const orgName = organization?.name ?? 'Organization';

  const [target, setTarget] = useState<AnnouncementTarget>('upcoming');
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [showHistory, setShowHistory] = useState<boolean>(false);

  const successScale = useRef(new Animated.Value(0)).current;

  const eventsQuery = useQuery({
    queryKey: ['org-events-list', orgId],
    queryFn: () => fetchOrgEventsList(orgId),
    enabled: !!orgId,
  });

  const signupCountsQuery = useQuery({
    queryKey: ['event-signup-counts'],
    queryFn: fetchEventSignupCounts,
  });

  const historyQuery = useQuery({
    queryKey: ['announcement-history', orgId],
    queryFn: () => fetchAnnouncementHistory(orgId),
    enabled: !!orgId && showHistory,
  });

  const now = new Date().toISOString();
  const upcomingEvents = useMemo(
    () => (eventsQuery.data ?? []).filter((e) => e.start_time >= now),
    [eventsQuery.data, now]
  );
  const pastEvents = useMemo(
    () => (eventsQuery.data ?? []).filter((e) => e.start_time < now),
    [eventsQuery.data, now]
  );

  const targetEvents = useMemo(() => {
    if (target === 'upcoming') return upcomingEvents;
    if (target === 'past') return pastEvents;
    return (eventsQuery.data ?? []).filter((e) => selectedEventIds.has(e.id));
  }, [target, upcomingEvents, pastEvents, eventsQuery.data, selectedEventIds]);

  const recipientCount = useMemo(() => {
    const counts = signupCountsQuery.data ?? {};
    const eventIds = target === 'custom'
      ? [...selectedEventIds]
      : targetEvents.map((e) => e.id);
    return eventIds.reduce((sum, id) => sum + (counts[id] ?? 0), 0);
  }, [target, targetEvents, selectedEventIds, signupCountsQuery.data]);

  const eventIdsToSend = useMemo(() => {
    if (target === 'custom') return [...selectedEventIds];
    return targetEvents.map((e) => e.id);
  }, [target, targetEvents, selectedEventIds]);

  const sendMutation = useMutation({
    mutationFn: () => sendAnnouncement(orgId, orgName, eventIdsToSend, title.trim(), message.trim()),
    onSuccess: (result) => {
      console.log('[Announcement] Sent:', result);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Animated.spring(successScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();

      setTimeout(() => {
        Alert.alert(
          'Announcement Sent',
          `Successfully sent to ${result.sent} volunteer${result.sent !== 1 ? 's' : ''}.${result.failed > 0 ? ` ${result.failed} failed.` : ''}`,
          [{ text: 'Done', onPress: () => router.back() }]
        );
      }, 600);
    },
    onError: (error: Error) => {
      console.error('[Announcement] Error:', error);
      Alert.alert('Error', error.message || 'Failed to send announcement.');
    },
  });

  const canSend = title.trim().length > 0 && message.trim().length > 0 && eventIdsToSend.length > 0;

  const handleSend = useCallback(() => {
    if (!canSend) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert(
      'Send Announcement',
      `This will notify ~${recipientCount} volunteer${recipientCount !== 1 ? 's' : ''} signed up for ${eventIdsToSend.length} event${eventIdsToSend.length !== 1 ? 's' : ''}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', style: 'default', onPress: () => sendMutation.mutate() },
      ]
    );
  }, [canSend, recipientCount, eventIdsToSend.length, sendMutation]);

  const toggleEvent = useCallback((eventId: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }, []);

  const formatDate = useCallback((dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, []);

  const renderEventItem = useCallback(({ item }: { item: DbEvent }) => {
    const isSelected = selectedEventIds.has(item.id);
    const count = signupCountsQuery.data?.[item.id] ?? 0;
    const imageUrl = resolveImageUrl(item.image_url);

    return (
      <Pressable
        style={[styles.eventItem, isSelected && styles.eventItemSelected]}
        onPress={() => toggleEvent(item.id)}
        testID={`event-select-${item.id}`}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.eventThumb} contentFit="cover" />
        ) : (
          <View style={[styles.eventThumb, styles.eventThumbPlaceholder]}>
            <Calendar color={joyTheme.primaryDark} size={16} />
          </View>
        )}
        <View style={styles.eventItemInfo}>
          <Text style={styles.eventItemTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.eventItemDate}>{formatDate(item.start_time)}</Text>
        </View>
        <View style={styles.eventItemRight}>
          <View style={styles.volunteerBadge}>
            <Users color={joyTheme.textMuted} size={12} />
            <Text style={styles.volunteerBadgeText}>{count}</Text>
          </View>
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && <Check color="#FFF" size={14} strokeWidth={3} />}
          </View>
        </View>
      </Pressable>
    );
  }, [selectedEventIds, signupCountsQuery.data, toggleEvent, formatDate]);

  const renderHistoryItem = useCallback(({ item }: { item: DbNotification }) => {
    const timeAgo = getTimeAgo(item.created_at);
    return (
      <View style={styles.historyItem}>
        <View style={styles.historyIcon}>
          <Megaphone color={joyTheme.primary} size={16} />
        </View>
        <View style={styles.historyInfo}>
          <Text style={styles.historyTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.historyMessage} numberOfLines={2}>{item.message}</Text>
          <Text style={styles.historyTime}>{timeAgo}</Text>
        </View>
      </View>
    );
  }, []);

  if (showHistory) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <Pressable onPress={() => setShowHistory(false)} style={styles.backButton} hitSlop={12}>
              <ChevronLeft color={joyTheme.text} size={24} />
            </Pressable>
            <Text style={styles.headerTitle}>Sent Announcements</Text>
            <View style={{ width: 40 }} />
          </View>
          {historyQuery.isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={joyTheme.primary} />
            </View>
          ) : (historyQuery.data ?? []).length === 0 ? (
            <View style={styles.centered}>
              <Clock color={joyTheme.textMuted} size={48} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>No announcements yet</Text>
              <Text style={styles.emptySubtitle}>Your sent announcements will appear here</Text>
            </View>
          ) : (
            <FlatList
              data={historyQuery.data}
              renderItem={renderHistoryItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.historyList}
              showsVerticalScrollIndicator={false}
            />
          )}
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
            <ChevronLeft color={joyTheme.text} size={24} />
          </Pressable>
          <Text style={styles.headerTitle}>New Announcement</Text>
          <Pressable onPress={() => setShowHistory(true)} style={styles.historyButton} hitSlop={8}>
            <Clock color={joyTheme.primary} size={20} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>AUDIENCE</Text>
            <View style={styles.targetRow}>
              {(['upcoming', 'past', 'custom'] as AnnouncementTarget[]).map((t) => (
                <Pressable
                  key={t}
                  style={[styles.targetChip, target === t && styles.targetChipActive]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setTarget(t);
                    if (t !== 'custom') setSelectedEventIds(new Set());
                  }}
                >
                  <Text style={[styles.targetChipText, target === t && styles.targetChipTextActive]}>
                    {t === 'upcoming' ? 'Upcoming' : t === 'past' ? 'Past' : 'Select Events'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.recipientSummary}>
              <Users color={joyTheme.primary} size={16} />
              <Text style={styles.recipientText}>
                ~{recipientCount} volunteer{recipientCount !== 1 ? 's' : ''} across{' '}
                {eventIdsToSend.length} event{eventIdsToSend.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {target === 'custom' && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>SELECT EVENTS</Text>
              {eventsQuery.isLoading ? (
                <ActivityIndicator color={joyTheme.primary} style={{ marginVertical: 20 }} />
              ) : (eventsQuery.data ?? []).length === 0 ? (
                <Text style={styles.noEventsText}>No events found</Text>
              ) : (
                <FlatList
                  data={eventsQuery.data}
                  renderItem={renderEventItem}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  style={styles.eventsList}
                />
              )}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ANNOUNCEMENT</Text>
            <View style={styles.inputCard}>
              <TextInput
                style={styles.titleInput}
                placeholder="Announcement title"
                placeholderTextColor={joyTheme.textMuted}
                value={title}
                onChangeText={setTitle}
                maxLength={100}
                testID="announcement-title-input"
              />
              <View style={styles.inputDivider} />
              <TextInput
                style={styles.messageInput}
                placeholder="Write your message to volunteers..."
                placeholderTextColor={joyTheme.textMuted}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={5}
                maxLength={500}
                textAlignVertical="top"
                testID="announcement-message-input"
              />
              <Text style={styles.charCount}>{message.length}/500</Text>
            </View>
          </View>

          <Pressable
            style={[styles.sendButton, (!canSend || sendMutation.isPending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!canSend || sendMutation.isPending}
            testID="send-announcement-button"
          >
            {sendMutation.isPending ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Send color="#FFF" size={18} />
                <Text style={styles.sendButtonText}>Send Announcement</Text>
              </>
            )}
          </Pressable>

          {sendMutation.isSuccess && (
            <Animated.View style={[styles.successBanner, { transform: [{ scale: successScale }] }]}>
              <CheckCircle2 color={joyTheme.success} size={20} />
              <Text style={styles.successText}>Announcement sent!</Text>
            </Animated.View>
          )}

          {sendMutation.isError && (
            <View style={styles.errorBanner}>
              <AlertCircle color="#E53935" size={18} />
              <Text style={styles.errorText}>
                {(sendMutation.error as Error)?.message ?? 'Something went wrong'}
              </Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: joyTheme.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
    letterSpacing: -0.3,
  },
  historyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: joyTheme.primarySoft,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: fonts.extraBold,
    color: joyTheme.textMuted,
    letterSpacing: 1.2,
    marginBottom: 10,
    marginLeft: 4,
  },
  targetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  targetChip: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: joyTheme.border,
    alignItems: 'center',
  },
  targetChipActive: {
    backgroundColor: joyTheme.primary,
    borderColor: joyTheme.primary,
  },
  targetChipText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: joyTheme.text,
  },
  targetChipTextActive: {
    color: '#FFFFFF',
  },
  recipientSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: joyTheme.primarySoft,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  recipientText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: joyTheme.primaryDark,
  },
  eventsList: {
    gap: 6,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: joyTheme.border,
    marginBottom: 6,
  },
  eventItemSelected: {
    borderColor: joyTheme.primary,
    backgroundColor: 'rgba(10,132,255,0.04)',
  },
  eventThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  eventThumbPlaceholder: {
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventItemInfo: {
    flex: 1,
    gap: 2,
  },
  eventItemTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: joyTheme.text,
  },
  eventItemDate: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: joyTheme.textMuted,
  },
  eventItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  volunteerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: joyTheme.backgroundAlt,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  volunteerBadgeText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: joyTheme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: joyTheme.primary,
    borderColor: joyTheme.primary,
  },
  inputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: joyTheme.border,
    overflow: 'hidden',
  },
  titleInput: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: joyTheme.text,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputDivider: {
    height: 1,
    backgroundColor: joyTheme.border,
    marginHorizontal: 16,
  },
  messageInput: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: joyTheme.text,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 120,
    lineHeight: 22,
  },
  charCount: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
    textAlign: 'right',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: joyTheme.primary,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#A3C9ED',
  },
  sendButtonText: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: '#FFFFFF',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8F8EF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 12,
  },
  successText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: joyTheme.success,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 12,
  },
  errorText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: '#E53935',
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: joyTheme.textMuted,
    textAlign: 'center',
  },
  noEventsText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: joyTheme.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
  },
  historyList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  historyItem: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyInfo: {
    flex: 1,
    gap: 3,
  },
  historyTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: joyTheme.text,
  },
  historyMessage: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: joyTheme.textMuted,
    lineHeight: 18,
  },
  historyTime: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
    marginTop: 2,
  },
});
