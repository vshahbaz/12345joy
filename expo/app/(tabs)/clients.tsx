import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Camera,
  ExternalLink,
  Heart,
  Search,
  Users,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { SectionTitle } from '@/components/SectionTitle';
import { fonts } from '@/constants/fonts';
import { joyTheme } from '@/constants/joyTheme';
import { resolveImageUrl } from '@/lib/imageUtils';
import { fetchClientPartners, fetchAllClientPartnerPhotos } from '@/lib/api';
import type { DbClientPartner, DbClientPartnerPhoto } from '@/types/database';

const CARD_GAP = 12;
const HORIZONTAL_PAD = 20;
const PHOTO_THUMB_SIZE = 36;
const MAX_THUMBS = 4;

function getPartnerImageUri(partner: DbClientPartner): string | null {
  return resolveImageUrl(partner.image_url) ?? resolveImageUrl(partner.logo_url);
}

const ClientCard = React.memo(function ClientCard({
  partner,
  photos,
  onPress,
  onDonate,
  onWebsite,
}: {
  partner: DbClientPartner;
  photos: DbClientPartnerPhoto[];
  onPress: () => void;
  onDonate: () => void;
  onWebsite: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const [imageError, setImageError] = useState(false);
  const imageUri = getPartnerImageUri(partner);
  console.log('[ClientCard] Partner:', partner.name, 'image_url:', partner.image_url, 'logo_url:', partner.logo_url, 'resolved:', imageUri);
  const initials =
    partner.initials ??
    partner.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  const accentColor = partner.color || joyTheme.primary;
  const visiblePhotos = photos.slice(0, MAX_THUMBS);
  const extraCount = photos.length - MAX_THUMBS;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      testID={`client-card-${partner.id}`}
    >
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <View style={styles.cardImageContainer}>
          {imageUri && !imageError ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.cardImage}
              contentFit="cover"
              onError={(e: any) => {
                console.error('[ClientCard] Image load error for', partner.name, ':', imageUri, e?.error || e);
                setImageError(true);
              }}
            />
          ) : (
            <View
              style={[
                styles.cardImage,
                styles.cardImagePlaceholder,
                { backgroundColor: accentColor + '15' },
              ]}
            >
              <Text style={[styles.cardInitials, { color: accentColor }]}>
                {initials}
              </Text>
            </View>
          )}
          {partner.sport && (
            <View style={[styles.sportBadge, { backgroundColor: accentColor }]}>
              <Text style={styles.sportBadgeText}>{partner.sport}</Text>
            </View>
          )}
          {photos.length > 0 && (
            <View style={styles.photoCountBadge}>
              <Camera color="#fff" size={10} />
              <Text style={styles.photoCountText}>{photos.length}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardName} numberOfLines={2}>{partner.name}</Text>
          {partner.foundation && (
            <Text style={styles.cardFoundation} numberOfLines={1}>{partner.foundation}</Text>
          )}
          {partner.team && (
            <Text style={styles.cardTeam} numberOfLines={1}>{partner.team}</Text>
          )}

          {visiblePhotos.length > 0 && (
            <View style={styles.photoStrip}>
              {visiblePhotos.map((photo, idx) => (
                <View
                  key={photo.id}
                  style={[
                    styles.photoThumb,
                    idx > 0 && { marginLeft: -8 },
                    { zIndex: MAX_THUMBS - idx },
                  ]}
                >
                  <Image
                    source={{ uri: resolveImageUrl(photo.photo_url) ?? photo.photo_url }}
                    style={styles.photoThumbImage}
                    contentFit="cover"
                  />
                </View>
              ))}
              {extraCount > 0 && (
                <View style={[styles.photoThumb, styles.photoThumbExtra, { marginLeft: -8, zIndex: 0 }]}>
                  <Text style={styles.photoThumbExtraText}>+{extraCount}</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.cardActions}>
            {partner.donate_url ? (
              <Pressable
                style={styles.donateBtn}
                onPress={(e) => {
                  e.stopPropagation?.();
                  onDonate();
                }}
                hitSlop={4}
              >
                <Heart color="#fff" size={13} />
                <Text style={styles.donateBtnText}>Donate</Text>
              </Pressable>
            ) : null}
            {partner.website ? (
              <Pressable
                style={styles.websiteBtn}
                onPress={(e) => {
                  e.stopPropagation?.();
                  onWebsite();
                }}
                hitSlop={4}
              >
                <ExternalLink color={joyTheme.primaryDark} size={13} />
                <Text style={styles.websiteBtnText}>Website</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
});

export default function ClientsScreen() {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const router = useRouter();

  const partnersQuery = useQuery({
    queryKey: ['client-partners'],
    queryFn: fetchClientPartners,
  });

  const photosQuery = useQuery({
    queryKey: ['all-client-partner-photos'],
    queryFn: fetchAllClientPartnerPhotos,
  });

  const partners = useMemo(() => partnersQuery.data ?? [], [partnersQuery.data]);
  const allPhotos = useMemo(() => photosQuery.data ?? [], [photosQuery.data]);

  const photosByPartner = useMemo(() => {
    const map: Record<string, DbClientPartnerPhoto[]> = {};
    allPhotos.forEach((photo) => {
      if (!map[photo.client_partner_id]) {
        map[photo.client_partner_id] = [];
      }
      map[photo.client_partner_id].push(photo);
    });
    return map;
  }, [allPhotos]);

  const filteredPartners = useMemo(() => {
    if (!searchQuery.trim()) return partners;
    const q = searchQuery.toLowerCase();
    return partners.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.foundation?.toLowerCase().includes(q) ||
        p.sport?.toLowerCase().includes(q) ||
        p.team?.toLowerCase().includes(q)
    );
  }, [partners, searchQuery]);

  const handlePartnerPress = useCallback((partner: DbClientPartner) => {
    console.log('[ClientsScreen] Partner pressed:', partner.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/client-detail', params: { id: partner.id } });
  }, [router]);

  const handleDonate = useCallback((partnerId: string) => {
    console.log('[ClientsScreen] Navigating to donate for partner:', partnerId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push({ pathname: '/donate', params: { partnerId } });
  }, [router]);

  const handleWebsite = useCallback((partnerId: string) => {
    console.log('[ClientsScreen] Navigating to client detail from website button:', partnerId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/client-detail', params: { id: partnerId } });
  }, [router]);

  const partnersRefetch = partnersQuery.refetch;
  const photosRefetch = photosQuery.refetch;

  const handleRefresh = useCallback(() => {
    console.log('[ClientsScreen] Refreshing clients');
    void partnersRefetch();
    void photosRefetch();
  }, [partnersRefetch, photosRefetch]);

  const leftColumn = useMemo(() => filteredPartners.filter((_, i) => i % 2 === 0), [filteredPartners]);
  const rightColumn = useMemo(() => filteredPartners.filter((_, i) => i % 2 === 1), [filteredPartners]);

  if (partnersQuery.isLoading) {
    return (
      <View style={[styles.screen, styles.centered]} testID="clients-loading">
        <ActivityIndicator size="large" color={joyTheme.primary} />
        <Text style={styles.loadingText}>Loading clients...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen} testID="clients-screen">
      <View style={styles.topTint} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
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
            title="Our Clients"
            subtitle={`${partners.length} partner${partners.length === 1 ? '' : 's'} powering the Joy Dealer movement`}
          />

          <View style={styles.searchContainer}>
            <Search color={joyTheme.textMuted} size={18} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search clients..."
              placeholderTextColor={joyTheme.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              testID="clients-search"
            />
          </View>

          {filteredPartners.length === 0 ? (
            <View style={styles.emptyState}>
              <Users color={joyTheme.textMuted} size={40} />
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No results found' : 'No clients yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'Try a different search term.'
                  : 'Check back soon for partner announcements!'}
              </Text>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              <View style={styles.gridColumn}>
                {leftColumn.map((partner) => (
                  <ClientCard
                    key={partner.id}
                    partner={partner}
                    photos={photosByPartner[partner.id] ?? []}
                    onPress={() => handlePartnerPress(partner)}
                    onDonate={() => handleDonate(partner.id)}
                    onWebsite={() => handleWebsite(partner.id)}
                  />
                ))}
              </View>
              <View style={styles.gridColumn}>
                {rightColumn.map((partner) => (
                  <ClientCard
                    key={partner.id}
                    partner={partner}
                    photos={photosByPartner[partner.id] ?? []}
                    onPress={() => handlePartnerPress(partner)}
                    onDonate={() => handleDonate(partner.id)}
                    onWebsite={() => handleWebsite(partner.id)}
                  />
                ))}
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
    color: joyTheme.textMuted,
    fontSize: 15,
    fontFamily: fonts.semiBold,
  },
  topTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: joyTheme.backgroundAlt,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: HORIZONTAL_PAD,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: joyTheme.text,
    padding: 0,
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
  gridContainer: {
    flexDirection: 'row',
    gap: CARD_GAP,
  },
  gridColumn: {
    flex: 1,
    gap: CARD_GAP,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: joyTheme.border,
    shadowColor: 'rgba(10, 60, 120, 0.12)',
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardImageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative' as const,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInitials: {
    fontSize: 36,
    fontFamily: fonts.black,
    letterSpacing: -1,
  },
  sportBadge: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sportBadgeText: {
    fontSize: 10,
    fontFamily: fonts.extraBold,
    color: '#fff',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  photoCountBadge: {
    position: 'absolute' as const,
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  photoCountText: {
    fontSize: 10,
    fontFamily: fonts.extraBold,
    color: '#fff',
  },
  cardBody: {
    padding: 12,
    gap: 2,
  },
  cardName: {
    fontSize: 15,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  cardFoundation: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: joyTheme.primaryDark,
    marginTop: 1,
  },
  cardTeam: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  photoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 2,
  },
  photoThumb: {
    width: PHOTO_THUMB_SIZE,
    height: PHOTO_THUMB_SIZE,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
  },
  photoThumbExtra: {
    backgroundColor: joyTheme.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoThumbExtraText: {
    fontSize: 10,
    fontFamily: fonts.extraBold,
    color: joyTheme.textMuted,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap' as const,
  },
  donateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8475F',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  donateBtnText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: '#fff',
  },
  websiteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: joyTheme.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  websiteBtnText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: joyTheme.primaryDark,
  },
  bottomSpacer: {
    height: 24,
  },
});
