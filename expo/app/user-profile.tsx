import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Award,
  Calendar,
  Camera,
  Clock,
  MapPin,
  Medal,
  Shield,
  Star,
  UserMinus,
  UserPlus,
} from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { resolveImageUrl } from '@/lib/imageUtils';

import { fonts } from '@/constants/fonts';
import { joyTheme } from '@/constants/joyTheme';
import { useAuth } from '@/providers/AuthProvider';
import {
  fetchProfileById,
  fetchFollowersCount,
  fetchFollowingCount,
  fetchFollowingIds,
  fetchUserLeaderboardRank,
  fetchUserEventsCount,
  fetchUserTotalPhotos,
  followUser,
  unfollowUser,
} from '@/lib/api';
import { useRealtimeFollows } from '@/hooks/useRealtimeFollows';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const myId = user?.id ?? '';

  useRealtimeFollows(myId || undefined);

  const profileQuery = useQuery({
    queryKey: ['profile', id],
    queryFn: () => fetchProfileById(id ?? ''),
    enabled: !!id,
    staleTime: 0,
    refetchOnMount: 'always' as const,
  });

  const followersCountQuery = useQuery({
    queryKey: ['followers-count', id],
    queryFn: () => fetchFollowersCount(id ?? ''),
    enabled: !!id,
    staleTime: 0,
    refetchOnMount: 'always' as const,
    refetchInterval: 15000,
  });

  const followingCountQuery = useQuery({
    queryKey: ['following-count', id],
    queryFn: () => fetchFollowingCount(id ?? ''),
    enabled: !!id,
    staleTime: 0,
    refetchOnMount: 'always' as const,
    refetchInterval: 15000,
  });

  const rankQuery = useQuery({
    queryKey: ['user-rank', id],
    queryFn: () => fetchUserLeaderboardRank(id ?? ''),
    enabled: !!id,
  });

  const eventsCountQuery = useQuery({
    queryKey: ['user-events-count', id],
    queryFn: () => fetchUserEventsCount(id ?? ''),
    enabled: !!id,
  });

  const photosCountQuery = useQuery({
    queryKey: ['user-photos-count', id],
    queryFn: () => fetchUserTotalPhotos(id ?? ''),
    enabled: !!id,
  });

  const followingIdsQuery = useQuery({
    queryKey: ['following-ids', myId],
    queryFn: () => fetchFollowingIds(myId),
    enabled: !!myId,
    staleTime: 0,
    refetchOnMount: 'always' as const,
    refetchInterval: 15000,
  });

  useFocusEffect(
    useCallback(() => {
      console.log('[UserProfile] Screen focused, refetching follow data');
      if (id) {
        void profileQuery.refetch();
        void followersCountQuery.refetch();
        void followingCountQuery.refetch();
        void followingIdsQuery.refetch();
        void rankQuery.refetch();
        void eventsCountQuery.refetch();
        void photosCountQuery.refetch();
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])
  );

  const profile = profileQuery.data;
  const followersCount = followersCountQuery.data ?? 0;
  const followingCount = followingCountQuery.data ?? 0;
  const rank = rankQuery.data;
  const eventsCount = eventsCountQuery.data ?? 0;
  const photosCount = photosCountQuery.data ?? 0;

  const isFollowing = useMemo(() => {
    return (followingIdsQuery.data ?? []).includes(id ?? '');
  }, [followingIdsQuery.data, id]);

  const isOwnProfile = myId === id;

  const followMutation = useMutation({
    mutationFn: () => followUser(myId, id ?? ''),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['following-ids', myId] });
      void queryClient.invalidateQueries({ queryKey: ['followers-count', id] });
      void queryClient.invalidateQueries({ queryKey: ['following-count', myId] });
    },
    onError: () => Alert.alert('Error', 'Could not follow user.'),
  });

  const unfollowMutation = useMutation({
    mutationFn: () => unfollowUser(myId, id ?? ''),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['following-ids', myId] });
      void queryClient.invalidateQueries({ queryKey: ['followers-count', id] });
      void queryClient.invalidateQueries({ queryKey: ['following-count', myId] });
    },
    onError: () => Alert.alert('Error', 'Could not unfollow user.'),
  });

  const handleToggleFollow = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (isFollowing) {
      unfollowMutation.mutate();
    } else {
      followMutation.mutate();
    }
  }, [isFollowing, followMutation, unfollowMutation]);

  const profileRefetch = profileQuery.refetch;
  const followersCountRefetch = followersCountQuery.refetch;
  const followingCountRefetch = followingCountQuery.refetch;
  const rankRefetch = rankQuery.refetch;
  const eventsCountRefetch = eventsCountQuery.refetch;
  const photosCountRefetch = photosCountQuery.refetch;

  const handleRefresh = useCallback(() => {
    void profileRefetch();
    void followersCountRefetch();
    void followingCountRefetch();
    void rankRefetch();
    void eventsCountRefetch();
    void photosCountRefetch();
  }, [profileRefetch, followersCountRefetch, followingCountRefetch, rankRefetch, eventsCountRefetch, photosCountRefetch]);

  if (profileQuery.isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color={joyTheme.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.loadingText}>Profile not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const displayName = profile.full_name ?? 'Joy Dealer';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={styles.screen} testID="user-profile-screen">
      <LinearGradient colors={['#0865C2', '#0A84FF', '#64B5FF']} style={styles.headerGradient} />
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
          <Text style={styles.topBarTitle}>Profile</Text>
          <View style={styles.topBarBtn} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={profileQuery.isRefetching} onRefresh={handleRefresh} tintColor="#fff" />
          }
        >
          <View style={styles.profileHeader}>
            {resolveImageUrl(profile.avatar_url) ? (
              <Image source={{ uri: resolveImageUrl(profile.avatar_url)! }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <Text style={styles.displayName}>{displayName}</Text>
            {profile.username && (
              <Text style={styles.usernameText}>@{profile.username}</Text>
            )}

            {profile.city && (
              <View style={styles.locationRow}>
                <MapPin color="rgba(255,255,255,0.7)" size={13} />
                <Text style={styles.locationText}>{profile.city}</Text>
              </View>
            )}

            <View style={styles.followRow}>
              <View style={styles.followStat}>
                <Text style={styles.followCount}>{followersCount}</Text>
                <Text style={styles.followLabel}>Followers</Text>
              </View>
              <View style={styles.followDivider} />
              <View style={styles.followStat}>
                <Text style={styles.followCount}>{followingCount}</Text>
                <Text style={styles.followLabel}>Following</Text>
              </View>
              <View style={styles.followDivider} />
              <View style={styles.followStat}>
                <Text style={styles.followCount}>{eventsCount}</Text>
                <Text style={styles.followLabel}>Events</Text>
              </View>
            </View>

            <View style={styles.badgeRow}>
              <View style={styles.roleBadge}>
                <Star color="#FFD84D" size={14} />
                <Text style={styles.roleBadgeText}>Volunteer</Text>
              </View>
              {profile.is_verified && (
                <View style={styles.verifiedBadge}>
                  <Shield color={joyTheme.success} size={14} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              )}
              {rank && (
                <View style={styles.rankBadge}>
                  <Medal color="#FFB020" size={14} />
                  <Text style={styles.rankBadgeText}>#{rank}</Text>
                </View>
              )}
            </View>

            {!isOwnProfile && myId && (
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
              <Award color="#0A84FF" size={20} />
              <Text style={styles.statValue}>{profile.total_points}</Text>
              <Text style={styles.statLabel}>Points</Text>
            </View>
            <View style={styles.statCard}>
              <Clock color="#2BB673" size={20} />
              <Text style={styles.statValue}>{profile.total_hours}</Text>
              <Text style={styles.statLabel}>Hours</Text>
            </View>
            <View style={styles.statCard}>
              <Calendar color="#FFB020" size={20} />
              <Text style={styles.statValue}>{eventsCount}</Text>
              <Text style={styles.statLabel}>Events</Text>
            </View>
            <View style={styles.statCard}>
              <Camera color="#E040FB" size={20} />
              <Text style={styles.statValue}>{photosCount}</Text>
              <Text style={styles.statLabel}>Photos</Text>
            </View>
          </View>

          {profile.interests && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Interests</Text>
              <Text style={styles.sectionText}>{profile.interests}</Text>
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
  backBtn: {
    marginTop: 12,
    backgroundColor: joyTheme.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backBtnText: {
    color: '#fff',
    fontFamily: fonts.bold,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 360,
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
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: '#fff',
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
    borderRadius: 34,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: {
    fontSize: 34,
    fontFamily: fonts.black,
    color: '#FFFFFF',
  },
  displayName: {
    fontSize: 26,
    fontFamily: fonts.black,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  usernameText: {
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
  followRow: {
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
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  roleBadgeText: {
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
    fontFamily: fonts.extraBold,
    color: '#FFB020',
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
    gap: 10,
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
  bottomSpacer: {
    height: 24,
  },
});
