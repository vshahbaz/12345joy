import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Search,
  UserPlus,
  UserMinus,
  Users,
  X,
  Building2,
  MapPin,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fonts } from '@/constants/fonts';
import { joyTheme } from '@/constants/joyTheme';
import { resolveImageUrl } from '@/lib/imageUtils';
import { useAuth } from '@/providers/AuthProvider';
import {
  fetchFollowers,
  fetchFollowing,
  fetchFollowingIds,
  fetchFollowingOrganizations,
  searchUsers,
  searchOrganizations,
  fetchAllOrganizations,
  followUser,
  unfollowUser,
  followOrganization,
  unfollowOrganization,
  fetchFollowingCount,
  fetchFriendProfiles,
} from '@/lib/api';
import type { DbProfile, DbOrganization } from '@/types/database';
import { useRealtimeFollows } from '@/hooks/useRealtimeFollows';

type FollowTab = 'followers' | 'following' | 'search';

function getInitials(name: string | null): string {
  if (!name) return '??';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function FollowersScreen() {
  const router = useRouter();
  const { tab: initialTab } = useLocalSearchParams<{ tab?: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  useRealtimeFollows(userId || undefined);

  const [activeTab, setActiveTab] = useState<FollowTab>(
    initialTab === 'following' ? 'following' : initialTab === 'search' ? 'search' : 'followers'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);



  const followersQuery = useQuery({
    queryKey: ['followers-list', userId],
    queryFn: () => fetchFollowers(userId),
    enabled: !!userId,
    refetchOnMount: 'always' as const,
    staleTime: 0,
    refetchInterval: 10000,
  });

  const followingQuery = useQuery({
    queryKey: ['following-list', userId],
    queryFn: () => fetchFollowing(userId),
    enabled: !!userId,
    refetchOnMount: 'always' as const,
    staleTime: 0,
    refetchInterval: 10000,
  });

  const followingOrgsQuery = useQuery({
    queryKey: ['following-orgs', userId],
    queryFn: () => fetchFollowingOrganizations(userId),
    enabled: !!userId,
    refetchOnMount: 'always' as const,
    staleTime: 0,
    refetchInterval: 10000,
  });

  const followingCountQuery = useQuery({
    queryKey: ['following-count', userId],
    queryFn: () => fetchFollowingCount(userId),
    enabled: !!userId,
    refetchOnMount: 'always' as const,
    staleTime: 0,
    refetchInterval: 10000,
  });

  const friendProfilesQuery = useQuery({
    queryKey: ['friends-list', userId],
    queryFn: () => fetchFriendProfiles(userId),
    enabled: !!userId,
    refetchOnMount: 'always' as const,
    staleTime: 0,
    refetchInterval: 10000,
  });

  const followingIdsQuery = useQuery({
    queryKey: ['following-ids', userId],
    queryFn: () => fetchFollowingIds(userId),
    enabled: !!userId,
    refetchOnMount: 'always' as const,
    staleTime: 0,
  });

  const searchResultsQuery = useQuery({
    queryKey: ['search-users', debouncedQuery],
    queryFn: () => searchUsers(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  const orgSearchQuery = useQuery({
    queryKey: ['search-organizations', debouncedQuery],
    queryFn: () => searchOrganizations(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  const allOrgsQuery = useQuery({
    queryKey: ['all-organizations'],
    queryFn: fetchAllOrganizations,
    enabled: activeTab === 'search' && debouncedQuery.length < 2,
  });

  useFocusEffect(
    useCallback(() => {
      console.log('[Followers] Screen focused, refetching all follow data');
      if (userId) {
        void followersQuery.refetch();
        void followingQuery.refetch();
        void followingOrgsQuery.refetch();
        void followingIdsQuery.refetch();
        void followingCountQuery.refetch();
        void friendProfilesQuery.refetch();
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId])
  );

  const followingIds = useMemo(
    () => new Set(followingIdsQuery.data ?? []),
    [followingIdsQuery.data]
  );

  const friendProfiles = useMemo(() => friendProfilesQuery.data ?? [], [friendProfilesQuery.data]);

  const followers = useMemo(() => {
    const followData = followersQuery.data ?? [];
    const friendData = friendProfiles;
    const seenIds = new Set<string>();
    const merged: DbProfile[] = [];
    for (const p of followData) {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        merged.push(p);
      }
    }
    for (const p of friendData) {
      if (!seenIds.has(p.id) && p.id !== userId) {
        seenIds.add(p.id);
        merged.push(p);
      }
    }
    return merged;
  }, [followersQuery.data, friendProfiles, userId]);

  const following = useMemo(() => {
    const followData = followingQuery.data ?? [];
    const friendData = friendProfiles;
    const seenIds = new Set<string>();
    const merged: DbProfile[] = [];
    for (const p of followData) {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        merged.push(p);
      }
    }
    for (const p of friendData) {
      if (!seenIds.has(p.id) && p.id !== userId) {
        seenIds.add(p.id);
        merged.push(p);
      }
    }
    return merged;
  }, [followingQuery.data, friendProfiles, userId]);
  const followingOrgs = useMemo(() => followingOrgsQuery.data ?? [], [followingOrgsQuery.data]);
  const totalFollowingCount = followingCountQuery.data ?? (following.length + followingOrgs.length);

  const searchResults = useMemo(() => {
    const results = searchResultsQuery.data ?? [];
    return results.filter((p) => p.id !== userId);
  }, [searchResultsQuery.data, userId]);

  const followedOrgUserIds = useMemo(() => {
    return new Set((followingOrgsQuery.data ?? []).map((o) => o.id));
  }, [followingOrgsQuery.data]);

  const orgResults = useMemo(() => {
    const raw = debouncedQuery.length >= 2
      ? (orgSearchQuery.data ?? [])
      : (allOrgsQuery.data ?? []);
    return raw.filter((o) => !followedOrgUserIds.has(o.id));
  }, [orgSearchQuery.data, allOrgsQuery.data, debouncedQuery, followedOrgUserIds]);

  const followMutation = useMutation({
    mutationFn: (targetId: string) => followUser(userId, targetId),
    onMutate: async (targetId: string) => {
      await queryClient.cancelQueries({ queryKey: ['following-ids', userId] });
      const previousIds = queryClient.getQueryData<string[]>(['following-ids', userId]);
      queryClient.setQueryData<string[]>(['following-ids', userId], (old) => [
        ...(old ?? []),
        targetId,
      ]);
      console.log('[Followers] Optimistic follow:', targetId);
      return { previousIds };
    },
    onSuccess: () => {
      console.log('[Followers] Follow success, invalidating queries');
      void queryClient.invalidateQueries({ queryKey: ['following-ids', userId] });
      void queryClient.invalidateQueries({ queryKey: ['following-list', userId] });
      void queryClient.invalidateQueries({ queryKey: ['following-orgs', userId] });
      void queryClient.invalidateQueries({ queryKey: ['followers-list', userId] });
      void queryClient.invalidateQueries({ queryKey: ['followers-count', userId] });
      void queryClient.invalidateQueries({ queryKey: ['following-count', userId] });
      void queryClient.invalidateQueries({ queryKey: ['leaderboard', 'friends'] });
    },
    onError: (error: Error, _targetId, context) => {
      console.error('[Followers] Follow error:', error.message);
      if (context?.previousIds) {
        queryClient.setQueryData(['following-ids', userId], context.previousIds);
      }
      Alert.alert('Error', 'Could not follow user. Please try again.');
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: (targetId: string) => unfollowUser(userId, targetId),
    onMutate: async (targetId: string) => {
      await queryClient.cancelQueries({ queryKey: ['following-ids', userId] });
      const previousIds = queryClient.getQueryData<string[]>(['following-ids', userId]);
      queryClient.setQueryData<string[]>(['following-ids', userId], (old) =>
        (old ?? []).filter((id) => id !== targetId)
      );
      console.log('[Followers] Optimistic unfollow:', targetId);
      return { previousIds };
    },
    onSuccess: () => {
      console.log('[Followers] Unfollow success, invalidating queries');
      void queryClient.invalidateQueries({ queryKey: ['following-ids', userId] });
      void queryClient.invalidateQueries({ queryKey: ['following-list', userId] });
      void queryClient.invalidateQueries({ queryKey: ['following-orgs', userId] });
      void queryClient.invalidateQueries({ queryKey: ['followers-list', userId] });
      void queryClient.invalidateQueries({ queryKey: ['followers-count', userId] });
      void queryClient.invalidateQueries({ queryKey: ['following-count', userId] });
      void queryClient.invalidateQueries({ queryKey: ['leaderboard', 'friends'] });
    },
    onError: (error: Error, _targetId, context) => {
      console.error('[Followers] Unfollow error:', error.message);
      if (context?.previousIds) {
        queryClient.setQueryData(['following-ids', userId], context.previousIds);
      }
      Alert.alert('Error', 'Could not unfollow user. Please try again.');
    },
  });

  const handleSearchInput = useCallback((text: string) => {
    setSearchQuery(text);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => {
      setDebouncedQuery(text.trim());
    }, 400);
    setDebounceTimer(timer);
  }, [debounceTimer]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
  }, []);

  const handleToggleFollow = useCallback((targetId: string, isFollowing: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (isFollowing) {
      unfollowMutation.mutate(targetId);
    } else {
      followMutation.mutate(targetId);
    }
  }, [followMutation, unfollowMutation]);

  const followersRefetch = followersQuery.refetch;
  const followingRefetch = followingQuery.refetch;
  const followingOrgsRefetch = followingOrgsQuery.refetch;
  const followingIdsRefetch = followingIdsQuery.refetch;
  const followingCountRefetch = followingCountQuery.refetch;
  const friendProfilesRefetch = friendProfilesQuery.refetch;
  const searchResultsRefetch = searchResultsQuery.refetch;
  const orgSearchRefetch = orgSearchQuery.refetch;
  const allOrgsRefetch = allOrgsQuery.refetch;

  const handleRefresh = useCallback(() => {
    void followersRefetch();
    void followingRefetch();
    void followingOrgsRefetch();
    void followingIdsRefetch();
    void followingCountRefetch();
    void friendProfilesRefetch();
    if (activeTab === 'search') {
      if (debouncedQuery.length >= 2) {
        void searchResultsRefetch();
        void orgSearchRefetch();
      } else {
        void allOrgsRefetch();
      }
    }
  }, [activeTab, debouncedQuery, followersRefetch, followingRefetch, followingOrgsRefetch, followingIdsRefetch, followingCountRefetch, friendProfilesRefetch, searchResultsRefetch, orgSearchRefetch, allOrgsRefetch]);

  const handleTabChange = useCallback((tab: FollowTab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setActiveTab(tab);
  }, []);

  const isLoading = activeTab === 'followers'
    ? followersQuery.isLoading
    : activeTab === 'following'
      ? followingQuery.isLoading
      : (searchResultsQuery.isLoading && debouncedQuery.length >= 2);

  const isRefetching = activeTab === 'followers'
    ? followersQuery.isRefetching
    : activeTab === 'following'
      ? followingQuery.isRefetching
      : searchResultsQuery.isRefetching;

  const handleProfilePress = useCallback((personId: string) => {
    if (personId === userId) return;
    console.log('[Followers] Navigating to user profile:', personId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/user-profile' as never, params: { id: personId } });
  }, [userId, router]);

  const renderPersonRow = useCallback((person: DbProfile) => {
    const isFollowed = followingIds.has(person.id);
    const isMutatingThis = (followMutation.isPending && followMutation.variables === person.id) ||
      (unfollowMutation.isPending && unfollowMutation.variables === person.id);

    return (
      <Pressable key={person.id} style={styles.personRow} testID={`person-${person.id}`} onPress={() => handleProfilePress(person.id)}>
        {resolveImageUrl(person.avatar_url) ? (
          <Image source={{ uri: resolveImageUrl(person.avatar_url)! }} style={styles.personAvatar} contentFit="cover" />
        ) : (
          <View style={styles.personAvatarPlaceholder}>
            <Text style={styles.personInitials}>{getInitials(person.full_name)}</Text>
          </View>
        )}
        <View style={styles.personInfo}>
          <Text style={styles.personName} numberOfLines={1}>
            {person.full_name ?? 'Joy Dealer'}
          </Text>
          {person.username && (
            <Text style={styles.personUsername}>@{person.username}</Text>
          )}
          <View style={styles.personMetaRow}>
            {person.city && (
              <Text style={styles.personMeta}>{person.city}</Text>
            )}
            <Text style={styles.personMeta}>
              {person.total_points} pts · {person.total_hours}h
            </Text>
          </View>
        </View>
        {userId && person.id !== userId && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              handleToggleFollow(person.id, isFollowed);
            }}
            style={[
              styles.followButton,
              isFollowed && styles.followButtonActive,
            ]}
            disabled={isMutatingThis}
            hitSlop={8}
          >
            {isFollowed ? (
              <>
                <UserMinus color={joyTheme.primaryDark} size={14} />
                <Text style={styles.followButtonTextActive}>Following</Text>
              </>
            ) : (
              <>
                <UserPlus color="#FFFFFF" size={14} />
                <Text style={styles.followButtonText}>Follow</Text>
              </>
            )}
          </Pressable>
        )}
      </Pressable>
    );
  }, [followingIds, userId, handleToggleFollow, handleProfilePress, followMutation.isPending, unfollowMutation.isPending, followMutation.variables, unfollowMutation.variables]);

  const handleOrgPress = useCallback((orgId: string) => {
    console.log('[Followers] Navigating to org profile:', orgId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/org-profile' as never, params: { id: orgId } });
  }, [router]);

  const orgFollowMutation = useMutation({
    mutationFn: (orgId: string) => followOrganization(userId, orgId),
    onSuccess: () => {
      console.log('[Followers] Org follow success, invalidating queries');
      void queryClient.invalidateQueries({ queryKey: ['following-orgs', userId] });
      void queryClient.invalidateQueries({ queryKey: ['following-count', userId] });
    },
    onError: (error: Error) => {
      console.error('[Followers] Org follow error:', error.message);
      Alert.alert('Error', 'Could not follow organization. Please try again.');
    },
  });

  const orgUnfollowMutation = useMutation({
    mutationFn: (orgId: string) => unfollowOrganization(userId, orgId),
    onSuccess: () => {
      console.log('[Followers] Org unfollow success, invalidating queries');
      void queryClient.invalidateQueries({ queryKey: ['following-orgs', userId] });
      void queryClient.invalidateQueries({ queryKey: ['following-count', userId] });
    },
    onError: (error: Error) => {
      console.error('[Followers] Org unfollow error:', error.message);
      Alert.alert('Error', 'Could not unfollow organization. Please try again.');
    },
  });

  const handleToggleOrgFollow = useCallback((orgId: string, isFollowed: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (isFollowed) {
      orgUnfollowMutation.mutate(orgId);
    } else {
      orgFollowMutation.mutate(orgId);
    }
  }, [orgFollowMutation, orgUnfollowMutation]);

  const renderOrgRow = useCallback((org: DbOrganization) => {
    const isFollowed = followedOrgUserIds.has(org.id);
    const isMutatingThis = (orgFollowMutation.isPending && orgFollowMutation.variables === org.id) ||
      (orgUnfollowMutation.isPending && orgUnfollowMutation.variables === org.id);

    return (
      <Pressable key={org.id} style={styles.personRow} testID={`org-${org.id}`} onPress={() => handleOrgPress(org.id)}>
        {resolveImageUrl(org.logo_url) ? (
          <Image source={{ uri: resolveImageUrl(org.logo_url)! }} style={styles.orgAvatar} contentFit="cover" />
        ) : (
          <View style={styles.orgAvatarPlaceholder}>
            <Building2 color={joyTheme.primaryDark} size={22} />
          </View>
        )}
        <View style={styles.personInfo}>
          <Text style={styles.personName} numberOfLines={1}>
            {org.name}
          </Text>
          {org.contact_email && (
            <Text style={styles.personUsername}>{org.contact_email}</Text>
          )}
          <View style={styles.personMetaRow}>
            {org.city && (
              <View style={styles.orgMetaItem}>
                <MapPin color={joyTheme.primary} size={11} />
                <Text style={styles.personMeta}>{org.city}{org.state ? `, ${org.state}` : ''}</Text>
              </View>
            )}
            {org.is_verified && (
              <Text style={styles.orgVerifiedBadge}>Verified</Text>
            )}
          </View>
        </View>
        {userId && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              handleToggleOrgFollow(org.id, isFollowed);
            }}
            style={[
              styles.followButton,
              isFollowed && styles.followButtonActive,
            ]}
            disabled={isMutatingThis}
            hitSlop={8}
          >
            {isFollowed ? (
              <>
                <UserMinus color={joyTheme.primaryDark} size={14} />
                <Text style={styles.followButtonTextActive}>Following</Text>
              </>
            ) : (
              <>
                <UserPlus color="#FFFFFF" size={14} />
                <Text style={styles.followButtonText}>Follow</Text>
              </>
            )}
          </Pressable>
        )}
      </Pressable>
    );
  }, [handleOrgPress, handleToggleOrgFollow, followedOrgUserIds, userId, orgFollowMutation.isPending, orgUnfollowMutation.isPending, orgFollowMutation.variables, orgUnfollowMutation.variables]);

  const combinedFollowing = useMemo(() => {
    const people: Array<{ type: 'person'; data: DbProfile }> = following.map((p) => ({ type: 'person', data: p }));
    const orgs: Array<{ type: 'org'; data: DbOrganization }> = followingOrgs.map((o) => ({ type: 'org', data: o }));
    return [...people, ...orgs];
  }, [following, followingOrgs]);

  const combinedFollowers = useMemo(() => {
    return followers.map((p) => ({ type: 'person' as const, data: p }));
  }, [followers]);

  const followingEmpty = activeTab === 'following' && !followingQuery.isLoading && combinedFollowing.length === 0;

  return (
    <View style={styles.screen} testID="followers-screen">
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
          <Text style={styles.headerTitle}>Connections</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.tabBarWrap}>
          <View style={styles.tabBar}>
            <Pressable
              onPress={() => handleTabChange('followers')}
              style={[styles.tab, activeTab === 'followers' && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeTab === 'followers' && styles.tabTextActive]}>
                Followers{followers.length > 0 ? ` (${followers.length})` : ''}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleTabChange('following')}
              style={[styles.tab, activeTab === 'following' && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeTab === 'following' && styles.tabTextActive]}>
                Following{totalFollowingCount > 0 ? ` (${totalFollowingCount})` : ''}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleTabChange('search')}
              style={[styles.tab, activeTab === 'search' && styles.tabActive]}
            >
              <Search
                color={activeTab === 'search' ? joyTheme.primaryDark : joyTheme.textMuted}
                size={16}
              />
              <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}>
                Find
              </Text>
            </Pressable>
          </View>
        </View>

        {activeTab === 'search' && (
          <View style={styles.searchBarWrap}>
            <View style={styles.searchBar}>
              <Search color={joyTheme.textMuted} size={18} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search people & organizations..."
                placeholderTextColor={joyTheme.textMuted}
                value={searchQuery}
                onChangeText={handleSearchInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                testID="search-input"
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={handleClearSearch} hitSlop={8}>
                  <X color={joyTheme.textMuted} size={18} />
                </Pressable>
              )}
            </View>
          </View>
        )}

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor={joyTheme.primary}
            />
          }
        >
          {isLoading && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={joyTheme.primary} size="large" />
            </View>
          )}

          {activeTab === 'search' && !isLoading && debouncedQuery.length < 2 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Search color={joyTheme.textMuted} size={40} />
              </View>
              <Text style={styles.emptyTitle}>Find Joy Dealers</Text>
              <Text style={styles.emptyText}>
                Search for volunteers and organizations by name to connect with them.
              </Text>
            </View>
          )}

          {activeTab === 'search' && !isLoading && debouncedQuery.length >= 2 && searchResults.length === 0 && orgResults.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Users color={joyTheme.textMuted} size={40} />
              </View>
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text style={styles.emptyText}>
                Try a different name or search term.
              </Text>
            </View>
          )}

          {activeTab === 'followers' && !isLoading && followers.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Users color={joyTheme.textMuted} size={40} />
              </View>
              <Text style={styles.emptyTitle}>No followers yet</Text>
              <Text style={styles.emptyText}>
                When people follow you, they'll appear here.
              </Text>
            </View>
          )}

          {followingEmpty && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Users color={joyTheme.textMuted} size={40} />
              </View>
              <Text style={styles.emptyTitle}>Not following anyone</Text>
              <Text style={styles.emptyText}>
                Use the Find tab to search and follow other joy dealers and organizations!
              </Text>
              <Pressable
                onPress={() => handleTabChange('search')}
                style={styles.ctaButton}
              >
                <Search color="#FFFFFF" size={16} />
                <Text style={styles.ctaButtonText}>Find People</Text>
              </Pressable>
            </View>
          )}

          {activeTab === 'followers' && combinedFollowers.map((item) => renderPersonRow(item.data))}

          {activeTab === 'following' && combinedFollowing.map((item) =>
            item.type === 'person'
              ? renderPersonRow(item.data)
              : renderOrgRow(item.data)
          )}

          {activeTab === 'search' && debouncedQuery.length >= 2 && (
            <>
              {searchResults.length > 0 && (
                <>
                  <View style={styles.sectionLabelWrap}>
                    <Users color={joyTheme.textMuted} size={14} />
                    <Text style={styles.sectionLabel}>People ({searchResults.length})</Text>
                  </View>
                  {searchResults.map(renderPersonRow)}
                </>
              )}
              {orgResults.length > 0 && (
                <>
                  <View style={styles.sectionLabelWrap}>
                    <Building2 color={joyTheme.textMuted} size={14} />
                    <Text style={styles.sectionLabel}>Organizations ({orgResults.length})</Text>
                  </View>
                  {orgResults.map(renderOrgRow)}
                </>
              )}
            </>
          )}

          {activeTab === 'search' && debouncedQuery.length < 2 && orgResults.length > 0 && (
            <>
              <View style={styles.sectionLabelWrap}>
                <Building2 color={joyTheme.textMuted} size={14} />
                <Text style={styles.sectionLabel}>Organizations</Text>
              </View>
              {orgResults.map(renderOrgRow)}
            </>
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
  tabBarWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: joyTheme.border,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: joyTheme.backgroundAlt,
    borderRadius: 14,
    padding: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 11,
    borderRadius: 11,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: joyTheme.shadow,
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
  },
  tabTextActive: {
    color: joyTheme.primaryDark,
    fontFamily: fonts.extraBold,
  },
  searchBarWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: joyTheme.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: joyTheme.backgroundAlt,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: joyTheme.text,
    paddingVertical: 2,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  loadingWrap: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
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
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: joyTheme.primaryDark,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 8,
  },
  ctaButtonText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  sectionLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  personAvatar: {
    width: 50,
    height: 50,
    borderRadius: 18,
  },
  personAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personInitials: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: joyTheme.primaryDark,
  },
  personInfo: {
    flex: 1,
    gap: 2,
  },
  personName: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: joyTheme.text,
  },
  personUsername: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  personMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  personMeta: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: joyTheme.primary,
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: joyTheme.primaryDark,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  followButtonActive: {
    backgroundColor: joyTheme.primarySoft,
    borderWidth: 1,
    borderColor: joyTheme.primary,
  },
  followButtonText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  followButtonTextActive: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: joyTheme.primaryDark,
  },
  orgAvatar: {
    width: 50,
    height: 50,
    borderRadius: 14,
  },
  orgAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  orgVerifiedBadge: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: joyTheme.success,
    backgroundColor: '#E8F8F0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  bottomSpacer: {
    height: 20,
  },
});
