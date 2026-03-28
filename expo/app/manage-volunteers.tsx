import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  Clock,
  Search,
  Star,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import {
  fetchEventById,
  fetchEventSignups,
  checkInVolunteer,
  uncheckInVolunteer,
  logVolunteerHours,
  awardVolunteerPoints,
} from '@/lib/api';
import type { DbEventSignup, DbProfile } from '@/types/database';

type SignupWithProfile = DbEventSignup & { profiles: DbProfile };

type FilterType = 'all' | 'checked_in' | 'not_checked_in';

export default function ManageVolunteersScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState<string>('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [hoursModal, setHoursModal] = useState<SignupWithProfile | null>(null);
  const [pointsModal, setPointsModal] = useState<SignupWithProfile | null>(null);
  const [hoursValue, setHoursValue] = useState<string>('');
  const [pointsValue, setPointsValue] = useState<string>('');

  const eventQuery = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => fetchEventById(eventId ?? ''),
    enabled: !!eventId,
  });

  const signupsQuery = useQuery({
    queryKey: ['event-signups', eventId],
    queryFn: () => fetchEventSignups(eventId ?? ''),
    enabled: !!eventId,
    refetchInterval: 10000,
  });

  const event = eventQuery.data;
  const signups = useMemo(() => (signupsQuery.data ?? []) as SignupWithProfile[], [signupsQuery.data]);

  const filteredSignups = useMemo(() => {
    let result = signups;
    if (filter === 'checked_in') result = result.filter((s) => s.checked_in);
    if (filter === 'not_checked_in') result = result.filter((s) => !s.checked_in);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter((s) =>
        (s.profiles?.full_name ?? '').toLowerCase().includes(q) ||
        (s.profiles?.email ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [signups, filter, search]);

  const checkedInCount = useMemo(() => signups.filter((s) => s.checked_in).length, [signups]);

  const checkInMutation = useMutation({
    mutationFn: (signupId: string) => checkInVolunteer(signupId),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void queryClient.invalidateQueries({ queryKey: ['event-signups', eventId] });
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const uncheckMutation = useMutation({
    mutationFn: (signupId: string) => uncheckInVolunteer(signupId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['event-signups', eventId] });
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const hoursMutation = useMutation({
    mutationFn: ({ signupId, hours }: { signupId: string; hours: number }) =>
      logVolunteerHours(signupId, hours),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void queryClient.invalidateQueries({ queryKey: ['event-signups', eventId] });
      setHoursModal(null);
      setHoursValue('');
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const pointsMutation = useMutation({
    mutationFn: ({ signupId, points, userId }: { signupId: string; points: number; userId: string }) =>
      awardVolunteerPoints(signupId, points, userId),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void queryClient.invalidateQueries({ queryKey: ['event-signups', eventId] });
      setPointsModal(null);
      setPointsValue('');
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const handleCheckIn = useCallback((signup: SignupWithProfile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (signup.checked_in) {
      Alert.alert('Undo Check-in', `Remove check-in for ${signup.profiles?.full_name ?? 'this volunteer'}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Undo', style: 'destructive', onPress: () => uncheckMutation.mutate(signup.id) },
      ]);
    } else {
      checkInMutation.mutate(signup.id);
    }
  }, [checkInMutation, uncheckMutation]);

  const handleLogHours = useCallback(() => {
    if (!hoursModal) return;
    const hours = parseFloat(hoursValue);
    if (isNaN(hours) || hours <= 0) {
      Alert.alert('Invalid', 'Please enter a valid number of hours.');
      return;
    }
    hoursMutation.mutate({ signupId: hoursModal.id, hours });
  }, [hoursModal, hoursValue, hoursMutation]);

  const handleAwardPoints = useCallback(() => {
    if (!pointsModal) return;
    const points = parseInt(pointsValue, 10);
    if (isNaN(points) || points <= 0) {
      Alert.alert('Invalid', 'Please enter a valid number of points.');
      return;
    }
    pointsMutation.mutate({
      signupId: pointsModal.id,
      points,
      userId: pointsModal.user_id,
    });
  }, [pointsModal, pointsValue, pointsMutation]);

  const handleCheckInAll = useCallback(() => {
    const unchecked = signups.filter((s) => !s.checked_in);
    if (unchecked.length === 0) {
      Alert.alert('All Checked In', 'Everyone is already checked in.');
      return;
    }
    Alert.alert(
      'Check In All',
      `Check in ${unchecked.length} volunteer${unchecked.length !== 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check In All',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
            unchecked.forEach((s) => checkInMutation.mutate(s.id));
          },
        },
      ]
    );
  }, [signups, checkInMutation]);

  if (eventQuery.isLoading || signupsQuery.isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color="#0E3C73" />
        <Text style={styles.loadingText}>Loading volunteers...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen} testID="manage-volunteers-screen">
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
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>Manage Volunteers</Text>
            {event && <Text style={styles.headerSub} numberOfLines={1}>{event.title}</Text>}
          </View>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Users color="#0A84FF" size={16} />
            <Text style={styles.summaryValue}>{signups.length}</Text>
            <Text style={styles.summaryLabel}>Signed Up</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <UserCheck color="#2BB673" size={16} />
            <Text style={styles.summaryValue}>{checkedInCount}</Text>
            <Text style={styles.summaryLabel}>Checked In</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <UserX color="#FF6B6B" size={16} />
            <Text style={styles.summaryValue}>{signups.length - checkedInCount}</Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
        </View>

        <View style={styles.controlsRow}>
          <View style={styles.searchWrap}>
            <Search color={joyTheme.textMuted} size={16} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search volunteers..."
              placeholderTextColor={joyTheme.textMuted}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <Pressable
            onPress={handleCheckInAll}
            style={styles.checkAllBtn}
          >
            <Check color="#fff" size={14} />
            <Text style={styles.checkAllBtnText}>All</Text>
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          {(['all', 'checked_in', 'not_checked_in'] as FilterType[]).map((f) => (
            <Pressable
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                {f === 'all' ? 'All' : f === 'checked_in' ? 'Checked In' : 'Pending'}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {filteredSignups.length === 0 && (
            <View style={styles.emptyState}>
              <Users color={joyTheme.textMuted} size={36} />
              <Text style={styles.emptyStateText}>
                {search ? 'No volunteers found' : 'No volunteers registered yet'}
              </Text>
            </View>
          )}

          {filteredSignups.map((signup) => {
            const profile = signup.profiles;
            const initials = (profile?.full_name ?? 'V')
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

            return (
              <View key={signup.id} style={styles.volunteerCard}>
                <View style={styles.volunteerTop}>
                  {resolveImageUrl(profile?.avatar_url) ? (
                    <Image source={{ uri: resolveImageUrl(profile?.avatar_url)! }} style={styles.avatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                  )}
                  <View style={styles.volunteerInfo}>
                    <Text style={styles.volunteerName} numberOfLines={1}>
                      {profile?.full_name ?? 'Volunteer'}
                    </Text>
                    <Text style={styles.volunteerEmail} numberOfLines={1}>
                      {profile?.email ?? ''}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleCheckIn(signup)}
                    style={[
                      styles.checkInBtn,
                      signup.checked_in && styles.checkInBtnActive,
                    ]}
                  >
                    {signup.checked_in ? (
                      <UserCheck color="#fff" size={16} />
                    ) : (
                      <Check color="#0E3C73" size={16} />
                    )}
                  </Pressable>
                </View>

                <View style={styles.volunteerActions}>
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => {
                      setHoursModal(signup);
                      setHoursValue(signup.hours_logged ? String(signup.hours_logged) : '');
                    }}
                  >
                    <Clock color={joyTheme.primary} size={14} />
                    <Text style={styles.actionBtnText}>
                      {signup.hours_logged ? `${signup.hours_logged}h` : 'Log Hours'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => {
                      setPointsModal(signup);
                      setPointsValue(signup.points_earned ? String(signup.points_earned) : '');
                    }}
                  >
                    <Star color="#FFB020" size={14} />
                    <Text style={styles.actionBtnText}>
                      {signup.points_earned ? `${signup.points_earned} pts` : 'Award Points'}
                    </Text>
                  </Pressable>
                </View>

                {signup.checked_in && (
                  <View style={styles.checkedInBanner}>
                    <UserCheck color="#2BB673" size={12} />
                    <Text style={styles.checkedInText}>Checked in</Text>
                  </View>
                )}
              </View>
            );
          })}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <Modal visible={!!hoursModal} transparent animationType="fade">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Hours</Text>
              <Pressable onPress={() => { setHoursModal(null); setHoursValue(''); }} hitSlop={12}>
                <X color={joyTheme.textMuted} size={22} />
              </Pressable>
            </View>
            <Text style={styles.modalSub}>
              For {hoursModal?.profiles?.full_name ?? 'this volunteer'}
            </Text>
            <View style={styles.modalInputWrap}>
              <Clock color={joyTheme.textMuted} size={18} />
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 3.5"
                placeholderTextColor={joyTheme.textMuted}
                value={hoursValue}
                onChangeText={setHoursValue}
                keyboardType="decimal-pad"
                autoFocus
              />
              <Text style={styles.modalInputSuffix}>hours</Text>
            </View>
            <Pressable
              style={[styles.modalSubmitBtn, hoursMutation.isPending && { opacity: 0.6 }]}
              onPress={handleLogHours}
              disabled={hoursMutation.isPending}
            >
              {hoursMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.modalSubmitText}>Save Hours</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!pointsModal} transparent animationType="fade">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Award Points</Text>
              <Pressable onPress={() => { setPointsModal(null); setPointsValue(''); }} hitSlop={12}>
                <X color={joyTheme.textMuted} size={22} />
              </Pressable>
            </View>
            <Text style={styles.modalSub}>
              For {pointsModal?.profiles?.full_name ?? 'this volunteer'}
            </Text>
            <View style={styles.modalInputWrap}>
              <Star color="#FFB020" size={18} />
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 50"
                placeholderTextColor={joyTheme.textMuted}
                value={pointsValue}
                onChangeText={setPointsValue}
                keyboardType="number-pad"
                autoFocus
              />
              <Text style={styles.modalInputSuffix}>points</Text>
            </View>
            <Pressable
              style={[styles.modalSubmitBtn, pointsMutation.isPending && { opacity: 0.6 }]}
              onPress={handleAwardPoints}
              disabled={pointsMutation.isPending}
            >
              {pointsMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.modalSubmitText}>Award Points</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: joyTheme.background },
  centered: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 15, fontFamily: fonts.semiBold, color: joyTheme.textMuted },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
    borderBottomColor: joyTheme.border, backgroundColor: '#fff',
  },
  headerBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontFamily: fonts.extraBold, color: joyTheme.text, letterSpacing: -0.3 },
  headerSub: { fontSize: 12, fontFamily: fonts.semiBold, color: joyTheme.textMuted, marginTop: 2 },
  summaryBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: '#fff', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: joyTheme.border,
  },
  summaryItem: { alignItems: 'center', gap: 4 },
  summaryValue: { fontSize: 20, fontFamily: fonts.black, color: joyTheme.text },
  summaryLabel: { fontSize: 11, fontFamily: fonts.semiBold, color: joyTheme.textMuted },
  summaryDivider: { width: 1, height: 32, backgroundColor: joyTheme.border },
  controlsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
  },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: joyTheme.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: joyTheme.text, padding: 0 },
  checkAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#2BB673',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
  },
  checkAllBtnText: { fontSize: 13, fontFamily: fonts.bold, color: '#fff' },
  filterRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: '#fff', borderWidth: 1, borderColor: joyTheme.border,
  },
  filterChipActive: { backgroundColor: '#0E3C73', borderColor: '#0E3C73' },
  filterChipText: { fontSize: 13, fontFamily: fonts.bold, color: joyTheme.text },
  filterChipTextActive: { color: '#fff' },
  listContent: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },
  volunteerCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 14, gap: 10,
    borderWidth: 1, borderColor: joyTheme.border,
  },
  volunteerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 14 },
  avatarPlaceholder: { backgroundColor: joyTheme.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontFamily: fonts.extraBold, color: joyTheme.primaryDark },
  volunteerInfo: { flex: 1, gap: 2 },
  volunteerName: { fontSize: 15, fontFamily: fonts.bold, color: joyTheme.text },
  volunteerEmail: { fontSize: 12, fontFamily: fonts.medium, color: joyTheme.textMuted },
  checkInBtn: {
    width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#D6E6F7',
  },
  checkInBtnActive: { backgroundColor: '#2BB673', borderColor: '#2BB673' },
  volunteerActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: joyTheme.background, borderRadius: 12,
    paddingVertical: 10, borderWidth: 1, borderColor: joyTheme.border,
  },
  actionBtnText: { fontSize: 13, fontFamily: fonts.semiBold, color: joyTheme.text },
  checkedInBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#E8F8EE', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  checkedInText: { fontSize: 11, fontFamily: fonts.bold, color: '#2BB673' },
  emptyState: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  emptyStateText: { fontSize: 15, fontFamily: fonts.semiBold, color: joyTheme.textMuted },
  bottomSpacer: { height: 24 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 24,
  },
  modalSheet: {
    backgroundColor: '#fff', borderRadius: 24, padding: 24, gap: 16,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  modalTitle: { fontSize: 18, fontFamily: fonts.extraBold, color: joyTheme.text },
  modalSub: { fontSize: 14, fontFamily: fonts.semiBold, color: joyTheme.textMuted },
  modalInputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: joyTheme.background, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: joyTheme.border,
  },
  modalInput: { flex: 1, fontSize: 18, fontFamily: fonts.bold, color: joyTheme.text, padding: 0 },
  modalInputSuffix: { fontSize: 14, fontFamily: fonts.semiBold, color: joyTheme.textMuted },
  modalSubmitBtn: {
    backgroundColor: '#0E3C73', borderRadius: 16, paddingVertical: 16, alignItems: 'center',
  },
  modalSubmitText: { fontSize: 16, fontFamily: fonts.extraBold, color: '#fff' },
});
