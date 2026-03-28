import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Building2, CalendarDays, Camera, CheckCircle2, ChevronDown, ClipboardList, Clock3, MapPin, Navigation, Search, X, Tag } from 'lucide-react-native';
import React, { useCallback, useMemo, useState, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SectionTitle } from '@/components/SectionTitle';
import { fonts } from '@/constants/fonts';
import { joyTheme } from '@/constants/joyTheme';
import { resolveImageUrl } from '@/lib/imageUtils';
import { fetchAllEvents, fetchAllOrganizations, fetchEventPhotoCounts, fetchEventSignupCounts, fetchUserSignups, fetchEventFirstPhotos } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import type { DbEvent, DbOrganization } from '@/types/database';

function formatEventDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatEventTime(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function getEventImageUri(event: DbEvent, firstPhotos?: Record<string, string>): string {
  const resolved = resolveImageUrl(event.image_url);
  if (resolved) return resolved;
  if (firstPhotos?.[event.id]) {
    const resolvedPhoto = resolveImageUrl(firstPhotos[event.id]);
    if (resolvedPhoto) return resolvedPhoto;
  }
  return 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80';
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getLocationString(event: DbEvent): string {
  const parts: string[] = [];
  if (event.venue) parts.push(event.venue);
  if (event.address) parts.push(event.address);
  if (event.city) parts.push(event.city);
  if (event.state) parts.push(event.state);
  return parts.length > 0 ? parts.join(', ') : 'Location TBD';
}

function parseSkills(skillsStr: string | string[] | null | undefined): string[] {
  if (!skillsStr) return [];
  if (Array.isArray(skillsStr)) return skillsStr.map(s => String(s).trim()).filter(Boolean);
  if (typeof skillsStr === 'string') return skillsStr.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

type EventTab = 'upcoming' | 'discover';

const TAB_LABELS: Record<EventTab, string> = {
  upcoming: 'Upcoming',
  discover: 'Discover',
};

const TAB_SUBTITLES: Record<EventTab, string> = {
  upcoming: 'Events you\'re signed up for',
  discover: 'Find your next event',
};

const EMPTY_MESSAGES: Record<EventTab, { title: string; subtitle: string }> = {
  upcoming: { title: 'No upcoming events', subtitle: 'Browse Discover to find events to sign up for!' },
  discover: { title: 'No events found', subtitle: 'Check back soon for new opportunities!' },
};

export default function EventsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<EventTab>('upcoming');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [showOrgPicker, setShowOrgPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [orgSearch, setOrgSearch] = useState('');
  const [datePickerMode, setDatePickerMode] = useState<'from' | 'to'>('from');
  const [tempYear, setTempYear] = useState(new Date().getFullYear());
  const [tempMonth, setTempMonth] = useState(new Date().getMonth());
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const eventsQuery = useQuery({
    queryKey: ['all-events'],
    queryFn: fetchAllEvents,
    staleTime: 30000,
  });

  const orgsQuery = useQuery({
    queryKey: ['all-organizations'],
    queryFn: fetchAllOrganizations,
    staleTime: 60000,
  });

  const photoCountsQuery = useQuery({
    queryKey: ['event-photo-counts'],
    queryFn: fetchEventPhotoCounts,
    staleTime: 30000,
  });

  const signupCountsQuery = useQuery({
    queryKey: ['event-signup-counts'],
    queryFn: fetchEventSignupCounts,
    staleTime: 30000,
  });

  const userSignupsQuery = useQuery({
    queryKey: ['user-signups', user?.id],
    queryFn: () => fetchUserSignups(user!.id),
    enabled: !!user?.id,
    staleTime: 30000,
  });

  const firstPhotosQuery = useQuery({
    queryKey: ['event-first-photos'],
    queryFn: fetchEventFirstPhotos,
    staleTime: 30000,
  });

  const userSignupsRefetchRef = useRef(userSignupsQuery.refetch);
  userSignupsRefetchRef.current = userSignupsQuery.refetch;
  const eventsRefetchRef = useRef(eventsQuery.refetch);
  eventsRefetchRef.current = eventsQuery.refetch;

  const isFirstMount = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstMount.current) {
        isFirstMount.current = false;
        return;
      }
      console.log('[EventsScreen] Screen focused, refetching user signups and events');
      setNow(new Date().toISOString());
      void userSignupsRefetchRef.current();
      void eventsRefetchRef.current();
    }, [])
  );

  const firstPhotos = useMemo(() => firstPhotosQuery.data ?? {}, [firstPhotosQuery.data]);

  const photoCounts = useMemo(() => photoCountsQuery.data ?? {}, [photoCountsQuery.data]);
  const signupCounts = useMemo(() => signupCountsQuery.data ?? {}, [signupCountsQuery.data]);
  const userSignedUpEventIds = useMemo(() => {
    const signups = userSignupsQuery.data ?? [];
    return new Set(signups.map((s) => s.event_id));
  }, [userSignupsQuery.data]);

  const [now, setNow] = useState(() => new Date().toISOString());



  const organizations = useMemo(() => orgsQuery.data ?? [], [orgsQuery.data]);

  const orgMap = useMemo(() => {
    const map: Record<string, DbOrganization> = {};
    organizations.forEach((org) => { map[org.id] = org; });
    return map;
  }, [organizations]);

  const uniqueLocations = useMemo(() => {
    const events = eventsQuery.data ?? [];
    const locationSet = new Map<string, { city: string; state: string | null; count: number }>();
    events.forEach((e) => {
      if (e.city) {
        const key = `${e.city}${e.state ? `, ${e.state}` : ''}`;
        const existing = locationSet.get(key);
        if (existing) {
          existing.count++;
        } else {
          locationSet.set(key, { city: e.city, state: e.state, count: 1 });
        }
      }
    });
    return Array.from(locationSet.entries())
      .map(([label, info]) => ({ label, ...info }))
      .sort((a, b) => b.count - a.count);
  }, [eventsQuery.data]);

  const filteredLocations = useMemo(() => {
    if (!locationSearch.trim()) return uniqueLocations;
    const q = locationSearch.toLowerCase();
    return uniqueLocations.filter((l) => l.label.toLowerCase().includes(q));
  }, [uniqueLocations, locationSearch]);

  const filteredOrgs = useMemo(() => {
    if (!orgSearch.trim()) return organizations;
    const q = orgSearch.toLowerCase();
    return organizations.filter((o) => o.name.toLowerCase().includes(q));
  }, [organizations, orgSearch]);

  const selectedOrgName = useMemo(() => {
    if (!selectedOrgId) return null;
    return orgMap[selectedOrgId]?.name ?? null;
  }, [selectedOrgId, orgMap]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedOrgId) count++;
    if (dateFrom || dateTo) count++;
    if (selectedLocation) count++;
    return count;
  }, [selectedOrgId, dateFrom, dateTo, selectedLocation]);

  const upcomingEvents = useMemo(() => {
    const events = eventsQuery.data ?? [];
    return events
      .filter((e) => e.end_time >= now && userSignedUpEventIds.has(e.id))
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [eventsQuery.data, now, userSignedUpEventIds]);

  const discoverEvents = useMemo(() => {
    let events = eventsQuery.data ?? [];
    events = events.filter((e) => e.end_time >= now && !userSignedUpEventIds.has(e.id));
    if (selectedOrgId) {
      events = events.filter((e) => e.organization_id === selectedOrgId);
    }
    if (dateFrom) {
      events = events.filter((e) => e.start_time >= dateFrom);
    }
    if (dateTo) {
      const toEnd = new Date(dateTo);
      toEnd.setHours(23, 59, 59, 999);
      events = events.filter((e) => e.start_time <= toEnd.toISOString());
    }
    if (selectedLocation) {
      events = events.filter((e) => {
        const eventLoc = `${e.city ?? ''}${e.state ? `, ${e.state}` : ''}`;
        return eventLoc === selectedLocation;
      });
    }
    return events.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [eventsQuery.data, now, userSignedUpEventIds, selectedOrgId, dateFrom, dateTo, selectedLocation]);

  const filteredEvents = useMemo(() => {
    switch (activeTab) {
      case 'upcoming': return upcomingEvents;
      case 'discover': return discoverEvents;
    }
  }, [activeTab, upcomingEvents, discoverEvents]);

  const handleTabChange = useCallback((tab: EventTab) => {
    console.log('[EventsScreen] Tab changed to:', tab);
    Haptics.selectionAsync().catch(() => {});
    setActiveTab(tab);
    setNow(new Date().toISOString());
  }, []);

  const handleClearFilters = useCallback(() => {
    console.log('[EventsScreen] Clearing all filters');
    Haptics.selectionAsync().catch(() => {});
    setSelectedOrgId(null);
    setDateFrom(null);
    setDateTo(null);
    setSelectedLocation(null);
  }, []);

  const handleSelectLocation = useCallback((loc: string | null) => {
    console.log('[EventsScreen] Location filter:', loc);
    Haptics.selectionAsync().catch(() => {});
    setSelectedLocation(loc);
    setShowLocationPicker(false);
    setLocationSearch('');
  }, []);

  const handleUseMyLocation = useCallback(async () => {
    console.log('[EventsScreen] Using device location');
    setIsLocating(true);
    try {
      if (Platform.OS === 'web') {
        if (!navigator.geolocation) {
          console.warn('[EventsScreen] Geolocation not supported');
          setIsLocating(false);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const { latitude, longitude } = position.coords;
              console.log('[EventsScreen] Got web coords:', latitude, longitude);
              const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=en`);
              const geo = await res.json();
              const city = geo?.address?.city || geo?.address?.town || geo?.address?.village || '';
              const state = geo?.address?.state || '';
              console.log('[EventsScreen] Reverse geocoded:', city, state);
              if (city) {
                const match = uniqueLocations.find((l) =>
                  l.city.toLowerCase() === city.toLowerCase() ||
                  l.label.toLowerCase().includes(city.toLowerCase())
                );
                if (match) {
                  setSelectedLocation(match.label);
                  setShowLocationPicker(false);
                  setLocationSearch('');
                } else {
                  setLocationSearch(city);
                }
              }
            } catch (err) {
              console.error('[EventsScreen] Reverse geocoding failed:', err);
            } finally {
              setIsLocating(false);
            }
          },
          (err) => {
            console.error('[EventsScreen] Web geolocation error:', err);
            setIsLocating(false);
          },
          { enableHighAccuracy: false, timeout: 10000 }
        );
        return;
      }

      const Location = await import('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[EventsScreen] Location permission denied');
        setIsLocating(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      console.log('[EventsScreen] Reverse geocoded:', geo);
      const city = geo?.city || '';
      if (city) {
        const match = uniqueLocations.find((l) =>
          l.city.toLowerCase() === city.toLowerCase() ||
          l.label.toLowerCase().includes(city.toLowerCase())
        );
        if (match) {
          setSelectedLocation(match.label);
          setShowLocationPicker(false);
          setLocationSearch('');
        } else {
          setLocationSearch(city);
        }
      }
    } catch (err) {
      console.error('[EventsScreen] Location error:', err);
    } finally {
      setIsLocating(false);
    }
  }, [uniqueLocations]);

  const handleSelectOrg = useCallback((orgId: string | null) => {
    console.log('[EventsScreen] Organization filter:', orgId);
    Haptics.selectionAsync().catch(() => {});
    setSelectedOrgId(orgId);
    setShowOrgPicker(false);
    setOrgSearch('');
  }, []);

  const handleSelectDate = useCallback((year: number, month: number, day: number) => {
    const selected = new Date(year, month, day);
    const iso = selected.toISOString();
    Haptics.selectionAsync().catch(() => {});
    if (datePickerMode === 'from') {
      setDateFrom(iso);
    } else {
      setDateTo(iso);
    }
    setShowDatePicker(false);
  }, [datePickerMode]);

  const handleEventPress = useCallback((eventId: string) => {
    console.log('[EventsScreen] Navigating to event detail:', eventId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/event-detail', params: { id: eventId } });
  }, [router]);

  const eventsRefetch = eventsQuery.refetch;
  const photoCountsRefetch = photoCountsQuery.refetch;
  const signupCountsRefetch = signupCountsQuery.refetch;
  const userSignupsRefetch = userSignupsQuery.refetch;
  const firstPhotosRefetch = firstPhotosQuery.refetch;
  const orgsRefetch = orgsQuery.refetch;

  const handleRefresh = useCallback(() => {
    console.log('[EventsScreen] Refreshing events');
    setNow(new Date().toISOString());
    void eventsRefetch();
    void photoCountsRefetch();
    void signupCountsRefetch();
    void userSignupsRefetch();
    void firstPhotosRefetch();
    void orgsRefetch();
  }, [eventsRefetch, photoCountsRefetch, signupCountsRefetch, userSignupsRefetch, firstPhotosRefetch, orgsRefetch]);

  const daysInMonth = useMemo(() => {
    return new Date(tempYear, tempMonth + 1, 0).getDate();
  }, [tempYear, tempMonth]);

  const firstDayOfWeek = useMemo(() => {
    return new Date(tempYear, tempMonth, 1).getDay();
  }, [tempYear, tempMonth]);

  const monthLabel = useMemo(() => {
    return new Date(tempYear, tempMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [tempYear, tempMonth]);

  const renderEventCard = useCallback((event: DbEvent) => {
    if (!event?.id) return null;
    const photoCount = photoCounts[event.id] ?? 0;
    const signupCount = signupCounts[event.id] ?? 0;
    const isSignedUp = userSignedUpEventIds.has(event.id);
    const isPast = event.start_time < now;
    const isFull = event.capacity ? signupCount >= event.capacity : false;
    const skills = parseSkills(event.skills_needed);
    const orgData = event.organization_id ? orgMap[event.organization_id] : null;

    return (
      <Pressable style={styles.eventCard} testID={`event-card-${event.id}`} onPress={() => handleEventPress(event.id)}>
        <View style={styles.imageWrap}>
          <Image source={{ uri: getEventImageUri(event, firstPhotos) }} style={styles.eventImage} contentFit="cover" />
          <View style={styles.imageOverlay} />
          <View style={styles.imageBadgeRow}>
            {isSignedUp && (
              <View style={styles.registeredBadge}>
                <CheckCircle2 color="#fff" size={12} />
                <Text style={styles.registeredBadgeText}>Registered</Text>
              </View>
            )}
            {isPast && (
              <View style={styles.pastBadge}>
                <Text style={styles.pastBadgeText}>Completed</Text>
              </View>
            )}
            {!isPast && !isFull && !isSignedUp && (
              <View style={styles.openBadge}>
                <Text style={styles.openBadgeText}>Open</Text>
              </View>
            )}
            {!isPast && isFull && !isSignedUp && (
              <View style={styles.fullBadge}>
                <Text style={styles.fullBadgeText}>Full</Text>
              </View>
            )}
          </View>
          {photoCount > 0 && (
            <View style={styles.photoCountBadge}>
              <Camera color="#fff" size={13} />
              <Text style={styles.photoCountText}>{photoCount}</Text>
            </View>
          )}
          <View style={styles.imageBottomInfo}>
            <View style={styles.eventTypePill}>
              <Text style={styles.eventTypePillText}>{event.event_type}</Text>
            </View>
            <View style={styles.dateTimePill}>
              <CalendarDays color="#fff" size={12} />
              <Text style={styles.dateTimePillText}>{formatEventDate(event.start_time)}</Text>
              <Clock3 color="rgba(255,255,255,0.7)" size={12} />
              <Text style={styles.dateTimePillText}>{formatEventTime(event.start_time)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.eventContent}>
          <Text style={styles.eventTitle}>{event.title}</Text>

          {event.description ? (
            <Text style={styles.eventDescription} numberOfLines={2}>{event.description}</Text>
          ) : null}

          <View style={styles.detailsSection}>
            <View style={styles.detailRow}>
              <View style={styles.detailIconWrap}>
                <MapPin color={joyTheme.primary} size={14} />
              </View>
              <Text style={styles.detailText} numberOfLines={2}>
                {getLocationString(event)}
              </Text>
            </View>

            {orgData ? (
              <Pressable
                style={styles.detailRow}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  router.push({ pathname: '/org-profile' as never, params: { id: event.organization_id! } });
                }}
                testID={`event-org-${event.organization_id}`}
              >
                <View style={styles.detailIconWrap}>
                  {resolveImageUrl(orgData.logo_url) ? (
                    <Image source={{ uri: resolveImageUrl(orgData.logo_url)! }} style={styles.orgMiniLogo} contentFit="cover" />
                  ) : (
                    <Building2 color={joyTheme.primary} size={14} />
                  )}
                </View>
                <Text style={styles.detailTextLink} numberOfLines={1}>
                  {orgData.name}
                </Text>
              </Pressable>
            ) : null}


          </View>

          {skills.length > 0 ? (
            <View style={styles.skillsRow}>
              <Tag color={joyTheme.textMuted} size={12} />
              <View style={styles.skillTags}>
                {skills.slice(0, 3).map((skill) => (
                  <View key={skill} style={styles.skillTag}>
                    <Text style={styles.skillTagText}>{skill}</Text>
                  </View>
                ))}
                {skills.length > 3 ? (
                  <Text style={styles.moreSkills}>+{skills.length - 3}</Text>
                ) : null}
              </View>
            </View>
          ) : null}



          <View style={styles.footerRow}>
            {isSignedUp && !isPast && (
              <Pressable
                style={styles.dayOfBtn}
                onPress={(e) => {
                  e.stopPropagation?.();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  router.push({ pathname: '/event-day-of', params: { eventId: event.id } } as never);
                }}
                testID={`day-of-btn-${event.id}`}
              >
                <ClipboardList color={joyTheme.primary} size={14} />
                <Text style={styles.dayOfBtnText}>Day Of</Text>
              </Pressable>
            )}
            <Text style={styles.joinPrompt}>
              {isSignedUp ? 'View details →' : isPast ? 'See recap →' : 'Sign up →'}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }, [photoCounts, signupCounts, userSignedUpEventIds, now, orgMap, firstPhotos, handleEventPress, router]);

  const tabCounts: Record<EventTab, number> = useMemo(() => ({
    upcoming: upcomingEvents.length,
    discover: discoverEvents.length,
  }), [upcomingEvents.length, discoverEvents.length]);

  const listHeader = useMemo(() => (
    <View style={styles.listHeader}>
      <SectionTitle
        eyebrow="Joy in Action"
        title={TAB_SUBTITLES[activeTab]}
        subtitle={`${filteredEvents.length} event${filteredEvents.length === 1 ? '' : 's'}`}
      />

      <View style={styles.tabBar}>
        {(['upcoming', 'discover'] as EventTab[]).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <Pressable
              key={tab}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => handleTabChange(tab)}
              testID={`events-tab-${tab}`}
            >
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {TAB_LABELS[tab]}
              </Text>
              <View style={[styles.tabCount, isActive && styles.tabCountActive]}>
                <Text style={[styles.tabCountText, isActive && styles.tabCountTextActive]}>
                  {tabCounts[tab]}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {activeTab === 'discover' && <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterChip, selectedOrgId ? styles.filterChipActive : null]}
          onPress={() => { setShowOrgPicker(true); Haptics.selectionAsync().catch(() => {}); }}
          testID="org-filter-btn"
        >
          <Building2 color={selectedOrgId ? '#fff' : joyTheme.textMuted} size={14} />
          <Text style={selectedOrgId ? styles.filterChipActiveText : styles.filterChipText} numberOfLines={1}>
            {selectedOrgName ?? 'Organization'}
          </Text>
          <ChevronDown color={selectedOrgId ? '#fff' : joyTheme.textMuted} size={14} />
        </Pressable>

        <Pressable
          style={[styles.filterChip, (dateFrom || dateTo) ? styles.filterChipActive : null]}
          onPress={() => {
            setDatePickerMode('from');
            setTempYear(new Date().getFullYear());
            setTempMonth(new Date().getMonth());
            setShowDatePicker(true);
            Haptics.selectionAsync().catch(() => {});
          }}
          testID="date-filter-btn"
        >
          <CalendarDays color={(dateFrom || dateTo) ? '#fff' : joyTheme.textMuted} size={14} />
          <Text style={(dateFrom || dateTo) ? styles.filterChipActiveText : styles.filterChipText} numberOfLines={1}>
            {dateFrom || dateTo
              ? `${dateFrom ? formatDateLabel(new Date(dateFrom)) : 'Any'} – ${dateTo ? formatDateLabel(new Date(dateTo)) : 'Any'}`
              : 'Date'}
          </Text>
          <ChevronDown color={(dateFrom || dateTo) ? '#fff' : joyTheme.textMuted} size={14} />
        </Pressable>

        <Pressable
          style={[styles.filterChip, selectedLocation ? styles.filterChipActive : null]}
          onPress={() => { setShowLocationPicker(true); Haptics.selectionAsync().catch(() => {}); }}
          testID="location-filter-btn"
        >
          <MapPin color={selectedLocation ? '#fff' : joyTheme.textMuted} size={14} />
          <Text style={selectedLocation ? styles.filterChipActiveText : styles.filterChipText} numberOfLines={1}>
            {selectedLocation ?? 'Location'}
          </Text>
          <ChevronDown color={selectedLocation ? '#fff' : joyTheme.textMuted} size={14} />
        </Pressable>

        {activeFilterCount > 0 ? (
          <Pressable style={styles.clearFilterBtn} onPress={handleClearFilters} testID="clear-filters-btn">
            <X color={joyTheme.primary} size={14} />
            <Text style={styles.clearFilterText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>}
    </View>
  ), [filteredEvents.length, selectedOrgId, selectedOrgName, dateFrom, dateTo, selectedLocation, activeFilterCount, handleClearFilters, activeTab, handleTabChange, tabCounts]);

  const listEmpty = useMemo(() => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{EMPTY_MESSAGES[activeTab].title}</Text>
      <Text style={styles.emptySubtitle}>{EMPTY_MESSAGES[activeTab].subtitle}</Text>
      {activeTab === 'upcoming' && (
        <Pressable
          style={styles.emptyAction}
          onPress={() => handleTabChange('discover')}
        >
          <Text style={styles.emptyActionText}>Browse events →</Text>
        </Pressable>
      )}
    </View>
  ), [activeTab, handleTabChange]);

  const keyExtractor = useCallback((item: DbEvent) => item.id, []);

  const renderItem = useCallback(({ item }: { item: DbEvent }) => renderEventCard(item), [renderEventCard]);

  if (eventsQuery.isLoading) {
    return (
      <View style={[styles.screen, styles.centered]} testID="events-loading">
        <ActivityIndicator size="large" color={joyTheme.primary} />
        <Text style={styles.loadingText}>Loading events...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen} testID="events-screen">
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <FlatList
          data={filteredEvents}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl refreshing={eventsQuery.isRefetching} onRefresh={handleRefresh} tintColor={joyTheme.primary} />
          }
        />
      </SafeAreaView>

      <Modal visible={showOrgPicker} animationType="slide" transparent testID="org-picker-modal">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <SafeAreaView edges={['bottom']}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Organization</Text>
                <Pressable onPress={() => { setShowOrgPicker(false); setOrgSearch(''); }} hitSlop={12}>
                  <X color={joyTheme.text} size={22} />
                </Pressable>
              </View>
              <View style={styles.searchWrap}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search organizations..."
                  placeholderTextColor={joyTheme.textMuted}
                  value={orgSearch}
                  onChangeText={setOrgSearch}
                  autoCapitalize="none"
                  testID="org-search-input"
                />
              </View>
              <ScrollView style={styles.orgList} keyboardShouldPersistTaps="handled">
                <Pressable
                  style={[styles.orgItem, !selectedOrgId && styles.orgItemActive]}
                  onPress={() => handleSelectOrg(null)}
                >
                  <Text style={[styles.orgItemText, !selectedOrgId && styles.orgItemTextActive]}>All Organizations</Text>
                </Pressable>
                {filteredOrgs.map((org) => (
                  <Pressable
                    key={org.id}
                    style={[styles.orgItem, selectedOrgId === org.id && styles.orgItemActive]}
                    onPress={() => handleSelectOrg(org.id)}
                  >
                    {resolveImageUrl(org.logo_url) ? (
                      <Image source={{ uri: resolveImageUrl(org.logo_url)! }} style={styles.orgLogo} contentFit="cover" />
                    ) : (
                      <View style={styles.orgLogoPlaceholder}>
                        <Text style={styles.orgLogoInitial}>{org.name.charAt(0)}</Text>
                      </View>
                    )}
                    <View style={styles.orgItemInfo}>
                      <Text style={[styles.orgItemText, selectedOrgId === org.id && styles.orgItemTextActive]} numberOfLines={1}>{org.name}</Text>
                      {org.city && <Text style={styles.orgItemSub}>{org.city}{org.state ? `, ${org.state}` : ''}</Text>}
                    </View>
                  </Pressable>
                ))}
                {filteredOrgs.length === 0 && (
                  <Text style={styles.orgEmptyText}>No organizations found</Text>
                )}
              </ScrollView>
            </SafeAreaView>
          </View>
        </View>
      </Modal>

      <Modal visible={showLocationPicker} animationType="slide" transparent testID="location-picker-modal">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <SafeAreaView edges={['bottom']}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Find by Location</Text>
                <Pressable onPress={() => { setShowLocationPicker(false); setLocationSearch(''); }} hitSlop={12}>
                  <X color={joyTheme.text} size={22} />
                </Pressable>
              </View>

              <Pressable
                style={styles.useLocationBtn}
                onPress={handleUseMyLocation}
                testID="use-my-location-btn"
              >
                <View style={styles.useLocationIcon}>
                  {isLocating ? (
                    <ActivityIndicator size="small" color={joyTheme.primary} />
                  ) : (
                    <Navigation color={joyTheme.primary} size={18} />
                  )}
                </View>
                <View style={styles.useLocationTextWrap}>
                  <Text style={styles.useLocationLabel}>
                    {isLocating ? 'Finding your location...' : 'Use my current location'}
                  </Text>
                  <Text style={styles.useLocationSub}>Find events near you</Text>
                </View>
              </Pressable>

              <View style={styles.locationDivider}>
                <View style={styles.locationDividerLine} />
                <Text style={styles.locationDividerText}>or search a city</Text>
                <View style={styles.locationDividerLine} />
              </View>

              <View style={styles.searchWrap}>
                <View style={styles.locationSearchRow}>
                  <Search color={joyTheme.textMuted} size={16} />
                  <TextInput
                    style={styles.locationSearchInput}
                    placeholder="Search city or state..."
                    placeholderTextColor={joyTheme.textMuted}
                    value={locationSearch}
                    onChangeText={setLocationSearch}
                    autoCapitalize="none"
                    testID="location-search-input"
                  />
                </View>
              </View>

              <ScrollView style={styles.orgList} keyboardShouldPersistTaps="handled">
                <Pressable
                  style={[styles.orgItem, !selectedLocation && styles.orgItemActive]}
                  onPress={() => handleSelectLocation(null)}
                >
                  <View style={styles.locationItemIcon}>
                    <MapPin color={!selectedLocation ? joyTheme.primary : joyTheme.textMuted} size={16} />
                  </View>
                  <Text style={[styles.orgItemText, !selectedLocation && styles.orgItemTextActive]}>All Locations</Text>
                </Pressable>
                {filteredLocations.map((loc) => (
                  <Pressable
                    key={loc.label}
                    style={[styles.orgItem, selectedLocation === loc.label && styles.orgItemActive]}
                    onPress={() => handleSelectLocation(loc.label)}
                  >
                    <View style={styles.locationItemIcon}>
                      <MapPin color={selectedLocation === loc.label ? joyTheme.primary : joyTheme.textMuted} size={16} />
                    </View>
                    <View style={styles.orgItemInfo}>
                      <Text style={[styles.orgItemText, selectedLocation === loc.label && styles.orgItemTextActive]} numberOfLines={1}>
                        {loc.label}
                      </Text>
                      <Text style={styles.orgItemSub}>{loc.count} event{loc.count === 1 ? '' : 's'}</Text>
                    </View>
                  </Pressable>
                ))}
                {filteredLocations.length === 0 && (
                  <Text style={styles.orgEmptyText}>No locations found</Text>
                )}
              </ScrollView>
            </SafeAreaView>
          </View>
        </View>
      </Modal>

      <Modal visible={showDatePicker} animationType="slide" transparent testID="date-picker-modal">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <SafeAreaView edges={['bottom']}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{datePickerMode === 'from' ? 'Start Date' : 'End Date'}</Text>
                <Pressable onPress={() => setShowDatePicker(false)} hitSlop={12}>
                  <X color={joyTheme.text} size={22} />
                </Pressable>
              </View>

              <View style={styles.dateToggleRow}>
                <Pressable
                  style={[styles.dateToggle, datePickerMode === 'from' && styles.dateToggleActive]}
                  onPress={() => setDatePickerMode('from')}
                >
                  <Text style={datePickerMode === 'from' ? styles.dateToggleActiveText : styles.dateToggleText}>
                    From: {dateFrom ? formatDateLabel(new Date(dateFrom)) : 'Any'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.dateToggle, datePickerMode === 'to' && styles.dateToggleActive]}
                  onPress={() => setDatePickerMode('to')}
                >
                  <Text style={datePickerMode === 'to' ? styles.dateToggleActiveText : styles.dateToggleText}>
                    To: {dateTo ? formatDateLabel(new Date(dateTo)) : 'Any'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.calendarNav}>
                <Pressable onPress={() => {
                  if (tempMonth === 0) { setTempMonth(11); setTempYear(tempYear - 1); }
                  else setTempMonth(tempMonth - 1);
                }} hitSlop={12}>
                  <Text style={styles.calendarNavArrow}>‹</Text>
                </Pressable>
                <Text style={styles.calendarMonthLabel}>{monthLabel}</Text>
                <Pressable onPress={() => {
                  if (tempMonth === 11) { setTempMonth(0); setTempYear(tempYear + 1); }
                  else setTempMonth(tempMonth + 1);
                }} hitSlop={12}>
                  <Text style={styles.calendarNavArrow}>›</Text>
                </Pressable>
              </View>

              <View style={styles.calendarDayNames}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                  <Text key={d} style={styles.calendarDayName}>{d}</Text>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <View key={`empty-${i}`} style={styles.calendarCell} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const cellDate = new Date(tempYear, tempMonth, day);
                  const cellIso = cellDate.toISOString().split('T')[0];
                  const fromIso = dateFrom ? new Date(dateFrom).toISOString().split('T')[0] : null;
                  const toIso = dateTo ? new Date(dateTo).toISOString().split('T')[0] : null;
                  const isSelected = (datePickerMode === 'from' && fromIso === cellIso) ||
                    (datePickerMode === 'to' && toIso === cellIso);
                  const isInRange = fromIso && toIso && cellIso >= fromIso && cellIso <= toIso;

                  return (
                    <Pressable
                      key={day}
                      style={[
                        styles.calendarCell,
                        isInRange ? styles.calendarCellInRange : null,
                        isSelected ? styles.calendarCellSelected : null,
                      ]}
                      onPress={() => handleSelectDate(tempYear, tempMonth, day)}
                    >
                      <Text style={[
                        styles.calendarDayText,
                        isSelected ? styles.calendarDayTextSelected : null,
                      ]}>{day}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {(dateFrom || dateTo) && (
                <Pressable style={styles.dateClearBtn} onPress={() => {
                  setDateFrom(null);
                  setDateTo(null);
                  setShowDatePicker(false);
                }}>
                  <Text style={styles.dateClearText}>Clear dates</Text>
                </Pressable>
              )}
            </SafeAreaView>
          </View>
        </View>
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
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
  listHeader: {
    gap: 18,
    marginBottom: 18,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: joyTheme.surface,
    borderWidth: 1,
    borderColor: joyTheme.border,
    maxWidth: 200,
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
  clearFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  clearFilterText: {
    color: joyTheme.primary,
    fontSize: 13,
    fontFamily: fonts.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: joyTheme.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingTop: 8,
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
  modalTitle: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
  },
  searchWrap: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchInput: {
    backgroundColor: joyTheme.backgroundAlt,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: joyTheme.text,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  orgList: {
    maxHeight: 400,
  },
  orgItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: joyTheme.border,
  },
  orgItemActive: {
    backgroundColor: joyTheme.primarySoft,
  },
  orgLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  orgLogoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: joyTheme.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgLogoInitial: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: joyTheme.primaryDark,
  },
  orgItemInfo: {
    flex: 1,
    gap: 2,
  },
  orgItemText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: joyTheme.text,
  },
  orgItemTextActive: {
    color: joyTheme.primaryDark,
    fontFamily: fonts.extraBold,
  },
  orgItemSub: {
    fontSize: 12,
    color: joyTheme.textMuted,
  },
  orgEmptyText: {
    textAlign: 'center',
    color: joyTheme.textMuted,
    paddingVertical: 30,
    fontSize: 14,
  },
  dateToggleRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  dateToggle: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: joyTheme.backgroundAlt,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  dateToggleActive: {
    borderColor: joyTheme.primary,
    backgroundColor: joyTheme.primarySoft,
  },
  dateToggleText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  dateToggleActiveText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: joyTheme.primaryDark,
  },
  calendarNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    paddingTop: 16,
    paddingBottom: 8,
  },
  calendarNavArrow: {
    fontSize: 28,
    fontFamily: fonts.semiBold,
    color: joyTheme.primary,
    paddingHorizontal: 10,
  },
  calendarMonthLabel: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
  },
  calendarDayNames: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  calendarDayName: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  calendarCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  calendarCellInRange: {
    backgroundColor: joyTheme.primarySoft,
  },
  calendarCellSelected: {
    backgroundColor: joyTheme.primary,
  },
  calendarDayText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: joyTheme.text,
  },
  calendarDayTextSelected: {
    color: '#fff',
    fontFamily: fonts.extraBold,
  },
  dateClearBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: joyTheme.border,
  },
  dateClearText: {
    color: joyTheme.primary,
    fontSize: 15,
    fontFamily: fonts.bold,
  },
  useLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: joyTheme.primarySoft,
    borderWidth: 1,
    borderColor: joyTheme.primary + '30',
  },
  useLocationIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  useLocationTextWrap: {
    flex: 1,
    gap: 2,
  },
  useLocationLabel: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: joyTheme.primaryDark,
  },
  useLocationSub: {
    fontSize: 12,
    color: joyTheme.textMuted,
    fontFamily: fonts.medium,
  },
  locationDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  locationDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: joyTheme.border,
  },
  locationDividerText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  locationSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: joyTheme.backgroundAlt,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  locationSearchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: joyTheme.text,
  },
  locationItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: joyTheme.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: joyTheme.textMuted,
  },
  emptyAction: {
    marginTop: 12,
    backgroundColor: joyTheme.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  emptyActionText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: fonts.bold,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: joyTheme.backgroundAlt,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
  },
  tabItemActive: {
    backgroundColor: joyTheme.surface,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabLabel: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  tabLabelActive: {
    color: joyTheme.text,
    fontFamily: fonts.bold,
  },
  tabCount: {
    backgroundColor: joyTheme.border,
    borderRadius: 999,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabCountActive: {
    backgroundColor: joyTheme.primary,
  },
  tabCountText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
  },
  tabCountTextActive: {
    color: '#fff',
  },
  eventCard: {
    marginBottom: 18,
    overflow: 'hidden',
    backgroundColor: joyTheme.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: joyTheme.border,
    shadowColor: joyTheme.shadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  imageWrap: {
    position: 'relative',
  },
  eventImage: {
    width: '100%',
    height: 200,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  imageBadgeRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    gap: 6,
  },
  registeredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(43,182,115,0.9)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  registeredBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: fonts.extraBold,
  },
  pastBadge: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pastBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  openBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(43,182,115,0.9)',
  },
  openBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: fonts.extraBold,
  },
  fullBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,176,32,0.9)',
  },
  fullBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: fonts.extraBold,
  },
  photoCountBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  photoCountText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: fonts.extraBold,
  },
  imageBottomInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 30,
  },
  eventTypePill: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  eventTypePillText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: fonts.extraBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  dateTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dateTimePillText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  eventContent: {
    padding: 16,
    gap: 10,
  },
  eventTitle: {
    color: joyTheme.text,
    fontSize: 20,
    lineHeight: 26,
    fontFamily: fonts.extraBold,
  },
  eventDescription: {
    color: joyTheme.textMuted,
    fontSize: 14,
    fontFamily: fonts.medium,
    lineHeight: 20,
  },
  detailsSection: {
    gap: 8,
    paddingTop: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailText: {
    flex: 1,
    color: joyTheme.textMuted,
    fontSize: 13,
    fontFamily: fonts.semiBold,
    lineHeight: 18,
  },
  detailTextLink: {
    flex: 1,
    color: joyTheme.primaryDark,
    fontSize: 13,
    fontFamily: fonts.bold,
  },
  orgMiniLogo: {
    width: 18,
    height: 18,
    borderRadius: 5,
  },
  skillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 2,
  },
  skillTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  skillTag: {
    backgroundColor: joyTheme.backgroundAlt,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  skillTagText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: joyTheme.primaryDark,
  },
  moreSkills: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
    alignSelf: 'center',
  },
  capacityBar: {
    height: 4,
    backgroundColor: joyTheme.backgroundAlt,
    borderRadius: 2,
    overflow: 'hidden',
  },
  capacityBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  dayOfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: joyTheme.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: joyTheme.primary + '30',
  },
  dayOfBtnText: {
    color: joyTheme.primary,
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  joinPrompt: {
    color: joyTheme.primary,
    fontSize: 14,
    fontFamily: fonts.bold,
  },
});
