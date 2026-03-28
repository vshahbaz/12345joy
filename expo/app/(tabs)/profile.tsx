import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter, useFocusEffect } from 'expo-router';
import { Alert, Dimensions, Linking, Modal, Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as Calendar from 'expo-calendar';
import {
  Award,
  Bell,
  Calendar as CalendarIcon,
  CalendarPlus,
  CheckCircle,
  ChevronRight,
  Clock,
  Globe,
  Heart,
  MapPin,
  MessageCircle,
  Newspaper,
  Star,
  TrendingUp,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import * as WebBrowser from 'expo-web-browser';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
// RNAnimated already imported above
import { SafeAreaView } from 'react-native-safe-area-context';

import { JOY_DEALERS_LOGO_URL } from '@/constants/branding';
import { joyTheme } from '@/constants/joyTheme';
import { resolveImageUrl } from '@/lib/imageUtils';
import { useAuth } from '@/providers/AuthProvider';
import {
  fetchUserEvents,
  fetchUserPhotos,
  fetchUserLeaderboardRank,
  fetchUserEventPhotos,
  fetchFollowersCount,
  fetchFollowingCount,
  fetchUnreadNotificationCount,
  fetchOrganizationEventsByOrgId,
  fetchOrganizationStatsByOrgId,
  fetchOrgAllPhotos,
  fetchOrgNewsArticles,
  fetchOrgFollowersCount,
  fetchOrgVolunteers,
} from '@/lib/api';
import type { OrgNewsArticle } from '@/lib/api';
import type { DbEvent, DbEventPhoto, DbEventSignup } from '@/types/database';
import { useRealtimeFollows } from '@/hooks/useRealtimeFollows';

type OrgStats = {
  totalEvents: number;
  totalVolunteers: number;
  totalPhotos: number;
  upcomingEvents: number;
};

function StandaloneStatCard({ label, value, icon: Icon, gradientColors, subtitle, onPress }: { label: string; value: string; icon: React.ComponentType<{ color?: string; size?: number }>; gradientColors: [string, string, ...string[]]; subtitle?: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] }]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.actionCardContent}>
        <View style={styles.actionCardLeft}>
          <View style={styles.actionCardIconWrap}>
            <Icon color="#fff" size={22} />
            {value !== '--' && (
              <View style={styles.actionCardValueBadge}>
                <Text style={styles.actionCardValueBadgeText}>{value}</Text>
              </View>
            )}
          </View>
          <View style={styles.actionCardTextWrap}>
            <Text style={styles.actionCardTitle}>{label}</Text>
            {subtitle ? <Text style={styles.actionCardSubtitle}>{subtitle}</Text> : null}
          </View>
        </View>
        <ChevronRight color="rgba(255,255,255,0.8)" size={22} />
      </View>
    </Pressable>
  );
}

function formatEventDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatEventTime(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function toGoogleCalendarDate(isoDate: string): string {
  return new Date(isoDate).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function openGoogleCalendarUrl(event: DbEvent) {
  const startDate = toGoogleCalendarDate(event.start_time);
  const endDate = toGoogleCalendarDate(event.end_time);
  const location = event.venue || event.address || event.city || '';
  const details = event.description || '';
  const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startDate}/${endDate}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}&sf=true&output=xml`;
  Linking.openURL(url).catch((err) => console.log('[ProfileScreen] Error opening calendar URL:', err));
}

async function addToNativeCalendar(event: DbEvent) {
  console.log('[ProfileScreen] Adding event to native calendar:', event.title);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

  if (Platform.OS === 'web') {
    openGoogleCalendarUrl(event);
    return;
  }

  try {
    const result = await Calendar.createEventInCalendarAsync({
      title: event.title,
      startDate: new Date(event.start_time),
      endDate: new Date(event.end_time),
      location: event.venue || event.address || event.city || undefined,
      notes: event.description || undefined,
    });
    console.log('[ProfileScreen] Calendar dialog result:', result);
    if (result.action === 'saved') {
      Alert.alert('Added!', 'Event has been saved to your calendar.');
    } else if (result.action === 'canceled') {
      console.log('[ProfileScreen] User cancelled calendar dialog');
    }
  } catch (err) {
    console.log('[ProfileScreen] Error with native calendar dialog:', err);
    Alert.alert(
      'Calendar',
      'Could not open the calendar. Would you like to add via Google Calendar instead?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Google Calendar', onPress: () => openGoogleCalendarUrl(event) },
      ]
    );
  }
}

function getEventImageUri(event: DbEvent): string {
  const resolved = resolveImageUrl(event.image_url);
  if (resolved) return resolved;
  return 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=600&q=80';
}

type UserEventEntry = DbEventSignup & { events: DbEvent };

const SCREEN_WIDTH = Dimensions.get('window').width;
const PHOTO_SIZE = Math.floor((SCREEN_WIDTH - 40 - 32 - 8) / 3);
const ORG_PHOTO_SIZE = Math.floor((SCREEN_WIDTH - 40 - 32 - 8) / 3);
const PHOTO_TAB_WIDTH = Math.floor((SCREEN_WIDTH - 40 - 32 - 8) / 2);

export default function ProfileScreen() {
  const router = useRouter();
  const { user, role, profile, organization, isAuthenticated, adminUser } = useAuth();
  const [lightboxPhoto, setLightboxPhoto] = useState<DbEventPhoto | null>(null);

  const userId = user?.id ?? adminUser?.id ?? '';
  const orgId = organization?.id ?? adminUser?.organization_id ?? null;
  const isAdminUser = !!adminUser && !user;

  useRealtimeFollows(userId || undefined);

  const userEventsQuery = useQuery({
    queryKey: ['user-events', userId],
    queryFn: () => fetchUserEvents(userId),
    enabled: !!userId && role === 'volunteer' && !isAdminUser,
    staleTime: 30000,
  });

  const userPhotosQuery = useQuery({
    queryKey: ['user-photos', userId],
    queryFn: () => fetchUserPhotos(userId),
    enabled: !!userId && role === 'volunteer' && !isAdminUser,
  });

  const rankQuery = useQuery({
    queryKey: ['user-rank', userId],
    queryFn: () => fetchUserLeaderboardRank(userId),
    enabled: !!userId && role === 'volunteer' && !isAdminUser,
  });

  const eventPhotosQuery = useQuery({
    queryKey: ['user-event-photos', userId],
    queryFn: () => fetchUserEventPhotos(userId),
    enabled: !!userId && role === 'volunteer' && !isAdminUser,
  });

  const followersCountQuery = useQuery({
    queryKey: ['followers-count', userId],
    queryFn: () => fetchFollowersCount(userId),
    enabled: !!userId && !isAdminUser,
    staleTime: 30000,
  });

  const followingCountQuery = useQuery({
    queryKey: ['following-count', userId],
    queryFn: () => fetchFollowingCount(userId),
    enabled: !!userId && !isAdminUser,
    staleTime: 30000,
  });

  const orgFollowersCountQuery = useQuery({
    queryKey: ['org-followers-count', userId],
    queryFn: () => fetchOrgFollowersCount(userId),
    enabled: !!userId && role === 'organization',
    staleTime: 60000,
  });

  const orgVolunteersQuery = useQuery({
    queryKey: ['org-volunteers', orgId ?? ''],
    queryFn: () => fetchOrgVolunteers(orgId ?? ''),
    enabled: !!orgId && role === 'organization',
    staleTime: 60000,
  });

  const unreadQuery = useQuery({
    queryKey: ['unread-notifications', userId],
    queryFn: () => fetchUnreadNotificationCount(userId),
    enabled: !!userId,
  });

  const orgEventsQuery = useQuery({
    queryKey: ['org-events', orgId],
    queryFn: () => orgId ? fetchOrganizationEventsByOrgId(orgId) : Promise.resolve([]),
    enabled: !!orgId && role === 'organization',
  });

  const orgStatsQuery = useQuery<OrgStats>({
    queryKey: ['org-stats', orgId],
    queryFn: () => orgId ? fetchOrganizationStatsByOrgId(orgId) : Promise.resolve({ totalEvents: 0, totalVolunteers: 0, totalPhotos: 0, upcomingEvents: 0 }),
    enabled: !!orgId && role === 'organization',
  });

  const orgPhotosQuery = useQuery({
    queryKey: ['org-all-photos', orgId],
    queryFn: () => orgId ? fetchOrgAllPhotos(orgId) : Promise.resolve([]),
    enabled: !!orgId && role === 'organization',
  });

  const orgNewsQuery = useQuery<OrgNewsArticle[]>({
    queryKey: ['org-news', orgId],
    queryFn: () => orgId ? fetchOrgNewsArticles(orgId) : Promise.resolve([]),
    enabled: !!orgId && role === 'organization',
  });

  const orgNews = useMemo(() => orgNewsQuery.data ?? [], [orgNewsQuery.data]);
  const _orgPhotos = useMemo(() => orgPhotosQuery.data ?? [], [orgPhotosQuery.data]);

  const _eventPhotos = useMemo(() => eventPhotosQuery.data ?? [], [eventPhotosQuery.data]);
  const rawEvents = useMemo(() => userEventsQuery.data ?? [], [userEventsQuery.data]);

  useEffect(() => {
    console.log('[ProfileScreen] Raw user events data:', JSON.stringify(rawEvents?.slice(0, 2), null, 2));
    console.log('[ProfileScreen] Total raw events:', rawEvents?.length);
  }, [rawEvents]);

  const myEvents = useMemo(() => {
    try {
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
      console.error('[ProfileScreen] Error processing events:', e);
      return [];
    }
  }, [rawEvents]);
  const _myPhotos = useMemo(() => userPhotosQuery.data ?? [], [userPhotosQuery.data]);
  const myRank = rankQuery.data ?? null;
  const orgFollowersCount = orgFollowersCountQuery.data ?? 0;
  const _orgVolunteers = useMemo(() => orgVolunteersQuery.data ?? [], [orgVolunteersQuery.data]);
  const rawFollowersCount = followersCountQuery.data ?? 0;
  const rawFollowingCount = followingCountQuery.data ?? 0;
  const followersCount = role === 'organization' ? orgFollowersCount : rawFollowersCount;
  const followingCount = role === 'organization' ? 0 : rawFollowingCount;
  const unreadCount = unreadQuery.data ?? 0;



  const [_showAllPastEvents, _setShowAllPastEvents] = useState<boolean>(false);
  const [showAllOrgPastEvents, setShowAllOrgPastEvents] = useState<boolean>(false);
  const pastEvents = useMemo(() => {
    const now = new Date().toISOString();
    return myEvents.filter((e: UserEventEntry) => e.events?.start_time < now);
  }, [myEvents]);

  const _visiblePastEvents = useMemo(() => {
    return _showAllPastEvents ? pastEvents : pastEvents.slice(0, 3);
  }, [pastEvents, _showAllPastEvents]);

  const _completedCount = useMemo(() => pastEvents.length, [pastEvents]);

  const handleEventPress = useCallback((eventId: string) => {
    console.log('[ProfileScreen] Navigating to event:', eventId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/event-detail', params: { id: eventId } });
  }, [router]);

  const _handlePhotoPress = useCallback((_photo: DbEventPhoto) => {
    console.log('[ProfileScreen] Photo pressed:', _photo.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setLightboxPhoto(_photo);
  }, []);

  useFocusEffect(
    useCallback(() => {
      console.log('[ProfileScreen] Tab focused, refetching events');
      if (userId) {
        void userEventsQuery.refetch();
        void followersCountQuery.refetch();
        void followingCountQuery.refetch();
        void unreadQuery.refetch();
        if (role === 'organization') {
          void orgEventsQuery.refetch();
          void orgStatsQuery.refetch();
          void orgPhotosQuery.refetch();
          void orgNewsQuery.refetch();
          void orgFollowersCountQuery.refetch();
          void orgVolunteersQuery.refetch();
        }
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, role])
  );

  const userEventsRefetch = userEventsQuery.refetch;
  const userPhotosRefetch = userPhotosQuery.refetch;
  const rankRefetch = rankQuery.refetch;
  const eventPhotosRefetch = eventPhotosQuery.refetch;
  const followersCountRefetch = followersCountQuery.refetch;
  const followingCountRefetch = followingCountQuery.refetch;
  const unreadRefetch = unreadQuery.refetch;
  const orgEventsRefetch = orgEventsQuery.refetch;
  const orgStatsRefetch = orgStatsQuery.refetch;
  const orgPhotosRefetch = orgPhotosQuery.refetch;
  const orgNewsRefetch = orgNewsQuery.refetch;
  const orgFollowersCountRefetch = orgFollowersCountQuery.refetch;
  const orgVolunteersRefetch = orgVolunteersQuery.refetch;

  const handleRefresh = useCallback(() => {
    console.log('[ProfileScreen] Refreshing profile data');
    void userEventsRefetch();
    void userPhotosRefetch();
    void rankRefetch();
    void eventPhotosRefetch();
    void followersCountRefetch();
    void followingCountRefetch();
    void unreadRefetch();
    if (role === 'organization') {
      void orgEventsRefetch();
      void orgStatsRefetch();
      void orgPhotosRefetch();
      void orgNewsRefetch();
      void orgFollowersCountRefetch();
      void orgVolunteersRefetch();
    }
  }, [userEventsRefetch, userPhotosRefetch, rankRefetch, eventPhotosRefetch, followersCountRefetch, followingCountRefetch, unreadRefetch, role, orgEventsRefetch, orgStatsRefetch, orgPhotosRefetch, orgNewsRefetch, orgFollowersCountRefetch, orgVolunteersRefetch]);

  const handleSettingsPress = useCallback(() => {
    console.log('[ProfileScreen] Opening settings');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push('/settings' as never);
  }, [router]);

  const handleNotificationsPress = useCallback(() => {
    console.log('[ProfileScreen] Opening notifications');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push('/notifications' as never);
  }, [router]);

  const handleShopPress = useCallback(() => {
    console.log('[ProfileScreen] Opening shop');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push('/shop' as never);
  }, [router]);

  const handleFollowersPress = useCallback(() => {
    console.log('[ProfileScreen] Opening followers');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/followers' as never, params: { tab: 'followers' } });
  }, [router]);

  const handleFollowingPress = useCallback(() => {
    console.log('[ProfileScreen] Opening following');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/followers' as never, params: { tab: 'following' } });
  }, [router]);

  const handleEventHistory = useCallback(() => {
    console.log('[ProfileScreen] Opening event history');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push('/event-history' as never);
  }, [router]);

  const isRefreshing = userEventsQuery.isRefetching || userPhotosQuery.isRefetching || rankQuery.isRefetching || eventPhotosQuery.isRefetching;
  const _isLoading = userEventsQuery.isLoading || userPhotosQuery.isLoading;

  if (!isAuthenticated || (!user && !adminUser)) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.emptyText}>Not signed in</Text>
        <Pressable onPress={() => router.replace('/welcome' as never)} style={styles.ctaButton}>
          <Text style={styles.ctaButtonText}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  const displayName = role === 'organization'
    ? organization?.name ?? 'Organization'
    : profile?.full_name ?? user?.email ?? adminUser?.email ?? 'Joy Dealer';

  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const isOrg = role === 'organization';
  const availablePoints = (profile?.total_points ?? 0) - (profile?.redeemed_points ?? 0);

  return (
    <View style={styles.screen} testID="profile-screen">
      <LinearGradient
        colors={isOrg ? ['#0F172A', '#1E293B', '#334155'] : ['#0F172A', '#1E293B', '#475569']}
        style={styles.headerGradient}
      />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <Image
            source={{ uri: JOY_DEALERS_LOGO_URL }}
            style={styles.topBarLogo}
            contentFit="contain"
          />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#fff" />
          }
        >
          <View style={styles.profileHeader}>
            <Pressable onPress={handleSettingsPress} testID="profile-avatar-settings-btn">
              {isOrg && resolveImageUrl(organization?.logo_url) ? (
                <Image source={{ uri: resolveImageUrl(organization?.logo_url)! }} style={styles.avatarImage} contentFit="cover" />
              ) : resolveImageUrl(profile?.avatar_url) ? (
                <Image source={{ uri: resolveImageUrl(profile?.avatar_url)! }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <View style={styles.avatarWrap}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
            </Pressable>
            <View style={styles.nameRow}>
              <Text style={styles.displayName}>{displayName}</Text>
              {(profile?.is_verified || organization?.is_verified) && (
                <CheckCircle color="#0A84FF" size={20} />
              )}
            </View>
            {profile?.username && (
              <Text style={styles.usernameText}>@{profile.username}</Text>
            )}

            <View style={styles.followRow}>
              <Pressable onPress={handleFollowersPress} style={styles.followStat}>
                <Text style={styles.followCount}>{followersCount}</Text>
                <Text style={styles.followLabel}>Followers</Text>
              </Pressable>
              <View style={styles.followDivider} />
              {isOrg ? (
                <View style={styles.followStat}>
                  <Text style={styles.followCount}>{orgStatsQuery.data?.totalVolunteers ?? 0}</Text>
                  <Text style={styles.followLabel}>Volunteers</Text>
                </View>
              ) : (
                <Pressable onPress={handleFollowingPress} style={styles.followStat}>
                  <Text style={styles.followCount}>{followingCount}</Text>
                  <Text style={styles.followLabel}>Following</Text>
                </Pressable>
              )}
            </View>


          </View>

          {!isOrg && profile && (
            <View style={styles.standaloneCardsContainer}>
              <StandaloneStatCard
                label="Rank"
                value={myRank ? `#${myRank}` : '--'}
                icon={TrendingUp}
                gradientColors={['#D97706', '#F59E0B', '#FBBF24']}
                subtitle={myRank ? `Ranked #${myRank} on leaderboard` : 'View leaderboard'}
                onPress={() => router.push('/(tabs)/leaderboard' as never)}
              />
              <StandaloneStatCard
                label="Points"
                value={String(availablePoints)}
                icon={Award}
                gradientColors={['#1D4ED8', '#2563EB', '#3B82F6']}
                subtitle={`${availablePoints} points available to redeem`}
                onPress={handleShopPress}
              />
              <StandaloneStatCard
                label="Events"
                value={String(pastEvents.length)}
                icon={CalendarIcon}
                gradientColors={['#047857', '#059669', '#10B981']}
                subtitle={`${pastEvents.length} event${pastEvents.length !== 1 ? 's' : ''} completed`}
                onPress={handleEventHistory}
              />
            </View>
          )}

          {!isOrg && profile && (
            <Pressable
              onPress={handleNotificationsPress}
              style={({ pressed }) => [styles.notificationsCard, pressed && styles.notificationsCardPressed]}
              testID="notifications-card"
              accessibilityRole="button"
              accessibilityLabel="Open notifications"
            >
              <View style={styles.notificationsCardInner} pointerEvents="none">
                <View style={styles.notificationsCardLeft}>
                  <View style={styles.notificationsBellWrap}>
                    <Bell color="#fff" size={22} />
                    {unreadCount > 0 && (
                      <View style={styles.notificationsCardBadge}>
                        <Text style={styles.notificationsCardBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.notificationsCardTextWrap}>
                    <Text style={styles.notificationsCardTitle}>Notifications</Text>
                    <Text style={styles.notificationsCardSubtitle}>
                      {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'You\'re all caught up'}
                    </Text>
                  </View>
                </View>
                <ChevronRight color="rgba(255,255,255,0.8)" size={22} />
              </View>
            </Pressable>
          )}

          {!isOrg && profile && (
            <Pressable
              onPress={() => {
                console.log('[ProfileScreen] Opening nominate');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                router.push('/nominate' as never);
              }}
              style={({ pressed }) => [styles.shopCard, pressed && { opacity: 0.92 }]}
            >
              <LinearGradient
                colors={['#F97316', '#EA580C', '#C2410C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.shopCardContent}>
                <View style={styles.shopCardLeft}>
                  <View style={styles.shopIconWrap}>
                    <Star color="#fff" size={22} />
                  </View>
                  <View>
                    <Text style={styles.shopCardTitle}>Nominate</Text>
                    <Text style={styles.shopCardSubtitle}>
                      Recognize a fellow volunteer
                    </Text>
                  </View>
                </View>
                <ChevronRight color="rgba(255,255,255,0.8)" size={22} />
              </View>
            </Pressable>
          )}

          {!isOrg && profile && (
            <Pressable
              onPress={() => {
                console.log('[ProfileScreen] Opening donate page');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                router.push('/donate' as never);
              }}
              style={({ pressed }) => [styles.leaderboardCard, pressed && { opacity: 0.92 }]}
            >
              <LinearGradient colors={['#0F172A', '#1E293B']} style={StyleSheet.absoluteFillObject} />
              <View style={styles.leaderboardContent}>
                <View style={styles.leaderboardLeft}>
                  <Heart color="#FF6B8A" size={22} />
                  <View>
                    <Text style={styles.leaderboardTitle}>Donate</Text>
                    <Text style={styles.leaderboardSubtitle}>
                      Support a cause you care about
                    </Text>
                  </View>
                </View>
                <ChevronRight color="rgba(255,255,255,0.8)" size={22} />
              </View>
            </Pressable>
          )}

          {isOrg && organization && (
            <View style={styles.orgContactRow}>
              <Pressable
                onPress={() => {
                  console.log('[ProfileScreen] Opening chat/contact');
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  router.push('/(tabs)/chat' as never);
                }}
                style={({ pressed }) => [styles.orgContactBtn, pressed && { opacity: 0.7, transform: [{ scale: 0.92 }] }]}
              >
                <View style={[styles.orgContactIconWrap, { backgroundColor: '#F1F5F9' }]}>
                  <MessageCircle color={joyTheme.navy} size={20} />
                </View>
                <Text style={styles.orgContactLabel}>Contact</Text>
              </Pressable>
              {organization.website && (
                <Pressable
                  onPress={() => {
                    console.log('[ProfileScreen] Opening website in-app');
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    const url = organization.website!.startsWith('http') ? organization.website! : `https://${organization.website!}`;
                    WebBrowser.openBrowserAsync(url).catch(() => {});
                  }}
                  style={({ pressed }) => [styles.orgContactBtn, pressed && { opacity: 0.7, transform: [{ scale: 0.92 }] }]}
                >
                  <View style={[styles.orgContactIconWrap, { backgroundColor: '#F0FDF4' }]}>
                    <Globe color="#059669" size={20} />
                  </View>
                  <Text style={styles.orgContactLabel}>Website</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => {
                  console.log('[ProfileScreen] Opening donate page');
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  router.push('/donate' as never);
                }}
                style={({ pressed }) => [styles.orgContactBtn, pressed && { opacity: 0.7, transform: [{ scale: 0.92 }] }]}
              >
                <View style={[styles.orgContactIconWrap, { backgroundColor: '#FFF1F2' }]}>
                  <Heart color="#E11D48" size={20} />
                </View>
                <Text style={styles.orgContactLabel}>Donate</Text>
              </Pressable>
            </View>
          )}

          {isOrg && organization?.description && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Mission Statement</Text>
              <Text style={styles.aboutText}>{organization.description}</Text>
            </View>
          )}



          {isOrg && (() => {
            const orgUpcoming = (orgEventsQuery.data ?? []).filter((e: DbEvent) => new Date(e.start_time) >= new Date());
            return (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.historySectionTitleRow}>
                    <View style={[styles.sectionIconWrap, { backgroundColor: joyTheme.warmSoft }]}>
                      <CalendarIcon color={joyTheme.warm} size={18} />
                    </View>
                    <Text style={styles.historySectionTitle}>Upcoming Events</Text>
                  </View>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{orgUpcoming.length}</Text>
                  </View>
                </View>

                {orgEventsQuery.isLoading && (
                  <View style={styles.loadingWrap}>
                    <ActivityIndicator color={joyTheme.primary} size="small" />
                  </View>
                )}

                {!orgEventsQuery.isLoading && orgUpcoming.length === 0 && (
                  <View style={styles.emptySectionInline}>
                    <CalendarIcon color={joyTheme.textMuted} size={28} />
                    <Text style={styles.emptySectionTitle}>No upcoming events</Text>
                    <Text style={styles.emptySectionText}>Create an event to get started.</Text>
                  </View>
                )}

                {orgUpcoming.map((event: DbEvent) => (
                  <View key={event.id} style={styles.eventCardInSection}>
                    <Pressable style={styles.upcomingEventMain} onPress={() => handleEventPress(event.id)}>
                      <Image source={{ uri: getEventImageUri(event) }} style={styles.upcomingEventImage} contentFit="cover" />
                      <View style={styles.upcomingEventInfo}>
                        <Text style={styles.upcomingEventTitle} numberOfLines={1}>{event.title}</Text>
                        <View style={styles.upcomingEventMetaRow}>
                          <Clock color={joyTheme.textMuted} size={13} />
                          <Text style={styles.upcomingEventMeta}>
                            {formatEventDate(event.start_time)} · {formatEventTime(event.start_time)}
                          </Text>
                        </View>
                        {(event.venue || event.city) && (
                          <View style={styles.upcomingEventMetaRow}>
                            <MapPin color={joyTheme.primary} size={13} />
                            <Text style={styles.upcomingEventLocation} numberOfLines={1}>
                              {event.venue ?? event.city}
                            </Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
                    <Pressable
                      onPress={() => addToNativeCalendar(event)}
                      style={({ pressed }) => [
                        styles.addToCalendarBtnInline,
                        pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
                      ]}
                      hitSlop={8}
                    >
                      <CalendarPlus color={joyTheme.primary} size={18} />
                      <Text style={styles.addToCalendarText}>Add to Calendar</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            );
          })()}

          {isOrg && (
            <View style={styles.sectionCard}>
              <View style={styles.newsSectionHeader}>
                <View style={styles.newsTitleRow}>
                  <Newspaper color="#FF8C42" size={18} />
                  <Text style={styles.sectionTitle}>In the News</Text>
                </View>
                {orgNews.length > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{orgNews.length}</Text>
                  </View>
                )}
              </View>
              {orgNews.length > 0 ? (
                <View style={styles.newsArticlesList}>
                  {orgNews.map((article: OrgNewsArticle) => (
                    <Pressable
                      key={article.id}
                      style={({ pressed }) => [styles.newsArticleCard, pressed && { opacity: 0.8 }]}
                      onPress={() => {
                        console.log('[ProfileScreen] Opening news article:', article.url);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        const url = article.url.startsWith('http') ? article.url : `https://${article.url}`;
                        WebBrowser.openBrowserAsync(url).catch(() => {});
                      }}
                    >
                      <View style={styles.newsArticleIcon}>
                        <Globe color="#FF8C42" size={16} />
                      </View>
                      <View style={styles.newsArticleContent}>
                        <Text style={styles.newsArticleTitle} numberOfLines={2}>{article.title}</Text>
                        {article.source && (
                          <Text style={styles.newsArticleSource}>{article.source}</Text>
                        )}
                        {article.published_at && (
                          <Text style={styles.newsArticleDate}>
                            {new Date(article.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </Text>
                        )}
                      </View>
                      <ChevronRight color={joyTheme.textMuted} size={16} />
                    </Pressable>
                  ))}
                </View>
              ) : organization?.website ? (
                <Pressable
                  style={({ pressed }) => [styles.newsWebsiteLink, pressed && { opacity: 0.8 }]}
                  onPress={() => {
                    console.log('[ProfileScreen] Opening org website for news');
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    const url = organization.website!.startsWith('http') ? organization.website! : `https://${organization.website!}`;
                    WebBrowser.openBrowserAsync(url).catch(() => {});
                  }}
                >
                  <View style={styles.newsArticleIcon}>
                    <Globe color="#FF8C42" size={16} />
                  </View>
                  <View style={styles.newsArticleContent}>
                    <Text style={styles.newsArticleTitle}>Visit our website for latest news</Text>
                    <Text style={styles.newsArticleSource}>{organization.website}</Text>
                  </View>
                  <ChevronRight color={joyTheme.textMuted} size={16} />
                </Pressable>
              ) : (
                <View style={styles.newsEmptyState}>
                  <Newspaper color={joyTheme.textMuted} size={28} />
                  <Text style={styles.newsEmptyTitle}>No press coverage yet</Text>
                  <Text style={styles.newsEmptyText}>News articles and media mentions will appear here.</Text>
                </View>
              )}
            </View>
          )}

          {isOrg && (() => {
            const orgPast = (orgEventsQuery.data ?? []).filter((e: DbEvent) => new Date(e.start_time) < new Date());
            const visibleOrgPast = showAllOrgPastEvents ? orgPast : orgPast.slice(0, 3);
            return (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.historySectionTitleRow}>
                    <View style={[styles.sectionIconWrap, { backgroundColor: '#F0FDF4' }]}>
                      <CheckCircle color="#059669" size={18} />
                    </View>
                    <Text style={styles.historySectionTitle}>Past Events</Text>
                  </View>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{orgPast.length}</Text>
                  </View>
                </View>

                {!orgEventsQuery.isLoading && orgPast.length === 0 && (
                  <View style={styles.emptySectionInline}>
                    <CalendarIcon color={joyTheme.textMuted} size={28} />
                    <Text style={styles.emptySectionTitle}>No past events</Text>
                    <Text style={styles.emptySectionText}>Completed events will appear here.</Text>
                  </View>
                )}

                {visibleOrgPast.map((event: DbEvent) => (
                  <Pressable key={event.id} style={styles.orgEventMain} onPress={() => handleEventPress(event.id)}>
                    <Image source={{ uri: getEventImageUri(event) }} style={styles.eventThumb} contentFit="cover" />
                    <View style={styles.eventRowText}>
                      <Text style={styles.eventRowTitle} numberOfLines={1}>{event.title}</Text>
                      <Text style={styles.eventRowMeta}>{formatEventDate(event.start_time)}</Text>
                      <Text style={styles.eventRowLocation} numberOfLines={1}>
                        {event.venue ?? event.city ?? 'TBD'}
                      </Text>
                    </View>
                    <View style={[styles.statusDot, styles.statusCheckedIn]} />
                  </Pressable>
                ))}

                {orgPast.length > 3 && (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setShowAllOrgPastEvents(!showAllOrgPastEvents);
                    }}
                    style={({ pressed }) => [styles.showMoreBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.showMoreText}>
                      {showAllOrgPastEvents ? 'Show Less' : `Show More (${orgPast.length - 3} more)`}
                    </Text>
                    <ChevronRight color={joyTheme.warm} size={16} style={showAllOrgPastEvents ? { transform: [{ rotate: '-90deg' }] } : { transform: [{ rotate: '90deg' }] }} />
                  </Pressable>
                )}
              </View>
            );
          })()}









          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={!!lightboxPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxPhoto(null)}
      >
        <Pressable style={styles.lightbox} onPress={() => setLightboxPhoto(null)}>
          <View style={styles.lightboxClose}>
            <Text style={styles.lightboxCloseText}>Close</Text>
          </View>
          {lightboxPhoto && (
            <Image
              source={{ uri: resolveImageUrl(lightboxPhoto.photo_url) ?? lightboxPhoto.photo_url }}
              style={styles.lightboxImage}
              contentFit="contain"
            />
          )}
          {lightboxPhoto?.caption && (
            <View style={styles.lightboxCaptionWrap}>
              <Text style={styles.lightboxCaptionText}>{lightboxPhoto.caption}</Text>
            </View>
          )}
        </Pressable>
      </Modal>
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
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: joyTheme.textMuted,
  },
  ctaButton: {
    backgroundColor: joyTheme.gold,
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  ctaButtonText: {
    color: '#1A1A2E',
    fontSize: 15,
    fontWeight: '800' as const,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 380,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  topBarLogo: {
    width: 110,
    height: 36,
    tintColor: 'rgba(255,255,255,0.85)',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topBarButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  notifBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 120,
    gap: 14,
  },
  profileHeader: {
    alignItems: 'center',
    gap: 10,
    paddingBottom: 8,
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 34,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: {
    fontSize: 34,
    fontWeight: '900' as const,
    color: '#FFFFFF',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
  displayName: {
    fontSize: 28,
    fontWeight: '900' as const,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  usernameText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.7)',
  },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 0,
    marginTop: 4,
  },
  followStat: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  followCount: {
    fontSize: 20,
    fontWeight: '900' as const,
    color: '#FFFFFF',
  },
  followLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  followDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },

  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,176,32,0.18)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  rankBadgeText: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: '#FFB020',
  },
  standaloneCardsContainer: {
    gap: 10,
  },
  actionCard: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  actionCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionCardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCardValueBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 10,
    minWidth: 24,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  actionCardValueBadgeText: {
    fontSize: 11,
    fontWeight: '900' as const,
    color: '#FFFFFF',
  },
  actionCardTextWrap: {
    flex: 1,
  },
  actionCardTitle: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  actionCardSubtitle: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: joyTheme.border,
    shadowColor: joyTheme.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900' as const,
    color: joyTheme.text,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: joyTheme.textMuted,
  },
  shopCard: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: 20,
  },
  shopCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shopCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  shopIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopCardTitle: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  shopCardSubtitle: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  leaderboardCard: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: 20,
  },
  leaderboardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  leaderboardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  leaderboardTitle: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  leaderboardSubtitle: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  leaderboardRankCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,216,77,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFD84D',
  },
  leaderboardRankText: {
    fontSize: 18,
    fontWeight: '900' as const,
    color: '#FFD84D',
  },
  orgContactRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 4,
  },
  orgContactBtn: {
    alignItems: 'center',
    gap: 6,
  },
  orgContactIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  orgContactLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.85)',
  },
  newsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  newsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newsEmptyState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  newsEmptyTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: joyTheme.text,
  },
  newsEmptyText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: joyTheme.textMuted,
    textAlign: 'center',
  },
  newsArticlesList: {
    gap: 10,
  },
  newsArticleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: joyTheme.backgroundAlt,
    borderRadius: 14,
    padding: 12,
  },
  newsArticleIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newsArticleContent: {
    flex: 1,
    gap: 2,
  },
  newsArticleTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: joyTheme.text,
    lineHeight: 19,
  },
  newsArticleSource: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: joyTheme.navy,
  },
  newsArticleDate: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: joyTheme.textMuted,
  },
  newsWebsiteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: joyTheme.backgroundAlt,
    borderRadius: 14,
    padding: 12,
  },
  orgPhotoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  orgPhotoCell: {
    width: ORG_PHOTO_SIZE,
    height: ORG_PHOTO_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: joyTheme.backgroundAlt,
  },
  orgPhotoImage: {
    width: '100%',
    height: '100%',
  },
  viewAllPhotosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: joyTheme.border,
    marginTop: 8,
  },
  viewAllPhotosText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: joyTheme.navy,
  },
  historySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: -4,
  },
  historySectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historySectionTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: joyTheme.text,
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: joyTheme.border,
    shadowColor: joyTheme.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: joyTheme.text,
  },
  countBadge: {
    backgroundColor: joyTheme.goldSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countBadgeText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: joyTheme.gold,
  },
  aboutText: {
    fontSize: 15,
    lineHeight: 22,
    color: joyTheme.textMuted,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  orgEventRow: {
    gap: 0,
  },
  orgEventMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  orgCalendarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 4,
  },
  upcomingEventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: joyTheme.border,
    shadowColor: joyTheme.shadow,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  upcomingEventMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  upcomingEventImage: {
    width: 60,
    height: 60,
    borderRadius: 14,
  },
  upcomingEventInfo: {
    flex: 1,
    gap: 4,
  },
  upcomingEventTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: joyTheme.text,
  },
  upcomingEventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  upcomingEventMeta: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: joyTheme.textMuted,
  },
  upcomingEventLocation: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: joyTheme.navy,
    flex: 1,
  },
  addToCalendarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: joyTheme.border,
    backgroundColor: '#F0F5FF',
  },
  addToCalendarBtnInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: joyTheme.border,
    backgroundColor: '#F0F5FF',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  eventCardInSection: {
    backgroundColor: joyTheme.backgroundAlt,
    borderRadius: 16,
    overflow: 'hidden',
  },
  emptySectionInline: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: joyTheme.border,
    marginTop: 4,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: joyTheme.gold,
  },
  addToCalendarText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: joyTheme.navy,
  },
  eventThumb: {
    width: 56,
    height: 56,
    borderRadius: 16,
  },
  eventRowText: {
    flex: 1,
    gap: 3,
  },
  eventRowTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: joyTheme.text,
  },
  eventRowMeta: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: joyTheme.textMuted,
  },
  eventRowLocation: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: joyTheme.navy,
  },
  eventDivider: {
    height: 1,
    backgroundColor: joyTheme.border,
    marginVertical: 4,
  },
  eventRowRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  hoursLoggedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hoursLoggedText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: joyTheme.success,
  },
  pointsText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: joyTheme.navy,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusUpcoming: {
    backgroundColor: joyTheme.primary,
  },
  statusCheckedIn: {
    backgroundColor: joyTheme.success,
  },
  fullPhotoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  fullPhotoCell: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: joyTheme.backgroundAlt,
  },
  fullPhotoImage: {
    width: '100%',
    height: '100%',
  },
  loadingWrap: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptySection: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  emptySectionTitle: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: joyTheme.text,
  },
  emptySectionText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: joyTheme.textMuted,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  photoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: joyTheme.border,
    shadowColor: joyTheme.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    gap: 14,
  },
  photoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photoCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  photoCardTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: joyTheme.text,
  },
  photoTabBar: {
    flexDirection: 'row',
    backgroundColor: '#F2F3F5',
    borderRadius: 14,
    padding: 4,
    position: 'relative' as const,
  },
  photoTabIndicator: {
    position: 'absolute' as const,
    top: 4,
    left: 4,
    width: PHOTO_TAB_WIDTH,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  photoTabBtn: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    height: 36,
    borderRadius: 11,
    zIndex: 1,
  },
  photoTabText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: joyTheme.textMuted,
  },
  photoTabTextActive: {
    color: joyTheme.text,
  },
  photoEmptyState: {
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 30,
  },
  photoEmptyTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: joyTheme.text,
  },
  photoEmptyText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: joyTheme.textMuted,
    textAlign: 'center' as const,
  },
  upcomingHeroCard: {
    borderRadius: 18,
    overflow: 'hidden' as const,
    height: 180,
    position: 'relative' as const,
  },
  upcomingHeroImage: {
    width: '100%',
    height: '100%',
    position: 'absolute' as const,
    top: 0,
    left: 0,
  },
  upcomingHeroOverlay: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%',
  },
  upcomingHeroContent: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    gap: 4,
  },
  upcomingHeroTitle: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  upcomingHeroMetaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  upcomingHeroMeta: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.9)',
  },
  upcomingHeroLocation: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.9)',
    flex: 1,
  },
  upcomingHeroCalBtn: {
    position: 'absolute' as const,
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  bottomSpacer: {
    height: 24,
  },
  lightbox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  lightboxCloseText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  lightboxImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  lightboxCaptionWrap: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  lightboxCaptionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  notificationsCard: {
    borderRadius: 20,
    overflow: 'hidden' as const,
    backgroundColor: '#0F172A',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    cursor: 'pointer' as never,
  },
  notificationsCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  notificationsCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  notificationsCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  notificationsBellWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(225,29,72,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationsCardBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#E11D48',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  notificationsCardBadgeText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  notificationsCardTextWrap: {
    flex: 1,
  },
  notificationsCardTitle: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  notificationsCardSubtitle: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
});
