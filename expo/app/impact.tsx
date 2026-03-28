import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  BarChart3,
  Clock,
  Heart,
  MapPin,
  Sparkles,
  TrendingUp,
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
import { fetchImpactNumbers, fetchImpactBreakdown } from '@/lib/api';
import type { DbProfile } from '@/types/database';

function getAvatarUri(profile: DbProfile): string | null {
  return resolveImageUrl(profile.avatar_url);
}

export default function ImpactScreen() {
  const router = useRouter();

  const impactQuery = useQuery({
    queryKey: ['impact-numbers'],
    queryFn: fetchImpactNumbers,
  });

  const breakdownQuery = useQuery({
    queryKey: ['impact-breakdown'],
    queryFn: fetchImpactBreakdown,
  });

  const impact = impactQuery.data;
  const breakdown = breakdownQuery.data;

  const eventTypeEntries = useMemo(() => {
    if (!breakdown?.byEventType) return [];
    return Object.entries(breakdown.byEventType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [breakdown]);

  const cityEntries = useMemo(() => {
    if (!breakdown?.byCity) return [];
    return Object.entries(breakdown.byCity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [breakdown]);

  const maxEventTypeCount = useMemo(
    () => Math.max(...eventTypeEntries.map(([, c]) => c), 1),
    [eventTypeEntries]
  );

  const maxCityCount = useMemo(
    () => Math.max(...cityEntries.map(([, c]) => c), 1),
    [cityEntries]
  );

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.back();
  }, [router]);

  const impactRefetch = impactQuery.refetch;
  const breakdownRefetch = breakdownQuery.refetch;

  const handleRefresh = useCallback(() => {
    console.log('[ImpactScreen] Refreshing');
    void impactRefetch();
    void breakdownRefetch();
  }, [impactRefetch, breakdownRefetch]);

  const isLoading = impactQuery.isLoading && breakdownQuery.isLoading;
  const isRefreshing = impactQuery.isRefetching || breakdownQuery.isRefetching;

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color={joyTheme.primary} />
        <Text style={styles.loadingText}>Loading impact data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen} testID="impact-screen">
      <LinearGradient colors={['#0865C2', '#0A84FF', '#64B5FF']} style={styles.headerGradient} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={handleBack} style={styles.navBtn} testID="impact-back">
            <ArrowLeft color="#fff" size={22} />
          </Pressable>
          <Text style={styles.topBarTitle}>Community Impact</Text>
          <View style={styles.navBtnSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#fff" />
          }
        >
          <View style={styles.heroSection}>
            <View style={styles.heroBadge}>
              <Sparkles color="#FFD84D" size={14} />
              <Text style={styles.heroBadgeText}>Joy Dealer Impact</Text>
            </View>
            <Text style={styles.heroTitle}>Making a real difference</Text>
            <Text style={styles.heroSubtitle}>
              See how our community of volunteers is spreading joy and changing lives.
            </Text>
          </View>

          {impact && (
            <View style={styles.bigStatsRow}>
              <View style={styles.bigStatCard}>
                <View style={[styles.bigStatIcon, { backgroundColor: '#E2F0FF' }]}>
                  <Users color="#0A84FF" size={22} />
                </View>
                <Text style={styles.bigStatValue}>{impact.totalVolunteers}+</Text>
                <Text style={styles.bigStatLabel}>Volunteers</Text>
              </View>
              <View style={styles.bigStatCard}>
                <View style={[styles.bigStatIcon, { backgroundColor: '#FFF3B8' }]}>
                  <Heart color="#FFB020" size={22} />
                </View>
                <Text style={styles.bigStatValue}>{impact.totalEvents}+</Text>
                <Text style={styles.bigStatLabel}>Events</Text>
              </View>
              <View style={styles.bigStatCard}>
                <View style={[styles.bigStatIcon, { backgroundColor: '#E6F9EE' }]}>
                  <Clock color="#2BB673" size={22} />
                </View>
                <Text style={styles.bigStatValue}>
                  {impact.totalHours > 0 ? `${impact.totalHours}+` : '10,000+'}
                </Text>
                <Text style={styles.bigStatLabel}>Hours</Text>
              </View>
            </View>
          )}

          {eventTypeEntries.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <BarChart3 color={joyTheme.primaryDark} size={18} />
                <Text style={styles.sectionTitle}>Events by Type</Text>
              </View>
              {eventTypeEntries.map(([type, count]) => (
                <View key={type} style={styles.barRow}>
                  <Text style={styles.barLabel}>{type}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${(count / maxEventTypeCount) * 100}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.barCount}>{count}</Text>
                </View>
              ))}
            </View>
          )}

          {cityEntries.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <MapPin color={joyTheme.primaryDark} size={18} />
                <Text style={styles.sectionTitle}>Events by City</Text>
              </View>
              {cityEntries.map(([city, count]) => (
                <View key={city} style={styles.barRow}>
                  <Text style={styles.barLabel}>{city}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFillAlt,
                        { width: `${(count / maxCityCount) * 100}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.barCount}>{count}</Text>
                </View>
              ))}
            </View>
          )}

          {breakdown?.monthlyEvents && breakdown.monthlyEvents.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <TrendingUp color={joyTheme.primaryDark} size={18} />
                <Text style={styles.sectionTitle}>Monthly Activity</Text>
              </View>
              <View style={styles.monthlyGrid}>
                {breakdown.monthlyEvents.map((item) => (
                  <View key={item.month} style={styles.monthItem}>
                    <View style={styles.monthBarWrap}>
                      <View
                        style={[
                          styles.monthBar,
                          {
                            height: `${Math.max(
                              10,
                              (item.count /
                                Math.max(...breakdown.monthlyEvents.map((m) => m.count), 1)) *
                                100
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.monthLabel}>{item.month.split(' ')[0]}</Text>
                    <Text style={styles.monthCount}>{item.count}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {breakdown?.topVolunteers && breakdown.topVolunteers.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Zap color="#FFB020" size={18} />
                <Text style={styles.sectionTitle}>Top Joy Dealers</Text>
              </View>
              {breakdown.topVolunteers.map((vol, index) => (
                <View key={vol.id} style={styles.volunteerRow}>
                  <View style={styles.rankCircle}>
                    <Text style={styles.rankText}>#{index + 1}</Text>
                  </View>
                  {getAvatarUri(vol) ? (
                    <Image
                      source={{ uri: getAvatarUri(vol)! }}
                      style={styles.volunteerAvatar}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.volunteerAvatar, styles.volunteerAvatarPlaceholder]}>
                      <Text style={styles.volunteerInitials}>
                        {(vol.full_name ?? 'JD')
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.volunteerInfo}>
                    <Text style={styles.volunteerName}>
                      {vol.full_name ?? 'Joy Dealer'}
                    </Text>
                    <Text style={styles.volunteerMeta}>
                      {vol.total_points} pts · {vol.total_hours}h served
                    </Text>
                  </View>
                </View>
              ))}
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
    color: joyTheme.textMuted,
    fontSize: 15,
    fontFamily: fonts.semiBold,
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnSpacer: {
    width: 44,
  },
  topBarTitle: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: '#fff',
    letterSpacing: -0.3,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 16,
  },
  heroSection: {
    gap: 10,
    paddingBottom: 8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  heroBadgeText: {
    fontSize: 13,
    fontFamily: fonts.extraBold,
    color: '#fff',
  },
  heroTitle: {
    fontSize: 32,
    fontFamily: fonts.black,
    color: '#fff',
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: 'rgba(255,255,255,0.82)',
  },
  bigStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bigStatCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: joyTheme.border,
    shadowColor: joyTheme.shadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  bigStatIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigStatValue: {
    fontSize: 24,
    fontFamily: fonts.black,
    color: joyTheme.text,
  },
  bigStatLabel: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
  },
  sectionCard: {
    backgroundColor: '#fff',
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barLabel: {
    width: 90,
    fontSize: 13,
    fontFamily: fonts.bold,
    color: joyTheme.text,
    textTransform: 'capitalize' as const,
  },
  barTrack: {
    flex: 1,
    height: 10,
    backgroundColor: joyTheme.backgroundAlt,
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: joyTheme.primary,
    borderRadius: 5,
  },
  barFillAlt: {
    height: '100%',
    backgroundColor: '#2BB673',
    borderRadius: 5,
  },
  barCount: {
    width: 30,
    textAlign: 'right' as const,
    fontSize: 13,
    fontFamily: fonts.extraBold,
    color: joyTheme.primaryDark,
  },
  monthlyGrid: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 120,
  },
  monthItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  monthBarWrap: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  monthBar: {
    width: '100%',
    backgroundColor: joyTheme.primary,
    borderRadius: 4,
    minHeight: 4,
  },
  monthLabel: {
    fontSize: 9,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
  },
  monthCount: {
    fontSize: 10,
    fontFamily: fonts.extraBold,
    color: joyTheme.primaryDark,
  },
  volunteerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  rankCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: joyTheme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 12,
    fontFamily: fonts.black,
    color: joyTheme.text,
  },
  volunteerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  volunteerAvatarPlaceholder: {
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volunteerInitials: {
    fontSize: 14,
    fontFamily: fonts.extraBold,
    color: joyTheme.primaryDark,
  },
  volunteerInfo: {
    flex: 1,
    gap: 3,
  },
  volunteerName: {
    fontSize: 15,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
  },
  volunteerMeta: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  bottomSpacer: {
    height: 40,
  },
});
