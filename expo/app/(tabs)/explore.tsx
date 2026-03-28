import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Building2,
  Calendar,
  ChevronRight,
  Clock,
  Heart,
  MapPin,
  Play,
  Search,
  Sparkles,
  Star,
  Trophy,
  Video,
  Zap,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JOY_SMILEY, JOY_DEALERS_LOGO_URL } from '@/constants/branding';
import { joyTheme } from '@/constants/joyTheme';
import { resolveImageUrl } from '@/lib/imageUtils';
import { useAuth } from '@/providers/AuthProvider';
import {
  fetchUpcomingEvents,
  fetchAllOrganizations,
  fetchClientPartners,
  fetchImpactNumbers,
  fetchPastEventsWithRecaps,
  fetchUnreadNotificationCount,
  fetchDealtJoyVideos,
} from '@/lib/api';
import type { DbDealtJoyVideo } from '@/types/database';
import type { DbClientPartner } from '@/types/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ORG_CARD_WIDTH = SCREEN_WIDTH * 0.42;
const EVENT_CARD_WIDTH = SCREEN_WIDTH * 0.75;
const VIDEO_CARD_WIDTH = SCREEN_WIDTH * 0.68;

function formatEventDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatEventTime(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function ExploreScreen() {
  const router = useRouter();
  const { profile, user, adminUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState<string>('');

  const smileyRotate = useRef(new Animated.Value(0)).current;
  const heroFade = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroFade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(heroSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(smileyRotate, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(smileyRotate, { toValue: 0, duration: 3000, useNativeDriver: true }),
      ])
    ).start();
  }, [heroFade, heroSlide, smileyRotate]);

  const smileyRotateInterp = smileyRotate.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-4deg', '4deg', '-4deg'],
  });

  const userId = user?.id ?? adminUser?.id ?? '';

  const eventsQuery = useQuery({
    queryKey: ['upcoming-events'],
    queryFn: fetchUpcomingEvents,
  });

  const orgsQuery = useQuery({
    queryKey: ['all-organizations'],
    queryFn: fetchAllOrganizations,
  });

  const partnersQuery = useQuery({
    queryKey: ['client-partners'],
    queryFn: fetchClientPartners,
  });

  const impactQuery = useQuery({
    queryKey: ['impact-numbers'],
    queryFn: fetchImpactNumbers,
  });

  const recapsQuery = useQuery({
    queryKey: ['past-events-recaps'],
    queryFn: fetchPastEventsWithRecaps,
  });

  const dealtJoyQuery = useQuery({
    queryKey: ['dealt-joy-videos'],
    queryFn: fetchDealtJoyVideos,
  });

  const unreadQuery = useQuery({
    queryKey: ['unread-notifications', userId],
    queryFn: () => fetchUnreadNotificationCount(userId),
    enabled: !!userId,
  });

  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const orgs = useMemo(() => orgsQuery.data ?? [], [orgsQuery.data]);
  const partners = useMemo(() => partnersQuery.data ?? [], [partnersQuery.data]);
  const impact = impactQuery.data;
  const recaps = useMemo(() => recapsQuery.data ?? [], [recapsQuery.data]);
  const dealtJoyVideos = useMemo(() => dealtJoyQuery.data ?? [], [dealtJoyQuery.data]);

  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return events;
    const q = searchQuery.toLowerCase();
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.city?.toLowerCase().includes(q) ||
        e.venue?.toLowerCase().includes(q) ||
        e.event_type?.toLowerCase().includes(q)
    );
  }, [events, searchQuery]);

  const filteredOrgs = useMemo(() => {
    if (!searchQuery.trim()) return orgs;
    const q = searchQuery.toLowerCase();
    return orgs.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.city?.toLowerCase().includes(q)
    );
  }, [orgs, searchQuery]);

  const isLoading = eventsQuery.isLoading && orgsQuery.isLoading;
  const isRefreshing = eventsQuery.isRefetching || orgsQuery.isRefetching;

  const eventsRefetch = eventsQuery.refetch;
  const orgsRefetch = orgsQuery.refetch;
  const partnersRefetch = partnersQuery.refetch;
  const impactRefetch = impactQuery.refetch;
  const recapsRefetch = recapsQuery.refetch;
  const dealtJoyRefetch = dealtJoyQuery.refetch;
  const unreadRefetch = unreadQuery.refetch;

  const handleRefresh = useCallback(() => {
    console.log('[ExploreScreen] Refreshing');
    void eventsRefetch();
    void orgsRefetch();
    void partnersRefetch();
    void impactRefetch();
    void recapsRefetch();
    void dealtJoyRefetch();
    void unreadRefetch();
  }, [eventsRefetch, orgsRefetch, partnersRefetch, impactRefetch, recapsRefetch, dealtJoyRefetch, unreadRefetch]);

  const handleEventPress = useCallback((eventId: string) => {
    console.log('[ExploreScreen] Event pressed:', eventId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/event-detail', params: { id: eventId } });
  }, [router]);

  const handleOrgPress = useCallback((orgId: string) => {
    console.log('[ExploreScreen] Org pressed:', orgId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/org-profile', params: { id: orgId } });
  }, [router]);

  const handleVideoPress = useCallback((video: DbDealtJoyVideo) => {
    console.log('[ExploreScreen] Video pressed:', video.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/dealt-joy-player', params: { id: video.id, url: video.video_url, title: video.title } });
  }, [router]);

  const handlePartnerPress = useCallback((partner: DbClientPartner) => {
    console.log('[ExploreScreen] Partner pressed:', partner.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (partner.website) {
      const url = partner.website.startsWith('http') ? partner.website : `https://${partner.website}`;
      WebBrowser.openBrowserAsync(url).catch(() => {});
    } else {
      router.push({ pathname: '/client-detail', params: { id: partner.id } });
    }
  }, [router]);

  const firstName = profile?.full_name?.split(' ')[0] ?? '';

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.centered]} testID="explore-loading">
        <Animated.Image
          source={JOY_SMILEY}
          style={[styles.loadingSmiley, { transform: [{ rotate: smileyRotateInterp }] }]}
          resizeMode="contain"
        />
        <Text style={styles.loadingText}>Loading your joy...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen} testID="explore-screen">
      <LinearGradient
        colors={['#0D1117', '#141B2D', '#1A2640']}
        style={styles.headerGradient}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#E8A838" />
          }
        >
          <Animated.View style={[styles.heroSection, { opacity: heroFade, transform: [{ translateY: heroSlide }] }]}>
            <View style={styles.heroTopRow}>
              <Image
                source={{ uri: JOY_DEALERS_LOGO_URL }}
                style={styles.heroLogo}
                contentFit="contain"
              />

            </View>

            <View style={styles.heroContent}>
              <View style={styles.heroTextCol}>
                <Text style={styles.greetingText}>
                  {getGreeting()}{firstName ? ',' : ''}
                </Text>
                {firstName ? (
                  <Text style={styles.heroName}>{firstName}</Text>
                ) : null}
                <Text style={styles.heroTagline}>
                  Let's spread some joy today
                </Text>
              </View>
              <Animated.Image
                source={JOY_SMILEY}
                style={[styles.heroSmiley, { transform: [{ rotate: smileyRotateInterp }] }]}
                resizeMode="contain"
              />
            </View>
          </Animated.View>

          <View style={styles.searchContainer}>
            <Search color={joyTheme.textMuted} size={18} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search events, organizations..."
              placeholderTextColor={joyTheme.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              testID="explore-search"
            />
          </View>

          {!searchQuery && (
            <View style={styles.quickActions}>
              <Pressable
                style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  router.push('/(tabs)/events' as never);
                }}
              >
                <LinearGradient colors={['#E8A838', '#D4922A']} style={styles.quickActionGradient} />
                <Calendar color="#fff" size={20} />
                <Text style={styles.quickActionText}>Events</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  router.push('/(tabs)/leaderboard' as never);
                }}
              >
                <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.quickActionGradient} />
                <Trophy color="#fff" size={20} />
                <Text style={styles.quickActionText}>Rank</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  router.push('/shop' as never);
                }}
              >
                <LinearGradient colors={['#10B981', '#059669']} style={styles.quickActionGradient} />
                <Star color="#fff" size={20} />
                <Text style={styles.quickActionText}>Shop</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  router.push('/donate' as never);
                }}
              >
                <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.quickActionGradient} />
                <Heart color="#fff" size={20} />
                <Text style={styles.quickActionText}>Donate</Text>
              </Pressable>
            </View>
          )}

          {impact && !searchQuery && (
            <View style={styles.impactBanner}>
              <LinearGradient
                colors={['#1A1A2E', '#2D2D4A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.impactBannerInner}>
                <Image
                  source={JOY_SMILEY}
                  style={styles.impactSmiley}
                  contentFit="contain"
                  tintColor="rgba(232,168,56,0.15)"
                />
                <View style={styles.impactRow}>
                  <View style={styles.impactStat}>
                    <Text style={styles.impactValue}>{impact.totalVolunteers}+</Text>
                    <Text style={styles.impactLabel}>Joy Dealers</Text>
                  </View>
                  <View style={styles.impactDivider} />
                  <View style={styles.impactStat}>
                    <Text style={styles.impactValue}>{impact.totalEvents}+</Text>
                    <Text style={styles.impactLabel}>Events</Text>
                  </View>
                  <View style={styles.impactDivider} />
                  <View style={styles.impactStat}>
                    <Text style={styles.impactValue}>{impact.totalHours}+</Text>
                    <Text style={styles.impactLabel}>Hours</Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    router.push('/impact' as never);
                  }}
                  style={({ pressed }) => [styles.impactCta, pressed && { opacity: 0.8 }]}
                >
                  <Zap color={joyTheme.gold} size={14} />
                  <Text style={styles.impactCtaText}>View Full Impact</Text>
                </Pressable>
              </View>
            </View>
          )}

          {filteredEvents.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: joyTheme.warmSoft }]}>
                    <Calendar color={joyTheme.warm} size={16} />
                  </View>
                  <Text style={styles.sectionTitle}>Upcoming Events</Text>
                </View>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    router.push('/(tabs)/events' as never);
                  }}
                  style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.seeAllText}>See All</Text>
                </Pressable>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.eventHScroll}
                decelerationRate="fast"
                snapToInterval={EVENT_CARD_WIDTH + 12}
              >
                {filteredEvents.slice(0, 8).map((event) => (
                  <Pressable
                    key={event.id}
                    style={({ pressed }) => [styles.featuredEventCard, pressed && { opacity: 0.94, transform: [{ scale: 0.98 }] }]}
                    onPress={() => handleEventPress(event.id)}
                    testID={`explore-event-${event.id}`}
                  >
                    {resolveImageUrl(event.image_url) ? (
                      <Image source={{ uri: resolveImageUrl(event.image_url)! }} style={styles.featuredEventImage} contentFit="cover" />
                    ) : (
                      <View style={[styles.featuredEventImage, styles.featuredEventImagePlaceholder]}>
                        <Image source={JOY_SMILEY} style={styles.eventPlaceholderSmiley} contentFit="contain" tintColor={joyTheme.gold} />
                      </View>
                    )}
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.75)']}
                      style={styles.featuredEventOverlay}
                    />
                    <View style={styles.featuredEventInfo}>
                      {event.event_type && (
                        <View style={styles.eventTypeBadge}>
                          <Text style={styles.eventTypeText}>{event.event_type}</Text>
                        </View>
                      )}
                      <Text style={styles.featuredEventTitle} numberOfLines={2}>{event.title}</Text>
                      <View style={styles.featuredEventMeta}>
                        <Clock color="rgba(255,255,255,0.8)" size={12} />
                        <Text style={styles.featuredEventMetaText}>
                          {formatEventDate(event.start_time)} · {formatEventTime(event.start_time)}
                        </Text>
                      </View>
                      {(event.city || event.venue) && (
                        <View style={styles.featuredEventMeta}>
                          <MapPin color={joyTheme.gold} size={12} />
                          <Text style={styles.featuredEventLocation} numberOfLines={1}>
                            {event.venue ?? event.city}
                          </Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          {filteredOrgs.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: '#F0FDF4' }]}>
                    <Building2 color={joyTheme.success} size={16} />
                  </View>
                  <Text style={styles.sectionTitle}>Organizations</Text>
                </View>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{filteredOrgs.length}</Text>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.orgScroll}
              >
                {filteredOrgs.slice(0, 10).map((org) => (
                  <Pressable
                    key={org.id}
                    style={({ pressed }) => [styles.orgCard, pressed && { opacity: 0.92, transform: [{ scale: 0.97 }] }]}
                    onPress={() => handleOrgPress(org.id)}
                    testID={`explore-org-${org.id}`}
                  >
                    {resolveImageUrl(org.logo_url) ? (
                      <Image source={{ uri: resolveImageUrl(org.logo_url)! }} style={styles.orgAvatar} contentFit="cover" />
                    ) : (
                      <View style={[styles.orgAvatar, styles.orgAvatarPlaceholder]}>
                        <Building2 color={joyTheme.primary} size={24} />
                      </View>
                    )}
                    <Text style={styles.orgName} numberOfLines={2}>{org.name}</Text>
                    {org.city && (
                      <Text style={styles.orgCity} numberOfLines={1}>
                        {org.city}{org.state ? `, ${org.state}` : ''}
                      </Text>
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          {dealtJoyVideos.length > 0 && !searchQuery && (
            <>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: '#1A1A2E' }]}>
                    <Video color={joyTheme.gold} size={16} />
                  </View>
                  <Text style={styles.sectionTitle}>Dealt Joy</Text>
                </View>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    if (dealtJoyVideos.length > 0) {
                      router.push({ pathname: '/dealt-joy-player', params: { id: dealtJoyVideos[0].id, url: dealtJoyVideos[0].video_url, title: dealtJoyVideos[0].title } });
                    }
                  }}
                  style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.seeAllText}>See All</Text>
                </Pressable>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dealtJoyScroll}
                decelerationRate="fast"
                snapToInterval={VIDEO_CARD_WIDTH + 12}
              >
                {dealtJoyVideos.slice(0, 6).map((video) => (
                  <Pressable
                    key={video.id}
                    style={({ pressed }) => [styles.videoCard, pressed && { opacity: 0.94, transform: [{ scale: 0.98 }] }]}
                    onPress={() => handleVideoPress(video)}
                    testID={`dealt-joy-video-${video.id}`}
                  >
                    {resolveImageUrl(video.thumbnail_url) ? (
                      <Image source={{ uri: resolveImageUrl(video.thumbnail_url)! }} style={styles.videoCardThumb} contentFit="cover" />
                    ) : (
                      <View style={[styles.videoCardThumb, styles.videoCardThumbPlaceholder]}>
                        <Image source={JOY_SMILEY} style={styles.videoPlaceholderSmiley} contentFit="contain" tintColor={joyTheme.gold} />
                      </View>
                    )}
                    <View style={styles.videoCardOverlay} />
                    <View style={styles.videoPlayIcon}>
                      <Play color="#fff" size={22} fill="#fff" />
                    </View>
                    {video.is_featured && (
                      <View style={styles.videoFeaturedBadge}>
                        <Sparkles color="#E8A838" size={10} />
                      </View>
                    )}
                    <View style={styles.videoCardInfo}>
                      <Text style={styles.videoCardTitle} numberOfLines={2}>{video.title}</Text>
                      {video.summary && (
                        <Text style={styles.videoCardSummary} numberOfLines={1}>{video.summary}</Text>
                      )}
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          {recaps.length > 0 && !searchQuery && (
            <>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: '#FFF7ED' }]}>
                    <Sparkles color="#F97316" size={16} />
                  </View>
                  <Text style={styles.sectionTitle}>Recent Recaps</Text>
                </View>
              </View>

              {recaps.slice(0, 3).map((event) => (
                <Pressable
                  key={event.id}
                  style={({ pressed }) => [styles.recapCard, pressed && { opacity: 0.92 }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    router.push({ pathname: '/event-recap', params: { id: event.id } });
                  }}
                >
                  {resolveImageUrl(event.image_url) ? (
                    <Image source={{ uri: resolveImageUrl(event.image_url)! }} style={styles.recapImage} contentFit="cover" />
                  ) : (
                    <View style={[styles.recapImage, styles.recapImagePlaceholder]}>
                      <Image source={JOY_SMILEY} style={styles.recapPlaceholderSmiley} contentFit="contain" tintColor={joyTheme.gold} />
                    </View>
                  )}
                  <View style={styles.recapInfo}>
                    <Text style={styles.recapTitle} numberOfLines={1}>{event.title}</Text>
                    <Text style={styles.recapDate}>{formatEventDate(event.start_time)}</Text>
                  </View>
                  <ChevronRight color={joyTheme.textMuted} size={18} />
                </Pressable>
              ))}
            </>
          )}

          {partners.length > 0 && !searchQuery && (
            <>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: joyTheme.warmSoft }]}>
                    <Sparkles color={joyTheme.warm} size={16} />
                  </View>
                  <Text style={styles.sectionTitle}>Athletes & Foundations</Text>
                </View>
              </View>

              {partners.slice(0, 4).map((partner) => {
                const imageUri = resolveImageUrl(partner.image_url) ?? resolveImageUrl(partner.logo_url);
                const initials = partner.initials ?? partner.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <Pressable
                    key={partner.id}
                    style={({ pressed }) => [styles.partnerCard, pressed && { opacity: 0.92 }]}
                    onPress={() => handlePartnerPress(partner)}
                    testID={`explore-partner-${partner.id}`}
                  >
                    {imageUri ? (
                      <Image source={{ uri: imageUri }} style={styles.partnerAvatar} contentFit="cover" />
                    ) : (
                      <View style={[styles.partnerAvatar, styles.partnerAvatarPlaceholder, partner.color ? { backgroundColor: partner.color + '20' } : null]}>
                        <Text style={[styles.partnerInitials, partner.color ? { color: partner.color } : null]}>{initials}</Text>
                      </View>
                    )}
                    <View style={styles.partnerInfo}>
                      <Text style={styles.partnerName} numberOfLines={1}>{partner.name}</Text>
                      {partner.foundation && <Text style={styles.partnerFoundation} numberOfLines={1}>{partner.foundation}</Text>}
                      {partner.team && <Text style={styles.partnerTeam} numberOfLines={1}>{partner.team} · {partner.sport}</Text>}
                    </View>
                    <ChevronRight color={joyTheme.textMuted} size={18} />
                  </Pressable>
                );
              })}

              {partners.length > 4 && (
                <Pressable
                  style={({ pressed }) => [styles.viewAllBtn, pressed && { opacity: 0.9 }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    router.push('/partners' as never);
                  }}
                >
                  <Text style={styles.viewAllBtnText}>View all partners</Text>
                  <ArrowRight color="#fff" size={16} />
                </Pressable>
              )}
            </>
          )}

          {filteredEvents.length === 0 && filteredOrgs.length === 0 && searchQuery && (
            <View style={styles.emptyState}>
              <Image source={JOY_SMILEY} style={styles.emptySmiley} contentFit="contain" tintColor={joyTheme.textMuted} />
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text style={styles.emptySubtitle}>Try a different search term</Text>
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
    gap: 16,
  },
  loadingSmiley: {
    width: 64,
    height: 64,
    tintColor: joyTheme.gold,
  },
  loadingText: {
    color: joyTheme.textMuted,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 340,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
    gap: 16,
  },
  heroSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLogo: {
    width: 120,
    height: 40,
    tintColor: 'rgba(255,255,255,0.9)',
  },
  notifButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#0D1117',
  },
  notifBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: '#fff',
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTextCol: {
    flex: 1,
    gap: 2,
  },
  greetingText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.65)',
  },
  heroName: {
    fontSize: 32,
    fontWeight: '900' as const,
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  heroTagline: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: joyTheme.gold,
    marginTop: 4,
  },
  heroSmiley: {
    width: 80,
    height: 80,
    tintColor: joyTheme.gold,
    marginLeft: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500' as const,
    color: joyTheme.text,
    padding: 0,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    borderRadius: 18,
    overflow: 'hidden',
  },
  quickActionPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
  quickActionGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  quickActionText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.3,
  },
  impactBanner: {
    marginHorizontal: 20,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  impactBannerInner: {
    padding: 20,
    gap: 16,
  },
  impactSmiley: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 120,
    height: 120,
    opacity: 0.6,
  },
  impactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  impactStat: {
    alignItems: 'center',
    gap: 4,
  },
  impactValue: {
    fontSize: 24,
    fontWeight: '900' as const,
    color: '#FFFFFF',
  },
  impactLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  impactDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  impactCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    backgroundColor: 'rgba(232,168,56,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(232,168,56,0.2)',
  },
  impactCtaText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: joyTheme.gold,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 4,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800' as const,
    color: joyTheme.text,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: joyTheme.gold,
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
  eventHScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  featuredEventCard: {
    width: EVENT_CARD_WIDTH,
    height: 200,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#1A1A2E',
  },
  featuredEventImage: {
    ...StyleSheet.absoluteFillObject,
  },
  featuredEventImagePlaceholder: {
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventPlaceholderSmiley: {
    width: 48,
    height: 48,
    opacity: 0.4,
  },
  featuredEventOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  featuredEventInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    gap: 6,
  },
  eventTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(232,168,56,0.9)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  eventTypeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#1A1A2E',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  featuredEventTitle: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  featuredEventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  featuredEventMetaText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.8)',
  },
  featuredEventLocation: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: joyTheme.gold,
    flex: 1,
  },
  orgScroll: {
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  orgCard: {
    width: ORG_CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  orgAvatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
  },
  orgAvatarPlaceholder: {
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgName: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: joyTheme.text,
    textAlign: 'center',
  },
  orgCity: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: joyTheme.textMuted,
    textAlign: 'center',
  },
  recapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  recapImage: {
    width: 56,
    height: 56,
    borderRadius: 16,
  },
  recapImagePlaceholder: {
    backgroundColor: joyTheme.warmSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recapPlaceholderSmiley: {
    width: 28,
    height: 28,
    opacity: 0.5,
  },
  recapInfo: {
    flex: 1,
    gap: 4,
  },
  recapTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: joyTheme.text,
  },
  recapDate: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: joyTheme.textMuted,
  },
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  partnerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
  },
  partnerAvatarPlaceholder: {
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerInitials: {
    fontSize: 18,
    fontWeight: '900' as const,
    color: joyTheme.navy,
  },
  partnerInfo: {
    flex: 1,
    gap: 2,
  },
  partnerName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: joyTheme.text,
  },
  partnerFoundation: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: joyTheme.navy,
  },
  partnerTeam: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: joyTheme.textMuted,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: joyTheme.navy,
    borderRadius: 14,
    marginHorizontal: 20,
  },
  viewAllBtnText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptySmiley: {
    width: 48,
    height: 48,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: joyTheme.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: joyTheme.textMuted,
  },
  bottomSpacer: {
    height: 24,
  },
  dealtJoyScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  videoCard: {
    width: VIDEO_CARD_WIDTH,
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1A1A2E',
  },
  videoCardThumb: {
    ...StyleSheet.absoluteFillObject,
  },
  videoCardThumbPlaceholder: {
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlaceholderSmiley: {
    width: 40,
    height: 40,
    opacity: 0.4,
  },
  videoCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  videoPlayIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -22,
    marginLeft: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(232,168,56,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  videoFeaturedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(26,26,46,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(232,168,56,0.3)',
  },
  videoCardInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    gap: 3,
  },
  videoCardTitle: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  videoCardSummary: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.65)',
  },
});
