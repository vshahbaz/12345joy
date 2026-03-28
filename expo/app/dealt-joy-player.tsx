import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  Play,
  Share2,
  Star,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JOY_SMILEY } from '@/constants/branding';
import { joyTheme } from '@/constants/joyTheme';
import { fetchDealtJoyVideos } from '@/lib/api';
import { resolveImageUrl } from '@/lib/imageUtils';
import type { DbDealtJoyVideo } from '@/types/database';


function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DealtJoyPlayerScreen() {
  const { id } = useLocalSearchParams<{ id?: string; url?: string; title?: string }>();
  const router = useRouter();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  const videosQuery = useQuery({
    queryKey: ['dealt-joy-videos'],
    queryFn: fetchDealtJoyVideos,
  });

  const videos = useMemo(() => videosQuery.data ?? [], [videosQuery.data]);
  const currentVideo = useMemo(
    () => videos.find((v) => v.id === id) ?? null,
    [videos, id]
  );
  const otherVideos = useMemo(
    () => videos.filter((v) => v.id !== id),
    [videos, id]
  );

  const handlePlayVideo = useCallback(async (videoUrl: string) => {
    console.log('[DealtJoyPlayer] Opening video URL:', videoUrl);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      if (Platform.OS === 'web') {
        window.open(videoUrl, '_blank');
      } else {
        await Linking.openURL(videoUrl);
      }
    } catch (err) {
      console.error('[DealtJoyPlayer] Error opening video:', err);
    }
  }, []);

  const handleShare = useCallback(async (video: DbDealtJoyVideo) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await Share.share({
        message: `Check out this Joy Dealers video: ${video.title}\n${video.video_url}`,
      });
    } catch (err) {
      console.error('[DealtJoyPlayer] Share error:', err);
    }
  }, []);

  const handleVideoCardPress = useCallback((video: DbDealtJoyVideo) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/dealt-joy-player', params: { id: video.id, url: video.video_url, title: video.title } });
  }, [router]);

  if (videosQuery.isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color={joyTheme.gold} />
        <Text style={styles.loadingText}>Loading videos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen} testID="dealt-joy-player-screen">
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.back();
            }}
            style={styles.headerBtn}
            hitSlop={12}
          >
            <ArrowLeft color="#fff" size={22} />
          </Pressable>
          <Text style={styles.headerTitle}>Dealt Joy</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {currentVideo && (
            <View style={styles.featuredSection}>
              <Pressable
                style={({ pressed }) => [styles.featuredCard, pressed && { opacity: 0.95 }]}
                onPress={() => handlePlayVideo(currentVideo.video_url)}
              >
                {resolveImageUrl(currentVideo.thumbnail_url) ? (
                  <Image
                    source={{ uri: resolveImageUrl(currentVideo.thumbnail_url)! }}
                    style={styles.featuredThumb}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.featuredThumb, styles.thumbPlaceholder]}>
                    <Image source={JOY_SMILEY} style={styles.placeholderSmiley} contentFit="contain" tintColor="rgba(232,168,56,0.3)" />
                  </View>
                )}
                <View style={styles.playOverlay}>
                  <Animated.View style={[styles.playBtnOuter, { transform: [{ scale: pulseAnim }] }]}>
                    <View style={styles.playBtn}>
                      <Play color="#fff" size={28} fill="#fff" />
                    </View>
                  </Animated.View>
                </View>
                {currentVideo.is_featured && (
                  <View style={styles.featuredBadge}>
                    <Star color="#E8A838" size={10} fill="#E8A838" />
                    <Text style={styles.featuredBadgeText}>Featured</Text>
                  </View>
                )}
              </Pressable>

              <View style={styles.videoInfo}>
                <Text style={styles.videoTitle}>{currentVideo.title}</Text>
                {currentVideo.summary && (
                  <Text style={styles.videoSummary}>{currentVideo.summary}</Text>
                )}
                <View style={styles.videoMeta}>
                  <View style={styles.metaItem}>
                    <Calendar color={joyTheme.textMuted} size={13} />
                    <Text style={styles.metaText}>{formatDate(currentVideo.created_at)}</Text>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <Pressable
                    style={({ pressed }) => [styles.watchBtn, pressed && { opacity: 0.85 }]}
                    onPress={() => handlePlayVideo(currentVideo.video_url)}
                  >
                    <ExternalLink color="#fff" size={16} />
                    <Text style={styles.watchBtnText}>Watch Video</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.85 }]}
                    onPress={() => handleShare(currentVideo)}
                  >
                    <Share2 color={joyTheme.gold} size={16} />
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {otherVideos.length > 0 && (
            <View style={styles.moreSection}>
              <Text style={styles.moreSectionTitle}>More Videos</Text>
              {otherVideos.map((video) => (
                <Pressable
                  key={video.id}
                  style={({ pressed }) => [styles.videoRow, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                  onPress={() => handleVideoCardPress(video)}
                >
                  <View style={styles.videoRowThumbWrap}>
                    {resolveImageUrl(video.thumbnail_url) ? (
                      <Image
                        source={{ uri: resolveImageUrl(video.thumbnail_url)! }}
                        style={styles.videoRowThumb}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.videoRowThumb, styles.thumbPlaceholderSmall]}>
                        <Image source={JOY_SMILEY} style={styles.placeholderSmileySmall} contentFit="contain" tintColor="rgba(232,168,56,0.3)" />
                      </View>
                    )}
                    <View style={styles.miniPlayBtn}>
                      <Play color="#fff" size={14} fill="#fff" />
                    </View>
                  </View>
                  <View style={styles.videoRowInfo}>
                    <Text style={styles.videoRowTitle} numberOfLines={2}>{video.title}</Text>
                    {video.summary && (
                      <Text style={styles.videoRowSummary} numberOfLines={2}>{video.summary}</Text>
                    )}
                    <Text style={styles.videoRowDate}>{formatDate(video.created_at)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {videos.length === 0 && (
            <View style={styles.emptyState}>
              <Image source={JOY_SMILEY} style={styles.emptySmiley} contentFit="contain" tintColor={joyTheme.textMuted} />
              <Text style={styles.emptyTitle}>No videos yet</Text>
              <Text style={styles.emptySubtitle}>Video recaps will appear here</Text>
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
    backgroundColor: '#0D1117',
  },
  safeArea: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  content: {
    paddingBottom: 40,
    gap: 24,
  },
  featuredSection: {
    gap: 16,
  },
  featuredCard: {
    marginHorizontal: 20,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#1A2640',
    aspectRatio: 16 / 9,
  },
  featuredThumb: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    backgroundColor: '#1A2640',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderSmiley: {
    width: 64,
    height: 64,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(232,168,56,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(232,168,56,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },
  featuredBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(26,26,46,0.85)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(232,168,56,0.3)',
  },
  featuredBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#E8A838',
  },
  videoInfo: {
    paddingHorizontal: 20,
    gap: 8,
  },
  videoTitle: {
    fontSize: 22,
    fontWeight: '900' as const,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  videoSummary: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 20,
  },
  videoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.45)',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  watchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E8A838',
    borderRadius: 14,
    paddingVertical: 14,
  },
  watchBtnText: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#fff',
  },
  shareBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(232,168,56,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(232,168,56,0.2)',
  },
  moreSection: {
    paddingHorizontal: 20,
    gap: 12,
  },
  moreSectionTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  videoRow: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  videoRowThumbWrap: {
    width: 120,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1A2640',
  },
  videoRowThumb: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholderSmall: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A2640',
  },
  placeholderSmileySmall: {
    width: 28,
    height: 28,
  },
  miniPlayBtn: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(232,168,56,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    left: 45,
    top: 21,
    paddingLeft: 2,
  },
  videoRowInfo: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  videoRowTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  videoRowSummary: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 16,
  },
  videoRowDate: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.35)',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptySmiley: {
    width: 48,
    height: 48,
    opacity: 0.4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: 'rgba(255,255,255,0.7)',
  },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },
  bottomSpacer: {
    height: 40,
  },
});
