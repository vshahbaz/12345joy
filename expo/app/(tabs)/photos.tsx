import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Camera, Filter, X } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
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
import { fetchAllPhotosWithEvents, fetchAllEvents } from '@/lib/api';
import type { DbEvent, DbEventPhoto } from '@/types/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 3;
const COLS = 3;
const PHOTO_SIZE = (SCREEN_WIDTH - 40 - GRID_GAP * (COLS - 1)) / COLS;

type PhotoWithEvent = DbEventPhoto & { events?: DbEvent };

export default function PhotosScreen() {
  const router = useRouter();
  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoWithEvent | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const photosQuery = useQuery({
    queryKey: ['all-photos-with-events'],
    queryFn: fetchAllPhotosWithEvents,
  });

  const eventsQuery = useQuery({
    queryKey: ['all-events'],
    queryFn: fetchAllEvents,
  });

  const photos = useMemo(() => photosQuery.data ?? [], [photosQuery.data]);
  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);

  const eventsWithPhotos = useMemo(() => {
    const photoEventIds = new Set(photos.map((p) => p.event_id));
    return events.filter((e) => photoEventIds.has(e.id));
  }, [photos, events]);

  const filteredPhotos = useMemo(() => {
    if (!selectedEventId) return photos;
    return photos.filter((p) => p.event_id === selectedEventId);
  }, [photos, selectedEventId]);

  const handlePhotoPress = useCallback((photo: PhotoWithEvent) => {
    console.log('[PhotosScreen] Photo pressed:', photo.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setLightboxPhoto(photo);
  }, []);

  const handleEventFilter = useCallback((eventId: string | null) => {
    console.log('[PhotosScreen] Filter by event:', eventId);
    Haptics.selectionAsync().catch(() => {});
    setSelectedEventId(eventId);
  }, []);

  const handleEventPress = useCallback((eventId: string) => {
    console.log('[PhotosScreen] Navigate to event:', eventId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/event-detail', params: { id: eventId } });
  }, [router]);

  const photosRefetch = photosQuery.refetch;
  const eventsRefetch = eventsQuery.refetch;

  const handleRefresh = useCallback(() => {
    console.log('[PhotosScreen] Refreshing photos');
    void photosRefetch();
    void eventsRefetch();
  }, [photosRefetch, eventsRefetch]);

  if (photosQuery.isLoading) {
    return (
      <View style={[styles.screen, styles.centered]} testID="photos-loading">
        <ActivityIndicator size="large" color={joyTheme.primary} />
        <Text style={styles.loadingText}>Loading gallery...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen} testID="photos-screen">
      <View style={styles.topTint} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={photosQuery.isRefetching}
              onRefresh={handleRefresh}
              tintColor={joyTheme.primary}
            />
          }
        >
          <SectionTitle
            eyebrow="Gallery"
            title="Community photos"
            subtitle={`${filteredPhotos.length} photo${filteredPhotos.length === 1 ? '' : 's'} from volunteer events`}
          />

          {eventsWithPhotos.length > 0 && (
            <View style={styles.filterSection}>
              <View style={styles.filterHeader}>
                <Filter color={joyTheme.textMuted} size={14} />
                <Text style={styles.filterLabel}>Filter by event</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScroll}
              >
                <Pressable
                  onPress={() => handleEventFilter(null)}
                  style={[styles.filterChip, !selectedEventId && styles.filterChipActive]}
                >
                  <Text style={!selectedEventId ? styles.filterChipActiveText : styles.filterChipText}>
                    All Photos
                  </Text>
                </Pressable>
                {eventsWithPhotos.map((event) => (
                  <Pressable
                    key={event.id}
                    onPress={() => handleEventFilter(event.id)}
                    style={[
                      styles.filterChip,
                      selectedEventId === event.id && styles.filterChipActive,
                    ]}
                  >
                    <Text
                      style={
                        selectedEventId === event.id
                          ? styles.filterChipActiveText
                          : styles.filterChipText
                      }
                      numberOfLines={1}
                    >
                      {event.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {filteredPhotos.length === 0 ? (
            <View style={styles.emptyState}>
              <Camera color={joyTheme.textMuted} size={40} />
              <Text style={styles.emptyTitle}>No photos yet</Text>
              <Text style={styles.emptySubtitle}>
                Photos from community events will appear here.
              </Text>
            </View>
          ) : (
            <View style={styles.photoGrid}>
              {filteredPhotos.map((photo, index) => (
                <Pressable
                  key={photo.id}
                  onPress={() => handlePhotoPress(photo)}
                  style={styles.photoCell}
                  testID={`gallery-photo-${index}`}
                >
                  <Image
                    source={{ uri: resolveImageUrl(photo.photo_url) ?? photo.photo_url }}
                    style={styles.photoImage}
                    contentFit="cover"
                  />
                  {photo.caption && (
                    <View style={styles.captionOverlay}>
                      <Text style={styles.captionText} numberOfLines={1}>
                        {photo.caption}
                      </Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={!!lightboxPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxPhoto(null)}
      >
        <Pressable style={styles.lightbox} onPress={() => setLightboxPhoto(null)}>
          <Pressable style={styles.lightboxClose} onPress={() => setLightboxPhoto(null)}>
            <X color="#fff" size={20} />
          </Pressable>
          {lightboxPhoto && (
            <>
              <Image
                source={{ uri: resolveImageUrl(lightboxPhoto.photo_url) ?? lightboxPhoto.photo_url }}
                style={styles.lightboxImage}
                contentFit="contain"
              />
              <View style={styles.lightboxInfo}>
                {lightboxPhoto.caption && (
                  <Text style={styles.lightboxCaption}>{lightboxPhoto.caption}</Text>
                )}
                {lightboxPhoto.events?.title && (
                  <Pressable
                    onPress={() => {
                      setLightboxPhoto(null);
                      handleEventPress(lightboxPhoto.event_id);
                    }}
                    style={styles.lightboxEventLink}
                  >
                    <Text style={styles.lightboxEventText}>
                      From: {lightboxPhoto.events.title} →
                    </Text>
                  </Pressable>
                )}
              </View>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 18,
  },
  filterSection: {
    gap: 8,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterLabel: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
  },
  filterScroll: {
    gap: 8,
    paddingRight: 20,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: joyTheme.surface,
    borderWidth: 1,
    borderColor: joyTheme.border,
    maxWidth: 180,
  },
  filterChipActive: {
    backgroundColor: joyTheme.primary,
    borderColor: joyTheme.primary,
  },
  filterChipText: {
    color: joyTheme.text,
    fontSize: 13,
    fontFamily: fonts.bold,
  },
  filterChipActiveText: {
    color: joyTheme.textOnDark,
    fontSize: 13,
    fontFamily: fonts.extraBold,
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
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  photoCell: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: joyTheme.backgroundAlt,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  captionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  captionText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: fonts.semiBold,
  },
  bottomSpacer: {
    height: 24,
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
    gap: 10,
    alignItems: 'center',
  },
  lightboxCaption: {
    color: '#fff',
    fontSize: 16,
    fontFamily: fonts.semiBold,
    textAlign: 'center',
  },
  lightboxEventLink: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  lightboxEventText: {
    color: joyTheme.accent,
    fontSize: 14,
    fontFamily: fonts.bold,
  },
});
