import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Heart,
  ImagePlus,
  MapPin,
  MessageSquare,
  Save,
  TrendingUp,
  Users,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fonts } from '@/constants/fonts';
import { joyTheme } from '@/constants/joyTheme';
import { resolveImageUrl } from '@/lib/imageUtils';
import { useAuth } from '@/providers/AuthProvider';
import {
  fetchEventById,
  fetchEventPhotos,
  fetchEventSignups,
  updateEvent,
  uploadPhotoToStorage,
  uploadEventPhoto,
} from '@/lib/api';
import type { DbEvent } from '@/types/database';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function EventRecapScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { adminSessionToken, adminUser, role } = useAuth();

  useEffect(() => {
    if (role && role !== 'organization') {
      console.log('[EventRecap] Volunteer attempted to access org recap, redirecting to event-detail');
      router.replace({ pathname: '/event-detail', params: { id: eventId ?? '' } });
    }
  }, [role, eventId, router]);

  const eventQuery = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => fetchEventById(eventId ?? ''),
    enabled: !!eventId,
  });

  const photosQuery = useQuery({
    queryKey: ['event-photos', eventId],
    queryFn: () => fetchEventPhotos(eventId ?? ''),
    enabled: !!eventId,
  });

  const signupsQuery = useQuery({
    queryKey: ['event-signups', eventId],
    queryFn: () => fetchEventSignups(eventId ?? ''),
    enabled: !!eventId,
  });

  const event = eventQuery.data;
  const photos = useMemo(() => photosQuery.data ?? [], [photosQuery.data]);
  const signups = useMemo(() => signupsQuery.data ?? [], [signupsQuery.data]);
  const checkedInCount = useMemo(() => signups.filter((s) => s.checked_in).length, [signups]);

  const [initialized, setInitialized] = useState<boolean>(false);
  const [recapSummary, setRecapSummary] = useState<string>('');
  const [communityBenefited, setCommunityBenefited] = useState<string>('');
  const [impactJoyDealt, setImpactJoyDealt] = useState<string>('');
  const [impactReach, setImpactReach] = useState<string>('');
  const [impactFunds, setImpactFunds] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const isPublished = !!event?.recap_published_at;

  useEffect(() => {
    if (event && !initialized) {
      console.log('[EventRecap] Pre-filling recap data for event:', event.id);
      setRecapSummary(event.recap_summary ?? '');
      setCommunityBenefited(event.community_benefited ?? '');
      setImpactJoyDealt(event.impact_joy_dealt ?? '');
      setImpactReach(event.impact_reach ?? '');
      setImpactFunds(event.impact_funds_generated ?? '');
      setInitialized(true);
    }
  }, [event, initialized]);

  const saveMutation = useMutation({
    mutationFn: async (publish: boolean) => {
      if (!eventId) throw new Error('No event ID');

      const updates: Partial<Omit<DbEvent, 'id' | 'created_at' | 'updated_at'>> = {
        recap_summary: recapSummary.trim() || null,
        community_benefited: communityBenefited.trim() || null,
        impact_joy_dealt: impactJoyDealt.trim() || null,
        impact_reach: impactReach.trim() || null,
        impact_funds_generated: impactFunds.trim() || null,
      };

      if (publish) {
        updates.recap_published_at = new Date().toISOString();
      }

      return updateEvent(eventId, updates, adminSessionToken);
    },
    onSuccess: (_data, publish) => {
      console.log('[EventRecap] Recap saved successfully, published:', publish);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      void queryClient.invalidateQueries({ queryKey: ['all-events'] });
      void queryClient.invalidateQueries({ queryKey: ['org-events'] });
      Alert.alert(
        publish ? 'Recap Published!' : 'Draft Saved',
        publish ? 'Your post-event recap is now live.' : 'Your recap draft has been saved.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    },
    onError: (error: Error) => {
      console.error('[EventRecap] Save error:', error.message);
      Alert.alert('Error', error.message);
    },
  });

  const handleUploadPhoto = useCallback(async () => {
    if (!eventId || !adminUser?.id) return;
    try {
      const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permResult.granted) {
        Alert.alert('Permission Required', 'Please allow photo access to upload event photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
        aspect: [4, 3],
      });
      if (result.canceled || !result.assets?.[0]) return;

      setIsUploading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const filePath = `event-photos/${eventId}/${adminUser.id}_${Date.now()}.${ext}`;

      console.log('[EventRecap] Uploading photo:', filePath);
      const publicUrl = await uploadPhotoToStorage('event-photos', filePath, asset.uri);
      await uploadEventPhoto(eventId, adminUser.id, publicUrl);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void queryClient.invalidateQueries({ queryKey: ['event-photos', eventId] });
      Alert.alert('Photo Uploaded!', 'Photo has been added to this event.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upload photo';
      console.error('[EventRecap] Photo upload error:', msg);
      Alert.alert('Upload Failed', msg);
    } finally {
      setIsUploading(false);
    }
  }, [eventId, adminUser, queryClient]);

  const handleSaveDraft = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    saveMutation.mutate(false);
  }, [saveMutation]);

  const handlePublish = useCallback(() => {
    if (!recapSummary.trim()) {
      Alert.alert('Missing Summary', 'Please add a recap summary before publishing.');
      return;
    }
    Alert.alert(
      'Publish Recap',
      'This will make the recap visible to all volunteers. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
            saveMutation.mutate(true);
          },
        },
      ]
    );
  }, [saveMutation, recapSummary]);

  if (eventQuery.isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color={joyTheme.primary} />
        <Text style={styles.loadingText}>Loading event...</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.loadingText}>Event not found</Text>
        <Pressable
          onPress={() => router.back()}
          style={styles.goBackBtn}
        >
          <Text style={styles.goBackBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const eventImageUri = resolveImageUrl(event.image_url)
    ?? 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=600&q=80';

  return (
    <View style={styles.screen} testID="event-recap-screen">
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
            <ArrowLeft color={joyTheme.text} size={22} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {isPublished ? 'Event Recap' : 'Post-Event Recap'}
          </Text>
          <View style={styles.headerBtn} />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.eventSummaryCard}>
              <Image source={{ uri: eventImageUri }} style={styles.eventThumb} contentFit="cover" />
              <View style={styles.eventSummaryInfo}>
                <Text style={styles.eventSummaryTitle} numberOfLines={2}>{event.title}</Text>
                <View style={styles.eventMetaRow}>
                  <Calendar color={joyTheme.textMuted} size={12} />
                  <Text style={styles.eventMetaText}>{formatDate(event.start_time)}</Text>
                </View>
                {event.city && (
                  <View style={styles.eventMetaRow}>
                    <MapPin color={joyTheme.textMuted} size={12} />
                    <Text style={styles.eventMetaText}>{event.city}{event.state ? `, ${event.state}` : ''}</Text>
                  </View>
                )}
              </View>
              {isPublished && (
                <View style={styles.publishedBadge}>
                  <CheckCircle2 color="#2BB673" size={14} />
                  <Text style={styles.publishedBadgeText}>Published</Text>
                </View>
              )}
            </View>

            <View style={styles.statsRow}>
              <View style={styles.miniStatCard}>
                <Users color="#0A84FF" size={16} />
                <Text style={styles.miniStatValue}>{signups.length}</Text>
                <Text style={styles.miniStatLabel}>Signed Up</Text>
              </View>
              <View style={styles.miniStatCard}>
                <CheckCircle2 color="#2BB673" size={16} />
                <Text style={styles.miniStatValue}>{checkedInCount}</Text>
                <Text style={styles.miniStatLabel}>Checked In</Text>
              </View>
              <View style={styles.miniStatCard}>
                <Camera color="#FFB020" size={16} />
                <Text style={styles.miniStatValue}>{photos.length}</Text>
                <Text style={styles.miniStatLabel}>Photos</Text>
              </View>
            </View>

            <View style={styles.photosSection}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleRow}>
                  <Camera color={joyTheme.primaryDark} size={16} />
                  <Text style={styles.sectionTitle}>Event Photos</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.uploadBtn, pressed && { opacity: 0.7 }]}
                  onPress={handleUploadPhoto}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <ActivityIndicator size="small" color="#0E3C73" />
                  ) : (
                    <ImagePlus color="#0E3C73" size={16} />
                  )}
                  <Text style={styles.uploadBtnText}>
                    {isUploading ? 'Uploading...' : 'Upload'}
                  </Text>
                </Pressable>
              </View>
              {photos.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.photoScroll}
                >
                  {photos.map((photo) => (
                    <View key={photo.id} style={styles.photoThumb}>
                      <Image
                        source={{ uri: resolveImageUrl(photo.photo_url) ?? photo.photo_url }}
                        style={styles.photoThumbImage}
                        contentFit="cover"
                      />
                      {!photo.approved && (
                        <View style={styles.pendingDot}>
                          <Clock color="#fff" size={8} />
                        </View>
                      )}
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.noPhotosWrap}>
                  <Camera color={joyTheme.textMuted} size={28} />
                  <Text style={styles.noPhotosText}>No photos yet. Upload photos from this event.</Text>
                </View>
              )}
            </View>

            <View style={styles.divider} />

            <View style={styles.formSection}>
              <View style={styles.sectionTitleRow}>
                <MessageSquare color={joyTheme.primaryDark} size={16} />
                <Text style={styles.sectionTitle}>Recap Summary</Text>
              </View>
              <TextInput
                style={styles.textArea}
                placeholder="Share highlights, key moments, and what made this event special..."
                placeholderTextColor={joyTheme.textMuted}
                value={recapSummary}
                onChangeText={setRecapSummary}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.formSection}>
              <View style={styles.sectionTitleRow}>
                <TrendingUp color={joyTheme.primaryDark} size={16} />
                <Text style={styles.sectionTitle}>Impact Metrics</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Community Benefited</Text>
                <View style={styles.inputWrap}>
                  <Heart color={joyTheme.textMuted} size={16} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Local food bank, 50 families served"
                    placeholderTextColor={joyTheme.textMuted}
                    value={communityBenefited}
                    onChangeText={setCommunityBenefited}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Joy Dealt</Text>
                <View style={styles.inputWrap}>
                  <Heart color={joyTheme.textMuted} size={16} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 200+ smiles, 100 care packages"
                    placeholderTextColor={joyTheme.textMuted}
                    value={impactJoyDealt}
                    onChangeText={setImpactJoyDealt}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Reach</Text>
                <View style={styles.inputWrap}>
                  <Users color={joyTheme.textMuted} size={16} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 500 people impacted"
                    placeholderTextColor={joyTheme.textMuted}
                    value={impactReach}
                    onChangeText={setImpactReach}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Funds Generated</Text>
                <View style={styles.inputWrap}>
                  <TrendingUp color={joyTheme.textMuted} size={16} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., $2,500 raised"
                    placeholderTextColor={joyTheme.textMuted}
                    value={impactFunds}
                    onChangeText={setImpactFunds}
                  />
                </View>
              </View>
            </View>

            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [styles.saveDraftBtn, pressed && { opacity: 0.8 }]}
                onPress={handleSaveDraft}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <ActivityIndicator size="small" color="#0E3C73" />
                ) : (
                  <>
                    <Save color="#0E3C73" size={16} />
                    <Text style={styles.saveDraftText}>Save Draft</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.publishBtn,
                  isPublished && styles.publishBtnUpdated,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={handlePublish}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <CheckCircle2 color="#fff" size={16} />
                    <Text style={styles.publishText}>
                      {isPublished ? 'Update Recap' : 'Publish Recap'}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: joyTheme.background,
  },
  flex: {
    flex: 1,
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
    color: joyTheme.textMuted,
    fontSize: 15,
    fontFamily: fonts.semiBold,
  },
  goBackBtn: {
    marginTop: 12,
    backgroundColor: joyTheme.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  goBackBtnText: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: joyTheme.border,
    backgroundColor: '#fff',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
    letterSpacing: -0.3,
  },
  content: {
    padding: 20,
    gap: 20,
  },
  eventSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: joyTheme.border,
    shadowColor: joyTheme.shadow,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  eventThumb: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  eventSummaryInfo: {
    flex: 1,
    gap: 4,
  },
  eventSummaryTitle: {
    fontSize: 15,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
    letterSpacing: -0.2,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventMetaText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  publishedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F8EE',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  publishedBadgeText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: '#2BB673',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  miniStatCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  miniStatValue: {
    fontSize: 18,
    fontFamily: fonts.black,
    color: joyTheme.text,
  },
  miniStatLabel: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  photosSection: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF4FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  uploadBtnText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: '#0E3C73',
  },
  photoScroll: {
    gap: 8,
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: joyTheme.backgroundAlt,
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
  },
  pendingDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFB020',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  noPhotosWrap: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  noPhotosText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: joyTheme.border,
  },
  formSection: {
    gap: 12,
  },
  textArea: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: joyTheme.border,
    padding: 16,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: joyTheme.text,
    minHeight: 120,
    lineHeight: 22,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: joyTheme.text,
    paddingLeft: 4,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: joyTheme.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: joyTheme.text,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  saveDraftBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EEF4FF',
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#C8DEFF',
  },
  saveDraftText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: '#0E3C73',
  },
  publishBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0E3C73',
    borderRadius: 16,
    paddingVertical: 16,
  },
  publishBtnUpdated: {
    backgroundColor: '#2BB673',
  },
  publishText: {
    fontSize: 15,
    fontFamily: fonts.extraBold,
    color: '#fff',
  },
  bottomSpacer: {
    height: 40,
  },
});
