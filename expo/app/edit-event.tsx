import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  Camera,
  Clock,
  FileText,
  Hash,
  MapPin,
  Shield,
  Trash2,
  Users,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fonts } from '@/constants/fonts';
import { joyTheme } from '@/constants/joyTheme';
import { resolveImageUrl } from '@/lib/imageUtils';
import { useAuth } from '@/providers/AuthProvider';
import { fetchEventById, updateEvent, deleteEvent } from '@/lib/api';
import type { DbEvent } from '@/types/database';

function buildCalendarDays(year: number, month: number): { day: number; isCurrentMonth: boolean }[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: { day: number; isCurrentMonth: boolean }[] = [];
  for (let i = 0; i < firstDay; i++) days.push({ day: 0, isCurrentMonth: false });
  for (let i = 1; i <= daysInMonth; i++) days.push({ day: i, isCurrentMonth: true });
  return days;
}

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 || 12;
  const ampm = i < 12 ? 'AM' : 'PM';
  return { label: `${h}:00 ${ampm}`, value: `${String(i).padStart(2, '0')}:00` };
});
const HALF_HOURS = HOURS.flatMap((h, i) => [
  h,
  { label: `${(i % 12 || 12)}:30 ${i < 12 ? 'AM' : 'PM'}`, value: `${String(i).padStart(2, '0')}:30` },
]);

const EVENT_TYPES = ['Community Service', 'Cleanup', 'Food Drive', 'Mentoring', 'Wellness', 'Education', 'Sports', 'Arts', 'Other'] as const;

function InputRow({
  label,
  value,
  onChangeText,
  icon: Icon,
  placeholder,
  keyboardType,
  multiline,
  required,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  icon: React.ComponentType<{ color?: string; size?: number }>;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'email-address';
  multiline?: boolean;
  required?: boolean;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
      <View style={[styles.inputWrap, multiline && styles.textAreaWrap]}>
        <Icon color={joyTheme.textMuted} size={18} />
        <TextInput
          style={[styles.input, multiline && styles.textArea]}
          placeholder={placeholder}
          placeholderTextColor={joyTheme.textMuted}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType ?? 'default'}
          multiline={multiline}
          numberOfLines={multiline ? 4 : 1}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
      </View>
    </View>
  );
}

function extractDateFromISO(iso: string): string {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return '';
  }
}

function extractTimeFromISO(iso: string): string {
  try {
    const d = new Date(iso);
    const h = String(d.getHours()).padStart(2, '0');
    const mins = d.getMinutes();
    const rounded = mins >= 30 ? '30' : '00';
    return `${h}:${rounded}`;
  } catch {
    return '';
  }
}

export default function EditEventScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { adminSessionToken } = useAuth();

  const eventQuery = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => fetchEventById(eventId ?? ''),
    enabled: !!eventId,
  });

  const event = eventQuery.data;

  const [initialized, setInitialized] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [eventType, setEventType] = useState<string>('Community Service');
  const [venue, setVenue] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [stateName, setStateName] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [capacity, setCapacity] = useState<string>('');
  const [minAge, setMinAge] = useState<string>('');
  const [skillsNeeded, setSkillsNeeded] = useState<string>('');
  const [waiverRequired, setWaiverRequired] = useState<boolean>(false);
  const [photoRelease, setPhotoRelease] = useState<boolean>(false);
  const [eventImage, setEventImage] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showTimePicker, setShowTimePicker] = useState<'start' | 'end' | null>(null);
  const [calYear, setCalYear] = useState<number>(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState<number>(new Date().getMonth());

  useEffect(() => {
    if (event && !initialized) {
      console.log('[EditEvent] Pre-filling form with event data:', event.id);
      setTitle(event.title ?? '');
      setDescription(event.description ?? '');
      setEventType(event.event_type ?? 'Community Service');
      setVenue(event.venue ?? '');
      setAddress(event.address ?? '');
      setCity(event.city ?? '');
      setStateName(event.state ?? '');
      setStartDate(extractDateFromISO(event.start_time));
      setStartTime(extractTimeFromISO(event.start_time));
      setEndTime(extractTimeFromISO(event.end_time));
      setCapacity(event.capacity ? String(event.capacity) : '');
      setMinAge(event.min_age ? String(event.min_age) : '');
      const sk = event.skills_needed;
      if (Array.isArray(sk)) {
        setSkillsNeeded(sk.join(', '));
      } else if (typeof sk === 'string') {
        setSkillsNeeded(sk);
      }
      setWaiverRequired(event.waiver_required ?? false);
      setPhotoRelease(event.photo_release_required ?? false);
      setEventImage(resolveImageUrl(event.image_url) ?? null);

      const sd = extractDateFromISO(event.start_time);
      if (sd) {
        const parts = sd.split('-');
        if (parts.length === 3) {
          setCalYear(parseInt(parts[0], 10));
          setCalMonth(parseInt(parts[1], 10) - 1);
        }
      }
      setInitialized(true);
    }
  }, [event, initialized]);

  const calDays = useMemo(() => buildCalendarDays(calYear, calMonth), [calYear, calMonth]);
  const calMonthLabel = useMemo(() => new Date(calYear, calMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), [calYear, calMonth]);

  const formatSelectedDate = useCallback((dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }, []);

  const handleSelectCalDate = useCallback((day: number) => {
    const m = String(calMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    setStartDate(`${calYear}-${m}-${d}`);
    setShowDatePicker(false);
    Haptics.selectionAsync().catch(() => {});
  }, [calYear, calMonth]);

  const handleSelectTime = useCallback((timeValue: string) => {
    if (showTimePicker === 'start') setStartTime(timeValue);
    else if (showTimePicker === 'end') setEndTime(timeValue);
    setShowTimePicker(null);
    Haptics.selectionAsync().catch(() => {});
  }, [showTimePicker]);

  const getTimeLabel = useCallback((timeValue: string) => {
    if (!timeValue) return '';
    const match = HALF_HOURS.find((t) => t.value === timeValue);
    return match?.label ?? timeValue;
  }, []);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error('No event ID');
      if (!title.trim()) throw new Error('Please enter an event title.');
      if (!startDate.trim()) throw new Error('Please select a start date.');
      if (!startTime.trim()) throw new Error('Please select a start time.');
      if (!endTime.trim()) throw new Error('Please select an end time.');

      const startISO = new Date(`${startDate.trim()}T${startTime.trim()}:00`).toISOString();
      const endISO = new Date(`${startDate.trim()}T${endTime.trim()}:00`).toISOString();

      const updates: Partial<Omit<DbEvent, 'id' | 'created_at' | 'updated_at'>> = {
        title: title.trim(),
        description: description.trim() || null,
        event_type: eventType,
        venue: venue.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        state: stateName.trim() || null,
        start_time: startISO,
        end_time: endISO,
        capacity: capacity ? parseInt(capacity, 10) : null,
        min_age: minAge ? parseInt(minAge, 10) : null,
        skills_needed: skillsNeeded.trim() || null,
        waiver_required: waiverRequired,
        photo_release_required: photoRelease,
        image_url: eventImage ?? null,
      };

      return updateEvent(eventId, updates, adminSessionToken);
    },
    onSuccess: () => {
      console.log('[EditEvent] Event updated successfully');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      void queryClient.invalidateQueries({ queryKey: ['all-events'] });
      void queryClient.invalidateQueries({ queryKey: ['upcoming-events'] });
      void queryClient.invalidateQueries({ queryKey: ['org-events'] });
      Alert.alert('Event Updated', 'Your changes have been saved.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (error: Error) => {
      console.error('[EditEvent] Error:', error.message);
      Alert.alert('Error', error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error('No event ID');
      return deleteEvent(eventId, adminSessionToken);
    },
    onSuccess: () => {
      console.log('[EditEvent] Event deleted');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void queryClient.invalidateQueries({ queryKey: ['all-events'] });
      void queryClient.invalidateQueries({ queryKey: ['upcoming-events'] });
      void queryClient.invalidateQueries({ queryKey: ['org-events'] });
      Alert.alert('Event Deleted', 'The event has been removed.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (error: Error) => {
      console.error('[EditEvent] Delete error:', error.message);
      Alert.alert('Error', error.message);
    },
  });

  const handleUpdate = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    updateMutation.mutate();
  }, [updateMutation]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Event',
      'Are you sure you want to permanently delete this event? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
            deleteMutation.mutate();
          },
        },
      ]
    );
  }, [deleteMutation]);

  if (eventQuery.isLoading || !initialized) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color="#0E3C73" />
        <Text style={styles.loadingText}>Loading event...</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.loadingText}>Event not found</Text>
        <Pressable onPress={() => router.back()} style={styles.goBackBtn}>
          <Text style={styles.goBackBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen} testID="edit-event-screen">
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
          <Text style={styles.headerTitle}>Edit Event</Text>
          <Pressable
            onPress={handleDelete}
            style={styles.headerBtn}
            hitSlop={12}
            disabled={deleteMutation.isPending}
          >
            <Trash2 color="#FF3B30" size={20} />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Event Photo</Text>
              {eventImage ? (
                <View style={styles.imagePreviewWrap}>
                  <Image source={{ uri: eventImage }} style={styles.imagePreview} contentFit="cover" />
                  <Pressable
                    style={styles.imageRemoveBtn}
                    onPress={() => {
                      setEventImage(null);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    }}
                    hitSlop={8}
                  >
                    <X color="#fff" size={16} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={styles.imagePickerBtn}
                  onPress={async () => {
                    try {
                      const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ImagePicker.MediaTypeOptions.Images,
                        allowsEditing: true,
                        aspect: [16, 9],
                        quality: 0.8,
                      });
                      if (!result.canceled && result.assets[0]) {
                        setEventImage(result.assets[0].uri);
                        Haptics.selectionAsync().catch(() => {});
                      }
                    } catch (err) {
                      console.error('[EditEvent] Image picker error:', err);
                    }
                  }}
                >
                  <Camera color={joyTheme.textMuted} size={28} />
                  <Text style={styles.imagePickerText}>Tap to add a cover photo</Text>
                  <Text style={styles.imagePickerHint}>Recommended: 16:9 ratio</Text>
                </Pressable>
              )}
            </View>

            <InputRow
              label="Event Title"
              value={title}
              onChangeText={setTitle}
              icon={FileText}
              placeholder="e.g. Beach Cleanup Day"
              required
            />

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Event Type *</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.typeScroll}
              >
                {EVENT_TYPES.map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => setEventType(type)}
                    style={[styles.typeChip, eventType === type && styles.typeChipActive]}
                  >
                    <Text style={[styles.typeChipText, eventType === type && styles.typeChipTextActive]}>
                      {type}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <InputRow
              label="Description"
              value={description}
              onChangeText={setDescription}
              icon={FileText}
              placeholder="Describe the event, what volunteers will do..."
              multiline
            />

            <InputRow
              label="Venue Name"
              value={venue}
              onChangeText={setVenue}
              icon={MapPin}
              placeholder="e.g. City Park Pavilion"
            />
            <InputRow
              label="Address"
              value={address}
              onChangeText={setAddress}
              icon={MapPin}
              placeholder="123 Main St"
            />
            <View style={styles.rowInputs}>
              <View style={[styles.inputGroup, styles.halfInput]}>
                <Text style={styles.label}>City</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    placeholder="City"
                    placeholderTextColor={joyTheme.textMuted}
                    value={city}
                    onChangeText={setCity}
                  />
                </View>
              </View>
              <View style={[styles.inputGroup, styles.halfInput]}>
                <Text style={styles.label}>State</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    placeholder="FL"
                    placeholderTextColor={joyTheme.textMuted}
                    value={stateName}
                    onChangeText={setStateName}
                    autoCapitalize="characters"
                  />
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date *</Text>
              <Pressable
                style={styles.inputWrap}
                onPress={() => setShowDatePicker(true)}
                testID="edit-date-picker-trigger"
              >
                <Calendar color={joyTheme.textMuted} size={18} />
                <Text style={[styles.input, !startDate && { color: joyTheme.textMuted }]}>
                  {startDate ? formatSelectedDate(startDate) : 'Select a date'}
                </Text>
              </Pressable>
            </View>
            <View style={styles.rowInputs}>
              <View style={[styles.inputGroup, styles.halfInput]}>
                <Text style={styles.label}>Start Time *</Text>
                <Pressable
                  style={styles.inputWrap}
                  onPress={() => setShowTimePicker('start')}
                  testID="edit-start-time-trigger"
                >
                  <Clock color={joyTheme.textMuted} size={18} />
                  <Text style={[styles.input, !startTime && { color: joyTheme.textMuted }]}>
                    {startTime ? getTimeLabel(startTime) : 'Start'}
                  </Text>
                </Pressable>
              </View>
              <View style={[styles.inputGroup, styles.halfInput]}>
                <Text style={styles.label}>End Time *</Text>
                <Pressable
                  style={styles.inputWrap}
                  onPress={() => setShowTimePicker('end')}
                  testID="edit-end-time-trigger"
                >
                  <Clock color={joyTheme.textMuted} size={18} />
                  <Text style={[styles.input, !endTime && { color: joyTheme.textMuted }]}>
                    {endTime ? getTimeLabel(endTime) : 'End'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.rowInputs}>
              <View style={[styles.inputGroup, styles.halfInput]}>
                <InputRow
                  label="Max Capacity"
                  value={capacity}
                  onChangeText={setCapacity}
                  icon={Users}
                  placeholder="50"
                  keyboardType="number-pad"
                />
              </View>
              <View style={[styles.inputGroup, styles.halfInput]}>
                <InputRow
                  label="Min Age"
                  value={minAge}
                  onChangeText={setMinAge}
                  icon={Hash}
                  placeholder="16"
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <InputRow
              label="Skills Needed"
              value={skillsNeeded}
              onChangeText={setSkillsNeeded}
              icon={Hash}
              placeholder="e.g. cooking, driving, bilingual"
            />

            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Shield color={joyTheme.warning} size={18} />
                <Text style={styles.switchLabel}>Waiver Required</Text>
              </View>
              <Switch
                value={waiverRequired}
                onValueChange={setWaiverRequired}
                trackColor={{ false: joyTheme.border, true: '#0E3C73' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Shield color={joyTheme.warning} size={18} />
                <Text style={styles.switchLabel}>Photo Release Required</Text>
              </View>
              <Switch
                value={photoRelease}
                onValueChange={setPhotoRelease}
                trackColor={{ false: joyTheme.border, true: '#0E3C73' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <Pressable
              onPress={handleUpdate}
              disabled={updateMutation.isPending}
              style={({ pressed }) => [
                styles.submitButton,
                pressed && { opacity: 0.9 },
                updateMutation.isPending && { opacity: 0.6 },
              ]}
              testID="edit-event-submit"
            >
              {updateMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Save Changes</Text>
              )}
            </Pressable>

            <Pressable
              onPress={handleDelete}
              disabled={deleteMutation.isPending}
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && { opacity: 0.9 },
                deleteMutation.isPending && { opacity: 0.6 },
              ]}
              testID="edit-event-delete"
            >
              {deleteMutation.isPending ? (
                <ActivityIndicator color="#FF3B30" size="small" />
              ) : (
                <>
                  <Trash2 color="#FF3B30" size={16} />
                  <Text style={styles.deleteButtonText}>Delete Event</Text>
                </>
              )}
            </Pressable>

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal visible={showDatePicker} animationType="slide" transparent testID="edit-date-picker-modal">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Date</Text>
              <Pressable onPress={() => setShowDatePicker(false)} hitSlop={12}>
                <Text style={styles.modalClose}>Done</Text>
              </Pressable>
            </View>
            <View style={styles.calNav}>
              <Pressable onPress={() => {
                if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
                else setCalMonth(calMonth - 1);
              }} hitSlop={12}>
                <Text style={styles.calNavArrow}>‹</Text>
              </Pressable>
              <Text style={styles.calMonthLabel}>{calMonthLabel}</Text>
              <Pressable onPress={() => {
                if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
                else setCalMonth(calMonth + 1);
              }} hitSlop={12}>
                <Text style={styles.calNavArrow}>›</Text>
              </Pressable>
            </View>
            <View style={styles.calDayNames}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <Text key={d} style={styles.calDayName}>{d}</Text>
              ))}
            </View>
            <View style={styles.calGrid}>
              {calDays.map((item, idx) => {
                if (!item.isCurrentMonth) return <View key={`e-${idx}`} style={styles.calCell} />;
                const m = String(calMonth + 1).padStart(2, '0');
                const d = String(item.day).padStart(2, '0');
                const cellIso = `${calYear}-${m}-${d}`;
                const isSelected = cellIso === startDate;
                return (
                  <Pressable
                    key={item.day}
                    style={[styles.calCell, isSelected && styles.calCellSelected]}
                    onPress={() => handleSelectCalDate(item.day)}
                  >
                    <Text style={[styles.calDayText, isSelected && styles.calDayTextSelected]}>
                      {item.day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showTimePicker !== null} animationType="slide" transparent testID="edit-time-picker-modal">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{showTimePicker === 'start' ? 'Start Time' : 'End Time'}</Text>
              <Pressable onPress={() => setShowTimePicker(null)} hitSlop={12}>
                <Text style={styles.modalClose}>Cancel</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.timeList} keyboardShouldPersistTaps="handled">
              {HALF_HOURS.map((t) => {
                const isActive = (showTimePicker === 'start' && startTime === t.value) ||
                  (showTimePicker === 'end' && endTime === t.value);
                return (
                  <Pressable
                    key={t.value}
                    style={[styles.timeItem, isActive && styles.timeItemActive]}
                    onPress={() => handleSelectTime(t.value)}
                  >
                    <Text style={[styles.timeItemText, isActive && styles.timeItemTextActive]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: joyTheme.background },
  flex: { flex: 1 },
  safeArea: { flex: 1 },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  goBackBtn: {
    marginTop: 12,
    backgroundColor: '#0E3C73',
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: joyTheme.border,
    backgroundColor: '#FFFFFF',
  },
  headerBtn: {
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
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 16,
  },
  inputGroup: { gap: 8 },
  label: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: joyTheme.text,
    paddingLeft: 4,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  textAreaWrap: { alignItems: 'flex-start', minHeight: 100 },
  input: { flex: 1, fontSize: 16, color: joyTheme.text, padding: 0 },
  textArea: { minHeight: 72 },
  typeScroll: { gap: 8, paddingVertical: 4 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  typeChipActive: { backgroundColor: '#0E3C73', borderColor: '#0E3C73' },
  typeChipText: { fontSize: 13, fontFamily: fonts.bold, color: joyTheme.text },
  typeChipTextActive: { color: '#FFFFFF', fontFamily: fonts.extraBold },
  rowInputs: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  switchInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  switchLabel: { fontSize: 15, fontFamily: fonts.semiBold, color: joyTheme.text },
  submitButton: {
    backgroundColor: '#0E3C73',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: { color: '#FFFFFF', fontSize: 17, fontFamily: fonts.extraBold },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF0F0',
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#FFD4D4',
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontSize: 15,
    fontFamily: fonts.bold,
  },
  imagePreviewWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 16,
  },
  imageRemoveBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePickerBtn: {
    borderWidth: 2,
    borderColor: joyTheme.border,
    borderStyle: 'dashed',
    borderRadius: 16,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FAFBFC',
  },
  imagePickerText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  imagePickerHint: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: joyTheme.textMuted,
    opacity: 0.7,
  },
  bottomSpacer: { height: 20 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end' as const,
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: joyTheme.border,
  },
  modalTitle: { fontSize: 18, fontFamily: fonts.extraBold, color: joyTheme.text },
  modalClose: { fontSize: 16, fontFamily: fonts.bold, color: '#0E3C73' },
  calNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    paddingTop: 16,
    paddingBottom: 8,
  },
  calNavArrow: { fontSize: 28, fontFamily: fonts.semiBold, color: '#0E3C73', paddingHorizontal: 10 },
  calMonthLabel: { fontSize: 16, fontFamily: fonts.extraBold, color: joyTheme.text },
  calDayNames: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 4 },
  calDayName: { flex: 1, textAlign: 'center', fontSize: 12, fontFamily: fonts.bold, color: joyTheme.textMuted },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 16 },
  calCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  calCellSelected: { backgroundColor: '#0E3C73' },
  calDayText: { fontSize: 15, fontFamily: fonts.semiBold, color: joyTheme.text },
  calDayTextSelected: { color: '#FFFFFF', fontFamily: fonts.extraBold },
  timeList: { maxHeight: 400 },
  timeItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: joyTheme.border,
  },
  timeItemActive: { backgroundColor: '#EEF4FF' },
  timeItemText: { fontSize: 16, fontFamily: fonts.semiBold, color: joyTheme.text },
  timeItemTextActive: { color: '#0E3C73', fontFamily: fonts.extraBold },
});
