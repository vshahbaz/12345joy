import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { Flame, Search, Users, Crown, Target, Clock, Zap, Medal, ChevronUp, Trophy } from 'lucide-react-native';

import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { joyTheme } from '@/constants/joyTheme';
import { resolveImageUrl } from '@/lib/imageUtils';
import { fetchLeaderboard, fetchFriendsLeaderboard, fetchChallenges } from '@/lib/api';
import type { DbChallenge, DbLeaderboardProfile } from '@/types/database';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';

type LeaderboardScope = 'everyone' | 'friends' | 'challenges';

type LeaderboardEntry = {
  id: string;
  name: string;
  subtitle: string | null;
  avatarUrl: string | null;
  points: number;
  isVerified: boolean;
};

function profileToEntry(profile: DbLeaderboardProfile): LeaderboardEntry {
  return {
    id: profile.id ?? '',
    name: profile.full_name ?? profile.username ?? 'Joy Dealer',
    subtitle: profile.username ? `@${profile.username}` : null,
    avatarUrl: resolveImageUrl(profile.avatar_url),
    points: profile.total_points ?? 0,
    isVerified: profile.is_verified ?? false,
  };
}

function getInitialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'JD';
}

function EntryAvatar({ entry, size, borderColor }: { entry: LeaderboardEntry; size: number; borderColor?: string }) {
  const borderRadius = size / 2;

  if (entry.avatarUrl) {
    return (
      <View style={{ borderRadius: borderRadius + 3, borderWidth: borderColor ? 3 : 0, borderColor: borderColor ?? 'transparent', padding: borderColor ? 2 : 0 }}>
        <Image
          source={{ uri: entry.avatarUrl }}
          style={{
            width: size,
            height: size,
            borderRadius,
            backgroundColor: '#E8EDF2',
          }}
          contentFit="cover"
        />
      </View>
    );
  }

  return (
    <View style={{ borderRadius: borderRadius + 3, borderWidth: borderColor ? 3 : 0, borderColor: borderColor ?? 'transparent', padding: borderColor ? 2 : 0 }}>
      <LinearGradient
        colors={['#2D2D4A', '#1A1A2E']}
        style={{
          width: size,
          height: size,
          borderRadius,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: size * 0.36, fontWeight: '800' as const, color: '#FFF' }}>
          {getInitialsFromName(entry.name)}
        </Text>
      </LinearGradient>
    </View>
  );
}

function getDaysLeft(endDate: string | null): number {
  if (!endDate) return 0;
  const now = new Date();
  const end = new Date(endDate);
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function getChallengeStatusColor(endDate: string | null): string {
  const days = getDaysLeft(endDate);
  if (days <= 3) return '#EF4444';
  if (days <= 7) return '#F59E0B';
  return '#10B981';
}

function ChallengeCard({ challenge }: { challenge: DbChallenge }) {
  const daysLeft = getDaysLeft(challenge.end_date);
  const statusColor = getChallengeStatusColor(challenge.end_date);
  const challengeLabel = challenge.challenge_type ?? 'Challenge';
  const pointsDiff = Math.abs(challenge.challenger_points - challenge.challenged_points);

  return (
    <View style={challengeStyles.card}>
      <LinearGradient
        colors={['rgba(232,168,56,0.06)', 'rgba(232,168,56,0.02)']}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={challengeStyles.cardHeader}>
        <View style={[challengeStyles.typeTag, { backgroundColor: `${statusColor}15` }]}>
          <Target color={statusColor} size={12} />
          <Text style={[challengeStyles.typeTagText, { color: statusColor }]}>
            {challengeLabel}
          </Text>
        </View>
        <View style={challengeStyles.pointsTag}>
          <Zap color={joyTheme.gold} size={12} />
          <Text style={challengeStyles.pointsTagText}>{pointsDiff} pts gap</Text>
        </View>
      </View>
      <Text style={challengeStyles.cardTitle}>{challengeLabel} Challenge</Text>
      <Text style={challengeStyles.cardDesc} numberOfLines={2}>
        Score: {challenge.challenger_points} vs {challenge.challenged_points} · Status: {challenge.status}
      </Text>
      <View style={challengeStyles.cardFooter}>
        <View style={challengeStyles.daysRow}>
          <Clock color={statusColor} size={13} />
          <Text style={[challengeStyles.daysText, { color: statusColor }]}>
            {daysLeft === 0 ? 'Ends today' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`}
          </Text>
        </View>
      </View>
    </View>
  );
}

function PodiumEntry({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const isFirst = rank === 1;
  const isSecond = rank === 2;

  const podiumHeight = isFirst ? 100 : isSecond ? 72 : 56;
  const avatarSize = isFirst ? 64 : 52;
  const medalColors = isFirst
    ? ['#FFD700', '#FFA500'] as [string, string]
    : isSecond
      ? ['#C0C0C0', '#A0A0A0'] as [string, string]
      : ['#CD7F32', '#A0522D'] as [string, string];
  const borderColor = isFirst ? '#FFD700' : isSecond ? '#C0C0C0' : '#CD7F32';

  return (
    <View style={styles.podiumItem} testID={`podium-${rank}`}>
      <View style={styles.podiumAvatarWrap}>
        <EntryAvatar entry={entry} size={avatarSize} borderColor={borderColor} />
        <LinearGradient
          colors={medalColors}
          style={styles.podiumMedal}
        >
          <Text style={styles.podiumMedalText}>{rank}</Text>
        </LinearGradient>
      </View>
      <Text style={[styles.podiumName, isFirst && styles.podiumNameFirst]} numberOfLines={1}>
        {entry.name.split(' ')[0]}
      </Text>
      <View style={[styles.podiumPointsBadge, { backgroundColor: `${medalColors[0]}20` }]}>
        <Text style={[styles.podiumPoints, { color: medalColors[0] }]}>{entry.points.toLocaleString()}</Text>
      </View>
      <LinearGradient
        colors={[medalColors[0] + '30', medalColors[0] + '10']}
        style={[styles.podiumBar, { height: podiumHeight }]}
      >
        <Text style={[styles.podiumBarRank, { color: medalColors[0] }]}>#{rank}</Text>
      </LinearGradient>
    </View>
  );
}

export default function LeaderboardScreen() {
  const [scope, setScope] = useState<LeaderboardScope>('everyone');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const everyoneQuery = useQuery({
    queryKey: ['leaderboard'],
    queryFn: fetchLeaderboard,
  });

  const friendsQuery = useQuery({
    queryKey: ['leaderboard', 'friends', user?.id],
    queryFn: () => fetchFriendsLeaderboard(user!.id),
    enabled: !!user?.id && scope === 'friends',
  });

  const challengesQuery = useQuery({
    queryKey: ['challenges', user?.id],
    queryFn: () => fetchChallenges(user?.id ?? ''),
    enabled: scope === 'challenges' && !!user?.id,
  });

  const activeProfileQuery = scope === 'friends' ? friendsQuery : everyoneQuery;

  const entries = useMemo(() => {
    const profileEntries = (activeProfileQuery.data ?? []).map(profileToEntry);
    profileEntries.sort((a, b) => b.points - a.points);
    if (!searchQuery.trim()) return profileEntries;
    const q = searchQuery.toLowerCase();
    return profileEntries.filter((e) => {
      return e.name.toLowerCase().includes(q) || (e.subtitle ?? '').toLowerCase().includes(q);
    });
  }, [activeProfileQuery.data, searchQuery]);

  const currentUserRank = useMemo(() => {
    if (!user?.id) return null;
    const idx = entries.findIndex((e) => e.id === user.id);
    return idx >= 0 ? idx + 1 : null;
  }, [entries, user?.id]);

  const handleScopeChange = useCallback((newScope: LeaderboardScope): void => {
    console.log('[LeaderboardScreen] Switching scope to:', newScope);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setScope(newScope);
    if (newScope === 'challenges') {
      setSearchQuery('');
    }
  }, []);

  const everyoneRefetch = everyoneQuery.refetch;
  const friendsRefetch = friendsQuery.refetch;
  const challengesRefetch = challengesQuery.refetch;

  useEffect(() => {
    console.log('[LeaderboardScreen] Setting up real-time leaderboard sync');
    const channel = supabase
      .channel('leaderboard-sync')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        () => {
          console.log('[LeaderboardScreen] Profile updated, refetching leaderboard');
          void everyoneRefetch();
          void friendsRefetch();
        }
      )
      .subscribe();

    return () => {
      console.log('[LeaderboardScreen] Cleaning up real-time leaderboard sync');
      void supabase.removeChannel(channel);
    };
  }, [everyoneRefetch, friendsRefetch]);

  const handleRefresh = useCallback(() => {
    console.log('[LeaderboardScreen] Refreshing');
    void everyoneRefetch();
    if (scope === 'friends') {
      void friendsRefetch();
    }
    if (scope === 'challenges') {
      void challengesRefetch();
    }
  }, [everyoneRefetch, friendsRefetch, scope, challengesRefetch]);

  const isLoading = scope === 'friends'
    ? friendsQuery.isLoading && !friendsQuery.data
    : everyoneQuery.isLoading;

  const challenges = useMemo<DbChallenge[]>(() => challengesQuery.data ?? [], [challengesQuery.data]);
  const activeChallenges = useMemo(() => {
    const now = new Date().toISOString();
    return challenges.filter((c: DbChallenge) => c.end_date != null && c.end_date >= now);
  }, [challenges]);

  const isLeaderboardView = scope === 'everyone' || scope === 'friends';
  const rankLabel = scope === 'friends' ? 'Friends Rank' : 'Global Rank';

  const top3 = useMemo(() => entries.slice(0, 3), [entries]);
  const restEntries = useMemo(() => entries.slice(3), [entries]);
  const podiumOrder = useMemo(() => {
    if (top3.length < 3) return top3;
    return [top3[1], top3[0], top3[2]];
  }, [top3]);


  return (
    <View style={styles.screen} testID="leaderboard-screen">
      <LinearGradient
        colors={['#1A1A2E', '#2D2D4A', '#1A1A2E']}
        style={styles.headerGradient}
      />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerSection}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Trophy color={joyTheme.gold} size={24} />
              <Text style={styles.headerTitle}>Rankings</Text>
            </View>
            {isAuthenticated && currentUserRank && (
              <View style={styles.yourRankBadge}>
                <ChevronUp color={joyTheme.gold} size={14} />
                <Text style={styles.yourRankText}>#{currentUserRank}</Text>
              </View>
            )}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={activeProfileQuery.isRefetching || challengesQuery.isRefetching}
              onRefresh={handleRefresh}
              tintColor={joyTheme.gold}
            />
          }
        >
          <View style={styles.scopeRow}>
            {(['everyone', 'friends', 'challenges'] as LeaderboardScope[]).map((s) => {
              const isActive = scope === s;
              const icons = { everyone: Crown, friends: Users, challenges: Target };
              const Icon = icons[s];
              const labels = { everyone: 'Global', friends: 'Friends', challenges: 'Challenges' };
              const isDisabled = s === 'friends' && !isAuthenticated;
              return (
                <Pressable
                  key={s}
                  onPress={() => {
                    if (isDisabled) return;
                    handleScopeChange(s);
                  }}
                  style={[
                    styles.scopeBtn,
                    isActive && styles.scopeBtnActive,
                    isDisabled && styles.scopeBtnDisabled,
                  ]}
                  testID={`leaderboard-scope-${s}`}
                >
                  <Icon
                    color={isDisabled ? '#555' : isActive ? joyTheme.gold : 'rgba(255,255,255,0.5)'}
                    size={14}
                  />
                  <Text style={[
                    styles.scopeBtnText,
                    isActive && styles.scopeBtnTextActive,
                    isDisabled && styles.scopeBtnTextDisabled,
                  ]}>
                    {labels[s]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {isLeaderboardView && (
            <>
              {isAuthenticated && currentUserRank && (
                <View style={styles.rankCard}>
                  <LinearGradient
                    colors={['rgba(232,168,56,0.15)', 'rgba(232,168,56,0.05)']}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <View style={styles.rankCardLeft}>
                    <View style={styles.rankCardIcon}>
                      <Flame color={joyTheme.gold} size={22} />
                    </View>
                    <View>
                      <Text style={styles.rankCardLabel}>{rankLabel}</Text>
                      <Text style={styles.rankCardValue}>#{currentUserRank}</Text>
                    </View>
                  </View>
                  <View style={styles.rankCardRight}>
                    <Text style={styles.rankCardMessage}>Keep going!</Text>
                    <Medal color={joyTheme.gold} size={16} />
                  </View>
                </View>
              )}

              {!isAuthenticated && (
                <View style={styles.rankCard}>
                  <View style={styles.rankCardLeft}>
                    <View style={styles.rankCardIcon}>
                      <Flame color={joyTheme.gold} size={22} />
                    </View>
                    <View>
                      <Text style={styles.rankCardLabel}>Sign in to see your rank</Text>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.searchContainer}>
                <Search color={joyTheme.textMuted} size={18} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search volunteers..."
                  placeholderTextColor={joyTheme.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="leaderboard-search"
                />
              </View>

              {isLoading && (
                <View style={styles.centered}>
                  <ActivityIndicator size="large" color={joyTheme.gold} />
                  <Text style={styles.loadingText}>Loading rankings...</Text>
                </View>
              )}

              {!isLoading && scope === 'friends' && entries.length === 0 && (
                <View style={styles.emptyFriendsCard}>
                  <Users color={joyTheme.gold} size={36} />
                  <Text style={styles.emptyFriendsTitle}>No friends yet</Text>
                  <Text style={styles.emptyFriendsSubtitle}>
                    Follow other volunteers to see them on this leaderboard!
                  </Text>
                  <Pressable
                    onPress={() => router.push('/followers?tab=search')}
                    style={styles.findPeopleButton}
                  >
                    <Search color="#FFFFFF" size={16} />
                    <Text style={styles.findPeopleText}>Find People</Text>
                  </Pressable>
                </View>
              )}

              {!isLoading && entries.length > 0 && !searchQuery && (
                <View style={styles.podiumSection}>
                  {podiumOrder.map((entry, i) => {
                    const realRank = i === 0 ? 2 : i === 1 ? 1 : 3;
                    if (!entry) return null;
                    return (
                      <PodiumEntry
                        key={entry.id}
                        entry={entry}
                        rank={realRank}
                      />
                    );
                  })}
                </View>
              )}

              {!isLoading && (searchQuery ? entries : restEntries).length > 0 && (
                <View style={styles.tableContainer}>
                  {(searchQuery ? entries : restEntries).map((entry, index) => {
                    const rank = searchQuery ? index + 1 : index + 4;
                    const isCurrentUser = entry.id === user?.id;

                    return (
                      <View
                        key={entry.id}
                        style={[
                          styles.tableRow,
                          isCurrentUser && styles.tableRowHighlight,
                          index === (searchQuery ? entries : restEntries).length - 1 && styles.tableRowLast,
                        ]}
                        testID={`leaderboard-entry-${entry.id}`}
                      >
                        <View style={styles.rankCol}>
                          <Text style={styles.rankNumber}>{rank}</Text>
                        </View>

                        <View style={styles.dealerCol}>
                          <EntryAvatar entry={entry} size={40} />
                          <View style={styles.dealerInfo}>
                            <View style={styles.dealerNameRow}>
                              <Text style={styles.dealerName} numberOfLines={1}>
                                {entry.name}
                              </Text>
                              {isCurrentUser && (
                                <View style={styles.youBadge}>
                                  <Text style={styles.youBadgeText}>You</Text>
                                </View>
                              )}
                            </View>
                            {entry.subtitle && (
                              <Text style={styles.dealerUsername} numberOfLines={1}>
                                {entry.subtitle}
                              </Text>
                            )}
                          </View>
                        </View>

                        <View style={styles.pointsCol}>
                          <Text style={styles.pointsValue}>{entry.points.toLocaleString()}</Text>
                          <Text style={styles.pointsUnit}>pts</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {!isLoading && entries.length === 0 && scope === 'everyone' && (
                <View style={styles.emptyState}>
                  <Crown color={joyTheme.textMuted} size={48} />
                  <Text style={styles.emptyStateTitle}>No participants yet</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    Be the first to earn points by volunteering!
                  </Text>
                </View>
              )}
            </>
          )}

          {scope === 'challenges' && (
            <>
              <View style={styles.subtitleRow}>
                <Text style={styles.headerSubtitle}>Complete challenges for bonus points</Text>
              </View>

              {challengesQuery.isLoading && (
                <View style={styles.centered}>
                  <ActivityIndicator size="large" color={joyTheme.gold} />
                  <Text style={styles.loadingText}>Loading challenges...</Text>
                </View>
              )}

              {!challengesQuery.isLoading && activeChallenges.length > 0 && (
                <View style={challengeStyles.list}>
                  {activeChallenges.map((challenge: DbChallenge) => (
                    <ChallengeCard key={challenge.id} challenge={challenge} />
                  ))}
                </View>
              )}

              {!challengesQuery.isLoading && activeChallenges.length === 0 && (
                <View style={styles.emptyState}>
                  <Target color={joyTheme.textMuted} size={48} />
                  <Text style={styles.emptyStateTitle}>No active challenges</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    Check back soon for new challenges!
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const challengeStyles = StyleSheet.create({
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: joyTheme.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: joyTheme.border,
    gap: 10,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  typeTagText: {
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'capitalize' as const,
  },
  pointsTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: joyTheme.goldSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  pointsTagText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: joyTheme.goldDark,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: joyTheme.text,
  },
  cardDesc: {
    fontSize: 13,
    color: joyTheme.textMuted,
    lineHeight: 19,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  daysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  daysText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  targetText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: joyTheme.textMuted,
  },
});

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
    height: 200,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 40,
  },
  loadingText: {
    color: joyTheme.textMuted,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900' as const,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  yourRankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(232,168,56,0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(232,168,56,0.3)',
  },
  yourRankText: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: joyTheme.gold,
  },
  scopeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  scopeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  scopeBtnActive: {
    backgroundColor: 'rgba(232,168,56,0.15)',
    borderColor: 'rgba(232,168,56,0.3)',
  },
  scopeBtnDisabled: {
    opacity: 0.35,
  },
  scopeBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.5)',
  },
  scopeBtnTextActive: {
    color: joyTheme.gold,
    fontWeight: '700' as const,
  },
  scopeBtnTextDisabled: {
    color: '#555',
  },
  subtitleRow: {
    paddingBottom: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: joyTheme.textMuted,
  },
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: joyTheme.surface,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: joyTheme.border,
    overflow: 'hidden',
  },
  rankCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rankCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rankCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: joyTheme.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankCardLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: joyTheme.textMuted,
  },
  rankCardValue: {
    fontSize: 24,
    fontWeight: '900' as const,
    color: joyTheme.text,
  },
  rankCardMessage: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: joyTheme.gold,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: joyTheme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: joyTheme.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: joyTheme.text,
    padding: 0,
  },
  podiumSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 8,
  },
  podiumItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  podiumAvatarWrap: {
    position: 'relative',
    marginBottom: 2,
  },
  podiumMedal: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  podiumMedalText: {
    fontSize: 11,
    fontWeight: '900' as const,
    color: '#FFF',
  },
  podiumName: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: joyTheme.text,
    textAlign: 'center',
  },
  podiumNameFirst: {
    fontSize: 14,
    fontWeight: '800' as const,
  },
  podiumPointsBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  podiumPoints: {
    fontSize: 12,
    fontWeight: '800' as const,
  },
  podiumBar: {
    width: '100%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumBarRank: {
    fontSize: 18,
    fontWeight: '900' as const,
  },
  tableContainer: {
    backgroundColor: joyTheme.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: joyTheme.border,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F3EE',
  },
  tableRowHighlight: {
    backgroundColor: joyTheme.goldSoft,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  rankCol: {
    width: 36,
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: joyTheme.textMuted,
  },
  dealerCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dealerInfo: {
    flex: 1,
    gap: 1,
  },
  dealerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dealerName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: joyTheme.text,
    flexShrink: 1,
  },
  youBadge: {
    backgroundColor: joyTheme.goldSoft,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  youBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: joyTheme.gold,
  },
  dealerUsername: {
    fontSize: 12,
    color: joyTheme.textMuted,
  },
  pointsCol: {
    alignItems: 'flex-end',
  },
  pointsValue: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: joyTheme.text,
  },
  pointsUnit: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: joyTheme.textMuted,
    marginTop: -2,
  },
  emptyFriendsCard: {
    alignItems: 'center',
    gap: 10,
    backgroundColor: joyTheme.surface,
    borderRadius: 20,
    padding: 32,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  emptyFriendsTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: joyTheme.text,
  },
  emptyFriendsSubtitle: {
    fontSize: 14,
    color: joyTheme.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  findPeopleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: joyTheme.navy,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 4,
  },
  findPeopleText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: joyTheme.text,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: joyTheme.textMuted,
    textAlign: 'center',
  },
});
