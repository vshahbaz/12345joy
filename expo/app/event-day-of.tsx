import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  Clock,
  ClipboardList,
  ExternalLink,
  FileText,
  ImageIcon,
  Link2,
  MapPin,
  Phone,
  Mail,
  Star,
  Users,
} from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts } from '@/constants/fonts';
import { joyTheme } from '@/constants/joyTheme';
import { resolveImageUrl } from '@/lib/imageUtils';
import {
  fetchEventById,
  fetchEventDayOfAgenda,
  fetchEventDayOfContacts,
  fetchEventDayOfMedia,
  fetchEventSignups,
} from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import type { DbEvent, DbEventDayOfAgenda, DbEventDayOfContact, DbEventDayOfMedia, DbEventSignup, DbProfile } from '@/types/database';

type SignupWithProfile = DbEventSignup & { profiles: DbProfile };

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – ${e.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

function formatAgendaTime(start: string | null, end: string | null): string {
  if (!start) return '';
  const parts = [start];
  if (end) parts.push(end);
  return parts.join(' – ');
}

function isEventToday(event: DbEvent): boolean {
  const now = new Date();
  const start = new Date(event.start_time);
  const end = new Date(event.end_time);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return (start <= todayEnd && end >= todayStart);
}

function getLocationString(event: DbEvent): string {
  const parts: string[] = [];
  if (event.venue) parts.push(event.venue);
  if (event.address) parts.push(event.address);
  if (event.city) parts.push(event.city);
  if (event.state) parts.push(event.state);
  return parts.length > 0 ? parts.join(', ') : 'Location TBD';
}

function getMediaIcon(mediaType: string) {
  switch (mediaType) {
    case 'image':
      return ImageIcon;
    case 'link':
      return Link2;
    case 'document':
      return FileText;
    default:
      return ExternalLink;
  }
}

export default function EventDayOfScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: _user } = useAuth();

  const eventQuery = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => fetchEventById(eventId ?? ''),
    enabled: !!eventId,
    staleTime: 10000,
  });

  const agendaQuery = useQuery({
    queryKey: ['event-day-of-agenda', eventId],
    queryFn: () => fetchEventDayOfAgenda(eventId ?? ''),
    enabled: !!eventId,
    staleTime: 15000,
  });

  const mediaQuery = useQuery({
    queryKey: ['event-day-of-media', eventId],
    queryFn: () => fetchEventDayOfMedia(eventId ?? ''),
    enabled: !!eventId,
    staleTime: 15000,
  });

  const contactsQuery = useQuery({
    queryKey: ['event-day-of-contacts', eventId],
    queryFn: () => fetchEventDayOfContacts(eventId ?? ''),
    enabled: !!eventId,
    staleTime: 15000,
  });

  const signupsQuery = useQuery({
    queryKey: ['event-signups', eventId],
    queryFn: () => fetchEventSignups(eventId ?? ''),
    enabled: !!eventId,
    staleTime: 10000,
  });

  const event = eventQuery.data;
  const agenda = useMemo(() => agendaQuery.data ?? [], [agendaQuery.data]);
  const media = useMemo(() => mediaQuery.data ?? [], [mediaQuery.data]);
  const contacts = useMemo(() => contactsQuery.data ?? [], [contactsQuery.data]);
  const signups = useMemo(() => (signupsQuery.data ?? []) as SignupWithProfile[], [signupsQuery.data]);

  const isToday = useMemo(() => {
    if (!event) return false;
    return isEventToday(event);
  }, [event]);

  const agendaItems = useMemo(() => agenda.filter(a => a.item_type === 'agenda'), [agenda]);
  const stationItems = useMemo(() => agenda.filter(a => a.item_type === 'station'), [agenda]);

  const eventLead = useMemo(() => {
    return signups.find(s => s.is_lead) ?? null;
  }, [signups]);

  const confirmedVolunteers = useMemo(() => {
    const leads = signups.filter(s => s.is_lead);
    const nonLeads = signups.filter(s => !s.is_lead);
    return [...leads, ...nonLeads];
  }, [signups]);

  const eventRefetch = eventQuery.refetch;
  const agendaRefetch = agendaQuery.refetch;
  const mediaRefetch = mediaQuery.refetch;
  const contactsRefetch = contactsQuery.refetch;
  const signupsRefetch = signupsQuery.refetch;

  const handleRefresh = useCallback(() => {
    console.log('[EventDayOf] Refreshing all data');
    void eventRefetch();
    void agendaRefetch();
    void mediaRefetch();
    void contactsRefetch();
    void signupsRefetch();
  }, [eventRefetch, agendaRefetch, mediaRefetch, contactsRefetch, signupsRefetch]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.back();
  }, [router]);

  const handleOpenLink = useCallback((url: string) => {
    console.log('[EventDayOf] Opening link:', url);
    Linking.openURL(url).catch(() => {});
  }, []);

  const handleCall = useCallback((phone: string) => {
    console.log('[EventDayOf] Calling:', phone);
    const url = Platform.OS === 'web' ? `tel:${phone}` : `tel:${phone}`;
    Linking.openURL(url).catch(() => {});
  }, []);

  const handleEmail = useCallback((email: string) => {
    console.log('[EventDayOf] Emailing:', email);
    Linking.openURL(`mailto:${email}`).catch(() => {});
  }, []);

  const handleOpenMap = useCallback(() => {
    if (!event) return;
    const address = [event.venue, event.address, event.city, event.state].filter(Boolean).join(', ');
    if (event.location_url) {
      Linking.openURL(event.location_url).catch(() => {});
    } else if (address) {
      const encoded = encodeURIComponent(address);
      const url = Platform.OS === 'web'
        ? `https://www.google.com/maps/search/?api=1&query=${encoded}`
        : Platform.OS === 'ios'
          ? `maps:?q=${encoded}`
          : `geo:0,0?q=${encoded}`;
      Linking.openURL(url).catch(() => {});
    }
  }, [event]);

  const isLoading = eventQuery.isLoading;
  const isRefreshing = eventQuery.isRefetching || agendaQuery.isRefetching;

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.centered]} testID="event-day-of-loading">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={joyTheme.primary} />
        <Text style={styles.loadingText}>Loading day-of info...</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.loadingText}>Event not found</Text>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const imageUri = resolveImageUrl(event.image_url) ?? 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80';

  return (
    <View style={styles.screen} testID="event-day-of-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#fff" />
        }
      >
        <View style={styles.hero}>
          <Image source={{ uri: imageUri }} style={styles.heroImage} contentFit="cover" />
          <LinearGradient
            colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(15,23,42,0.95)']}
            locations={[0, 0.3, 1]}
            style={styles.heroOverlay}
          />
          <View style={[styles.heroNav, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={handleBack} style={styles.navBtn} testID="day-of-back-btn">
              <ArrowLeft color="#fff" size={22} />
            </Pressable>
            <View style={styles.dayOfBadge}>
              <ClipboardList color="#fff" size={14} />
              <Text style={styles.dayOfBadgeText}>Day-Of Info</Text>
            </View>
          </View>
          <View style={styles.heroContent}>
            {isToday && (
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.livePillText}>TODAY</Text>
              </View>
            )}
            <Text style={styles.heroTitle}>{event.title}</Text>
            <View style={styles.heroMetaRow}>
              <Calendar color="rgba(255,255,255,0.8)" size={14} />
              <Text style={styles.heroMetaText}>{formatDate(event.start_time)}</Text>
            </View>
            <View style={styles.heroMetaRow}>
              <Clock color="rgba(255,255,255,0.8)" size={14} />
              <Text style={styles.heroMetaText}>{formatTime(event.start_time, event.end_time)}</Text>
            </View>
            <Pressable onPress={handleOpenMap} style={styles.heroLocationRow}>
              <MapPin color="rgba(255,255,255,0.8)" size={14} />
              <Text style={styles.heroMetaTextLink} numberOfLines={2}>{getLocationString(event)}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          {eventLead && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <Star color="#F59E0B" size={18} />
                <Text style={styles.sectionTitle}>Event Lead</Text>
              </View>
              <View style={styles.leadCard}>
                {eventLead.profiles?.avatar_url ? (
                  <Image
                    source={{ uri: resolveImageUrl(eventLead.profiles.avatar_url) ?? '' }}
                    style={styles.leadAvatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.leadAvatar, styles.leadAvatarPlaceholder]}>
                    <Text style={styles.leadInitials}>
                      {(eventLead.profiles?.full_name ?? '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.leadInfo}>
                  <Text style={styles.leadName}>{eventLead.profiles?.full_name ?? 'Event Lead'}</Text>
                  <View style={styles.leadBadge}>
                    <Star color="#F59E0B" size={10} />
                    <Text style={styles.leadBadgeText}>Lead Volunteer</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {agendaItems.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <ClipboardList color={joyTheme.primary} size={18} />
                <Text style={styles.sectionTitle}>Agenda</Text>
              </View>
              {agendaItems.map((item, index) => (
                <AgendaRow key={item.id} item={item} isLast={index === agendaItems.length - 1} />
              ))}
            </View>
          )}

          {stationItems.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <MapPin color={joyTheme.primary} size={18} />
                <Text style={styles.sectionTitle}>Stations</Text>
              </View>
              {stationItems.map((item, index) => (
                <StationRow key={item.id} item={item} isLast={index === stationItems.length - 1} />
              ))}
            </View>
          )}

          {media.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <FileText color={joyTheme.primary} size={18} />
                <Text style={styles.sectionTitle}>Resources</Text>
              </View>
              {media.map((item) => (
                <MediaRow key={item.id} item={item} onPress={handleOpenLink} />
              ))}
            </View>
          )}

          {isToday && contacts.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <Phone color="#EF4444" size={18} />
                <Text style={styles.sectionTitle}>Emergency Contacts</Text>
              </View>
              <Text style={styles.sectionSubtitle}>Visible on event day only</Text>
              {contacts.map((contact) => (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  onCall={handleCall}
                  onEmail={handleEmail}
                />
              ))}
            </View>
          )}

          {isToday && confirmedVolunteers.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <Users color={joyTheme.primary} size={18} />
                <Text style={styles.sectionTitle}>Volunteer Directory</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{confirmedVolunteers.length}</Text>
                </View>
              </View>
              <Text style={styles.sectionSubtitle}>Visible on event day only</Text>
              <View style={styles.volunteerGrid}>
                {confirmedVolunteers.map((signup) => (
                  <VolunteerChip key={signup.id} signup={signup} />
                ))}
              </View>
            </View>
          )}

          {!isToday && contacts.length > 0 && (
            <View style={styles.lockedCard}>
              <Phone color={joyTheme.textMuted} size={20} />
              <Text style={styles.lockedText}>Emergency contacts will be available on the day of the event</Text>
            </View>
          )}

          {!isToday && confirmedVolunteers.length > 0 && (
            <View style={styles.lockedCard}>
              <Users color={joyTheme.textMuted} size={20} />
              <Text style={styles.lockedText}>Volunteer directory will be available on the day of the event</Text>
            </View>
          )}

          {agendaItems.length === 0 && stationItems.length === 0 && media.length === 0 && contacts.length === 0 && (
            <View style={styles.emptyState}>
              <ClipboardList color={joyTheme.textMuted} size={48} />
              <Text style={styles.emptyTitle}>No Day-Of Info Yet</Text>
              <Text style={styles.emptyText}>The organizer hasn't added day-of details for this event yet. Check back closer to the event date.</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const AgendaRow = React.memo(function AgendaRow({ item, isLast }: { item: DbEventDayOfAgenda; isLast: boolean }) {
  const timeStr = formatAgendaTime(item.start_time, item.end_time);
  return (
    <View style={[styles.agendaRow, !isLast && styles.agendaRowBorder]}>
      <View style={styles.agendaTimeline}>
        <View style={styles.agendaDot} />
        {!isLast && <View style={styles.agendaLine} />}
      </View>
      <View style={styles.agendaContent}>
        {timeStr ? <Text style={styles.agendaTime}>{timeStr}</Text> : null}
        <Text style={styles.agendaTitle}>{item.title}</Text>
        {item.description ? <Text style={styles.agendaDesc}>{item.description}</Text> : null}
        {item.location_note ? (
          <View style={styles.agendaLocationRow}>
            <MapPin color={joyTheme.textMuted} size={12} />
            <Text style={styles.agendaLocation}>{item.location_note}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
});

const StationRow = React.memo(function StationRow({ item, isLast }: { item: DbEventDayOfAgenda; isLast: boolean }) {
  return (
    <View style={[styles.stationRow, !isLast && styles.stationRowBorder]}>
      <View style={styles.stationIcon}>
        <MapPin color={joyTheme.primary} size={16} />
      </View>
      <View style={styles.stationContent}>
        <Text style={styles.stationTitle}>{item.title}</Text>
        {item.description ? <Text style={styles.stationDesc}>{item.description}</Text> : null}
        {item.location_note ? <Text style={styles.stationLocation}>{item.location_note}</Text> : null}
      </View>
    </View>
  );
});

const MediaRow = React.memo(function MediaRow({ item, onPress }: { item: DbEventDayOfMedia; onPress: (url: string) => void }) {
  const IconComp = getMediaIcon(item.media_type);
  return (
    <Pressable
      onPress={() => onPress(item.media_url)}
      style={({ pressed }) => [styles.mediaRow, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.mediaIconWrap}>
        <IconComp color={joyTheme.primary} size={18} />
      </View>
      <View style={styles.mediaContent}>
        <Text style={styles.mediaTitle} numberOfLines={1}>{item.title}</Text>
        {item.description ? <Text style={styles.mediaDesc} numberOfLines={1}>{item.description}</Text> : null}
      </View>
      <ExternalLink color={joyTheme.textMuted} size={16} />
    </Pressable>
  );
});

const ContactRow = React.memo(function ContactRow({
  contact,
  onCall,
  onEmail,
}: {
  contact: DbEventDayOfContact;
  onCall: (phone: string) => void;
  onEmail: (email: string) => void;
}) {
  return (
    <View style={styles.contactRow}>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{contact.name}</Text>
        <Text style={styles.contactRole}>{contact.role}</Text>
      </View>
      <View style={styles.contactActions}>
        {contact.phone ? (
          <Pressable
            onPress={() => onCall(contact.phone!)}
            style={({ pressed }) => [styles.contactBtn, styles.contactBtnCall, pressed && { opacity: 0.7 }]}
          >
            <Phone color="#fff" size={14} />
          </Pressable>
        ) : null}
        {contact.email ? (
          <Pressable
            onPress={() => onEmail(contact.email!)}
            style={({ pressed }) => [styles.contactBtn, styles.contactBtnEmail, pressed && { opacity: 0.7 }]}
          >
            <Mail color="#fff" size={14} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

const VolunteerChip = React.memo(function VolunteerChip({ signup }: { signup: SignupWithProfile }) {
  const profile = signup.profiles;
  if (!profile) return null;
  const initials = (profile.full_name ?? 'V')
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={styles.volunteerChip}>
      {resolveImageUrl(profile.avatar_url) ? (
        <Image source={{ uri: resolveImageUrl(profile.avatar_url)! }} style={styles.volunteerAvatar} contentFit="cover" />
      ) : (
        <View style={[styles.volunteerAvatar, styles.volunteerAvatarPlaceholder]}>
          <Text style={styles.volunteerInitials}>{initials}</Text>
        </View>
      )}
      <Text style={styles.volunteerName} numberOfLines={1}>{profile.full_name ?? 'Volunteer'}</Text>
      {signup.is_lead && (
        <Star color="#F59E0B" size={10} style={styles.volunteerStar} />
      )}
    </View>
  );
});

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
  backButton: {
    marginTop: 12,
    backgroundColor: joyTheme.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  hero: {
    height: 340,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroNav: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayOfBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dayOfBadgeText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: '#fff',
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    gap: 6,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#10B981',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  livePillText: {
    fontSize: 11,
    fontFamily: fonts.black,
    color: '#fff',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 24,
    fontFamily: fonts.black,
    color: '#fff',
    letterSpacing: -0.5,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroMetaText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: 'rgba(255,255,255,0.85)',
  },
  heroLocationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 2,
  },
  heroMetaTextLink: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: 'rgba(255,255,255,0.85)',
    textDecorationLine: 'underline',
    flex: 1,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 16,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: joyTheme.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
    flex: 1,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
    marginTop: -10,
    marginBottom: 12,
  },
  countBadge: {
    backgroundColor: joyTheme.primarySoft,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countBadgeText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: joyTheme.primary,
  },
  leadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  leadAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  leadAvatarPlaceholder: {
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadInitials: {
    fontSize: 18,
    fontFamily: fonts.black,
    color: '#92400E',
  },
  leadInfo: {
    flex: 1,
    gap: 4,
  },
  leadName: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: joyTheme.text,
  },
  leadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  leadBadgeText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: '#92400E',
  },
  agendaRow: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 16,
  },
  agendaRowBorder: {},
  agendaTimeline: {
    alignItems: 'center',
    width: 20,
    paddingTop: 4,
  },
  agendaDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: joyTheme.primary,
    borderWidth: 2,
    borderColor: joyTheme.primarySoft,
  },
  agendaLine: {
    width: 2,
    flex: 1,
    backgroundColor: joyTheme.border,
    marginTop: 4,
  },
  agendaContent: {
    flex: 1,
    gap: 3,
  },
  agendaTime: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: joyTheme.primary,
    letterSpacing: 0.3,
  },
  agendaTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: joyTheme.text,
  },
  agendaDesc: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
    lineHeight: 18,
  },
  agendaLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  agendaLocation: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  stationRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  stationRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: joyTheme.border,
  },
  stationIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stationContent: {
    flex: 1,
    gap: 2,
  },
  stationTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: joyTheme.text,
  },
  stationDesc: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
    lineHeight: 18,
  },
  stationLocation: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: joyTheme.primary,
    marginTop: 2,
  },
  mediaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: joyTheme.border,
  },
  mediaIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaContent: {
    flex: 1,
    gap: 2,
  },
  mediaTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: joyTheme.text,
  },
  mediaDesc: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: joyTheme.border,
  },
  contactInfo: {
    flex: 1,
    gap: 2,
  },
  contactName: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: joyTheme.text,
  },
  contactRole: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
  },
  contactBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactBtnCall: {
    backgroundColor: '#10B981',
  },
  contactBtnEmail: {
    backgroundColor: '#3B82F6',
  },
  lockedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: joyTheme.surfaceAlt,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  lockedText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
    lineHeight: 18,
  },
  volunteerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  volunteerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: joyTheme.backgroundAlt,
    borderRadius: 24,
    paddingRight: 14,
    paddingVertical: 4,
    paddingLeft: 4,
  },
  volunteerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  volunteerAvatarPlaceholder: {
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volunteerInitials: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: joyTheme.primary,
  },
  volunteerName: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: joyTheme.text,
    maxWidth: 100,
  },
  volunteerStar: {
    marginLeft: -2,
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 48,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: fonts.black,
    color: joyTheme.text,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
