import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  CalendarDays,
  CalendarPlus,
  Camera,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Edit3,
  Heart,
  ImagePlus,
  MapPin,
  Users,
  Bell,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
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
import {
  fetchOrganizationEventsByOrgId,
  fetchOrganizationStatsByOrgId,
  fetchOrgPendingPhotos,
  fetchOrgRecentActivity,
  fetchUnreadNotificationCount,
  fetchOrgVolunteers,
  fetchOrgFollowersCount,
  fetchEventSignupCounts,
} from '@/lib/api';
import type { DbEvent, DbProfile } from '@/types/database';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function getEventImageUri(event: DbEvent): string {
  const resolved = resolveImageUrl(event.image_url);
  if (resolved) return resolved;
  return 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=600&q=80';
}

export default function OrgDashboard() {
  const router = useRouter();
  const { organization, adminUser } = useAuth();
  const orgId = organization?.id ?? adminUser?.organization_id ?? '';

  const statsQuery = useQuery({
    queryKey: ['org-stats', orgId],
    queryFn: () => fetchOrganizationStatsByOrgId(orgId),
    enabled: !!orgId,
    staleTime: 60000,
  });

  const eventsQuery = useQuery({
    queryKey: ['org-events', orgId],
    queryFn: () => fetchOrganizationEventsByOrgId(orgId),
    enabled: !!orgId,
    staleTime: 60000,
  });

  const pendingPhotosQuery = useQuery({
    queryKey: ['org-pending-photos', orgId],
    queryFn: () => fetchOrgPendingPhotos(orgId),
    enabled: !!orgId,
    staleTime: 60000,
  });

  const volunteersQuery = useQuery({
    queryKey: ['org-volunteers', orgId],
    queryFn: () => fetchOrgVolunteers(orgId),
    enabled: !!orgId,
    staleTime: 60000,
  });

  const activityQuery = useQuery({
    queryKey: ['org-recent-activity', orgId],
    queryFn: () => fetchOrgRecentActivity(orgId),
    enabled: !!orgId,
    staleTime: 60000,
  });

  const adminUserId = adminUser?.id ?? '';
  const unreadQuery = useQuery({
    queryKey: ['unread-notifications', adminUserId],
    queryFn: () => fetchUnreadNotificationCount(adminUserId),
    enabled: !!adminUserId,
    staleTime: 60000,
  });
  const unreadCount = unreadQuery.data ?? 0;

  const orgFollowersQuery = useQuery({
    queryKey: ['org-followers-count', orgId],
    queryFn: () => fetchOrgFollowersCount(orgId),
    enabled: !!orgId,
    staleTime: 60000,
  });
  const orgFollowersCount = orgFollowersQuery.data ?? 0;

  const signupCountsQuery = useQuery({
    queryKey: ['event-signup-counts'],
    queryFn: fetchEventSignupCounts,
    staleTime: 60000,
  });
  const signupCounts = useMemo(() => signupCountsQuery.data ?? {}, [signupCountsQuery.data]);

  const stats = statsQuery.data;
  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const pendingPhotos = pendingPhotosQuery.data ?? [];
  const activity = activityQuery.data;
  const volunteers = useMemo(() => volunteersQuery.data ?? [], [volunteersQuery.data]);

  const upcomingEvents = useMemo(() => {
    const now = new Date().toISOString();
    return events.filter((e) => e.start_time >= now);
  }, [events]);

  const pastEvents = useMemo(() => {
    const now = new Date().toISOString();
    return events.filter((e) => e.start_time < now);
  }, [events]);

  const isRefreshing = statsQuery.isRefetching || eventsQuery.isRefetching;

  const statsRefetch = statsQuery.refetch;
  const eventsRefetch = eventsQuery.refetch;
  const pendingPhotosRefetch = pendingPhotosQuery.refetch;
  const activityRefetch = activityQuery.refetch;
  const unreadRefetch = unreadQuery.refetch;
  const volunteersRefetch = volunteersQuery.refetch;
  const orgFollowersRefetch = orgFollowersQuery.refetch;
  const signupCountsRefetch = signupCountsQuery.refetch;

  const handleRefresh = useCallback(() => {
    console.log('[OrgDashboard] Refreshing all data');
    void statsRefetch();
    void eventsRefetch();
    void pendingPhotosRefetch();
    void activityRefetch();
    void unreadRefetch();
    void volunteersRefetch();
    void orgFollowersRefetch();
    void signupCountsRefetch();
  }, [statsRefetch, eventsRefetch, pendingPhotosRefetch, activityRefetch, unreadRefetch, volunteersRefetch, orgFollowersRefetch, signupCountsRefetch]);

  const [showAllVolunteers, setShowAllVolunteers] = useState<boolean>(false);
  const visibleVolunteers = useMemo(() => {
    if (showAllVolunteers) return volunteers;
    return volunteers.slice(0, 8);
  }, [volunteers, showAllVolunteers]);

  const handleEventPress = useCallback((eventId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/event-detail' as never, params: { id: eventId } });
  }, [router]);


  const handleEventRecap = useCallback((eventId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/event-recap' as never, params: { eventId } });
  }, [router]);

  const handleEditEvent = useCallback((eventId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/edit-event' as never, params: { eventId } });
  }, [router]);

  const [showAllPast, setShowAllPast] = useState<boolean>(false);
  const visiblePastEvents = useMemo(() => {
    if (showAllPast) return pastEvents;
    return pastEvents.slice(0, 3);
  }, [pastEvents, showAllPast]);

  if (statsQuery.isLoading && eventsQuery.isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color={joyTheme.warm} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen} testID="org-dashboard">
      <LinearGradient colors={['#0F172A', '#1E293B', '#334155']} style={styles.headerGradient} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            {resolveImageUrl(organization?.logo_url) ? (
              <Image source={{ uri: resolveImageUrl(organization?.logo_url)! }} style={styles.orgLogo} contentFit="cover" />
            ) : (
              <View style={styles.orgLogoPlaceholder}>
                <Text style={styles.orgLogoText}>
                  {(organization?.name ?? 'O').slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.topBarInfo}>
              <Text style={styles.topBarGreeting}>Welcome back</Text>
              <Text style={styles.topBarName} numberOfLines={1}>
                {organization?.name ?? adminUser?.name ?? 'Organization'}
              </Text>
            </View>
          </View>
          <View style={styles.topBarActions} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#fff" />
          }
        >
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: joyTheme.warmSoft }]}>
                <Calendar color={joyTheme.warm} size={18} />
              </View>
              <Text style={styles.statValue}>{stats?.totalEvents ?? 0}</Text>
              <Text style={styles.statLabel}>Events</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#F0FDF4' }]}>
                <Users color={joyTheme.success} size={18} />
              </View>
              <Text style={styles.statValue}>{stats?.totalVolunteers ?? volunteers.length}</Text>
              <Text style={styles.statLabel}>Volunteers</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#FFF1F2' }]}>
                <Heart color="#E11D48" size={18} />
              </View>
              <Text style={styles.statValue}>{orgFollowersCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#FDF2F8' }]}>
                <Camera color="#DB2777" size={18} />
              </View>
              <Text style={styles.statValue}>{stats?.totalPhotos ?? 0}</Text>
              <Text style={styles.statLabel}>Photos</Text>
            </View>
          </View>

          <View style={styles.quickActionsSection}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActionsList}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  router.push('/create-event' as never);
                }}
                style={({ pressed }) => [styles.qaCard, pressed && { opacity: 0.88, transform: [{ scale: 0.985 }] }]}
              >
                <View style={[styles.qaIconWrap, { backgroundColor: joyTheme.warmSoft }]}>
                  <CalendarPlus color={joyTheme.warm} size={18} />
                </View>
                <View style={styles.qaTextWrap}>
                  <Text style={styles.qaTitle}>Create Event</Text>
                  <Text style={styles.qaSub}>Publish a new volunteer event</Text>
                </View>
                <ChevronRight color={joyTheme.textMuted} size={16} />
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  router.push('/photo-approval' as never);
                }}
                style={({ pressed }) => [styles.qaCard, pressed && { opacity: 0.88, transform: [{ scale: 0.985 }] }]}
              >
                <View style={[styles.qaIconWrap, { backgroundColor: '#FDF2F8' }]}>
                  <ImagePlus color="#DB2777" size={18} />
                  {pendingPhotos.length > 0 && (
                    <View style={styles.qaBadge}>
                      <Text style={styles.qaBadgeText}>{pendingPhotos.length}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.qaTextWrap}>
                  <Text style={styles.qaTitle}>Review & Upload Photos</Text>
                  <Text style={styles.qaSub}>
                    {pendingPhotos.length > 0 ? `${pendingPhotos.length} pending review` : 'Review, approve & upload event photos'}
                  </Text>
                </View>
                <ChevronRight color={joyTheme.textMuted} size={16} />
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  router.push('/notifications' as never);
                }}
                style={({ pressed }) => [styles.qaCard, pressed && { opacity: 0.88, transform: [{ scale: 0.985 }] }]}
              >
                <View style={[styles.qaIconWrap, { backgroundColor: '#FFF1F2' }]}>
                  <Bell color="#E11D48" size={18} />
                  {unreadCount > 0 && (
                    <View style={styles.qaBadge}>
                      <Text style={styles.qaBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.qaTextWrap}>
                  <Text style={styles.qaTitle}>Notifications</Text>
                  <Text style={styles.qaSub}>
                    {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
                  </Text>
                </View>
                <ChevronRight color={joyTheme.textMuted} size={16} />
              </Pressable>
            </View>
          </View>

          {upcomingEvents.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Upcoming Events</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{upcomingEvents.length}</Text>
                </View>
              </View>
              {upcomingEvents.map((event) => (
                <Pressable
                  key={event.id}
                  style={({ pressed }) => [styles.upcomingEventCard, pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] }]}
                  onPress={() => handleEventPress(event.id)}
                  testID={`upcoming-event-${event.id}`}
                >
                  <Image source={{ uri: getEventImageUri(event) }} style={styles.upcomingEventCover} contentFit="cover" />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.75)']}
                    style={styles.upcomingEventOverlay}
                  />
                  <View style={styles.upcomingEventContent}>
                    <View style={styles.upcomingEventBadge}>
                      <Text style={styles.upcomingEventBadgeText}>Upcoming</Text>
                    </View>
                    <View style={styles.upcomingEventBottom}>
                      <Text style={styles.upcomingEventTitle} numberOfLines={2}>{event.title}</Text>
                      <View style={styles.upcomingEventMetaRow}>
                        <View style={styles.eventMeta}>
                          <Clock color="rgba(255,255,255,0.85)" size={12} />
                          <Text style={styles.upcomingEventMetaText}>
                            {formatDate(event.start_time)} · {formatTime(event.start_time)}
                          </Text>
                        </View>
                        {event.city && (
                          <View style={styles.eventMeta}>
                            <MapPin color="rgba(255,255,255,0.85)" size={12} />
                            <Text style={styles.upcomingEventMetaText}>{event.city}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  <View style={styles.upcomingEventActions}>
                    <View style={styles.eventDateChip}>
                      <CalendarDays color={joyTheme.warm} size={14} />
                      <Text style={styles.eventDateChipText}>{formatDate(event.start_time)}</Text>
                    </View>
                    {(signupCounts[event.id] ?? 0) > 0 && (
                      <View style={styles.eventVolunteerChip}>
                        <Users color={joyTheme.success} size={13} />
                        <Text style={styles.eventVolunteerChipText}>{signupCounts[event.id]} signed up</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }} />
                    <Pressable
                      style={({ pressed }) => [styles.manageBtn, { flex: 0, paddingHorizontal: 16 }, pressed && { opacity: 0.7 }]}
                      onPress={() => handleEditEvent(event.id)}
                    >
                      <Edit3 color="#0E3C73" size={14} />
                      <Text style={styles.manageBtnText}>Manage</Text>
                    </Pressable>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {volunteers.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Volunteers</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{volunteers.length}</Text>
                </View>
              </View>
              <View style={styles.volunteersGrid}>
                {visibleVolunteers.map((vol: DbProfile) => (
                  <View key={vol.id} style={styles.volunteerChip} testID={`volunteer-${vol.id}`}>
                    {resolveImageUrl(vol.avatar_url) ? (
                      <Image source={{ uri: resolveImageUrl(vol.avatar_url)! }} style={styles.volunteerAvatar} contentFit="cover" />
                    ) : (
                      <View style={[styles.volunteerAvatar, styles.volunteerAvatarPlaceholder]}>
                        <Text style={styles.volunteerInitial}>
                          {(vol.full_name ?? 'V').slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.volunteerInfo}>
                      <Text style={styles.volunteerName} numberOfLines={1}>{vol.full_name ?? 'Volunteer'}</Text>
                      <Text style={styles.volunteerMeta} numberOfLines={1}>
                        {vol.total_points > 0 ? `${vol.total_points} pts` : ''}{vol.city ? `${vol.total_points > 0 ? ' · ' : ''}${vol.city}` : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
              {!showAllVolunteers && volunteers.length > 8 && (
                <Pressable
                  style={({ pressed }) => [styles.seeMoreBtn, pressed && { opacity: 0.8 }]}
                  onPress={() => {
                    setShowAllVolunteers(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  }}
                >
                  <Text style={styles.seeMoreText}>See All ({volunteers.length - 8} more)</Text>
                  <ChevronRight color={joyTheme.primaryDark} size={16} />
                </Pressable>
              )}
            </View>
          )}

          {activity && activity.recentSignups.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              {activity.recentSignups.slice(0, 6).map((signup) => {
                const profile = signup.profiles;
                const event = signup.events;
                if (!profile || !event) return null;
                return (
                  <Pressable
                    key={signup.id}
                    style={styles.activityRow}
                    onPress={() => handleEventPress(event.id)}
                  >
                    {resolveImageUrl(profile.avatar_url) ? (
                      <Image source={{ uri: resolveImageUrl(profile.avatar_url)! }} style={styles.activityAvatar} contentFit="cover" />
                    ) : (
                      <View style={[styles.activityAvatar, styles.activityAvatarPlaceholder]}>
                        <Text style={styles.activityInitials}>
                          {(profile.full_name ?? 'V').slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityName} numberOfLines={1}>
                        {profile.full_name ?? 'Volunteer'}
                      </Text>
                      <Text style={styles.activityDetail} numberOfLines={1}>
                        {signup.checked_in ? 'Checked in at' : 'Signed up for'} {event.title}
                      </Text>
                    </View>
                    <ChevronRight color={joyTheme.textMuted} size={16} />
                  </Pressable>
                );
              })}
            </View>
          )}

          {pastEvents.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Past Events</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{pastEvents.length}</Text>
                </View>
              </View>
              {visiblePastEvents.map((event) => (
                <View key={event.id} style={styles.pastEventCard} testID={`past-event-${event.id}`}>
                  <Pressable
                    style={styles.pastEventMain}
                    onPress={() => handleEventPress(event.id)}
                  >
                    <Image source={{ uri: getEventImageUri(event) }} style={styles.pastEventThumb} contentFit="cover" />
                    <View style={styles.pastEventInfo}>
                      <View style={styles.pastCompletedBadge}>
                        <Text style={styles.pastCompletedBadgeText}>Completed</Text>
                      </View>
                      <Text style={styles.pastEventTitle} numberOfLines={1}>{event.title}</Text>
                      <View style={styles.eventMeta}>
                        <Calendar color={joyTheme.textMuted} size={12} />
                        <Text style={styles.eventMetaText}>{formatDate(event.start_time)}</Text>
                      </View>
                      {event.city && (
                        <View style={styles.eventMeta}>
                          <MapPin color={joyTheme.textMuted} size={12} />
                          <Text style={styles.eventMetaText}>{event.city}</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                  <View style={styles.pastEventBtnRow}>
                    <Pressable
                      style={({ pressed }) => [styles.pastRecapBtn, pressed && { opacity: 0.7 }]}
                      onPress={() => handleEventRecap(event.id)}
                    >
                      <ClipboardCheck color="#fff" size={14} />
                      <Text style={styles.pastRecapBtnText}>
                        {event.recap_published_at ? 'View Recap' : 'Complete Recap'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
              {!showAllPast && pastEvents.length > 3 && (
                <Pressable
                  style={({ pressed }) => [styles.seeMoreBtn, pressed && { opacity: 0.8 }]}
                  onPress={() => {
                    setShowAllPast(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  }}
                >
                  <Text style={styles.seeMoreText}>See More ({pastEvents.length - 3} more)</Text>
                  <ChevronRight color={joyTheme.primaryDark} size={16} />
                </Pressable>
              )}
            </View>
          )}

          {events.length === 0 && !eventsQuery.isLoading && (
            <View style={styles.emptyCard}>
              <Calendar color={joyTheme.textMuted} size={40} />
              <Text style={styles.emptyTitle}>No events yet</Text>
              <Text style={styles.emptyText}>Create your first event to start managing volunteers.</Text>
              <Pressable
                style={styles.emptyBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  router.push('/create-event' as never);
                }}
              >
                <Text style={styles.emptyBtnText}>Create Event</Text>
              </Pressable>
            </View>
          )}

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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topBarLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orgLogo: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  orgLogoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  orgLogoText: {
    fontSize: 16,
    fontFamily: fonts.black,
    color: '#fff',
  },
  topBarInfo: {
    flex: 1,
  },
  topBarGreeting: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: 'rgba(255,255,255,0.65)',
  },
  topBarName: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: '#fff',
    letterSpacing: -0.3,
  },
  topBarBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 120,
    gap: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: joyTheme.border,
    shadowColor: joyTheme.shadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 20,
    fontFamily: fonts.black,
    color: joyTheme.text,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  quickActionsSection: {
    gap: 12,
  },
  quickActionsList: {
    gap: 8,
  },
  qaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: joyTheme.border,
    shadowColor: joyTheme.shadow,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  qaIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qaTextWrap: {
    flex: 1,
    gap: 2,
  },
  qaTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: joyTheme.text,
  },
  qaSub: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: joyTheme.textMuted,
  },
  qaBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#E11D48',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  qaBadgeText: {
    fontSize: 10,
    fontFamily: fonts.extraBold,
    color: '#fff',
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
    letterSpacing: -0.2,
  },
  countBadge: {
    backgroundColor: joyTheme.warmSoft,
    borderRadius: 10,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countBadgeText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: joyTheme.warm,
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: joyTheme.border,
    gap: 10,
  },
  eventMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eventThumb: {
    width: 52,
    height: 52,
    borderRadius: 14,
  },
  eventInfo: {
    flex: 1,
    gap: 3,
  },
  eventTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: joyTheme.text,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventMetaText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  eventBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  manageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 10,
  },
  manageBtnText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: joyTheme.navy,
  },
  checkInBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: joyTheme.navy,
    borderRadius: 12,
    paddingVertical: 10,
  },
  checkInBtnText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: '#fff',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  activityAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
  },
  activityAvatarPlaceholder: {
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInitials: {
    fontSize: 14,
    fontFamily: fonts.extraBold,
    color: joyTheme.primaryDark,
  },
  activityInfo: {
    flex: 1,
    gap: 2,
  },
  activityName: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: joyTheme.text,
  },
  activityDetail: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: joyTheme.textMuted,
  },
  upcomingEventCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: joyTheme.border,
    shadowColor: joyTheme.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  upcomingEventCover: {
    width: '100%',
    height: 170,
  },
  upcomingEventOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 170,
  },
  upcomingEventContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 170,
    justifyContent: 'space-between',
    padding: 14,
  },
  upcomingEventBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(15,23,42,0.75)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  upcomingEventBadgeText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: '#fff',
  },
  upcomingEventBottom: {
    gap: 4,
  },
  upcomingEventTitle: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: '#fff',
    letterSpacing: -0.2,
  },
  upcomingEventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  upcomingEventMetaText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: 'rgba(255,255,255,0.85)',
  },
  upcomingEventActions: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: joyTheme.border,
  },
  pastEventCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: joyTheme.border,
    gap: 10,
  },
  pastEventMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pastEventThumb: {
    width: 52,
    height: 52,
    borderRadius: 14,
  },
  pastEventInfo: {
    flex: 1,
    gap: 3,
  },
  pastCompletedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 2,
  },
  pastCompletedBadgeText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: joyTheme.success,
  },
  pastEventTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: joyTheme.text,
  },
  pastEventBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  pastRecapBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: joyTheme.navy,
    borderRadius: 10,
    paddingVertical: 10,
  },
  pastRecapBtnText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: '#fff',
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: joyTheme.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBtn: {
    backgroundColor: joyTheme.warm,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 8,
  },
  emptyBtnText: {
    fontSize: 15,
    fontFamily: fonts.extraBold,
    color: '#fff',
  },
  seeMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: joyTheme.warmSoft,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  seeMoreText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: joyTheme.warm,
  },
  volunteersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  volunteerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: joyTheme.border,
    width: '48.5%' as unknown as number,
  },
  volunteerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
  },
  volunteerAvatarPlaceholder: {
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volunteerInitial: {
    fontSize: 14,
    fontFamily: fonts.extraBold,
    color: joyTheme.primaryDark,
  },
  volunteerInfo: {
    flex: 1,
    gap: 1,
  },
  volunteerName: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: joyTheme.text,
  },
  volunteerMeta: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: joyTheme.textMuted,
  },
  eventDateChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: joyTheme.warmSoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  eventDateChipText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: joyTheme.warm,
  },
  eventVolunteerChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  eventVolunteerChipText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: joyTheme.success,
  },
  bottomSpacer: {
    height: 24,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#E11D48',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: 'rgba(15,23,42,0.9)',
  },
  headerBadgeText: {
    fontSize: 10,
    fontFamily: fonts.extraBold,
    color: '#fff',
  },
});
