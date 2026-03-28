import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  ClipboardList,
  FileText,
  MapPin,
  Megaphone,
  Shield,
  UserCheck,
  Users,
  Zap,
  CalendarDays,
  Calendar,
  History,
  ListFilter,
  ExternalLink,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Linking,
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
import { useAuth } from '@/providers/AuthProvider';
import {
  fetchOrgEventsList,
  fetchEventSignups,
  fetchEventPhotos,
  fetchOrgPendingPhotos,
  checkInVolunteer,
  fetchEventDayOfAgenda,
  fetchEventDayOfContacts,
  fetchEventDayOfMedia,
  fetchEventLinks,
  fetchUserEvents,
  fetchOrganizationById,
} from '@/lib/api';
import type { DbEvent, DbEventSignup, DbProfile } from '@/types/database';

type SignupWithProfile = DbEventSignup & { profiles: DbProfile };

type FilterTab = 'upcoming' | 'today' | 'past' | 'all';

const SCREEN_WIDTH = Dimensions.get('window').width;

const FILTER_TABS: { key: FilterTab; label: string; icon: React.ComponentType<{ color: string; size: number }> }[] = [
  { key: 'upcoming', label: 'Upcoming', icon: Calendar },
  { key: 'today', label: 'Today', icon: CalendarDays },
  { key: 'past', label: 'Past', icon: History },
  { key: 'all', label: 'All', icon: ListFilter },
];

function formatEventTime(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – ${e.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getEventImageUri(event: DbEvent): string {
  const resolved = resolveImageUrl(event.image_url);
  if (resolved) return resolved;
  return 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=600&q=80';
}

function getEventStatus(event: DbEvent): 'upcoming' | 'live' | 'ended' {
  const now = new Date();
  const start = new Date(event.start_time);
  const end = new Date(event.end_time);
  if (now < start) return 'upcoming';
  if (now >= start && now <= end) return 'live';
  return 'ended';
}

function getStatusLabel(status: 'upcoming' | 'live' | 'ended'): string {
  switch (status) {
    case 'live': return 'LIVE NOW';
    case 'upcoming': return 'UPCOMING';
    case 'ended': return 'COMPLETED';
  }
}

function getStatusColor(status: 'upcoming' | 'live' | 'ended'): string {
  switch (status) {
    case 'live': return '#10B981';
    case 'upcoming': return '#F59E0B';
    case 'ended': return '#6B7280';
  }
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function EventResourcesSection({ eventId }: { eventId: string }) {
  const agendaQuery = useQuery({
    queryKey: ['event-day-of-agenda', eventId],
    queryFn: () => fetchEventDayOfAgenda(eventId),
    staleTime: 15000,
  });

  const contactsQuery = useQuery({
    queryKey: ['event-day-of-contacts', eventId],
    queryFn: () => fetchEventDayOfContacts(eventId),
    staleTime: 15000,
  });

  const mediaQuery = useQuery({
    queryKey: ['event-day-of-media', eventId],
    queryFn: () => fetchEventDayOfMedia(eventId),
    staleTime: 15000,
  });

  const linksQuery = useQuery({
    queryKey: ['event-links', eventId],
    queryFn: () => fetchEventLinks(eventId),
    staleTime: 15000,
  });

  const agenda = useMemo(() => agendaQuery.data ?? [], [agendaQuery.data]);
  const contacts = useMemo(() => contactsQuery.data ?? [], [contactsQuery.data]);
  const media = useMemo(() => mediaQuery.data ?? [], [mediaQuery.data]);
  const links = useMemo(() => linksQuery.data ?? [], [linksQuery.data]);

  const isLoading = agendaQuery.isLoading || contactsQuery.isLoading;
  const hasContent = agenda.length > 0 || contacts.length > 0 || media.length > 0 || links.length > 0;

  const handleOpenLink = useCallback((url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open link');
    });
  }, []);

  if (isLoading) {
    return (
      <View style={styles.docLoadingWrap}>
        <ActivityIndicator color={joyTheme.primary} size="small" />
      </View>
    );
  }

  if (!hasContent) return null;

  return (
    <View style={styles.documentsCard}>
      {agenda.length > 0 && (
        <>
          <View style={styles.documentsTitleRow}>
            <ClipboardList color={joyTheme.primary} size={18} />
            <Text style={styles.documentsTitle}>Agenda</Text>
          </View>
          {agenda.map((item) => (
            <View key={item.id} style={styles.docRow}>
              <View style={styles.docInfo}>
                <Text style={styles.docIcon}>📋</Text>
                <View style={styles.docTextWrap}>
                  <Text style={styles.docName} numberOfLines={1}>{item.title}</Text>
                  {item.start_time && <Text style={styles.docDate}>{item.start_time}{item.end_time ? ` – ${item.end_time}` : ''}</Text>}
                </View>
              </View>
            </View>
          ))}
        </>
      )}

      {contacts.length > 0 && (
        <>
          <View style={[styles.documentsTitleRow, { marginTop: 12 }]}>
            <Users color={joyTheme.primary} size={18} />
            <Text style={styles.documentsTitle}>Key Contacts</Text>
          </View>
          {contacts.map((contact) => (
            <View key={contact.id} style={styles.docRow}>
              <View style={styles.docInfo}>
                <Text style={styles.docIcon}>👤</Text>
                <View style={styles.docTextWrap}>
                  <Text style={styles.docName}>{contact.name} – {contact.role}</Text>
                  {contact.phone && <Text style={styles.docDate}>{contact.phone}</Text>}
                </View>
              </View>
            </View>
          ))}
        </>
      )}

      {links.length > 0 && (
        <>
          <View style={[styles.documentsTitleRow, { marginTop: 12 }]}>
            <ExternalLink color={joyTheme.primary} size={18} />
            <Text style={styles.documentsTitle}>Resources</Text>
          </View>
          {links.map((link) => (
            <Pressable
              key={link.id}
              onPress={() => handleOpenLink(link.url)}
              style={({ pressed }) => [styles.docRow, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.docInfo}>
                <Text style={styles.docIcon}>🔗</Text>
                <View style={styles.docTextWrap}>
                  <Text style={styles.docName} numberOfLines={1}>{link.label}</Text>
                </View>
                <ExternalLink color={joyTheme.textMuted} size={16} />
              </View>
            </Pressable>
          ))}
        </>
      )}

      {media.length > 0 && (
        <>
          <View style={[styles.documentsTitleRow, { marginTop: 12 }]}>
            <FileText color={joyTheme.primary} size={18} />
            <Text style={styles.documentsTitle}>Media & Documents</Text>
          </View>
          {media.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => handleOpenLink(item.media_url)}
              style={({ pressed }) => [styles.docRow, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.docInfo}>
                <Text style={styles.docIcon}>{item.media_type === 'image' ? '🖼️' : '📄'}</Text>
                <View style={styles.docTextWrap}>
                  <Text style={styles.docName} numberOfLines={1}>{item.title}</Text>
                </View>
                <ExternalLink color={joyTheme.textMuted} size={16} />
              </View>
            </Pressable>
          ))}
        </>
      )}
    </View>
  );
}

function EventSignupsCard({ eventId }: { eventId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const signupsQuery = useQuery({
    queryKey: ['event-signups', eventId],
    queryFn: () => fetchEventSignups(eventId),
    refetchInterval: 15000,
    staleTime: 5000,
  });

  const photosQuery = useQuery({
    queryKey: ['event-photos', eventId],
    queryFn: () => fetchEventPhotos(eventId),
    refetchInterval: 30000,
  });

  const signups = useMemo(() => (signupsQuery.data ?? []) as SignupWithProfile[], [signupsQuery.data]);
  const checkedInCount = useMemo(() => signups.filter(s => s.checked_in).length, [signups]);
  const totalSignups = signups.length;
  const photos = useMemo(() => photosQuery.data ?? [], [photosQuery.data]);

  const checkInMutation = useMutation({
    mutationFn: (signupId: string) => checkInVolunteer(signupId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['event-signups', eventId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message);
    },
  });

  const handleQuickCheckIn = useCallback((signup: SignupWithProfile) => {
    if (signup.checked_in) return;
    Alert.alert(
      'Check In',
      `Check in ${signup.profiles?.full_name ?? 'this volunteer'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Check In', onPress: () => checkInMutation.mutate(signup.id) },
      ]
    );
  }, [checkInMutation]);

  const handleManageVolunteers = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/manage-volunteers', params: { eventId } } as never);
  }, [router, eventId]);

  if (signupsQuery.isLoading) {
    return (
      <View style={styles.loadingMiniWrap}>
        <ActivityIndicator color={joyTheme.primary} size="small" />
      </View>
    );
  }

  return (
    <>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: '#DBEAFE' }]}>
            <Users color="#2563EB" size={18} />
          </View>
          <Text style={styles.statValue}>{totalSignups}</Text>
          <Text style={styles.statLabel}>Registered</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: '#D1FAE5' }]}>
            <UserCheck color="#059669" size={18} />
          </View>
          <Text style={styles.statValue}>{checkedInCount}</Text>
          <Text style={styles.statLabel}>Checked In</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: '#FEF3C7' }]}>
            <Camera color="#D97706" size={18} />
          </View>
          <Text style={styles.statValue}>{photos.length}</Text>
          <Text style={styles.statLabel}>Photos</Text>
        </View>
      </View>

      {totalSignups > 0 && (
        <View style={styles.quickCheckinCard}>
          <View style={styles.quickCheckinHeader}>
            <View style={styles.quickCheckinTitleRow}>
              <Shield color={joyTheme.primary} size={18} />
              <Text style={styles.quickCheckinTitle}>Quick Check-In</Text>
            </View>
            <Pressable
              onPress={handleManageVolunteers}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.viewAllLink}>View All</Text>
            </Pressable>
          </View>
          {signups.slice(0, 5).map((signup) => (
            <Pressable
              key={signup.id}
              onPress={() => handleQuickCheckIn(signup)}
              style={({ pressed }) => [styles.volunteerRow, pressed && { opacity: 0.7, backgroundColor: '#F8FAFC' }]}
            >
              <View style={styles.volunteerInfo}>
                {signup.profiles?.avatar_url ? (
                  <Image
                    source={{ uri: resolveImageUrl(signup.profiles.avatar_url) ?? '' }}
                    style={styles.volunteerAvatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.volunteerAvatarPlaceholder}>
                    <Text style={styles.volunteerInitials}>
                      {(signup.profiles?.full_name ?? '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.volunteerTextWrap}>
                  <Text style={styles.volunteerName} numberOfLines={1}>
                    {signup.profiles?.full_name ?? 'Unknown'}
                  </Text>
                  <Text style={styles.volunteerStatus}>
                    {signup.checked_in ? 'Checked in' : 'Not checked in'}
                  </Text>
                </View>
              </View>
              {signup.checked_in ? (
                <CheckCircle2 color="#059669" size={22} />
              ) : (
                <View style={styles.checkInBtn}>
                  <Text style={styles.checkInBtnText}>Check In</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      )}

      {checkedInCount > 0 && totalSignups > 0 && (
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Zap color="#F59E0B" size={18} />
            <Text style={styles.progressTitle}>Check-In Progress</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.round((checkedInCount / totalSignups) * 100)}%` as never },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {checkedInCount} of {totalSignups} volunteers checked in ({Math.round((checkedInCount / totalSignups) * 100)}%)
          </Text>
        </View>
      )}
    </>
  );
}

function EventActionsGrid({ eventId, pendingPhotosCount }: { eventId: string; orgId: string | null; pendingPhotosCount: number }) {
  const router = useRouter();

  const handleManageVolunteers = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/manage-volunteers', params: { eventId } } as never);
  }, [router, eventId]);

  const handlePhotoApproval = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push('/photo-approval' as never);
  }, [router]);

  const handleSendAnnouncement = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push('/send-announcement' as never);
  }, [router]);

  const handleEventDetails = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/event-detail', params: { id: eventId } } as never);
  }, [router, eventId]);

  return (
    <View style={styles.actionsGrid}>
      <Text style={styles.actionsTitle}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        <Pressable
          onPress={handleManageVolunteers}
          style={({ pressed }) => [styles.actionTile, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
        >
          <LinearGradient colors={['#2563EB', '#1D4ED8']} style={StyleSheet.absoluteFillObject} />
          <Users color="#fff" size={24} />
          <Text style={styles.actionTileTitle}>Manage{'\n'}Volunteers</Text>
        </Pressable>
        <Pressable
          onPress={handlePhotoApproval}
          style={({ pressed }) => [styles.actionTile, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
        >
          <LinearGradient colors={['#D97706', '#B45309']} style={StyleSheet.absoluteFillObject} />
          <Camera color="#fff" size={24} />
          <Text style={styles.actionTileTitle}>Photo{'\n'}Approval</Text>
          {pendingPhotosCount > 0 && (
            <View style={styles.actionBadge}>
              <Text style={styles.actionBadgeText}>{pendingPhotosCount}</Text>
            </View>
          )}
        </Pressable>
      </View>
      <View style={styles.actionsRow}>
        <Pressable
          onPress={handleSendAnnouncement}
          style={({ pressed }) => [styles.actionTile, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
        >
          <LinearGradient colors={['#059669', '#047857']} style={StyleSheet.absoluteFillObject} />
          <Megaphone color="#fff" size={24} />
          <Text style={styles.actionTileTitle}>Send{'\n'}Announcement</Text>
        </Pressable>
        <Pressable
          onPress={handleEventDetails}
          style={({ pressed }) => [styles.actionTile, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
        >
          <LinearGradient colors={['#7C3AED', '#6D28D9']} style={StyleSheet.absoluteFillObject} />
          <ClipboardList color="#fff" size={24} />
          <Text style={styles.actionTileTitle}>Event{'\n'}Details</Text>
        </Pressable>
      </View>
    </View>
  );
}

const MemoizedEventSignupsCard = React.memo(EventSignupsCard);
const MemoizedEventActionsGrid = React.memo(EventActionsGrid);
const MemoizedEventResourcesSection = React.memo(EventResourcesSection);

function VolunteerEventCard({ signup, event }: { signup: DbEventSignup; event: DbEvent }) {
  const router = useRouter();
  const { user } = useAuth();
  const status = getEventStatus(event);
  const statusColor = getStatusColor(status);
  const statusLabel = getStatusLabel(status);
  const [expanded, setExpanded] = useState(false);

  const orgQuery = useQuery({
    queryKey: ['org-for-event', event.organization_id],
    queryFn: () => fetchOrganizationById(event.organization_id ?? ''),
    enabled: !!event.organization_id,
    staleTime: 60000,
  });

  const signupsQuery = useQuery({
    queryKey: ['event-signups-count', event.id],
    queryFn: () => fetchEventSignups(event.id),
    enabled: expanded,
    staleTime: 15000,
  });

  const orgName = orgQuery.data?.name ?? 'Organization';
  const signups = useMemo(() => (signupsQuery.data ?? []) as SignupWithProfile[], [signupsQuery.data]);
  const checkedInCount = useMemo(() => signups.filter(s => s.checked_in).length, [signups]);
  const mySignup = useMemo(() => signups.find(s => s.user_id === user?.id), [signups, user?.id]);

  const handleToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setExpanded(prev => !prev);
  }, []);

  const handleViewEvent = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/event-detail', params: { id: event.id } } as never);
  }, [router, event.id]);

  const handleNavigate = useCallback(() => {
    if (event.location_url) {
      Linking.openURL(event.location_url).catch(() => {});
    } else if (event.address || event.venue) {
      const q = encodeURIComponent([event.address, event.city, event.state].filter(Boolean).join(', '));
      Linking.openURL(`https://maps.google.com/?q=${q}`).catch(() => {});
    }
  }, [event]);

  return (
    <View style={volStyles.eventSection}>
      <Pressable
        onPress={handleToggle}
        style={({ pressed }) => [volStyles.eventCard, pressed && { opacity: 0.95, transform: [{ scale: 0.99 }] }]}
      >
        <Image source={{ uri: getEventImageUri(event) }} style={volStyles.eventBanner} contentFit="cover" />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={StyleSheet.absoluteFillObject} />
        <View style={volStyles.eventBannerContent}>
          <View style={volStyles.eventBannerTopRow}>
            <View style={[volStyles.statusPill, { backgroundColor: statusColor }]}>
              {status === 'live' && <View style={volStyles.pulseDot} />}
              <Text style={volStyles.statusPillText}>{statusLabel}</Text>
            </View>
            {signup.checked_in && (
              <View style={volStyles.checkedInPill}>
                <CheckCircle2 color="#fff" size={12} />
                <Text style={volStyles.checkedInPillText}>Checked In</Text>
              </View>
            )}
          </View>
          <Text style={volStyles.eventTitle} numberOfLines={2}>{event.title}</Text>
          <Text style={volStyles.orgName}>{orgName}</Text>
          <View style={volStyles.eventMetaRow}>
            <Clock color="#fff" size={14} />
            <Text style={volStyles.eventMeta}>{formatEventTime(event.start_time, event.end_time)}</Text>
          </View>
          {(event.venue || event.city) && (
            <View style={volStyles.eventMetaRow}>
              <MapPin color="#fff" size={14} />
              <Text style={volStyles.eventMeta} numberOfLines={1}>{event.venue ?? event.city}</Text>
            </View>
          )}
          <View style={volStyles.expandHint}>
            <Text style={volStyles.expandHintText}>{expanded ? 'Tap to collapse' : 'Tap for details'}</Text>
            <ChevronDown
              color="rgba(255,255,255,0.6)"
              size={14}
              style={expanded ? { transform: [{ rotate: '180deg' }] } : undefined}
            />
          </View>
        </View>
      </Pressable>

      {expanded && (
        <View style={volStyles.expandedContent}>
          <View style={volStyles.infoGrid}>
            <View style={volStyles.infoCard}>
              <View style={[volStyles.infoIconWrap, { backgroundColor: signup.checked_in ? '#D1FAE5' : '#FEF3C7' }]}>
                {signup.checked_in
                  ? <CheckCircle2 color="#059669" size={20} />
                  : <Clock color="#D97706" size={20} />
                }
              </View>
              <Text style={volStyles.infoValue}>{signup.checked_in ? 'Checked In' : 'Not Yet'}</Text>
              <Text style={volStyles.infoLabel}>Your Status</Text>
            </View>
            <View style={volStyles.infoCard}>
              <View style={[volStyles.infoIconWrap, { backgroundColor: '#DBEAFE' }]}>
                <Users color="#2563EB" size={20} />
              </View>
              <Text style={volStyles.infoValue}>{signups.length}</Text>
              <Text style={volStyles.infoLabel}>Volunteers</Text>
            </View>
            <View style={volStyles.infoCard}>
              <View style={[volStyles.infoIconWrap, { backgroundColor: '#E0E7FF' }]}>
                <UserCheck color="#4F46E5" size={20} />
              </View>
              <Text style={volStyles.infoValue}>{checkedInCount}</Text>
              <Text style={volStyles.infoLabel}>Checked In</Text>
            </View>
          </View>

          {(mySignup?.hours_logged != null && mySignup.hours_logged > 0) && (
            <View style={volStyles.hoursCard}>
              <Zap color="#F59E0B" size={18} />
              <Text style={volStyles.hoursText}>{mySignup.hours_logged} hours logged</Text>
              {mySignup.points_earned != null && mySignup.points_earned > 0 && (
                <Text style={volStyles.pointsText}>+{mySignup.points_earned} pts</Text>
              )}
            </View>
          )}

          <View style={volStyles.actionsRow}>
            <Pressable
              onPress={handleViewEvent}
              style={({ pressed }) => [volStyles.actionBtn, pressed && { opacity: 0.85 }]}
            >
              <ClipboardList color="#fff" size={18} />
              <Text style={volStyles.actionBtnText}>Event Details</Text>
            </Pressable>
            {(event.address || event.venue || event.location_url) && (
              <Pressable
                onPress={handleNavigate}
                style={({ pressed }) => [volStyles.actionBtnSecondary, pressed && { opacity: 0.85 }]}
              >
                <MapPin color={joyTheme.primary} size={18} />
                <Text style={volStyles.actionBtnSecondaryText}>Navigate</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const MemoizedVolunteerEventCard = React.memo(VolunteerEventCard);

function VolunteerDayOfView() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const userEventsQuery = useQuery({
    queryKey: ['user-events', userId],
    queryFn: () => fetchUserEvents(userId ?? ''),
    enabled: !!userId,
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const userEventsRefetch = userEventsQuery.refetch;

  useFocusEffect(
    useCallback(() => {
      console.log('[VolunteerDayOf] Focused, refreshing');
      void userEventsRefetch();
    }, [userEventsRefetch])
  );

  const handleRefresh = useCallback(() => {
    void userEventsRefetch();
  }, [userEventsRefetch]);

  const allSignups = useMemo(() => userEventsQuery.data ?? [], [userEventsQuery.data]);

  const todayEvents = useMemo(() => {
    return allSignups.filter(s => s.events && isToday(s.events.start_time))
      .sort((a, b) => new Date(a.events.start_time).getTime() - new Date(b.events.start_time).getTime());
  }, [allSignups]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return allSignups.filter(s => s.events && new Date(s.events.start_time) > now && !isToday(s.events.start_time))
      .sort((a, b) => new Date(a.events.start_time).getTime() - new Date(b.events.start_time).getTime());
  }, [allSignups]);

  const liveEvents = useMemo(() => {
    return allSignups.filter(s => s.events && getEventStatus(s.events) === 'live');
  }, [allSignups]);

  const pastEvents = useMemo(() => {
    const now = new Date();
    return allSignups.filter(s => s.events && new Date(s.events.end_time) < now)
      .sort((a, b) => new Date(b.events.start_time).getTime() - new Date(a.events.start_time).getTime())
      .slice(0, 5);
  }, [allSignups]);

  const todayDateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const hasLive = liveEvents.length > 0;
  const hasTodayEvents = todayEvents.length > 0;
  const isLoading = userEventsQuery.isLoading;

  return (
    <View style={volStyles.screen}>
      <LinearGradient colors={['#0F172A', '#1E293B', '#334155']} style={volStyles.headerGradient} />
      <SafeAreaView style={volStyles.safeArea} edges={['top']}>
        <View style={volStyles.topBar}>
          <View>
            <Text style={volStyles.topBarTitle}>Day Of</Text>
            <Text style={volStyles.topBarDate}>{todayDateStr}</Text>
          </View>
          <View style={volStyles.liveBadge}>
            <View style={[volStyles.liveDot, hasLive && volStyles.liveDotActive]} />
            <Text style={volStyles.liveBadgeText}>
              {hasLive ? 'LIVE' : hasTodayEvents ? 'TODAY' : 'NO EVENTS'}
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={volStyles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={userEventsQuery.isRefetching} onRefresh={handleRefresh} tintColor="#fff" />
          }
        >
          {isLoading && (
            <View style={volStyles.loadingWrap}>
              <ActivityIndicator color="#fff" size="large" />
              <Text style={volStyles.loadingText}>Loading your events...</Text>
            </View>
          )}

          {!isLoading && allSignups.length === 0 && (
            <View style={volStyles.emptyState}>
              <View style={volStyles.emptyIconWrap}>
                <ClipboardList color={joyTheme.textMuted} size={48} />
              </View>
              <Text style={volStyles.emptyTitle}>No Events Yet</Text>
              <Text style={volStyles.emptyText}>
                Sign up for events to see your day-of logistics, check-in status, and event details here.
              </Text>
              <Pressable
                onPress={() => router.push('/(tabs)/events' as never)}
                style={({ pressed }) => [volStyles.discoverBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={volStyles.discoverBtnText}>Discover Events</Text>
              </Pressable>
            </View>
          )}

          {liveEvents.length > 0 && (
            <View style={volStyles.sectionWrap}>
              <View style={volStyles.sectionHeader}>
                <View style={volStyles.sectionLiveDot} />
                <Text style={volStyles.sectionTitle}>Happening Now</Text>
              </View>
              {liveEvents.map(s => (
                <MemoizedVolunteerEventCard key={s.id} signup={s} event={s.events} />
              ))}
            </View>
          )}

          {todayEvents.filter(s => getEventStatus(s.events) !== 'live').length > 0 && (
            <View style={volStyles.sectionWrap}>
              <Text style={volStyles.sectionTitle}>Today&apos;s Events</Text>
              {todayEvents.filter(s => getEventStatus(s.events) !== 'live').map(s => (
                <MemoizedVolunteerEventCard key={s.id} signup={s} event={s.events} />
              ))}
            </View>
          )}

          {upcomingEvents.length > 0 && (
            <View style={volStyles.sectionWrap}>
              <Text style={volStyles.sectionTitle}>Upcoming</Text>
              {upcomingEvents.slice(0, 5).map(s => (
                <MemoizedVolunteerEventCard key={s.id} signup={s} event={s.events} />
              ))}
            </View>
          )}

          {pastEvents.length > 0 && (
            <View style={volStyles.sectionWrap}>
              <Text style={volStyles.sectionTitle}>Recent</Text>
              {pastEvents.map(s => (
                <MemoizedVolunteerEventCard key={s.id} signup={s} event={s.events} />
              ))}
            </View>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const volStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: joyTheme.background,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topBarTitle: {
    fontSize: 28,
    fontFamily: fonts.black,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  topBarDate: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6B7280',
  },
  liveDotActive: {
    backgroundColor: '#10B981',
  },
  liveBadgeText: {
    fontSize: 12,
    fontFamily: fonts.black,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 20,
  },
  loadingWrap: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: 'rgba(255,255,255,0.7)',
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: fonts.black,
    color: '#FFFFFF',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 22,
  },
  discoverBtn: {
    backgroundColor: joyTheme.gold,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 8,
  },
  discoverBtnText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  sectionWrap: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionLiveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  eventSection: {
    gap: 12,
  },
  eventCard: {
    borderRadius: 20,
    overflow: 'hidden',
    height: 210,
  },
  eventBanner: {
    width: '100%',
    height: '100%',
  },
  eventBannerContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    gap: 4,
  },
  eventBannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  statusPillText: {
    fontSize: 11,
    fontFamily: fonts.black,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  checkedInPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16,185,129,0.8)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  checkedInPillText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  eventTitle: {
    fontSize: 20,
    fontFamily: fonts.black,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  orgName: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: 'rgba(255,255,255,0.7)',
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventMeta: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: 'rgba(255,255,255,0.85)',
  },
  expandHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  expandHintText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: 'rgba(255,255,255,0.5)',
  },
  expandedContent: {
    gap: 12,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: joyTheme.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  infoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoValue: {
    fontSize: 16,
    fontFamily: fonts.black,
    color: joyTheme.text,
  },
  infoLabel: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
  },
  hoursCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  hoursText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: '#92400E',
    flex: 1,
  },
  pointsText: {
    fontSize: 15,
    fontFamily: fonts.black,
    color: '#D97706',
  },
  docsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  docsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  docsTitle: {
    fontSize: 15,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  docIcon: {
    fontSize: 20,
  },
  docName: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: joyTheme.text,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: joyTheme.primary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  actionBtnText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  actionBtnSecondaryText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: joyTheme.primary,
  },
});

export default function DayOfScreen() {
  const router = useRouter();
  const { role, organization, adminUser, user } = useAuth();
  const [activeTab, setActiveTab] = useState<FilterTab>('upcoming');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

  const orgId = organization?.id ?? adminUser?.organization_id ?? null;
  const isOrg = role === 'organization';
  const _userId = user?.id ?? adminUser?.id ?? null;

  const allEventsQuery = useQuery({
    queryKey: ['org-all-events', orgId],
    queryFn: () => fetchOrgEventsList(orgId ?? ''),
    enabled: !!orgId && isOrg,
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const pendingPhotosQuery = useQuery({
    queryKey: ['org-pending-photos', orgId],
    queryFn: () => fetchOrgPendingPhotos(orgId ?? ''),
    enabled: !!orgId && isOrg,
    refetchInterval: 30000,
  });

  const allEvents = useMemo(() => allEventsQuery.data ?? [], [allEventsQuery.data]);
  const pendingPhotos = useMemo(() => pendingPhotosQuery.data ?? [], [pendingPhotosQuery.data]);

  const filteredEvents = useMemo(() => {
    const now = new Date();
    switch (activeTab) {
      case 'today':
        return allEvents.filter(e => isToday(e.start_time)).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      case 'upcoming':
        return allEvents.filter(e => new Date(e.start_time) > now).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      case 'past':
        return allEvents.filter(e => new Date(e.end_time) < now).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
      case 'all':
        return [...allEvents].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
    }
  }, [allEvents, activeTab]);

  const todayCount = useMemo(() => allEvents.filter(e => isToday(e.start_time)).length, [allEvents]);
  const upcomingCount = useMemo(() => allEvents.filter(e => new Date(e.start_time) > new Date()).length, [allEvents]);
  const pastCount = useMemo(() => allEvents.filter(e => new Date(e.end_time) < new Date()).length, [allEvents]);

  const tabCounts: Record<FilterTab, number> = useMemo(() => ({
    today: todayCount,
    upcoming: upcomingCount,
    past: pastCount,
    all: allEvents.length,
  }), [todayCount, upcomingCount, pastCount, allEvents.length]);

  const handleTabPress = useCallback((tab: FilterTab, index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setActiveTab(tab);
    setExpandedEventId(null);
    const tabWidth = (SCREEN_WIDTH - 40) / FILTER_TABS.length;
    Animated.spring(tabIndicatorAnim, {
      toValue: index * tabWidth,
      useNativeDriver: true,
      tension: 300,
      friction: 30,
    }).start();
  }, [tabIndicatorAnim]);

  const handleToggleExpand = useCallback((eventId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setExpandedEventId(prev => prev === eventId ? null : eventId);
  }, []);

  const handleEventPress = useCallback((eventId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/event-detail', params: { id: eventId } } as never);
  }, [router]);

  const allEventsRefetch = allEventsQuery.refetch;
  const pendingPhotosRefetch = pendingPhotosQuery.refetch;

  useFocusEffect(
    useCallback(() => {
      console.log('[DayOfScreen] Focused, refreshing data');
      void allEventsRefetch();
      void pendingPhotosRefetch();
    }, [allEventsRefetch, pendingPhotosRefetch])
  );

  const handleRefresh = useCallback(() => {
    console.log('[DayOfScreen] Pull to refresh');
    void allEventsRefetch();
    void pendingPhotosRefetch();
  }, [allEventsRefetch, pendingPhotosRefetch]);

  const isRefreshing = allEventsQuery.isRefetching;
  const isLoading = allEventsQuery.isLoading;

  const todayDateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const hasLiveEvent = useMemo(() => allEvents.some(e => getEventStatus(e) === 'live'), [allEvents]);

  if (!isOrg) {
    return <VolunteerDayOfView />;
  }

  const tabWidth = (SCREEN_WIDTH - 40) / FILTER_TABS.length;

  return (
    <View style={styles.screen} testID="day-of-screen">
      <LinearGradient colors={['#0F172A', '#1E293B', '#334155']} style={styles.headerGradient} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.topBarTitle}>Day Of</Text>
            <Text style={styles.topBarDate}>{todayDateStr}</Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={[styles.liveDot, hasLiveEvent && styles.liveDotActive]} />
            <Text style={styles.liveBadgeText}>
              {hasLiveEvent ? 'LIVE' : todayCount > 0 ? 'TODAY' : 'NO EVENTS'}
            </Text>
          </View>
        </View>

        <View style={styles.tabBarContainer}>
          <View style={styles.tabBar}>
            <Animated.View
              style={[
                styles.tabIndicator,
                {
                  width: tabWidth - 4,
                  transform: [{ translateX: tabIndicatorAnim }],
                },
              ]}
            />
            {FILTER_TABS.map((tab, index) => {
              const isActive = activeTab === tab.key;
              const Icon = tab.icon;
              const count = tabCounts[tab.key];
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => handleTabPress(tab.key, index)}
                  style={[styles.tabItem, { width: tabWidth }]}
                >
                  <Icon color={isActive ? '#FFFFFF' : 'rgba(255,255,255,0.5)'} size={16} />
                  <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                    {tab.label}
                  </Text>
                  {count > 0 && (
                    <View style={[styles.tabCountBadge, isActive && styles.tabCountBadgeActive]}>
                      <Text style={[styles.tabCountText, isActive && styles.tabCountTextActive]}>{count}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#fff" />
          }
        >
          {isLoading && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color="#fff" size="large" />
              <Text style={styles.loadingText}>Loading events...</Text>
            </View>
          )}

          {!isLoading && filteredEvents.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <ClipboardList color={joyTheme.textMuted} size={48} />
              </View>
              <Text style={styles.emptyTitle}>
                {activeTab === 'today' ? 'No Events Today' : activeTab === 'upcoming' ? 'No Upcoming Events' : activeTab === 'past' ? 'No Past Events' : 'No Events'}
              </Text>
              <Text style={styles.emptyText}>
                {activeTab === 'today'
                  ? 'You don\'t have any events scheduled for today. Check upcoming events or create a new one.'
                  : activeTab === 'upcoming'
                  ? 'No upcoming events scheduled. Create a new event from the dashboard.'
                  : activeTab === 'past'
                  ? 'No past events found.'
                  : 'No events found for this organization.'}
              </Text>
            </View>
          )}

          {filteredEvents.map((event) => {
            const status = getEventStatus(event);
            const statusColor = getStatusColor(status);
            const statusLabel = getStatusLabel(status);
            const isExpanded = expandedEventId === event.id;

            return (
              <View key={event.id} style={styles.eventSection}>
                <Pressable
                  onPress={() => handleToggleExpand(event.id)}
                  onLongPress={() => handleEventPress(event.id)}
                  style={({ pressed }) => [styles.eventCard, pressed && { opacity: 0.95, transform: [{ scale: 0.99 }] }]}
                >
                  <Image source={{ uri: getEventImageUri(event) }} style={styles.eventBanner} contentFit="cover" />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.75)']}
                    style={styles.eventBannerOverlay}
                  />
                  <View style={styles.eventBannerContent}>
                    <View style={styles.eventBannerTopRow}>
                      <View style={[styles.statusPill, { backgroundColor: statusColor }]}>
                        {status === 'live' && <View style={styles.pulseDot} />}
                        <Text style={styles.statusPillText}>{statusLabel}</Text>
                      </View>
                      {!isToday(event.start_time) && (
                        <View style={styles.datePill}>
                          <Text style={styles.datePillText}>{formatEventDate(event.start_time)}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
                    <View style={styles.eventMetaRow}>
                      <Clock color="#fff" size={14} />
                      <Text style={styles.eventMeta}>{formatEventTime(event.start_time, event.end_time)}</Text>
                    </View>
                    {(event.venue || event.city) && (
                      <View style={styles.eventMetaRow}>
                        <MapPin color="#fff" size={14} />
                        <Text style={styles.eventMeta} numberOfLines={1}>{event.venue ?? event.city}</Text>
                      </View>
                    )}
                    <View style={styles.expandHint}>
                      <Text style={styles.expandHintText}>{isExpanded ? 'Tap to collapse' : 'Tap to manage event'}</Text>
                      <ChevronDown
                        color="rgba(255,255,255,0.6)"
                        size={14}
                        style={isExpanded ? { transform: [{ rotate: '180deg' }] } : undefined}
                      />
                    </View>
                  </View>
                </Pressable>

                {isExpanded && (
                  <View style={styles.expandedContent}>
                    <MemoizedEventSignupsCard eventId={event.id} />

                    <MemoizedEventResourcesSection eventId={event.id} />

                    <MemoizedEventActionsGrid
                      eventId={event.id}
                      orgId={orgId}
                      pendingPhotosCount={pendingPhotos.length}
                    />
                  </View>
                )}
              </View>
            );
          })}

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
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topBarTitle: {
    fontSize: 28,
    fontFamily: fonts.black,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  topBarDate: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6B7280',
  },
  liveDotActive: {
    backgroundColor: '#10B981',
  },
  liveBadgeText: {
    fontSize: 12,
    fontFamily: fonts.black,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  tabBarContainer: {
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 2,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 2,
    left: 2,
    bottom: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 3,
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },
  tabCountBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  tabCountBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabCountText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: 'rgba(255,255,255,0.5)',
  },
  tabCountTextActive: {
    color: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 16,
  },
  loadingWrap: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: 'rgba(255,255,255,0.7)',
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: fonts.black,
    color: '#FFFFFF',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 22,
  },
  heroSection: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(245,158,11,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 24,
    fontFamily: fonts.black,
    color: '#FFFFFF',
    marginTop: 4,
  },
  heroSubtitle: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 22,
  },
  eventSection: {
    gap: 14,
  },
  eventCard: {
    borderRadius: 20,
    overflow: 'hidden',
    height: 200,
  },
  eventBanner: {
    width: '100%',
    height: '100%',
  },
  eventBannerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  eventBannerContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    gap: 5,
  },
  eventBannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  statusPillText: {
    fontSize: 11,
    fontFamily: fonts.black,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  datePill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  datePillText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  eventTitle: {
    fontSize: 20,
    fontFamily: fonts.black,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventMeta: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: 'rgba(255,255,255,0.85)',
  },
  expandHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  expandHintText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: 'rgba(255,255,255,0.5)',
  },
  expandedContent: {
    gap: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: joyTheme.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 22,
    fontFamily: fonts.black,
    color: joyTheme.text,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
  },
  quickCheckinCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    gap: 2,
    borderWidth: 1,
    borderColor: joyTheme.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  quickCheckinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  quickCheckinTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickCheckinTitle: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
  },
  viewAllLink: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: joyTheme.primary,
  },
  volunteerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  volunteerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  volunteerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
  },
  volunteerAvatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  volunteerInitials: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
  },
  volunteerTextWrap: {
    flex: 1,
    gap: 2,
  },
  volunteerName: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: joyTheme.text,
  },
  volunteerStatus: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  checkInBtn: {
    backgroundColor: '#DBEAFE',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  checkInBtnText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: '#2563EB',
  },
  actionsGrid: {
    gap: 10,
  },
  actionsTitle: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionTile: {
    flex: 1,
    height: 100,
    borderRadius: 18,
    overflow: 'hidden',
    padding: 16,
    justifyContent: 'space-between',
  },
  actionTileTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    lineHeight: 18,
  },
  actionBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  actionBadgeText: {
    fontSize: 11,
    fontFamily: fonts.black,
    color: '#FFFFFF',
  },
  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTitle: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
  },
  progressBarBg: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  progressText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  documentsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: joyTheme.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  documentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  documentsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  documentsTitle: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: joyTheme.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 90,
    justifyContent: 'center',
  },
  uploadBtnText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  docLoadingWrap: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  noDocsWrap: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 4,
  },
  noDocsText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  noDocsHint: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: '#94A3B8',
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    gap: 8,
  },
  docInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  docIcon: {
    fontSize: 22,
  },
  docTextWrap: {
    flex: 1,
    gap: 2,
  },
  docName: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: joyTheme.text,
  },
  docDate: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  docDeleteBtn: {
    padding: 8,
  },
  loadingMiniWrap: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  bottomSpacer: {
    height: 24,
  },
});
