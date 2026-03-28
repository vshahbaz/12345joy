import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock,
  ImagePlus,
  MessageSquare,
  Star,
  ThumbsUp,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
  submitVolunteerFeedback,
  uploadPhotoToStorage,
  uploadEventPhoto,
  fetchEventPhotos,
} from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { DbEventPhoto } from '@/types/database';

const FEEDBACK_WINDOW_HOURS = 48;

function useCountdownTimer(deadlineIso: string | null) {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    totalMs: number;
    expired: boolean;
  }>({ hours: 0, minutes: 0, seconds: 0, totalMs: 0, expired: false });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!deadlineIso) {
      setTimeLeft({ hours: 0, minutes: 0, seconds: 0, totalMs: 0, expired: false });
      return;
    }

    const calculate = () => {
      const now = Date.now();
      const deadline = new Date(deadlineIso).getTime();
      const diff = deadline - now;

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, totalMs: 0, expired: true });
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      setTimeLeft({ hours, minutes, seconds, totalMs: diff, expired: false });
    };

    calculate();
    intervalRef.current = setInterval(calculate, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [deadlineIso]);

  return timeLeft;
}

function CountdownTimerBanner({
  deadline,
  eventEndTime,
}: {
  deadline: string | null;
  eventEndTime: string | null;
}) {
  const timer = useCountdownTimer(deadline);

  if (!deadline || !eventEndTime) return null;

  const pad = (n: number) => String(n).padStart(2, '0');

  if (timer.expired) {
    return (
      <View style={timerStyles.expiredBanner}>
        <Clock color={joyTheme.rose} size={18} />
        <View style={{ flex: 1 }}>
          <Text style={timerStyles.expiredTitle}>Feedback Window Closed</Text>
          <Text style={timerStyles.expiredSub}>The deadline for this survey has passed.</Text>
        </View>
      </View>
    );
  }

  const totalHours = timer.totalMs / (1000 * 60 * 60);
  const isUrgent = totalHours < 6;
  const isWarning = totalHours < 24 && !isUrgent;

  const bannerBg = isUrgent ? joyTheme.roseSoft : isWarning ? '#FFF8EB' : '#EBF3FF';
  const bannerBorder = isUrgent ? 'rgba(239,68,68,0.2)' : isWarning ? 'rgba(232,168,56,0.2)' : 'rgba(59,130,246,0.2)';
  const timerColor = isUrgent ? joyTheme.rose : isWarning ? joyTheme.gold : '#3B82F6';

  return (
    <View style={[timerStyles.banner, { backgroundColor: bannerBg, borderColor: bannerBorder }]}>
      <View style={timerStyles.bannerTop}>
        <Clock color={timerColor} size={18} />
        <Text style={[timerStyles.bannerLabel, { color: timerColor }]}>
          {isUrgent ? 'Hurry! Time is running out' : isWarning ? 'Less than 24 hours left' : 'Time remaining to complete'}
        </Text>
      </View>
      <View style={timerStyles.timerRow}>
        <View style={[timerStyles.timerBlock, { backgroundColor: isUrgent ? 'rgba(239,68,68,0.1)' : isWarning ? 'rgba(232,168,56,0.1)' : 'rgba(59,130,246,0.08)' }]}>
          <Text style={[timerStyles.timerDigit, { color: timerColor }]}>{pad(timer.hours)}</Text>
          <Text style={timerStyles.timerUnit}>hrs</Text>
        </View>
        <Text style={[timerStyles.timerSeparator, { color: timerColor }]}>:</Text>
        <View style={[timerStyles.timerBlock, { backgroundColor: isUrgent ? 'rgba(239,68,68,0.1)' : isWarning ? 'rgba(232,168,56,0.1)' : 'rgba(59,130,246,0.08)' }]}>
          <Text style={[timerStyles.timerDigit, { color: timerColor }]}>{pad(timer.minutes)}</Text>
          <Text style={timerStyles.timerUnit}>min</Text>
        </View>
        <Text style={[timerStyles.timerSeparator, { color: timerColor }]}>:</Text>
        <View style={[timerStyles.timerBlock, { backgroundColor: isUrgent ? 'rgba(239,68,68,0.1)' : isWarning ? 'rgba(232,168,56,0.1)' : 'rgba(59,130,246,0.08)' }]}>
          <Text style={[timerStyles.timerDigit, { color: timerColor }]}>{pad(timer.seconds)}</Text>
          <Text style={timerStyles.timerUnit}>sec</Text>
        </View>
      </View>
    </View>
  );
}

const timerStyles = StyleSheet.create({
  banner: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  bannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerLabel: {
    fontSize: 14,
    fontFamily: fonts.bold,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  timerBlock: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 60,
  },
  timerDigit: {
    fontSize: 26,
    fontFamily: fonts.extraBold,
    letterSpacing: -0.5,
  },
  timerUnit: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
    marginTop: -2,
    textTransform: 'uppercase' as const,
  },
  timerSeparator: {
    fontSize: 22,
    fontFamily: fonts.bold,
  },
  expiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: joyTheme.roseSoft,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  expiredTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: joyTheme.rose,
  },
  expiredSub: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: joyTheme.textMuted,
    marginTop: 2,
  },
});

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_THUMB_SIZE = (SCREEN_WIDTH - 32 - 36 - 24) / 4;

interface LocalPhoto {
  uri: string;
  uploading: boolean;
  uploaded: boolean;
  caption: string;
}

function StarRating({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <View style={styles.ratingSection}>
      <Text style={styles.ratingLabel}>{label}</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onChange(star);
            }}
            hitSlop={6}
            style={styles.starButton}
          >
            <Star
              size={32}
              color={star <= value ? joyTheme.gold : joyTheme.border}
              fill={star <= value ? joyTheme.gold : 'transparent'}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function EventFeedbackScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ signupId: string; eventId: string; eventTitle?: string }>();
  const signupId = params.signupId as string;
  const eventId = params.eventId as string;
  const eventTitle = params.eventTitle as string | undefined;

  const [didAttend, setDidAttend] = useState<boolean | null>(null);
  const [clearInstructions, setClearInstructions] = useState<boolean | null>(null);
  const [instructionsFeedback, setInstructionsFeedback] = useState('');
  const [experienceFeedback, setExperienceFeedback] = useState('');
  const [likelihoodRating, setLikelihoodRating] = useState(0);
  const [joyRating, setJoyRating] = useState(0);
  const [leadName, setLeadName] = useState('');
  const [localPhotos, setLocalPhotos] = useState<LocalPhoto[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);

  const eventQuery = useQuery({
    queryKey: ['event-feedback-details', eventId],
    queryFn: async () => {
      console.log('[EventFeedback] Fetching event details for:', eventId);
      const { data, error } = await supabase
        .from('events')
        .select('id, title, end_time, start_time, location')
        .eq('id', eventId)
        .single();
      if (error) {
        console.error('[EventFeedback] Error fetching event:', error);
        throw error;
      }
      return data as { id: string; title: string; end_time: string; start_time: string; location: string };
    },
    enabled: !!eventId,
  });

  const existingPhotosQuery = useQuery({
    queryKey: ['event-photos', eventId],
    queryFn: () => fetchEventPhotos(eventId),
    enabled: !!eventId,
  });

  const existingPhotos = useMemo(() => existingPhotosQuery.data ?? [], [existingPhotosQuery.data]);
  const myPhotos = useMemo(
    () => existingPhotos.filter((p: DbEventPhoto) => p.uploaded_by === user?.id),
    [existingPhotos, user?.id]
  );

  const deadlineQuery = useQuery({
    queryKey: ['feedback-deadline', signupId, eventId, user?.id],
    queryFn: async () => {
      console.log('[EventFeedback] Fetching feedback deadline for signup:', signupId);
      const { data: extension } = await supabase
        .from('feedback_extensions')
        .select('new_deadline')
        .eq('signup_id', signupId)
        .eq('user_id', user?.id ?? '')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (extension?.new_deadline) {
        console.log('[EventFeedback] Found extension deadline:', extension.new_deadline);
        return extension.new_deadline as string;
      }

      return null;
    },
    enabled: !!signupId && !!user?.id,
  });

  const feedbackDeadline = useMemo(() => {
    if (deadlineQuery.data) return deadlineQuery.data;
    if (eventQuery.data?.end_time) {
      const endTime = new Date(eventQuery.data.end_time);
      endTime.setHours(endTime.getHours() + FEEDBACK_WINDOW_HOURS);
      return endTime.toISOString();
    }
    return null;
  }, [deadlineQuery.data, eventQuery.data?.end_time]);

  const existingFeedbackQuery = useQuery({
    queryKey: ['existing-feedback', signupId],
    queryFn: async () => {
      console.log('[EventFeedback] Checking existing feedback for signup:', signupId);
      const { data, error } = await supabase
        .from('volunteer_feedback')
        .select('id')
        .eq('signup_id', signupId)
        .maybeSingle();
      if (error) {
        console.error('[EventFeedback] Error checking existing feedback:', error);
        return null;
      }
      return data;
    },
    enabled: !!signupId,
  });

  const handlePickPhotos = useCallback(async () => {
    try {
      const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permResult.granted) {
        Alert.alert('Permission Required', 'Please allow photo access to upload event photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 10,
      });
      if (result.canceled || !result.assets?.length) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const newPhotos: LocalPhoto[] = result.assets.map((asset) => ({
        uri: asset.uri,
        uploading: false,
        uploaded: false,
        caption: '',
      }));
      setLocalPhotos((prev) => [...prev, ...newPhotos]);
      console.log('[EventFeedback] Selected', newPhotos.length, 'photos');
    } catch (err) {
      console.error('[EventFeedback] Error picking photos:', err);
    }
  }, []);

  const handleTakePhoto = useCallback(async () => {
    try {
      const permResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permResult.granted) {
        Alert.alert('Permission Required', 'Please allow camera access to take event photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      });
      if (result.canceled || !result.assets?.[0]) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setLocalPhotos((prev) => [
        ...prev,
        { uri: result.assets[0].uri, uploading: false, uploaded: false, caption: '' },
      ]);
      console.log('[EventFeedback] Captured photo from camera');
    } catch (err) {
      console.error('[EventFeedback] Error taking photo:', err);
    }
  }, []);

  const handleRemoveLocalPhoto = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setLocalPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const uploadAllPhotos = useCallback(async () => {
    if (!user?.id || !eventId || localPhotos.length === 0) return;
    const pending = localPhotos.filter((p) => !p.uploaded);
    if (pending.length === 0) return;

    console.log('[EventFeedback] Uploading', pending.length, 'photos');
    setIsUploadingPhotos(true);

    for (let i = 0; i < localPhotos.length; i++) {
      const photo = localPhotos[i];
      if (photo.uploaded) continue;

      setLocalPhotos((prev) =>
        prev.map((p, idx) => (idx === i ? { ...p, uploading: true } : p))
      );

      try {
        const ext = photo.uri.split('.').pop() ?? 'jpg';
        const filePath = `event-photos/${eventId}/${user.id}_${Date.now()}_${i}.${ext}`;
        console.log('[EventFeedback] Uploading photo', i, ':', filePath);

        const publicUrl = await uploadPhotoToStorage('event-photos', filePath, photo.uri);
        await uploadEventPhoto(eventId, user.id, publicUrl, photo.caption || undefined);

        setLocalPhotos((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, uploading: false, uploaded: true } : p))
        );
        console.log('[EventFeedback] Photo', i, 'uploaded successfully');
      } catch (err) {
        console.error('[EventFeedback] Error uploading photo', i, ':', err);
        setLocalPhotos((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, uploading: false } : p))
        );
      }
    }

    setIsUploadingPhotos(false);
    void queryClient.invalidateQueries({ queryKey: ['event-photos', eventId] });
    void queryClient.invalidateQueries({ queryKey: ['all-photos-with-events'] });
  }, [localPhotos, user?.id, eventId, queryClient]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !eventId || !signupId) throw new Error('Missing required data');

      const pendingPhotos = localPhotos.filter((p) => !p.uploaded);
      if (pendingPhotos.length > 0) {
        console.log('[EventFeedback] Uploading pending photos before submitting feedback');
        await uploadAllPhotos();
      }

      console.log('[EventFeedback] Submitting feedback');
      return submitVolunteerFeedback({
        user_id: user.id,
        event_id: eventId,
        signup_id: signupId,
        did_attend: didAttend ?? undefined,
        lead_name: leadName || undefined,
        received_clear_instructions: clearInstructions ?? undefined,
        instructions_feedback: instructionsFeedback || undefined,
        experience_feedback: experienceFeedback || undefined,
        volunteer_likelihood_rating: likelihoodRating || undefined,
        joy_spread_rating: joyRating || undefined,
      });
    },
    onSuccess: () => {
      console.log('[EventFeedback] Feedback submitted successfully');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void queryClient.invalidateQueries({ queryKey: ['existing-feedback', signupId] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['event-photos', eventId] });
      void queryClient.invalidateQueries({ queryKey: ['all-photos-with-events'] });
      const photoCount = localPhotos.length;
      const msg = photoCount > 0
        ? `Your feedback and ${photoCount} photo${photoCount === 1 ? '' : 's'} have been submitted.`
        : 'Your feedback has been submitted.';
      Alert.alert('Thank You!', msg, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (error) => {
      console.error('[EventFeedback] Submit error:', error);
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    },
  });

  const handleSubmit = useCallback(() => {
    if (likelihoodRating === 0 || joyRating === 0) {
      Alert.alert('Missing Ratings', 'Please provide both ratings before submitting.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    submitMutation.mutate();
  }, [likelihoodRating, joyRating, submitMutation]);

  const title = eventTitle || eventQuery.data?.title || 'Event Feedback';
  const alreadySubmitted = !!existingFeedbackQuery.data;
  const isLoading = eventQuery.isLoading || existingFeedbackQuery.isLoading;
  const totalPhotos = myPhotos.length + localPhotos.length;

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
              <ArrowLeft color={joyTheme.text} size={22} />
            </Pressable>
            <Text style={styles.headerTitle}>Feedback</Text>
            <View style={styles.backButton} />
          </View>
          <View style={styles.centered}>
            <ActivityIndicator color={joyTheme.primary} size="large" />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (alreadySubmitted) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
              <ArrowLeft color={joyTheme.text} size={22} />
            </Pressable>
            <Text style={styles.headerTitle}>Feedback</Text>
            <View style={styles.backButton} />
          </View>
          <View style={styles.centered}>
            <View style={styles.submittedIcon}>
              <CheckCircle2 color={joyTheme.success} size={48} />
            </View>
            <Text style={styles.submittedTitle}>Already Submitted</Text>
            <Text style={styles.submittedText}>
              You've already submitted feedback for this event. Thank you!
            </Text>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
            <ArrowLeft color={joyTheme.text} size={22} />
          </Pressable>
          <Text style={styles.headerTitle}>Feedback</Text>
          <View style={styles.backButton} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.eventBanner}>
              <MessageSquare color={joyTheme.gold} size={24} />
              <View style={{ flex: 1 }}>
                <Text style={styles.eventBannerTitle}>{title}</Text>
                {eventQuery.data?.location && (
                  <Text style={styles.eventBannerSub}>{eventQuery.data.location}</Text>
                )}
              </View>
            </View>

            <CountdownTimerBanner
              deadline={feedbackDeadline}
              eventEndTime={eventQuery.data?.end_time ?? null}
            />

            <View style={styles.photoSection}>
              <View style={styles.photoSectionHeader}>
                <View style={styles.photoTitleRow}>
                  <Camera color={joyTheme.primaryDark ?? joyTheme.primary} size={18} />
                  <Text style={styles.photoSectionTitle}>Event Photos</Text>
                </View>
                {totalPhotos > 0 && (
                  <View style={styles.photoBadge}>
                    <Text style={styles.photoBadgeText}>{totalPhotos}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.photoSectionSub}>
                Share your favorite moments from this event
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photoScroll}
              >
                {myPhotos.map((photo: DbEventPhoto) => (
                  <View key={photo.id} style={styles.photoThumb}>
                    <Image
                      source={{ uri: resolveImageUrl(photo.photo_url) ?? photo.photo_url }}
                      style={styles.photoThumbImage}
                      contentFit="cover"
                    />
                    <View style={styles.photoUploadedBadge}>
                      <CheckCircle2 color="#fff" size={10} />
                    </View>
                  </View>
                ))}

                {localPhotos.map((photo, index) => (
                  <View key={`local-${index}`} style={styles.photoThumb}>
                    <Image
                      source={{ uri: photo.uri }}
                      style={styles.photoThumbImage}
                      contentFit="cover"
                    />
                    {photo.uploading && (
                      <View style={styles.photoOverlay}>
                        <ActivityIndicator color="#fff" size="small" />
                      </View>
                    )}
                    {photo.uploaded && (
                      <View style={styles.photoUploadedBadge}>
                        <CheckCircle2 color="#fff" size={10} />
                      </View>
                    )}
                    {!photo.uploading && !photo.uploaded && (
                      <Pressable
                        style={styles.photoRemoveBtn}
                        onPress={() => handleRemoveLocalPhoto(index)}
                        hitSlop={4}
                      >
                        <X color="#fff" size={10} />
                      </Pressable>
                    )}
                  </View>
                ))}

                <Pressable
                  style={styles.addPhotoBtn}
                  onPress={handlePickPhotos}
                  disabled={isUploadingPhotos}
                >
                  <ImagePlus color={joyTheme.primary} size={22} />
                  <Text style={styles.addPhotoText}>Gallery</Text>
                </Pressable>

                {Platform.OS !== 'web' && (
                  <Pressable
                    style={styles.addPhotoBtn}
                    onPress={handleTakePhoto}
                    disabled={isUploadingPhotos}
                  >
                    <Camera color={joyTheme.primary} size={22} />
                    <Text style={styles.addPhotoText}>Camera</Text>
                  </Pressable>
                )}
              </ScrollView>

              {localPhotos.some((p) => !p.uploaded) && (
                <Text style={styles.photoHint}>
                  {localPhotos.filter((p) => !p.uploaded).length} photo{localPhotos.filter((p) => !p.uploaded).length === 1 ? '' : 's'} ready to upload with your feedback
                </Text>
              )}
            </View>

            <View style={styles.questionCard}>
              <Text style={styles.questionLabel}>Did you attend this event?</Text>
              <View style={styles.boolRow}>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setDidAttend(true);
                  }}
                  style={[styles.boolBtn, didAttend === true && styles.boolBtnActive]}
                >
                  <ThumbsUp size={18} color={didAttend === true ? '#fff' : joyTheme.text} />
                  <Text style={[styles.boolBtnText, didAttend === true && styles.boolBtnTextActive]}>Yes</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setDidAttend(false);
                  }}
                  style={[styles.boolBtn, didAttend === false && styles.boolBtnActiveDanger]}
                >
                  <Text style={[styles.boolBtnText, didAttend === false && styles.boolBtnTextActive]}>No</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.questionCard}>
              <Text style={styles.questionLabel}>Who was your event lead?</Text>
              <TextInput
                style={styles.textInput}
                value={leadName}
                onChangeText={setLeadName}
                placeholder="Lead's name"
                placeholderTextColor={joyTheme.textMuted}
              />
            </View>

            <View style={styles.questionCard}>
              <Text style={styles.questionLabel}>Did you receive clear instructions?</Text>
              <View style={styles.boolRow}>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setClearInstructions(true);
                  }}
                  style={[styles.boolBtn, clearInstructions === true && styles.boolBtnActive]}
                >
                  <Text style={[styles.boolBtnText, clearInstructions === true && styles.boolBtnTextActive]}>Yes</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setClearInstructions(false);
                  }}
                  style={[styles.boolBtn, clearInstructions === false && styles.boolBtnActiveDanger]}
                >
                  <Text style={[styles.boolBtnText, clearInstructions === false && styles.boolBtnTextActive]}>No</Text>
                </Pressable>
              </View>
              {clearInstructions === false && (
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={instructionsFeedback}
                  onChangeText={setInstructionsFeedback}
                  placeholder="What could be improved?"
                  placeholderTextColor={joyTheme.textMuted}
                  multiline
                  numberOfLines={3}
                />
              )}
            </View>

            <StarRating
              label="How likely are you to volunteer again?"
              value={likelihoodRating}
              onChange={setLikelihoodRating}
            />

            <StarRating
              label="How much joy did you spread?"
              value={joyRating}
              onChange={setJoyRating}
            />

            <View style={styles.questionCard}>
              <Text style={styles.questionLabel}>Share your experience</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={experienceFeedback}
                onChangeText={setExperienceFeedback}
                placeholder="Tell us about your experience..."
                placeholderTextColor={joyTheme.textMuted}
                multiline
                numberOfLines={4}
              />
            </View>

            <Pressable
              onPress={handleSubmit}
              disabled={submitMutation.isPending}
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && { opacity: 0.85 },
                submitMutation.isPending && { opacity: 0.6 },
              ]}
            >
              {submitMutation.isPending ? (
                <View style={styles.submitBtnContent}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.submitBtnText}>
                    {isUploadingPhotos ? 'Uploading Photos...' : 'Submitting...'}
                  </Text>
                </View>
              ) : (
                <View style={styles.submitBtnContent}>
                  <Text style={styles.submitBtnText}>
                    {localPhotos.some((p) => !p.uploaded)
                      ? `Submit Feedback & ${localPhotos.filter((p) => !p.uploaded).length} Photo${localPhotos.filter((p) => !p.uploaded).length === 1 ? '' : 's'}`
                      : 'Submit Feedback'}
                  </Text>
                </View>
              )}
            </Pressable>

            <View style={{ height: 40 }} />
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
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: joyTheme.border,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
    letterSpacing: -0.3,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    gap: 16,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
  },
  eventBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: joyTheme.goldSoft,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(232,168,56,0.2)',
  },
  eventBannerTitle: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
  },
  eventBannerSub: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: joyTheme.textMuted,
    marginTop: 2,
  },
  photoSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: joyTheme.border,
    gap: 10,
  },
  photoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  photoSectionTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: joyTheme.text,
  },
  photoSectionSub: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: joyTheme.textMuted,
    marginBottom: 4,
  },
  photoBadge: {
    backgroundColor: joyTheme.primary,
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  photoBadgeText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  photoScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  photoThumb: {
    width: PHOTO_THUMB_SIZE,
    height: PHOTO_THUMB_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: joyTheme.backgroundAlt ?? '#F0F0F0',
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoUploadedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoBtn: {
    width: PHOTO_THUMB_SIZE,
    height: PHOTO_THUMB_SIZE,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: joyTheme.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: joyTheme.background,
  },
  addPhotoText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: joyTheme.primary,
  },
  photoHint: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: joyTheme.primary,
    textAlign: 'center',
  },
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: joyTheme.border,
    gap: 12,
  },
  questionLabel: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: joyTheme.text,
  },
  boolRow: {
    flexDirection: 'row',
    gap: 10,
  },
  boolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: joyTheme.border,
    backgroundColor: joyTheme.background,
  },
  boolBtnActive: {
    backgroundColor: joyTheme.primary,
    borderColor: joyTheme.primary,
  },
  boolBtnActiveDanger: {
    backgroundColor: joyTheme.rose,
    borderColor: joyTheme.rose,
  },
  boolBtnText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: joyTheme.text,
  },
  boolBtnTextActive: {
    color: '#FFFFFF',
  },
  textInput: {
    backgroundColor: joyTheme.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: joyTheme.text,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  ratingSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: joyTheme.border,
    gap: 12,
  },
  ratingLabel: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: joyTheme.text,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  submitBtn: {
    backgroundColor: joyTheme.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  submittedIcon: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: joyTheme.emeraldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submittedTitle: {
    fontSize: 22,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
  },
  submittedText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: joyTheme.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  doneBtn: {
    backgroundColor: joyTheme.primary,
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 8,
  },
  doneBtnText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
});
