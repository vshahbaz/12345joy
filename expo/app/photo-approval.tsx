import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ImageOff,
  ImagePlus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
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
  fetchOrgPendingPhotos,
  fetchOrgAllPhotos,
  fetchOrgUploadedPhotos,
  fetchOrgEventsList,
  approveEventPhoto,
  rejectEventPhoto,
  replaceEventPhoto,
  uploadEventPhoto,
  uploadPhotoToStorage,
} from '@/lib/api';
import type { DbEvent, DbEventPhoto } from '@/types/database';

interface EventPhotoGroup {
  event: DbEvent;
  photos: DbEventPhoto[];
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_COLS = 2;
const PHOTO_GAP = 10;
const PHOTO_SIZE = (SCREEN_WIDTH - 40 - PHOTO_GAP) / PHOTO_COLS;

type TabType = 'pending' | 'approved' | 'uploaded';

export default function PhotoApprovalScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { organization, adminUser, user } = useAuth();
  const orgId = organization?.id ?? adminUser?.organization_id ?? '';
  const uploaderId = user?.id ?? adminUser?.id ?? '';

  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [lightbox, setLightbox] = useState<DbEventPhoto | null>(null);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadImageUri, setUploadImageUri] = useState<string | null>(null);
  const [uploadCaption, setUploadCaption] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showEventPicker, setShowEventPicker] = useState<boolean>(false);

  const pendingQuery = useQuery({
    queryKey: ['org-pending-photos', orgId],
    queryFn: () => fetchOrgPendingPhotos(orgId),
    enabled: !!orgId,
  });

  const approvedQuery = useQuery({
    queryKey: ['org-all-photos', orgId],
    queryFn: () => fetchOrgAllPhotos(orgId),
    enabled: !!orgId,
  });

  const uploadedQuery = useQuery({
    queryKey: ['org-uploaded-photos', orgId, uploaderId],
    queryFn: () => fetchOrgUploadedPhotos(orgId, uploaderId),
    enabled: !!orgId && !!uploaderId,
  });

  const eventsQuery = useQuery({
    queryKey: ['org-events-list', orgId],
    queryFn: () => fetchOrgEventsList(orgId),
    enabled: !!orgId,
  });

  const pendingPhotos = useMemo(() => pendingQuery.data ?? [], [pendingQuery.data]);
  const approvedPhotos = useMemo(() => approvedQuery.data ?? [], [approvedQuery.data]);
  const uploadedPhotos = useMemo(() => uploadedQuery.data ?? [], [uploadedQuery.data]);
  const orgEvents = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);

  const uploadedByEvent = useMemo<EventPhotoGroup[]>(() => {
    if (uploadedPhotos.length === 0 || orgEvents.length === 0) return [];
    const eventMap = new Map<string, DbEvent>();
    for (const ev of orgEvents) {
      eventMap.set(ev.id, ev);
    }
    const grouped = new Map<string, DbEventPhoto[]>();
    for (const photo of uploadedPhotos) {
      const existing = grouped.get(photo.event_id) ?? [];
      existing.push(photo);
      grouped.set(photo.event_id, existing);
    }
    const result: EventPhotoGroup[] = [];
    for (const [eventId, photos] of grouped) {
      const event = eventMap.get(eventId);
      if (event) {
        result.push({ event, photos });
      }
    }
    result.sort((a, b) => new Date(b.event.start_time).getTime() - new Date(a.event.start_time).getTime());
    return result;
  }, [uploadedPhotos, orgEvents]);

  const selectedEvent = useMemo(
    () => orgEvents.find((e) => e.id === selectedEventId) ?? null,
    [orgEvents, selectedEventId]
  );

  const approveMutation = useMutation({
    mutationFn: (photoId: string) => approveEventPhoto(photoId),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void queryClient.invalidateQueries({ queryKey: ['org-pending-photos', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['org-all-photos', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['org-uploaded-photos', orgId, uploaderId] });
      setLightbox(null);
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: (photoId: string) => rejectEventPhoto(photoId),
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      void queryClient.invalidateQueries({ queryKey: ['org-pending-photos', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['org-uploaded-photos', orgId, uploaderId] });
      setLightbox(null);
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadImageUri || !selectedEventId) {
        throw new Error('Please select an event and a photo');
      }
      console.log('[PhotoApproval] Uploading photo for event:', selectedEventId);
      const fileName = `org_${orgId}_${Date.now()}.jpg`;
      const publicUrl = await uploadPhotoToStorage('event-photos', fileName, uploadImageUri, 'image/jpeg');
      const photo = await uploadEventPhoto(selectedEventId, uploaderId, publicUrl, uploadCaption || undefined);
      await approveEventPhoto(photo.id);
      return photo;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void queryClient.invalidateQueries({ queryKey: ['org-pending-photos', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['org-all-photos', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['org-uploaded-photos', orgId, uploaderId] });
      resetUploadForm();
      Alert.alert('Success', 'Photo uploaded successfully');
    },
    onError: (err: Error) => {
      console.error('[PhotoApproval] Upload error:', err);
      Alert.alert('Upload Failed', err.message);
    },
  });

  const handleApprove = useCallback((photoId: string) => {
    approveMutation.mutate(photoId);
  }, [approveMutation]);

  const handleReject = useCallback((photoId: string) => {
    Alert.alert('Reject Photo', 'This photo will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => rejectMutation.mutate(photoId) },
    ]);
  }, [rejectMutation]);

  const replaceMutation = useMutation({
    mutationFn: async ({ photoId, newUri }: { photoId: string; newUri: string }) => {
      console.log('[PhotoApproval] Replacing photo:', photoId);
      const fileName = `replace_${orgId}_${Date.now()}.jpg`;
      const publicUrl = await uploadPhotoToStorage('event-photos', fileName, newUri, 'image/jpeg');
      return replaceEventPhoto(photoId, publicUrl);
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void queryClient.invalidateQueries({ queryKey: ['org-pending-photos', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['org-all-photos', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['org-uploaded-photos', orgId, uploaderId] });
      void queryClient.invalidateQueries({ queryKey: ['event-photos'] });
      setLightbox(null);
      Alert.alert('Success', 'Photo replaced successfully');
    },
    onError: (err: Error) => {
      console.error('[PhotoApproval] Replace error:', err);
      Alert.alert('Replace Failed', err.message);
    },
  });

  const handleReplacePhoto = useCallback(async (photoId: string) => {
    console.log('[PhotoApproval] Starting photo replace for:', photoId);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        replaceMutation.mutate({ photoId, newUri: result.assets[0].uri });
      }
    } catch (err) {
      console.error('[PhotoApproval] Replace picker error:', err);
    }
  }, [replaceMutation]);

  const resetUploadForm = useCallback(() => {
    setShowUploadModal(false);
    setUploadImageUri(null);
    setUploadCaption('');
    setSelectedEventId(null);
    setShowEventPicker(false);
  }, []);

  const handlePickImage = useCallback(async () => {
    console.log('[PhotoApproval] Picking image');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      console.log('[PhotoApproval] Image selected:', result.assets[0].uri.slice(0, 50));
      setUploadImageUri(result.assets[0].uri);
    }
  }, []);

  const handleOpenUploadModal = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setShowUploadModal(true);
  }, []);

  const currentPhotos = activeTab === 'pending'
    ? pendingPhotos
    : activeTab === 'approved'
      ? approvedPhotos
      : uploadedPhotos;

  const isLoading = activeTab === 'pending'
    ? pendingQuery.isLoading
    : activeTab === 'approved'
      ? approvedQuery.isLoading
      : uploadedQuery.isLoading;

  return (
    <View style={styles.screen} testID="photo-approval-screen">
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
          <Text style={styles.headerTitle}>Photo Management</Text>
          <Pressable
            onPress={handleOpenUploadModal}
            style={styles.addBtn}
            hitSlop={12}
            testID="upload-photo-btn"
          >
            <ImagePlus color={joyTheme.primary} size={22} />
          </Pressable>
        </View>

        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
            onPress={() => setActiveTab('pending')}
          >
            <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
              Pending
            </Text>
            {pendingPhotos.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{pendingPhotos.length}</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'approved' && styles.tabActive]}
            onPress={() => setActiveTab('approved')}
          >
            <Text style={[styles.tabText, activeTab === 'approved' && styles.tabTextActive]}>
              Approved
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'uploaded' && styles.tabActive]}
            onPress={() => setActiveTab('uploaded')}
          >
            <Text style={[styles.tabText, activeTab === 'uploaded' && styles.tabTextActive]}>
              Uploaded
            </Text>
            {uploadedPhotos.length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: joyTheme.primary }]}>
                <Text style={styles.tabBadgeText}>{uploadedPhotos.length}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={joyTheme.primary} />
          </View>
        ) : activeTab === 'uploaded' ? (
          uploadedByEvent.length === 0 ? (
            <View style={styles.centered}>
              <ImageOff color={joyTheme.textMuted} size={40} />
              <Text style={styles.emptyText}>No photos uploaded by your organization yet</Text>
              <Pressable style={styles.emptyUploadBtn} onPress={handleOpenUploadModal}>
                <Upload color="#fff" size={16} />
                <Text style={styles.emptyUploadBtnText}>Upload a Photo</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.eventGroupList} showsVerticalScrollIndicator={false}>
              {uploadedByEvent.map((group) => (
                <View key={group.event.id} style={styles.eventGroup}>
                  <View style={styles.eventGroupHeader}>
                    {group.event.image_url ? (
                      <Image
                        source={{ uri: resolveImageUrl(group.event.image_url) ?? group.event.image_url }}
                        style={styles.eventGroupThumb}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.eventGroupThumb, styles.eventGroupThumbPlaceholder]}>
                        <ImageOff color={joyTheme.textMuted} size={16} />
                      </View>
                    )}
                    <View style={styles.eventGroupInfo}>
                      <Text style={styles.eventGroupTitle} numberOfLines={1}>{group.event.title}</Text>
                      <Text style={styles.eventGroupMeta}>
                        {new Date(group.event.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {'  ·  '}
                        {group.photos.length} {group.photos.length === 1 ? 'photo' : 'photos'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.eventGroupGrid}>
                    {group.photos.map((photo) => (
                      <Pressable
                        key={photo.id}
                        style={styles.photoCell}
                        onPress={() => setLightbox(photo)}
                      >
                        <Image
                          source={{ uri: resolveImageUrl(photo.photo_url) ?? photo.photo_url }}
                          style={styles.photoImage}
                          contentFit="cover"
                        />
                        {photo.caption && (
                          <View style={styles.captionWrap}>
                            <Text style={styles.captionText} numberOfLines={1}>{photo.caption}</Text>
                          </View>
                        )}
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
              <View style={styles.bottomSpacer} />
            </ScrollView>
          )
        ) : currentPhotos.length === 0 ? (
          <View style={styles.centered}>
            <ImageOff color={joyTheme.textMuted} size={40} />
            <Text style={styles.emptyText}>
              {activeTab === 'pending'
                ? 'No photos waiting for approval'
                : 'No approved photos yet'}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {currentPhotos.map((photo) => (
              <Pressable
                key={photo.id}
                style={styles.photoCell}
                onPress={() => setLightbox(photo)}
              >
                <Image
                  source={{ uri: resolveImageUrl(photo.photo_url) ?? photo.photo_url }}
                  style={styles.photoImage}
                  contentFit="cover"
                />
                <View style={styles.photoActions}>
                  {activeTab === 'pending' && (
                    <>
                      <Pressable
                        style={styles.approveSmallBtn}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          handleApprove(photo.id);
                        }}
                      >
                        <Check color="#fff" size={14} />
                      </Pressable>
                      <Pressable
                        style={styles.rejectSmallBtn}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          handleReject(photo.id);
                        }}
                      >
                        <X color="#fff" size={14} />
                      </Pressable>
                    </>
                  )}
                  <Pressable
                    style={styles.replaceSmallBtn}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      void handleReplacePhoto(photo.id);
                    }}
                  >
                    <RefreshCw color="#fff" size={14} />
                  </Pressable>
                </View>
                {photo.caption && (
                  <View style={styles.captionWrap}>
                    <Text style={styles.captionText} numberOfLines={1}>{photo.caption}</Text>
                  </View>
                )}
              </Pressable>
            ))}
            <View style={styles.bottomSpacer} />
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Lightbox */}
      <Modal visible={!!lightbox} transparent animationType="fade">
        <View style={styles.lightbox}>
          <Pressable style={styles.lightboxClose} onPress={() => setLightbox(null)}>
            <X color="#fff" size={24} />
          </Pressable>
          {lightbox && (
            <>
              <Image
                source={{ uri: resolveImageUrl(lightbox.photo_url) ?? lightbox.photo_url }}
                style={styles.lightboxImage}
                contentFit="contain"
              />
              {lightbox.caption && (
                <Text style={styles.lightboxCaption}>{lightbox.caption}</Text>
              )}
              <View style={styles.lightboxActions}>
                {activeTab === 'pending' && (
                  <>
                    <Pressable
                      style={styles.lightboxApproveBtn}
                      onPress={() => handleApprove(lightbox.id)}
                      disabled={approveMutation.isPending}
                    >
                      {approveMutation.isPending ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Check color="#fff" size={18} />
                          <Text style={styles.lightboxBtnText}>Approve</Text>
                        </>
                      )}
                    </Pressable>
                    <Pressable
                      style={styles.lightboxRejectBtn}
                      onPress={() => handleReject(lightbox.id)}
                      disabled={rejectMutation.isPending}
                    >
                      {rejectMutation.isPending ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Trash2 color="#fff" size={18} />
                          <Text style={styles.lightboxBtnText}>Reject</Text>
                        </>
                      )}
                    </Pressable>
                  </>
                )}
                <Pressable
                  style={styles.lightboxReplaceBtn}
                  onPress={() => handleReplacePhoto(lightbox.id)}
                  disabled={replaceMutation.isPending}
                >
                  {replaceMutation.isPending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <RefreshCw color="#fff" size={18} />
                      <Text style={styles.lightboxBtnText}>Replace</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* Upload Modal */}
      <Modal
        visible={showUploadModal}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={resetUploadForm}
      >
        <SafeAreaView style={styles.uploadModal} edges={['top', 'bottom']}>
          <View style={styles.uploadHeader}>
            <Pressable onPress={resetUploadForm} hitSlop={12}>
              <X color={joyTheme.text} size={22} />
            </Pressable>
            <Text style={styles.uploadHeaderTitle}>Upload Photo</Text>
            <View style={{ width: 22 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.uploadContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Event Selector */}
            <View style={styles.uploadField}>
              <Text style={styles.uploadLabel}>Select Event</Text>
              <Pressable
                style={styles.eventSelector}
                onPress={() => setShowEventPicker(!showEventPicker)}
              >
                <Text
                  style={selectedEvent ? styles.eventSelectorText : styles.eventSelectorPlaceholder}
                  numberOfLines={1}
                >
                  {selectedEvent ? selectedEvent.title : 'Choose an event...'}
                </Text>
                <ChevronDown color={joyTheme.textMuted} size={18} />
              </Pressable>

              {showEventPicker && (
                <View style={styles.eventPickerList}>
                  <ScrollView style={styles.eventPickerScroll} nestedScrollEnabled>
                    {orgEvents.length === 0 ? (
                      <Text style={styles.eventPickerEmpty}>No events found</Text>
                    ) : (
                      orgEvents.map((event) => (
                        <Pressable
                          key={event.id}
                          style={[
                            styles.eventPickerItem,
                            selectedEventId === event.id && styles.eventPickerItemActive,
                          ]}
                          onPress={() => {
                            setSelectedEventId(event.id);
                            setShowEventPicker(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.eventPickerItemText,
                              selectedEventId === event.id && styles.eventPickerItemTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            {event.title}
                          </Text>
                          <Text style={styles.eventPickerDate}>
                            {new Date(event.start_time).toLocaleDateString()}
                          </Text>
                        </Pressable>
                      ))
                    )}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Photo Picker */}
            <View style={styles.uploadField}>
              <Text style={styles.uploadLabel}>Photo</Text>
              <Pressable style={styles.imagePicker} onPress={handlePickImage}>
                {uploadImageUri ? (
                  <Image
                    source={{ uri: uploadImageUri }}
                    style={styles.imagePreview}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.imagePickerPlaceholder}>
                    <ImagePlus color={joyTheme.textMuted} size={32} />
                    <Text style={styles.imagePickerText}>Tap to select a photo</Text>
                  </View>
                )}
              </Pressable>
              {uploadImageUri && (
                <Pressable
                  style={styles.changePhotoBtn}
                  onPress={handlePickImage}
                >
                  <Text style={styles.changePhotoBtnText}>Change Photo</Text>
                </Pressable>
              )}
            </View>

            {/* Caption */}
            <View style={styles.uploadField}>
              <Text style={styles.uploadLabel}>Caption (optional)</Text>
              <TextInput
                style={styles.captionInput}
                placeholder="Add a caption..."
                placeholderTextColor={joyTheme.textMuted}
                value={uploadCaption}
                onChangeText={setUploadCaption}
                multiline
                maxLength={200}
              />
            </View>

            {/* Upload Button */}
            <Pressable
              style={[
                styles.uploadBtn,
                (!uploadImageUri || !selectedEventId || uploadMutation.isPending) && styles.uploadBtnDisabled,
              ]}
              onPress={() => uploadMutation.mutate()}
              disabled={!uploadImageUri || !selectedEventId || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Upload color="#fff" size={18} />
                  <Text style={styles.uploadBtnText}>Upload Photo</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: joyTheme.background },
  safeArea: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
    borderBottomColor: joyTheme.border, backgroundColor: '#fff',
  },
  headerBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: fonts.extraBold, color: joyTheme.text, letterSpacing: -0.3 },
  addBtn: {
    width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: `${joyTheme.primary}14`,
  },
  tabBar: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10,
    gap: 6, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: joyTheme.border,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 10, borderRadius: 12,
    backgroundColor: joyTheme.background, borderWidth: 1, borderColor: joyTheme.border,
  },
  tabActive: { backgroundColor: '#0E3C73', borderColor: '#0E3C73' },
  tabText: { fontSize: 13, fontFamily: fonts.bold, color: joyTheme.text },
  tabTextActive: { color: '#fff' },
  tabBadge: {
    backgroundColor: '#FF3B30', borderRadius: 8, minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  tabBadgeText: { fontSize: 10, fontFamily: fonts.extraBold, color: '#fff' },
  emptyText: { fontSize: 15, fontFamily: fonts.semiBold, color: joyTheme.textMuted, textAlign: 'center' },
  emptyUploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
    backgroundColor: joyTheme.primary, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12,
  },
  emptyUploadBtnText: { fontSize: 14, fontFamily: fonts.bold, color: '#fff' },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: PHOTO_GAP,
  },
  eventGroupList: {
    paddingBottom: 20,
  },
  eventGroup: {
    marginBottom: 8,
  },
  eventGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: joyTheme.border,
    gap: 12,
  },
  eventGroupThumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    overflow: 'hidden',
  },
  eventGroupThumbPlaceholder: {
    backgroundColor: joyTheme.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventGroupInfo: {
    flex: 1,
    gap: 2,
  },
  eventGroupTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: joyTheme.text,
    letterSpacing: -0.2,
  },
  eventGroupMeta: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  eventGroupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    paddingTop: 8,
    gap: PHOTO_GAP,
  },
  photoCell: {
    width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 16, overflow: 'hidden',
    backgroundColor: joyTheme.backgroundAlt,
  },
  photoImage: { width: '100%', height: '100%' },
  photoActions: {
    position: 'absolute', bottom: 8, right: 8, flexDirection: 'row', gap: 6,
  },
  approveSmallBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#2BB673',
    alignItems: 'center', justifyContent: 'center',
  },
  rejectSmallBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#FF3B30',
    alignItems: 'center', justifyContent: 'center',
  },
  replaceSmallBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#0A84FF',
    alignItems: 'center', justifyContent: 'center',
  },
  captionWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 4,
  },
  captionText: { fontSize: 11, fontFamily: fonts.semiBold, color: '#fff' },
  lightbox: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center',
  },
  lightboxClose: {
    position: 'absolute', top: 60, right: 20, width: 44, height: 44,
    borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  lightboxImage: { width: SCREEN_WIDTH - 32, height: SCREEN_WIDTH - 32 },
  lightboxCaption: {
    fontSize: 14, fontFamily: fonts.semiBold, color: 'rgba(255,255,255,0.8)',
    marginTop: 12, paddingHorizontal: 20, textAlign: 'center',
  },
  lightboxActions: {
    flexDirection: 'row', gap: 16, marginTop: 24,
  },
  lightboxApproveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#2BB673', borderRadius: 16, paddingHorizontal: 28, paddingVertical: 14,
  },
  lightboxRejectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FF3B30', borderRadius: 16, paddingHorizontal: 28, paddingVertical: 14,
  },
  lightboxReplaceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#0A84FF', borderRadius: 16, paddingHorizontal: 28, paddingVertical: 14,
  },
  lightboxBtnText: { fontSize: 15, fontFamily: fonts.extraBold, color: '#fff' },
  bottomSpacer: { height: 40, width: '100%' },
  uploadModal: { flex: 1, backgroundColor: '#fff' },
  uploadHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: joyTheme.border,
  },
  uploadHeaderTitle: { fontSize: 17, fontFamily: fonts.extraBold, color: joyTheme.text },
  uploadContent: { padding: 20, gap: 24, paddingBottom: 40 },
  uploadField: { gap: 8 },
  uploadLabel: { fontSize: 14, fontFamily: fonts.bold, color: joyTheme.text },
  eventSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: joyTheme.background, borderWidth: 1, borderColor: joyTheme.border,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
  },
  eventSelectorText: { fontSize: 15, fontFamily: fonts.semiBold, color: joyTheme.text, flex: 1, marginRight: 8 },
  eventSelectorPlaceholder: { fontSize: 15, color: joyTheme.textMuted, flex: 1, marginRight: 8 },
  eventPickerList: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: joyTheme.border,
    borderRadius: 14, marginTop: 4, overflow: 'hidden',
  },
  eventPickerScroll: { maxHeight: 200 },
  eventPickerEmpty: { padding: 16, fontSize: 14, color: joyTheme.textMuted, textAlign: 'center' },
  eventPickerItem: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: joyTheme.border,
  },
  eventPickerItemActive: { backgroundColor: `${joyTheme.primary}12` },
  eventPickerItemText: { fontSize: 15, fontFamily: fonts.semiBold, color: joyTheme.text },
  eventPickerItemTextActive: { color: joyTheme.primary },
  eventPickerDate: { fontSize: 12, color: joyTheme.textMuted, marginTop: 2 },
  imagePicker: {
    borderRadius: 16, overflow: 'hidden', backgroundColor: joyTheme.background,
    borderWidth: 1, borderColor: joyTheme.border, borderStyle: 'dashed',
  },
  imagePreview: { width: '100%', height: 220, borderRadius: 16 },
  imagePickerPlaceholder: {
    height: 180, alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  imagePickerText: { fontSize: 14, fontFamily: fonts.semiBold, color: joyTheme.textMuted },
  changePhotoBtn: {
    alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, backgroundColor: joyTheme.background,
    borderWidth: 1, borderColor: joyTheme.border,
  },
  changePhotoBtnText: { fontSize: 13, fontFamily: fonts.bold, color: joyTheme.primary },
  captionInput: {
    backgroundColor: joyTheme.background, borderWidth: 1, borderColor: joyTheme.border,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: joyTheme.text, minHeight: 80, textAlignVertical: 'top',
  },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: joyTheme.primary, borderRadius: 16,
    paddingVertical: 16, marginTop: 8,
  },
  uploadBtnDisabled: { opacity: 0.5 },
  uploadBtnText: { fontSize: 16, fontFamily: fonts.extraBold, color: '#fff' },
});
