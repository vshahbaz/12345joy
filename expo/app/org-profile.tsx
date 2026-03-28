import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Camera,
  ChevronRight,
  Clock,
  Globe,
  Heart,
  MapPin,
  MessageCircle,
  Phone,
  Shield,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
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
  fetchOrganizationById,
  fetchOrganizationEventsByOrgId,
  fetchOrganizationStatsByOrgId,
  fetchOrgFollowersCount,
  fetchFollowingOrgIds,
  followOrganization,
  unfollowOrganization,
} from '@/lib/api';
import type { DbEvent } from '@/types/database';
import { useRealtimeFollows } from '@/hooks/useRealtimeFollows';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function OrgProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const myId = user?.id ?? '';

  useRealtimeFollows(myId || undefined);

  const orgQuery = useQuery({
    queryKey: ['organization', id],
    queryFn: () => fetchOrganizationById(id ?? ''),
    enabled: !!id,
  });

  const eventsQuery = useQuery({
    queryKey: ['org-events', id],
    queryFn: () => fetchOrganizationEventsByOrgId(id ?? ''),
    enabled: !!id,
  });

  const statsQuery = useQuery({
    queryKey: ['org-stats', id],
    queryFn: () => fetchOrganizationStatsByOrgId(id ?? ''),
    enabled: !!id,
  });

  const followersCountQuery = useQuery({
    queryKey: ['org-followers-count', id],
    queryFn: () => fetchOrgFollowersCount(id ?? ''),
    enabled: !!id,
  });

  const followingOrgIdsQuery = useQuery({
    queryKey: ['following-org-ids', myId],
    queryFn: () => fetchFollowingOrgIds(myId),
    enabled: !!myId,
  });

  const org = orgQuery.data;
  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const stats = statsQuery.data;
  const followersCount = followersCountQuery.data ?? 0;

  const isFollowing = useMemo(() => {
    if (!org?.id) return false;
    return (followingOrgIdsQuery.data ?? []).includes(org.id);
  }, [followingOrgIdsQuery.data, org?.id]);

  const upcomingEvents = useMemo(() => {
    const now = new Date().toISOString();
    return events.filter((e) => e.start_time >= now);
  }, [events]);

  const pastEvents = useMemo(() => {
    const now = new Date().toISOString();
    return events.filter((e) => e.start_time < now);
  }, [events]);

  const PAST_EVENTS_LIMIT = 5;
  const [showAllPast, setShowAllPast] = useState<boolean>(false);
  const visiblePastEvents = useMemo(() => {
    if (showAllPast) return pastEvents;
    return pastEvents.slice(0, PAST_EVENTS_LIMIT);
  }, [pastEvents, showAllPast]);

  const followMutation = useMutation({
    mutationFn: () => followOrganization(myId, org?.id ?? ''),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['following-org-ids', myId] });
      const prev = queryClient.getQueryData<string[]>(['following-org-ids', myId]);
      queryClient.setQueryData<string[]>(['following-org-ids', myId], (old) => [
        ...(old ?? []),
        org?.id ?? '',
      ]);
      return { prev };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['following-org-ids', myId] });
      void queryClient.invalidateQueries({ queryKey: ['org-followers-count', id] });
      void queryClient.invalidateQueries({ queryKey: ['following-orgs', myId] });
      void queryClient.invalidateQueries({ queryKey: ['following-count', myId] });
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['following-org-ids', myId], context.prev);
      }
      Alert.alert('Error', 'Could not follow this organization.');
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: () => unfollowOrganization(myId, org?.id ?? ''),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['following-org-ids', myId] });
      const prev = queryClient.getQueryData<string[]>(['following-org-ids', myId]);
      queryClient.setQueryData<string[]>(['following-org-ids', myId], (old) =>
        (old ?? []).filter((oid) => oid !== org?.id)
      );
      return { prev };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['following-org-ids', myId] });
      void queryClient.invalidateQueries({ queryKey: ['org-followers-count', id] });
      void queryClient.invalidateQueries({ queryKey: ['following-orgs', myId] });
      void queryClient.invalidateQueries({ queryKey: ['following-count', myId] });
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['following-org-ids', myId], context.prev);
      }
      Alert.alert('Error', 'Could not unfollow this organization.');
    },
  });

  const handleToggleFollow = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (isFollowing) {
      unfollowMutation.mutate();
    } else {
      followMutation.mutate();
    }
  }, [isFollowing, followMutation, unfollowMutation]);

  const handleOpenWebsite = useCallback((url: string | null) => {
    if (!url) return;
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    console.log('[OrgProfile] Opening website in-app:', fullUrl);
    WebBrowser.openBrowserAsync(fullUrl).catch(() => {
      Alert.alert('Error', 'Could not open website.');
    });
  }, []);

  const orgRefetch = orgQuery.refetch;
  const eventsRefetch = eventsQuery.refetch;
  const statsRefetch = statsQuery.refetch;
  const followersCountRefetch = followersCountQuery.refetch;

  const handleRefresh = useCallback(() => {
    void orgRefetch();
    void eventsRefetch();
    void statsRefetch();
    void followersCountRefetch();
  }, [orgRefetch, eventsRefetch, statsRefetch, followersCountRefetch]);

  const handleEventPress = useCallback((eventId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/event-detail' as never, params: { id: eventId } });
  }, [router]);

  if (orgQuery.isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color={joyTheme.primary} />
        <Text style={styles.loadingText}>Loading organization...</Text>
      </View>
    );
  }

  if (!org) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Building2 color={joyTheme.textMuted} size={48} />
        <Text style={styles.loadingText}>Organization not found</Text>
        <Pressable onPress={() => router.back()} style={styles.goBackBtn}>
          <Text style={styles.goBackBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const renderEventCard = (event: DbEvent) => {
    const isPast = new Date(event.start_time) < new Date();
    return (
      <Pressable
        key={event.id}
        style={styles.eventCard}
        onPress={() => handleEventPress(event.id)}
        testID={`org-event-${event.id}`}
      >
        {resolveImageUrl(event.image_url) ? (
          <Image source={{ uri: resolveImageUrl(event.image_url)! }} style={styles.eventImage} contentFit="cover" />
        ) : (
          <View style={[styles.eventImage, styles.eventImagePlaceholder]}>
            <Calendar color={joyTheme.primary} size={20} />
          </View>
        )}
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
          <View style={styles.eventMeta}>
            <Clock color={joyTheme.textMuted} size={12} />
            <Text style={styles.eventMetaText}>
              {formatDate(event.start_time)} · {formatTime(event.start_time)}
            </Text>
          </View>
          {event.city && (
            <View style={styles.eventMeta}>
              <MapPin color={joyTheme.textMuted} size={12} />
              <Text style={styles.eventMetaText}>{event.city}{event.state ? `, ${event.state}` : ''}</Text>
            </View>
          )}
          {isPast && (
            <View style={styles.pastInlineBadge}>
              <Text style={styles.pastInlineBadgeText}>Past</Text>
            </View>
          )}
        </View>
        <ChevronRight color={joyTheme.textMuted} size={18} />
      </Pressable>
    );
  };

  return (
    <View style={styles.screen} testID="org-profile-screen">
      <LinearGradient colors={['#0E3C73', '#0865C2', '#0A84FF']} style={styles.headerGradient} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.back();
            }}
            style={styles.topBarBtn}
            hitSlop={12}
          >
            <ArrowLeft color="rgba(255,255,255,0.9)" size={22} />
          </Pressable>
          <Text style={styles.topBarTitle} numberOfLines={1}>{org.name}</Text>
          <View style={styles.topBarBtn} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={orgQuery.isRefetching || eventsQuery.isRefetching}
              onRefresh={handleRefresh}
              tintColor="#fff"
            />
          }
        >
          <View style={styles.profileHeader}>
            {resolveImageUrl(org.logo_url) ? (
              <Image source={{ uri: resolveImageUrl(org.logo_url)! }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Building2 color="#FFFFFF" size={40} />
              </View>
            )}

            <Text style={styles.orgName}>{org.name}</Text>

            {org.contact_email && (
              <Text style={styles.contactName}>{org.contact_email}</Text>
            )}

            {(org.city || org.state) && (
              <View style={styles.locationRow}>
                <MapPin color="rgba(255,255,255,0.7)" size={13} />
                <Text style={styles.locationText}>
                  {[org.city, org.state].filter(Boolean).join(', ')}
                </Text>
              </View>
            )}

            <View style={styles.followStatsRow}>
              <View style={styles.followStat}>
                <Text style={styles.followCount}>{followersCount}</Text>
                <Text style={styles.followLabel}>Followers</Text>
              </View>
              <View style={styles.followDivider} />
              <View style={styles.followStat}>
                <Text style={styles.followCount}>{stats?.totalEvents ?? 0}</Text>
                <Text style={styles.followLabel}>Events</Text>
              </View>
              <View style={styles.followDivider} />
              <View style={styles.followStat}>
                <Text style={styles.followCount}>{stats?.totalVolunteers ?? 0}</Text>
                <Text style={styles.followLabel}>Volunteers</Text>
              </View>
            </View>

            <View style={styles.badgeRow}>
              <View style={styles.orgBadge}>
                <Building2 color="#FFD84D" size={14} />
                <Text style={styles.orgBadgeText}>Organization</Text>
              </View>
              {org.is_verified && (
                <View style={styles.verifiedBadge}>
                  <Shield color={joyTheme.success} size={14} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              )}
            </View>

            {myId && (
              <Pressable
                onPress={handleToggleFollow}
                style={[styles.followButton, isFollowing && styles.followButtonActive]}
                disabled={followMutation.isPending || unfollowMutation.isPending}
              >
                {isFollowing ? (
                  <>
                    <UserMinus color={joyTheme.primaryDark} size={18} />
                    <Text style={styles.followButtonTextActive}>Following</Text>
                  </>
                ) : (
                  <>
                    <UserPlus color="#FFFFFF" size={18} />
                    <Text style={styles.followButtonText}>Follow</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Calendar color="#0A84FF" size={20} />
              <Text style={styles.statValue}>{stats?.totalEvents ?? 0}</Text>
              <Text style={styles.statLabel}>Events</Text>
            </View>
            <View style={styles.statCard}>
              <Users color="#2BB673" size={20} />
              <Text style={styles.statValue}>{stats?.totalVolunteers ?? 0}</Text>
              <Text style={styles.statLabel}>Volunteers</Text>
            </View>
            <View style={styles.statCard}>
              <Camera color="#E040FB" size={20} />
              <Text style={styles.statValue}>{stats?.totalPhotos ?? 0}</Text>
              <Text style={styles.statLabel}>Photos</Text>
            </View>
            <View style={styles.statCard}>
              <Calendar color="#FFB020" size={20} />
              <Text style={styles.statValue}>{stats?.upcomingEvents ?? 0}</Text>
              <Text style={styles.statLabel}>Upcoming</Text>
            </View>
          </View>

          {org.description && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.sectionText}>{org.description}</Text>
            </View>
          )}

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Contact</Text>
            <View style={styles.contactIconsRow}>
              <Pressable
                style={styles.contactIconBtn}
                onPress={() => {
                  console.log('[OrgProfile] Opening chat for org contact');
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  router.push('/(tabs)/chat' as never);
                }}
                testID="contact-message-btn"
              >
                <View style={[styles.contactIconCircle, { backgroundColor: '#EBF5FF' }]}>
                  <MessageCircle color="#0A84FF" size={20} />
                </View>
                <Text style={styles.contactIconLabel}>Contact</Text>
              </Pressable>
              {org.contact_phone && (
                <Pressable
                  style={styles.contactIconBtn}
                  onPress={() => Linking.openURL(`tel:${org.contact_phone}`).catch(() => {})}
                  testID="contact-phone-btn"
                >
                  <View style={[styles.contactIconCircle, { backgroundColor: '#E8F9EF' }]}>
                    <Phone color="#2BB673" size={20} />
                  </View>
                  <Text style={styles.contactIconLabel}>Call</Text>
                </Pressable>
              )}
              {org.website && (
                <Pressable
                  style={styles.contactIconBtn}
                  onPress={() => handleOpenWebsite(org.website)}
                  testID="contact-website-btn"
                >
                  <View style={[styles.contactIconCircle, { backgroundColor: '#FFF3E0' }]}>
                    <Globe color="#F57C00" size={20} />
                  </View>
                  <Text style={styles.contactIconLabel}>Website</Text>
                </Pressable>
              )}
              {(org.city || org.state) && (
                <Pressable
                  style={styles.contactIconBtn}
                  onPress={() => {
                    const query = encodeURIComponent([org.city, org.state].filter(Boolean).join(', '));
                    Linking.openURL(`https://maps.google.com/?q=${query}`).catch(() => {});
                  }}
                  testID="contact-address-btn"
                >
                  <View style={[styles.contactIconCircle, { backgroundColor: '#F3E8FF' }]}>
                    <MapPin color="#9C27B0" size={20} />
                  </View>
                  <Text style={styles.contactIconLabel}>Map</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.contactIconBtn}
                onPress={() => {
                  console.log('[OrgProfile] Opening donate for org:', id);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  router.push({ pathname: '/donate' as never, params: { partnerId: id } });
                }}
                testID="contact-donate-btn"
              >
                <View style={[styles.contactIconCircle, { backgroundColor: '#FFF0F0' }]}>
                  <Heart color="#FF3B5C" size={20} />
                </View>
                <Text style={styles.contactIconLabel}>Donate</Text>
              </Pressable>
              {!org.contact_email && !org.contact_phone && !org.website && !org.city && (
                <Text style={styles.noContactText}>No contact info available</Text>
              )}
            </View>
          </View>

          {upcomingEvents.length > 0 && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Upcoming Events</Text>
              {upcomingEvents.map(renderEventCard)}
            </View>
          )}

          {pastEvents.length > 0 && (
            <View style={styles.pastEventsSection}>
              <View style={styles.pastSectionHeader}>
                <Text style={styles.sectionTitle}>Past Events</Text>
                <View style={styles.pastCountBadge}>
                  <Text style={styles.pastCountText}>{pastEvents.length}</Text>
                </View>
              </View>
              {visiblePastEvents.map((event) => (
                <Pressable
                  key={event.id}
                  style={({ pressed }) => [styles.pastStandaloneCard, pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] }]}
                  onPress={() => handleEventPress(event.id)}
                  testID={`org-past-event-${event.id}`}
                >
                  {resolveImageUrl(event.image_url) ? (
                    <Image source={{ uri: resolveImageUrl(event.image_url)! }} style={styles.pastCoverImage} contentFit="cover" />
                  ) : (
                    <View style={[styles.pastCoverImage, styles.pastCoverPlaceholder]}>
                      <Calendar color="rgba(255,255,255,0.5)" size={28} />
                    </View>
                  )}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.7)']}
                    style={styles.pastCoverGradient}
                  />
                  <View style={styles.pastCardOverlay}>
                    <View style={styles.pastCompletedBadge}>
                      <Text style={styles.pastCompletedText}>Completed</Text>
                    </View>
                    <View style={styles.pastCardBottom}>
                      <Text style={styles.pastCardTitle} numberOfLines={2}>{event.title}</Text>
                      <View style={styles.pastCardMetaRow}>
                        <View style={styles.eventMeta}>
                          <Clock color="rgba(255,255,255,0.8)" size={12} />
                          <Text style={styles.pastCardMetaText}>
                            {formatDate(event.start_time)} · {formatTime(event.start_time)}
                          </Text>
                        </View>
                        {event.city && (
                          <View style={styles.eventMeta}>
                            <MapPin color="rgba(255,255,255,0.8)" size={12} />
                            <Text style={styles.pastCardMetaText}>
                              {event.city}{event.state ? `, ${event.state}` : ''}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  <View style={styles.pastCardFooter}>
                    <ChevronRight color={joyTheme.textMuted} size={16} />
                    <Text style={styles.pastCardFooterText}>View Details</Text>
                  </View>
                </Pressable>
              ))}
              {!showAllPast && pastEvents.length > PAST_EVENTS_LIMIT && (
                <Pressable
                  style={({ pressed }) => [styles.seeMoreBtn, pressed && { opacity: 0.8 }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setShowAllPast(true);
                  }}
                  testID="see-more-past-events"
                >
                  <Text style={styles.seeMoreText}>See All {pastEvents.length} Past Events</Text>
                  <ChevronRight color={joyTheme.primary} size={16} />
                </Pressable>
              )}
              {showAllPast && pastEvents.length > PAST_EVENTS_LIMIT && (
                <Pressable
                  style={({ pressed }) => [styles.seeMoreBtn, pressed && { opacity: 0.8 }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setShowAllPast(false);
                  }}
                  testID="see-less-past-events"
                >
                  <Text style={styles.seeMoreText}>Show Less</Text>
                </Pressable>
              )}
            </View>
          )}

          {events.length === 0 && !eventsQuery.isLoading && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Events</Text>
              <View style={styles.emptyEvents}>
                <Calendar color={joyTheme.textMuted} size={32} />
                <Text style={styles.emptyEventsText}>No events yet</Text>
              </View>
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
    marginTop: 8,
  },
  goBackBtn: {
    marginTop: 12,
    backgroundColor: joyTheme.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  goBackBtnText: {
    color: '#fff',
    fontFamily: fonts.bold,
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
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  topBarBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: '#fff',
    textAlign: 'center',
    marginHorizontal: 12,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 40,
    gap: 14,
  },
  profileHeader: {
    alignItems: 'center',
    gap: 10,
    paddingBottom: 8,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  orgName: {
    fontSize: 26,
    fontFamily: fonts.black,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  contactName: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: 'rgba(255,255,255,0.7)',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: 'rgba(255,255,255,0.7)',
  },
  followStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 4,
  },
  followStat: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  followCount: {
    fontSize: 18,
    fontFamily: fonts.black,
    color: '#FFFFFF',
  },
  followLabel: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
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
  orgBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  orgBadgeText: {
    fontSize: 13,
    fontFamily: fonts.extraBold,
    color: '#FFD84D',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(43,182,115,0.14)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  verifiedText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: joyTheme.success,
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: joyTheme.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 6,
  },
  followButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: joyTheme.primary,
  },
  followButtonText: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: '#FFFFFF',
  },
  followButtonTextActive: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: joyTheme.primaryDark,
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
  statValue: {
    fontSize: 20,
    fontFamily: fonts.black,
    color: joyTheme.text,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
  },
  sectionText: {
    fontSize: 15,
    lineHeight: 22,
    color: joyTheme.textMuted,
  },
  contactIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 4,
  },
  contactIconBtn: {
    alignItems: 'center',
    gap: 6,
  },
  contactIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactIconLabel: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
  },
  noContactText: {
    fontSize: 14,
    color: joyTheme.textMuted,
    fontStyle: 'italic',
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: joyTheme.backgroundAlt,
    borderRadius: 16,
    padding: 12,
  },
  eventImage: {
    width: 52,
    height: 52,
    borderRadius: 14,
  },
  eventImagePlaceholder: {
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventInfo: {
    flex: 1,
    gap: 3,
  },
  eventTitle: {
    fontSize: 14,
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
  pastEventsSection: {
    gap: 12,
  },
  pastSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pastCountBadge: {
    backgroundColor: joyTheme.primarySoft,
    borderRadius: 10,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  pastCountText: {
    fontSize: 12,
    fontFamily: fonts.extraBold,
    color: joyTheme.primaryDark,
  },
  pastStandaloneCard: {
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
  pastCoverImage: {
    width: '100%',
    height: 160,
  },
  pastCoverPlaceholder: {
    backgroundColor: '#0E3C73',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastCoverGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 40,
    height: 120,
  },
  pastCardOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 160,
    justifyContent: 'space-between',
    padding: 14,
  },
  pastCompletedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pastCompletedText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: 'rgba(255,255,255,0.9)',
  },
  pastCardBottom: {
    gap: 4,
  },
  pastCardTitle: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: '#fff',
    letterSpacing: -0.2,
  },
  pastCardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap' as const,
  },
  pastCardMetaText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: 'rgba(255,255,255,0.85)',
  },
  pastCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: joyTheme.border,
  },
  pastCardFooterText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  seeMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: joyTheme.primarySoft,
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 4,
  },
  seeMoreText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: joyTheme.primary,
  },
  pastInlineBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF3E0',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginTop: 2,
  },
  pastInlineBadgeText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: '#E65100',
  },
  emptyEvents: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  emptyEventsText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  bottomSpacer: {
    height: 24,
  },
});
