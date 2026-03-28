import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronRight,
  Heart,
  Shield,
} from 'lucide-react-native';
import React, { useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import { fetchClientPartners } from '@/lib/api';
import type { DbClientPartner } from '@/types/database';

function getPartnerImageUri(partner: DbClientPartner): string | null {
  return resolveImageUrl(partner.image_url) ?? resolveImageUrl(partner.logo_url);
}

const DonateCard = React.memo(function DonateCard({
  partner,
  onDonate,
  onPartnerPress,
}: {
  partner: DbClientPartner;
  onDonate: (url: string, name?: string, partnerId?: string) => void;
  onPartnerPress: (partnerId: string) => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const imageUri = getPartnerImageUri(partner);
  const initials =
    partner.initials ??
    partner.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scale]);

  const handleDonate = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onDonate(partner.donate_url ?? '', partner.name, partner.id);
  }, [partner.donate_url, partner.name, partner.id, onDonate]);

  const handlePartnerNavigate = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPartnerPress(partner.id);
  }, [partner.id, onPartnerPress]);

  return (
    <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
      <View
        style={styles.cardInner}
      >
        <Pressable
          onPress={handlePartnerNavigate}
          style={styles.cardHeader}
          testID={`donate-card-${partner.id}`}
        >
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.partnerImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[styles.partnerInitials, { backgroundColor: partner.color ?? '#0E3C73' }]}>
              <Text style={styles.initialsText}>{initials}</Text>
            </View>
          )}
          <View style={styles.cardInfo}>
            <Text style={styles.partnerName} numberOfLines={1}>
              {partner.name}
            </Text>
            {partner.foundation ? (
              <Text style={styles.partnerFoundation} numberOfLines={1}>
                {partner.foundation}
              </Text>
            ) : null}
          </View>
          <ChevronRight color={joyTheme.textMuted} size={18} />
        </Pressable>

        {partner.mission ? (
          <Text style={styles.missionText} numberOfLines={3}>
            {partner.mission}
          </Text>
        ) : partner.description ? (
          <Text style={styles.missionText} numberOfLines={3}>
            {partner.description}
          </Text>
        ) : null}

        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handleDonate}
          style={styles.donateRow}
        >
          <View style={styles.donateBtnPrimary}>
            <Heart color="#fff" size={16} fill="#fff" />
            <Text style={styles.donateBtnText}>Donate Now</Text>
          </View>

        </Pressable>
      </View>
    </Animated.View>
  );
});

export default function DonateScreen() {
  const router = useRouter();
  const { partnerId } = useLocalSearchParams<{ partnerId?: string }>();

  const partnersQuery = useQuery({
    queryKey: ['client-partners'],
    queryFn: fetchClientPartners,
  });

  const donatePartners = React.useMemo(() => {
    if (!partnersQuery.data) return [];
    const withDonate = partnersQuery.data.filter((p) => !!p.donate_url);
    if (partnerId) {
      const target = withDonate.find((p) => p.id === partnerId);
      if (target) {
        const rest = withDonate.filter((p) => p.id !== partnerId);
        return [target, ...rest];
      }
    }
    return withDonate;
  }, [partnersQuery.data, partnerId]);

  const handleDonate = useCallback((_url: string, name?: string, partnerId?: string) => {
    console.log('[DonateScreen] Navigating to native donate form');
    router.push({ pathname: '/donate-form', params: { partnerId: partnerId ?? '', partnerName: name ?? 'Joy Dealer Foundation' } });
  }, [router]);

  const handlePartnerPress = useCallback((partnerId: string) => {  
    console.log('[DonateScreen] Navigating to client detail:', partnerId);
    router.push({ pathname: '/client-detail', params: { id: partnerId } });
  }, [router]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.back();
  }, [router]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
            hitSlop={12}
            testID="donate-back"
          >
            <ArrowLeft color={joyTheme.text} size={24} />
          </Pressable>
          <Text style={styles.headerTitle}>Donate</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={partnersQuery.isFetching && !partnersQuery.isLoading}
            onRefresh={() => partnersQuery.refetch()}
            tintColor={joyTheme.primary}
          />
        }
      >
        <View style={styles.heroSection}>
          <View style={styles.heroIconWrap}>
            <Heart color="#FF6B8A" size={32} fill="#FF6B8A" />
          </View>
          <Text style={styles.heroTitle}>Support a Cause</Text>
          <Text style={styles.heroSubtitle}>
            Choose an organization below to make a direct donation. Every contribution makes a difference in the communities we serve.
          </Text>
        </View>

        {partnersQuery.isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={joyTheme.primary} />
            <Text style={styles.loadingText}>Loading organizations...</Text>
          </View>
        ) : donatePartners.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Heart color={joyTheme.textMuted} size={40} />
            <Text style={styles.emptyTitle}>No Organizations Yet</Text>
            <Text style={styles.emptySubtitle}>
              Donation links will appear here once our partner organizations set them up.
            </Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {donatePartners.map((partner) => (
              <DonateCard
                key={partner.id}
                partner={partner}
                onDonate={handleDonate}
                onPartnerPress={handlePartnerPress}
              />
            ))}
          </View>
        )}

        <View style={styles.trustSection}>
          <Shield color={joyTheme.textMuted} size={18} />
          <Text style={styles.trustText}>
            All donations go directly to the selected organization. Joy Dealer facilitates giving but does not process donations.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: joyTheme.background,
  },
  safeArea: {
    backgroundColor: joyTheme.surface,
    borderBottomWidth: 1,
    borderBottomColor: joyTheme.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: joyTheme.text,
    letterSpacing: -0.3,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 24,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 26,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 15,
    color: joyTheme.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: joyTheme.textMuted,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: joyTheme.text,
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: joyTheme.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  cardList: {
    paddingHorizontal: 20,
    gap: 14,
  },
  card: {
    borderRadius: 16,
    backgroundColor: joyTheme.surface,
    shadowColor: joyTheme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  cardInner: {
    padding: 18,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  partnerImage: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: joyTheme.backgroundAlt,
  },
  partnerInitials: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontSize: 20,
    fontFamily: fonts.extraBold,
    color: '#fff',
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  partnerName: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: joyTheme.text,
    letterSpacing: -0.2,
  },
  partnerFoundation: {
    fontSize: 13,
    color: joyTheme.textMuted,
  },
  missionText: {
    fontSize: 14,
    color: joyTheme.textMuted,
    lineHeight: 20,
  },
  donateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  donateBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8475F',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
  },
  donateBtnText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: '#fff',
  },
  trustSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 28,
    marginHorizontal: 20,
    padding: 16,
    backgroundColor: joyTheme.surfaceAlt,
    borderRadius: 12,
  },
  trustText: {
    flex: 1,
    fontSize: 13,
    color: joyTheme.textMuted,
    lineHeight: 19,
  },
});
