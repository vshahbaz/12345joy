import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  Heart,
  Trophy,
} from 'lucide-react-native';
import React, { useCallback } from 'react';
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

import { SectionTitle } from '@/components/SectionTitle';
import { fonts } from '@/constants/fonts';
import { joyTheme } from '@/constants/joyTheme';
import { resolveImageUrl } from '@/lib/imageUtils';
import { fetchClientPartners } from '@/lib/api';
import type { DbClientPartner } from '@/types/database';

function getPartnerImageUri(partner: DbClientPartner): string | null {
  return resolveImageUrl(partner.image_url) ?? resolveImageUrl(partner.logo_url);
}

export default function PartnersScreen() {
  const router = useRouter();

  const partnersQuery = useQuery({
    queryKey: ['client-partners'],
    queryFn: fetchClientPartners,
  });

  const partners = partnersQuery.data ?? [];

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.back();
  }, [router]);

  const handleWebsite = useCallback((url: string) => {
    console.log('[PartnersScreen] Opening website in-app:', url);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/donate-webview', params: { url, title: 'Website' } });
  }, [router]);

  const handleDonate = useCallback((url: string) => {
    console.log('[PartnersScreen] Opening donate in-app:', url);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/donate-webview', params: { url, title: 'Donate' } });
  }, [router]);

  const partnersRefetch = partnersQuery.refetch;

  const handleRefresh = useCallback(() => {
    console.log('[PartnersScreen] Refreshing partners');
    void partnersRefetch();
  }, [partnersRefetch]);

  if (partnersQuery.isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color={joyTheme.primary} />
        <Text style={styles.loadingText}>Loading partners...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen} testID="partners-screen">
      <View style={styles.topTint} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={handleBack} style={styles.backBtn} testID="partners-back">
            <ArrowLeft color={joyTheme.text} size={22} />
          </Pressable>
          <Text style={styles.topBarTitle}>Partners</Text>
          <View style={styles.backBtnSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={partnersQuery.isRefetching}
              onRefresh={handleRefresh}
              tintColor={joyTheme.primary}
            />
          }
        >
          <SectionTitle
            eyebrow="Athletes & Foundations"
            title="Our amazing partners"
            subtitle="Organizations and athletes powering the Joy Dealer movement."
          />

          {partners.length === 0 ? (
            <View style={styles.emptyState}>
              <Trophy color={joyTheme.textMuted} size={40} />
              <Text style={styles.emptyTitle}>No partners yet</Text>
              <Text style={styles.emptySubtitle}>Check back soon for partner announcements!</Text>
            </View>
          ) : (
            partners.map((partner) => {
              const imageUri = getPartnerImageUri(partner);
              const initials = partner.initials ??
                partner.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();

              return (
                <View key={partner.id} style={styles.partnerCard} testID={`partner-card-${partner.id}`}>
                  <View style={styles.partnerHeader}>
                    {imageUri ? (
                      <Image source={{ uri: imageUri }} style={styles.partnerImage} contentFit="cover" />
                    ) : (
                      <View style={[styles.partnerImage, styles.partnerImagePlaceholder, partner.color ? { backgroundColor: partner.color + '20' } : null]}>
                        <Text style={[styles.partnerInitials, partner.color ? { color: partner.color } : null]}>
                          {initials}
                        </Text>
                      </View>
                    )}
                    <View style={styles.partnerTitleBlock}>
                      <Text style={styles.partnerName}>{partner.name}</Text>
                      {partner.foundation && (
                        <Text style={styles.partnerFoundation}>{partner.foundation}</Text>
                      )}
                      {(partner.team || partner.sport) && (
                        <Text style={styles.partnerTeam}>
                          {[partner.team, partner.sport].filter(Boolean).join(' · ')}
                        </Text>
                      )}
                    </View>
                  </View>

                  {partner.description && (
                    <Text style={styles.partnerDescription}>{partner.description}</Text>
                  )}

                  {partner.mission && (
                    <View style={styles.missionCard}>
                      <Heart color={joyTheme.primary} size={14} />
                      <Text style={styles.missionText}>{partner.mission}</Text>
                    </View>
                  )}

                  <View style={styles.partnerActions}>
                    {partner.website && (
                      <Pressable
                        onPress={() => handleWebsite(partner.website!)}
                        style={styles.actionBtn}
                      >
                        <Globe color={joyTheme.primary} size={16} />
                        <Text style={styles.actionBtnText}>Website</Text>
                        <ExternalLink color={joyTheme.textMuted} size={12} />
                      </Pressable>
                    )}
                    {partner.donate_url && (
                      <Pressable
                        onPress={() => handleDonate(partner.donate_url!)}
                        style={[styles.actionBtn, styles.actionBtnDonate]}
                      >
                        <Heart color="#fff" size={16} />
                        <Text style={styles.actionBtnDonateText}>Donate</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })
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
  topTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
    backgroundColor: joyTheme.backgroundAlt,
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
    borderBottomWidth: 1,
    borderBottomColor: joyTheme.border,
    backgroundColor: '#fff',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnSpacer: {
    width: 40,
  },
  topBarTitle: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
    letterSpacing: -0.3,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
    backgroundColor: joyTheme.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: joyTheme.textMuted,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  partnerCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: joyTheme.border,
    shadowColor: joyTheme.shadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  partnerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  partnerImage: {
    width: 64,
    height: 64,
    borderRadius: 20,
  },
  partnerImagePlaceholder: {
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerInitials: {
    fontSize: 22,
    fontFamily: fonts.black,
    color: joyTheme.primaryDark,
  },
  partnerTitleBlock: {
    flex: 1,
    gap: 3,
  },
  partnerName: {
    fontSize: 19,
    fontFamily: fonts.black,
    color: joyTheme.text,
    letterSpacing: -0.3,
  },
  partnerFoundation: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: joyTheme.primaryDark,
  },
  partnerTeam: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  partnerDescription: {
    fontSize: 15,
    lineHeight: 23,
    color: joyTheme.textMuted,
  },
  missionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: joyTheme.primarySoft,
    borderRadius: 16,
    padding: 14,
  },
  missionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.semiBold,
    color: joyTheme.primaryDark,
  },
  partnerActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: joyTheme.primarySoft,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionBtnText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: joyTheme.primaryDark,
  },
  actionBtnDonate: {
    backgroundColor: joyTheme.primary,
  },
  actionBtnDonateText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: '#fff',
  },
  bottomSpacer: {
    height: 40,
  },
});
