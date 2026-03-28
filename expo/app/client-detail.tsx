import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Camera,
  ExternalLink,
  Globe,
  Heart,
  Share2,
  X,
} from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { fonts } from '@/constants/fonts';
import { joyTheme } from '@/constants/joyTheme';
import { resolveImageUrl } from '@/lib/imageUtils';
import { fetchPartnerById, fetchClientPartnerPhotos } from '@/lib/api';
import type { DbClientPartner, DbClientPartnerPhoto } from '@/types/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_GRID_GAP = 3;
const PHOTO_COLS = 3;
const PHOTO_CELL_SIZE = (SCREEN_WIDTH - 40 - PHOTO_GRID_GAP * (PHOTO_COLS - 1)) / PHOTO_COLS;

function getPartnerImageUri(partner: DbClientPartner): string | null {
  return resolveImageUrl(partner.image_url) ?? resolveImageUrl(partner.logo_url);
}

function ActionButton({
  onPress,
  icon,
  label,
  variant = 'default',
}: {
  onPress: () => void;
  icon: React.ReactNode;
  label: string;
  variant?: 'default' | 'primary' | 'donate';
}) {
  const scale = React.useRef(new Animated.Value(1)).current;

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

  const bgStyle =
    variant === 'donate'
      ? styles.actionDonate
      : variant === 'primary'
        ? styles.actionPrimary
        : styles.actionDefault;

  const textStyle =
    variant === 'donate'
      ? styles.actionDonateTxt
      : variant === 'primary'
        ? styles.actionPrimaryTxt
        : styles.actionDefaultTxt;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[styles.actionBtn, bgStyle, { transform: [{ scale }] }]}>
        {icon}
        <Text style={textStyle}>{label}</Text>
        {variant !== 'donate' && <ExternalLink color={variant === 'primary' ? '#fff' : joyTheme.textMuted} size={14} />}
      </Animated.View>
    </Pressable>
  );
}

const PhotoCell = React.memo(function PhotoCell({
  photo,
  index,
  onPress,
}: {
  photo: DbClientPartnerPhoto;
  index: number;
  onPress: () => void;
}) {
  const photoUri = resolveImageUrl(photo.photo_url) ?? photo.photo_url;

  return (
    <Pressable
      onPress={onPress}
      style={styles.photoCell}
      testID={`partner-photo-${index}`}
    >
      <Image
        source={{ uri: photoUri }}
        style={styles.photoCellImage}
        contentFit="cover"
      />
      {photo.caption ? (
        <View style={styles.photoCaptionOverlay}>
          <Text style={styles.photoCaptionText} numberOfLines={1}>
            {photo.caption}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
});

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [lightboxPhoto, setLightboxPhoto] = useState<DbClientPartnerPhoto | null>(null);

  const partnerQuery = useQuery({
    queryKey: ['client-partner', id],
    queryFn: () => fetchPartnerById(id!),
    enabled: !!id,
  });

  const photosQuery = useQuery({
    queryKey: ['client-partner-photos', id],
    queryFn: () => fetchClientPartnerPhotos(id!),
    enabled: !!id,
  });

  const partner = partnerQuery.data;
  const photos = useMemo(() => photosQuery.data ?? [], [photosQuery.data]);

  const handleWebsite = useCallback(() => {
    if (!partner?.website) return;
    console.log('[ClientDetail] Opening website in-app:', partner.website);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const fullUrl = partner.website.startsWith('http') ? partner.website : `https://${partner.website}`;
    WebBrowser.openBrowserAsync(fullUrl).catch((err) => console.error('[ClientDetail] Failed to open URL:', err));
  }, [partner?.website]);

  const handleDonate = useCallback(() => {
    if (!partner) return;
    console.log('[ClientDetail] Navigating to donate for partner:', partner.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push({ pathname: '/donate', params: { partnerId: partner.id } });
  }, [partner, router]);

  const handleShare = useCallback(async () => {
    if (!partner) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const url = partner.website ?? partner.donate_url ?? '';
    const message = `Check out ${partner.name}${partner.foundation ? ` – ${partner.foundation}` : ''}${url ? `\n${url}` : ''}`;
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(message);
      } catch {}
      return;
    }
    try {
      await Share.share({ message });
    } catch {}
  }, [partner]);

  const handlePhotoPress = useCallback((photo: DbClientPartnerPhoto) => {
    console.log('[ClientDetail] Photo pressed:', photo.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setLightboxPhoto(photo);
  }, []);

  const handleCloseLightbox = useCallback(() => {
    setLightboxPhoto(null);
  }, []);

  if (partnerQuery.isLoading) {
    return (
      <View style={[styles.screen, styles.centered]} testID="client-detail-loading">
        <ActivityIndicator size="large" color={joyTheme.primary} />
      </View>
    );
  }

  if (!partner) {
    return (
      <View style={[styles.screen, styles.centered]} testID="client-detail-empty">
        <Text style={styles.emptyText}>Client not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const imageUri = getPartnerImageUri(partner);
  const initials =
    partner.initials ??
    partner.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  return (
    <View style={styles.screen} testID="client-detail-screen">
      <View style={[styles.heroBg, partner.color ? { backgroundColor: partner.color + '18' } : null]} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.navbar}>
          <Pressable
            onPress={() => router.back()}
            style={styles.navBtn}
            hitSlop={12}
            testID="client-detail-back"
          >
            <ArrowLeft color={joyTheme.text} size={22} />
          </Pressable>
          <Text style={styles.navTitle} numberOfLines={1}>{partner.name}</Text>
          <Pressable onPress={handleShare} style={styles.navBtn} hitSlop={12}>
            <Share2 color={joyTheme.text} size={20} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileSection}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View
                style={[
                  styles.avatar,
                  styles.avatarPlaceholder,
                  partner.color ? { backgroundColor: partner.color + '20' } : null,
                ]}
              >
                <Text
                  style={[
                    styles.avatarInitials,
                    partner.color ? { color: partner.color } : null,
                  ]}
                >
                  {initials}
                </Text>
              </View>
            )}

            <Text style={styles.name}>{partner.name}</Text>

            {partner.foundation && (
              <Text style={styles.foundation}>{partner.foundation}</Text>
            )}

            {(partner.team || partner.sport) && (
              <View style={styles.tagRow}>
                {partner.sport && (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{partner.sport}</Text>
                  </View>
                )}
                {partner.team && (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{partner.team}</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {partner.description && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>About</Text>
              <Text style={styles.descriptionText}>{partner.description}</Text>
            </View>
          )}

          {partner.mission && (
            <View style={styles.missionCard}>
              <Heart color={joyTheme.primary} size={18} />
              <View style={styles.missionContent}>
                <Text style={styles.missionLabel}>Mission</Text>
                <Text style={styles.missionText}>{partner.mission}</Text>
              </View>
            </View>
          )}

          {photos.length > 0 && (
            <View style={styles.photosSection}>
              <View style={styles.photosSectionHeader}>
                <Camera color={joyTheme.primary} size={18} />
                <Text style={styles.photosSectionTitle}>Photos</Text>
                <View style={styles.photosCountBadge}>
                  <Text style={styles.photosCountText}>{photos.length}</Text>
                </View>
              </View>
              <View style={styles.photoGrid}>
                {photos.map((photo, index) => (
                  <PhotoCell
                    key={photo.id}
                    photo={photo}
                    index={index}
                    onPress={() => handlePhotoPress(photo)}
                  />
                ))}
              </View>
            </View>
          )}

          <View style={styles.actionsSection}>
            {partner.donate_url && (
              <ActionButton
                onPress={handleDonate}
                icon={<Heart color="#fff" size={20} />}
                label="Donate Now"
                variant="donate"
              />
            )}
            {partner.website && (
              <ActionButton
                onPress={handleWebsite}
                icon={<Globe color="#fff" size={20} />}
                label="Visit Website"
                variant="primary"
              />
            )}
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={!!lightboxPhoto}
        transparent
        animationType="fade"
        onRequestClose={handleCloseLightbox}
      >
        <Pressable style={styles.lightbox} onPress={handleCloseLightbox}>
          <Pressable style={styles.lightboxClose} onPress={handleCloseLightbox}>
            <X color="#fff" size={20} />
          </Pressable>
          {lightboxPhoto && (
            <>
              <Image
                source={{ uri: resolveImageUrl(lightboxPhoto.photo_url) ?? lightboxPhoto.photo_url }}
                style={styles.lightboxImage}
                contentFit="contain"
              />
              {lightboxPhoto.caption ? (
                <View style={styles.lightboxInfo}>
                  <Text style={styles.lightboxCaption}>{lightboxPhoto.caption}</Text>
                </View>
              ) : null}
            </>
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
    fontSize: 17,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
  },
  backBtn: {
    backgroundColor: joyTheme.primarySoft,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  backBtnText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: joyTheme.primaryDark,
  },
  heroBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 280,
    backgroundColor: joyTheme.backgroundAlt,
  },
  safeArea: {
    flex: 1,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 28,
    gap: 8,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 32,
    marginBottom: 8,
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 36,
    fontFamily: fonts.black,
    color: joyTheme.primaryDark,
  },
  name: {
    fontSize: 26,
    fontFamily: fonts.black,
    color: joyTheme.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  foundation: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: joyTheme.primaryDark,
    textAlign: 'center',
  },
  tagRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  tag: {
    backgroundColor: joyTheme.primarySoft,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: joyTheme.primaryDark,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: fonts.extraBold,
    color: joyTheme.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 24,
    color: joyTheme.text,
    fontFamily: fonts.medium,
  },
  missionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: joyTheme.border,
    borderLeftWidth: 4,
    borderLeftColor: joyTheme.primary,
  },
  missionContent: {
    flex: 1,
    gap: 4,
  },
  missionLabel: {
    fontSize: 13,
    fontFamily: fonts.extraBold,
    color: joyTheme.primaryDark,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  missionText: {
    fontSize: 15,
    lineHeight: 23,
    fontFamily: fonts.medium,
    color: joyTheme.text,
  },
  photosSection: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: joyTheme.border,
    gap: 14,
  },
  photosSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  photosSectionTitle: {
    fontSize: 15,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
    flex: 1,
  },
  photosCountBadge: {
    backgroundColor: joyTheme.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  photosCountText: {
    fontSize: 12,
    fontFamily: fonts.extraBold,
    color: joyTheme.primaryDark,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PHOTO_GRID_GAP,
  },
  photoCell: {
    width: PHOTO_CELL_SIZE,
    height: PHOTO_CELL_SIZE,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: joyTheme.backgroundAlt,
  },
  photoCellImage: {
    width: '100%',
    height: '100%',
  },
  photoCaptionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  photoCaptionText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: fonts.semiBold,
  },
  actionsSection: {
    gap: 12,
    marginTop: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  actionDonate: {
    backgroundColor: '#E8475F',
  },
  actionDonateTxt: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: '#fff',
  },
  actionPrimary: {
    backgroundColor: joyTheme.primary,
  },
  actionPrimaryTxt: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: '#fff',
  },
  actionDefault: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: joyTheme.border,
  },
  actionDefaultTxt: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: joyTheme.text,
  },
  bottomSpacer: {
    height: 40,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  lightboxInfo: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  lightboxCaption: {
    color: '#fff',
    fontSize: 16,
    fontFamily: fonts.semiBold,
    textAlign: 'center',
  },
});
