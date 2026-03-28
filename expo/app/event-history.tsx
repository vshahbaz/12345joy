import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  MapPin,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fonts } from '@/constants/fonts';
import { joyTheme } from '@/constants/joyTheme';
import { resolveImageUrl } from '@/lib/imageUtils';
import { useAuth } from '@/providers/AuthProvider';
import { fetchUserEvents, fetchOrganizationsByIds } from '@/lib/api';
import type { DbEvent, DbEventSignup, DbOrganization } from '@/types/database';

type UserEventEntry = DbEventSignup & { events: DbEvent };


type OrgMap = Record<string, DbOrganization>;

function formatEventDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatEventTime(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function getEventImageUri(event: DbEvent): string {
  const resolved = resolveImageUrl(event.image_url);
  if (resolved) return resolved;
  return 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=600&q=80';
}

export default function EventHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const userId = user?.id ?? '';

  const userEventsQuery = useQuery({
    queryKey: ['user-events', userId],
    queryFn: () => fetchUserEvents(userId),
    enabled: !!userId,
    refetchOnMount: 'always' as const,
    staleTime: 5000,
  });

  useFocusEffect(
    useCallback(() => {
      console.log('[EventHistory] Focused, refetching');
      if (userId) {
        void userEventsQuery.refetch();
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId])
  );

  const myEvents = useMemo(() => {
    try {
      const rawEvents = userEventsQuery.data ?? [];
      return rawEvents.map((entry: any) => {
        if (entry.events && !Array.isArray(entry.events)) {
          return entry as UserEventEntry;
        }
        if (Array.isArray(entry.events) && entry.events.length > 0) {
          return { ...entry, events: entry.events[0] } as UserEventEntry;
        }
        return entry as UserEventEntry;
      }).filter((entry: UserEventEntry) => !!entry.events && !!entry.events.id);
    } catch (e) {
      console.error('[EventHistory] Error processing events:', e);
      return [];
    }
  }, [userEventsQuery.data]);

  const orgIds = useMemo(() => {
    const ids = myEvents
      .map((e) => e.events?.organization_id)
      .filter((id): id is string => !!id);
    return [...new Set(ids)];
  }, [myEvents]);

  const orgsQuery = useQuery({
    queryKey: ['organizations-batch', orgIds],
    queryFn: () => fetchOrganizationsByIds(orgIds),
    enabled: orgIds.length > 0,
    staleTime: 10000,
  });

  const orgsMap: OrgMap = useMemo(() => orgsQuery.data ?? {}, [orgsQuery.data]);

  const pastEvents = useMemo(() => {
    const now = new Date().toISOString();
    return myEvents
      .filter((e: UserEventEntry) => e.events?.start_time < now)
      .sort((a, b) => new Date(b.events.start_time).getTime() - new Date(a.events.start_time).getTime());
  }, [myEvents]);

  const handleEventPress = useCallback((eventId: string) => {
    console.log('[EventHistory] Navigating to event:', eventId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/event-detail', params: { id: eventId } });
  }, [router]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.back();
  }, [router]);

  const userEventsRefetch = userEventsQuery.refetch;

  const handleRefresh = useCallback(() => {
    console.log('[EventHistory] Refreshing');
    void userEventsRefetch();
  }, [userEventsRefetch]);

  return (
    <View style={styles.screen} testID="event-history-screen">
      <LinearGradient
        colors={['#0865C2', '#0A84FF', '#64B5FF']}
        style={styles.headerGradient}
      />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={handleBack} style={styles.backButton} hitSlop={12}>
            <ArrowLeft color="#fff" size={22} />
          </Pressable>
          <Text style={styles.topBarTitle}>Event History</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>{pastEvents.length} completed event{pastEvents.length !== 1 ? 's' : ''}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={userEventsQuery.isRefetching}
              onRefresh={handleRefresh}
              tintColor={joyTheme.primary}
            />
          }
        >
          {userEventsQuery.isLoading && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={joyTheme.primary} size="large" />
            </View>
          )}

          {!userEventsQuery.isLoading && pastEvents.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Calendar color={joyTheme.textMuted} size={40} />
              </View>
              <Text style={styles.emptyTitle}>No completed events yet</Text>
              <Text style={styles.emptySubtitle}>
                Events you've attended will appear here with recaps.
              </Text>
            </View>
          )}

          {pastEvents.map((signup: UserEventEntry) => {
            const event = signup.events;
            if (!event) return null;
            const isPast = true;
            const org = event.organization_id ? orgsMap[event.organization_id] : undefined;
            const hasRecap = isPast && (event.recap_summary || event.impact_joy_dealt || event.impact_reach || event.community_benefited);
            return (
              <Pressable
                key={signup.id}
                style={({ pressed }) => [styles.eventCard, pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] }]}
                onPress={() => handleEventPress(event.id)}
              >
                <Image source={{ uri: getEventImageUri(event) }} style={styles.eventImage} contentFit="cover" />
                <View style={styles.eventCardBody}>
                  {org && (
                    <View style={styles.orgRow}>
                      <View style={styles.orgIconWrap}>
                        {resolveImageUrl(org.logo_url) ? (
                          <Image source={{ uri: resolveImageUrl(org.logo_url)! }} style={styles.orgLogo} contentFit="cover" />
                        ) : (
                          <Building2 color={joyTheme.primaryDark} size={14} />
                        )}
                      </View>
                      <Text style={styles.orgName} numberOfLines={1}>{org.name}</Text>
                    </View>
                  )}
                  <View style={styles.eventCardHeader}>
                    <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
                    {isPast && signup.checked_in && (
                      <View style={styles.checkedInBadge}>
                        <Text style={styles.checkedInText}>Attended</Text>
                      </View>
                    )}
                    {!isPast && (
                      <View style={styles.upcomingBadge}>
                        <Text style={styles.upcomingBadgeText}>Signed Up</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.eventMetaRow}>
                    <Calendar color={joyTheme.textMuted} size={14} />
                    <Text style={styles.eventMetaText}>{formatEventDate(event.start_time)}</Text>
                  </View>
                  <View style={styles.eventMetaRow}>
                    <Clock color={joyTheme.textMuted} size={14} />
                    <Text style={styles.eventMetaText}>{formatEventTime(event.start_time)}</Text>
                  </View>
                  {(event.venue || event.city) && (
                    <View style={styles.eventMetaRow}>
                      <MapPin color={joyTheme.primary} size={14} />
                      <Text style={[styles.eventMetaText, { color: joyTheme.primary }]} numberOfLines={1}>
                        {event.venue ?? event.city ?? 'TBD'}
                      </Text>
                    </View>
                  )}
                  {isPast && (
                    <View style={styles.eventStatsRow}>
                      {signup.hours_logged != null && signup.hours_logged > 0 && (
                        <View style={styles.eventStatChip}>
                          <Clock color={joyTheme.success} size={12} />
                          <Text style={styles.eventStatChipText}>{signup.hours_logged}h</Text>
                        </View>
                      )}
                      {signup.points_earned != null && signup.points_earned > 0 && (
                        <View style={[styles.eventStatChip, { backgroundColor: '#EEF4FF' }]}>
                          <Text style={[styles.eventStatChipText, { color: joyTheme.primary }]}>+{signup.points_earned} pts</Text>
                        </View>
                      )}
                    </View>
                  )}
                  {hasRecap && (
                    <View style={styles.recapSection}>
                      <View style={styles.recapHeader}>
                        <Sparkles color="#FFB800" size={14} />
                        <Text style={styles.recapLabel}>Event Recap</Text>
                      </View>
                      {event.recap_summary && (
                        <Text style={styles.recapSummary} numberOfLines={3}>{event.recap_summary}</Text>
                      )}
                      <View style={styles.recapStatsRow}>
                        {event.community_benefited && (
                          <View style={styles.recapStatChip}>
                            <Users color="#fff" size={11} />
                            <Text style={styles.recapStatText}>{event.community_benefited}</Text>
                          </View>
                        )}
                        {event.impact_joy_dealt && (
                          <View style={styles.recapStatChip}>
                            <Zap color="#fff" size={11} />
                            <Text style={styles.recapStatText}>{event.impact_joy_dealt}</Text>
                          </View>
                        )}
                        {event.impact_reach && (
                          <View style={[styles.recapStatChip, { backgroundColor: '#2B8A5E' }]}>
                            <Text style={styles.recapStatText}>{event.impact_reach} reach</Text>
                          </View>
                        )}
                        {event.impact_funds_generated && (
                          <View style={[styles.recapStatChip, { backgroundColor: '#B8860B' }]}>
                            <Text style={styles.recapStatText}>{event.impact_funds_generated}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: joyTheme.background,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  summaryBar: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: 'rgba(255,255,255,0.9)',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 14,
  },
  loadingWrap: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: joyTheme.border,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: joyTheme.border,
    shadowColor: joyTheme.shadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  eventImage: {
    width: '100%',
    height: 140,
  },
  eventCardBody: {
    padding: 16,
    gap: 8,
  },
  eventCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  eventTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
    letterSpacing: -0.2,
  },
  checkedInBadge: {
    backgroundColor: '#E8F8EF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  checkedInText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: joyTheme.success,
  },
  upcomingBadge: {
    backgroundColor: joyTheme.primarySoft,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  upcomingBadgeText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: joyTheme.primaryDark,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventMetaText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  eventStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  eventStatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F8EF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  eventStatChipText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: joyTheme.success,
  },
  orgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  orgIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orgLogo: {
    width: 24,
    height: 24,
  },
  orgName: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: joyTheme.primary,
    flex: 1,
  },
  recapSection: {
    marginTop: 6,
    backgroundColor: '#0E3C73',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  recapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recapLabel: {
    fontSize: 13,
    fontFamily: fonts.extraBold,
    color: '#FFD84D',
    letterSpacing: -0.2,
  },
  recapSummary: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.medium,
    color: 'rgba(255,255,255,0.85)',
  },
  recapStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  recapStatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  recapStatText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: '#fff',
  },
  bottomSpacer: {
    height: 40,
  },
});
