import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  ImagePlus,
  MapPin,
  MessageCircle,
  Navigation,
  Search,
  Send,
  Share2,
  Shield,
  Star,
  Tag,
  UserCheck,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts } from '@/constants/fonts';
import { joyTheme } from '@/constants/joyTheme';
import { resolveImageUrl } from '@/lib/imageUtils';
import {
  fetchEventById,
  fetchEventPhotos,
  fetchEventSignups,
  fetchOrganizationById,
  signUpForEvent,
  cancelEventSignup,
  uploadPhotoToStorage,
  uploadEventPhoto,
  fetchFollowing,
  fetchFollowingOrganizations,
} from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import type { DbEvent, DbEventPhoto, DbEventSignup, DbProfile, DbOrganization } from '@/types/database';

type EventWithOrg = DbEvent & { organizations?: DbOrganization };

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_GRID_GAP = 3;
const PHOTO_COLS = 3;
const PHOTO_SIZE = (SCREEN_WIDTH - 40 - PHOTO_GRID_GAP * (PHOTO_COLS - 1)) / PHOTO_COLS;

type SignupWithProfile = DbEventSignup & { profiles: DbProfile };

function formatEventDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatEventTime(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – ${e.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

function getEventImageUri(event: DbEvent, photos?: DbEventPhoto[]): string {
  const resolved = resolveImageUrl(event.image_url);
  if (resolved) return resolved;
  if (photos && photos.length > 0) {
    const resolvedPhoto = resolveImageUrl(photos[0].photo_url);
    if (resolvedPhoto) return resolvedPhoto;
  }
  return 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80';
}

function parseSkills(skillsInput: unknown): string[] {
  if (!skillsInput) return [];
  if (Array.isArray(skillsInput)) {
    return skillsInput.map(s => String(s).trim()).filter(Boolean);
  }
  if (typeof skillsInput === 'string') {
    return skillsInput.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function buildFullAddress(event: DbEvent): { venue: string | null; streetAddress: string | null; cityState: string | null } {
  const venue = event.venue || null;
  const streetAddress = event.address || null;
  const cityParts: string[] = [];
  if (event.city) cityParts.push(event.city);
  if (event.state) cityParts.push(event.state);
  const cityState = cityParts.length > 0 ? cityParts.join(', ') : null;
  return { venue, streetAddress, cityState };
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const [lightboxPhoto, setLightboxPhoto] = useState<DbEventPhoto | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [showShareChat, setShowShareChat] = useState<boolean>(false);
  const [shareChatSearch, setShareChatSearch] = useState<string>('');

  const eventQuery = useQuery<EventWithOrg | null>({
    queryKey: ['event', id],
    queryFn: () => fetchEventById(id ?? ''),
    enabled: !!id,
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const photosQuery = useQuery({
    queryKey: ['event-photos', id],
    queryFn: () => fetchEventPhotos(id ?? ''),
    enabled: !!id,
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const signupsQuery = useQuery({
    queryKey: ['event-signups', id],
    queryFn: () => fetchEventSignups(id ?? ''),
    enabled: !!id,
    refetchInterval: 15000,
    staleTime: 5000,
  });

  const event = eventQuery.data;

  const followingQuery = useQuery({
    queryKey: ['following-people', user?.id],
    queryFn: () => fetchFollowing(user!.id),
    enabled: !!user?.id && showShareChat,
  });

  const followingOrgsQuery = useQuery({
    queryKey: ['following-orgs', user?.id],
    queryFn: () => fetchFollowingOrganizations(user!.id),
    enabled: !!user?.id && showShareChat,
  });

  const shareChatContacts = useMemo(() => {
    const people = (followingQuery.data ?? []).map((p: DbProfile) => ({
      id: p.id,
      name: p.full_name ?? 'User',
      avatar: resolveImageUrl(p.avatar_url) ?? null,
      type: 'person' as const,
    }));
    const orgs = (followingOrgsQuery.data ?? []).map((o: DbOrganization) => ({
      id: o.id,
      name: o.name ?? 'Organization',
      avatar: resolveImageUrl(o.logo_url) ?? null,
      type: 'org' as const,
    }));
    const all = [...people, ...orgs];
    if (!shareChatSearch.trim()) return all;
    const q = shareChatSearch.toLowerCase();
    return all.filter((c) => c.name.toLowerCase().includes(q));
  }, [followingQuery.data, followingOrgsQuery.data, shareChatSearch]);

  const handleShareToChat = useCallback((contact: { id: string; name: string }) => {
    if (!event) return;
    console.log('[EventDetail] Sharing event to chat contact:', contact.name);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setShowShareChat(false);
    setShareChatSearch('');
    Alert.alert(
      'Event Shared!',
      `"${event.title}" has been sent to ${contact.name}.`
    );
  }, [event]);

  const inlineOrg = (event as EventWithOrg)?.organizations ?? null;

  const orgQuery = useQuery({
    queryKey: ['organization', event?.organization_id],
    queryFn: () => fetchOrganizationById(event?.organization_id ?? ''),
    enabled: !!event?.organization_id && !inlineOrg,
  });

  const org = inlineOrg ?? orgQuery.data;
  const photos = useMemo(() => photosQuery.data ?? [], [photosQuery.data]);
  const signups = useMemo(() => (signupsQuery.data ?? []) as SignupWithProfile[], [signupsQuery.data]);
  const checkedInCount = useMemo(() => signups.filter((s) => s.checked_in).length, [signups]);

  const userSignup = useMemo(() => {
    if (!user) return null;
    return signups.find((s) => s.user_id === user.id) ?? null;
  }, [signups, user]);

  const isUserSignedUp = !!userSignup;

  const isPast = useMemo(() => {
    if (!event) return false;
    return new Date(event.start_time) < new Date();
  }, [event]);

  const isFull = useMemo(() => {
    if (!event?.capacity) return false;
    return signups.length >= event.capacity;
  }, [event, signups]);

  const spotsRemaining = useMemo(() => {
    if (!event?.capacity) return null;
    return Math.max(0, event.capacity - signups.length);
  }, [event, signups]);

  const signUpMutation = useMutation({
    mutationFn: () => {
      if (!user || !id) throw new Error('Must be logged in');
      return signUpForEvent(id, user.id);
    },
    onSuccess: () => {
      console.log('[EventDetail] Successfully signed up');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void queryClient.invalidateQueries({ queryKey: ['event-signups', id] });
      void queryClient.invalidateQueries({ queryKey: ['event-signup-counts'] });
      void queryClient.invalidateQueries({ queryKey: ['user-signups'] });
      void queryClient.invalidateQueries({ queryKey: ['user-events'] });
      void queryClient.invalidateQueries({ queryKey: ['all-events'] });
      Alert.alert('Success!', 'You have been registered for this event.');
    },
    onError: (error: Error) => {
      console.error('[EventDetail] Signup error:', error.message);
      if (error.message.includes('already signed up')) {
        void queryClient.invalidateQueries({ queryKey: ['event-signups', id] });
        void queryClient.invalidateQueries({ queryKey: ['user-signups'] });
        Alert.alert('Already Registered', 'You are already signed up for this event.');
      } else {
        Alert.alert('Sign Up Failed', error.message + '\n\nPlease make sure you are signed in and try again.');
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => {
      if (!user || !id) throw new Error('Must be logged in');
      return cancelEventSignup(id, user.id);
    },
    onSuccess: () => {
      console.log('[EventDetail] Successfully cancelled signup');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void queryClient.invalidateQueries({ queryKey: ['event-signups', id] });
      void queryClient.invalidateQueries({ queryKey: ['event-signup-counts'] });
      void queryClient.invalidateQueries({ queryKey: ['user-signups'] });
      void queryClient.invalidateQueries({ queryKey: ['user-events'] });
      void queryClient.invalidateQueries({ queryKey: ['all-events'] });
    },
    onError: (error: Error) => {
      console.error('[EventDetail] Cancel error:', error.message);
      Alert.alert('Cancel Failed', error.message);
    },
  });

  const handleSignUp = useCallback(() => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to register for events.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/login') },
      ]);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    signUpMutation.mutate();
  }, [isAuthenticated, signUpMutation, router]);

  const handleCancelSignup = useCallback(() => {
    Alert.alert(
      'Cancel Registration',
      'Are you sure you want to cancel your registration for this event?',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Registration',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            cancelMutation.mutate();
          },
        },
      ]
    );
  }, [cancelMutation]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.back();
  }, [router]);

  const handlePhotoPress = useCallback((photo: DbEventPhoto) => {
    console.log('[EventDetail] Photo pressed:', photo.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setLightboxPhoto(photo);
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

  const eventRefetch = eventQuery.refetch;
  const photosRefetch = photosQuery.refetch;
  const signupsRefetch = signupsQuery.refetch;

  const handleRefresh = useCallback(() => {
    console.log('[EventDetail] Refreshing event data');
    void eventRefetch();
    void photosRefetch();
    void signupsRefetch();
  }, [eventRefetch, photosRefetch, signupsRefetch]);

  const isRefreshing = eventQuery.isRefetching || photosQuery.isRefetching;

  const skills = useMemo(() => {
    if (!event) return [];
    return parseSkills(event.skills_needed);
  }, [event]);

  const addressInfo = useMemo(() => {
    if (!event) return { venue: null, streetAddress: null, cityState: null };
    return buildFullAddress(event);
  }, [event]);

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
        <Pressable onPress={handleBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen} testID="event-detail-screen">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#fff" />
        }
      >
        <View style={styles.heroSection}>
          <Image source={{ uri: getEventImageUri(event, photos) }} style={styles.heroImage} contentFit="cover" />
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(14,60,115,0.92)']}
            locations={[0, 0.3, 1]}
            style={styles.heroOverlay}
          />
          <View style={[styles.heroNav, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={handleBack} style={styles.navBtn} testID="event-detail-back">
              <ArrowLeft color="#fff" size={22} />
            </Pressable>
            <Pressable
              style={styles.navBtn}
              onPress={() => {
                const url = `https://joydealers.com/events/${event.id}`;
                Share.share({
                  message: `Check out "${event.title}" on Joy Dealer! ${url}`,
                  url,
                  title: event.title,
                }).catch(() => {});
              }}
            >
              <Share2 color="#fff" size={20} />
            </Pressable>
          </View>
          <View style={styles.heroContent}>
            <View style={styles.heroBadgeRow}>
              <View style={styles.heroTypeBadge}>
                <Text style={styles.heroTypeText}>{event.event_type}</Text>
              </View>
              {isPast && (
                <View style={styles.pastBadge}>
                  <Text style={styles.pastBadgeText}>Completed</Text>
                </View>
              )}
              {isUserSignedUp && !isPast && (
                <View style={styles.registeredBadge}>
                  <CheckCircle2 color="#fff" size={12} />
                  <Text style={styles.registeredBadgeText}>Registered</Text>
                </View>
              )}
            </View>
            <Text style={styles.heroTitle}>{event.title}</Text>
            <View style={styles.heroMeta}>
              <Calendar color="rgba(255,255,255,0.8)" size={15} />
              <Text style={styles.heroMetaText}>{formatEventDate(event.start_time)}</Text>
            </View>
            <View style={styles.heroMeta}>
              <Clock color="rgba(255,255,255,0.8)" size={15} />
              <Text style={styles.heroMetaText}>{formatEventTime(event.start_time, event.end_time)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.quickStats}>
            {event.capacity && (
              <View style={styles.quickStatItem}>
                <Users color={joyTheme.primary} size={18} />
                <Text style={styles.quickStatValue}>{signups.length}/{event.capacity}</Text>
                <Text style={styles.quickStatLabel}>Signed up</Text>
              </View>
            )}
            {!event.capacity && signups.length > 0 && (
              <View style={styles.quickStatItem}>
                <Users color={joyTheme.primary} size={18} />
                <Text style={styles.quickStatValue}>{signups.length}</Text>
                <Text style={styles.quickStatLabel}>Signed up</Text>
              </View>
            )}
            {checkedInCount > 0 && (
              <View style={styles.quickStatItem}>
                <Zap color={joyTheme.success} size={18} />
                <Text style={styles.quickStatValue}>{checkedInCount}</Text>
                <Text style={styles.quickStatLabel}>Checked in</Text>
              </View>
            )}
            {photos.length > 0 && (
              <View style={styles.quickStatItem}>
                <Camera color={joyTheme.warning} size={18} />
                <Text style={styles.quickStatValue}>{photos.length}</Text>
                <Text style={styles.quickStatLabel}>Photos</Text>
              </View>
            )}
          </View>

          {!isPast && (
            <View style={styles.signupSection}>
              {isUserSignedUp ? (
                <View style={styles.signedUpCard}>
                  <View style={styles.signedUpHeader}>
                    <View style={styles.signedUpIconWrap}>
                      <UserCheck color="#fff" size={20} />
                    </View>
                    <View style={styles.signedUpInfo}>
                      <Text style={styles.signedUpTitle}>You're registered!</Text>
                      <Text style={styles.signedUpSubtitle}>
                        {userSignup?.checked_in ? 'Checked in' : 'See you there'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.signedUpActions}>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setShowShareChat(true);
                      }}
                      style={styles.shareChatBtn}
                      testID="share-to-chat-btn"
                    >
                      <Send color={joyTheme.primary} size={14} />
                      <Text style={styles.shareChatBtnText}>Share to Friend</Text>
                    </Pressable>
                    {!userSignup?.checked_in && (
                      <Pressable
                        onPress={handleCancelSignup}
                        style={styles.cancelBtn}
                        testID="cancel-signup-btn"
                        disabled={cancelMutation.isPending}
                      >
                        {cancelMutation.isPending ? (
                          <ActivityIndicator size="small" color={joyTheme.textMuted} />
                        ) : (
                          <Text style={styles.cancelBtnText}>Cancel registration</Text>
                        )}
                      </Pressable>
                    )}
                  </View>
                </View>
              ) : (
                <View style={styles.signupCard}>
                  {spotsRemaining !== null && (
                    <View style={styles.spotsRow}>
                      <View style={styles.spotsBarBg}>
                        <View
                          style={[
                            styles.spotsBarFill,
                            { width: `${Math.min(100, (signups.length / (event.capacity ?? 1)) * 100)}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.spotsText}>
                        {isFull ? 'Event is full' : `${spotsRemaining} spot${spotsRemaining === 1 ? '' : 's'} remaining`}
                      </Text>
                    </View>
                  )}
                  {event.waiver_required && (
                    <View style={styles.requirementRow}>
                      <Shield color={joyTheme.warning} size={14} />
                      <Text style={styles.requirementText}>Waiver required</Text>
                    </View>
                  )}
                  {event.photo_release_required && (
                    <View style={styles.requirementRow}>
                      <Camera color={joyTheme.warning} size={14} />
                      <Text style={styles.requirementText}>Photo release required</Text>
                    </View>
                  )}
                  {event.min_age && (
                    <View style={styles.requirementRow}>
                      <Star color={joyTheme.warning} size={14} />
                      <Text style={styles.requirementText}>Minimum age: {event.min_age}</Text>
                    </View>
                  )}
                  <Pressable
                    onPress={handleSignUp}
                    style={[styles.signUpBtn, isFull && styles.signUpBtnDisabled]}
                    testID="signup-btn"
                    disabled={isFull || signUpMutation.isPending}
                  >
                    {signUpMutation.isPending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <UserPlus color="#fff" size={18} />
                        <Text style={styles.signUpBtnText}>
                          {isFull ? 'Event Full' : 'Sign Up for This Event'}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {org && (
            <Pressable
              style={styles.orgCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                router.push({ pathname: '/org-profile' as never, params: { id: org.id } });
              }}
              testID="event-org-card"
            >
              <View style={styles.orgCardIcon}>
                {resolveImageUrl(org.logo_url) ? (
                  <Image source={{ uri: resolveImageUrl(org.logo_url)! }} style={styles.orgCardLogo} contentFit="cover" />
                ) : (
                  <Building2 color={joyTheme.primaryDark} size={22} />
                )}
              </View>
              <View style={styles.orgCardInfo}>
                <Text style={styles.orgCardLabel}>Hosted by</Text>
                <Text style={styles.orgCardName} numberOfLines={1}>{org.name}</Text>
                {org.city && (
                  <Text style={styles.orgCardLocation}>{org.city}{org.state ? `, ${org.state}` : ''}</Text>
                )}
              </View>
              <ChevronRight color={joyTheme.textMuted} size={18} />
            </Pressable>
          )}

          {(addressInfo.venue || addressInfo.streetAddress || addressInfo.cityState) && (
            <Pressable style={styles.locationCard} onPress={handleOpenMap} testID="location-card">
              <View style={styles.locationIconWrap}>
                <MapPin color={joyTheme.primary} size={20} />
              </View>
              <View style={styles.locationTextWrap}>
                {addressInfo.venue && (
                  <Text style={styles.locationName}>{addressInfo.venue}</Text>
                )}
                {addressInfo.streetAddress && (
                  <Text style={styles.locationAddress}>{addressInfo.streetAddress}</Text>
                )}
                {addressInfo.cityState && (
                  <Text style={styles.locationCityState}>{addressInfo.cityState}</Text>
                )}
              </View>
              <View style={styles.locationActions}>
                <View style={styles.directionsBtn}>
                  <Navigation color={joyTheme.primary} size={14} />
                  <Text style={styles.directionsBtnText}>Directions</Text>
                </View>
              </View>
            </Pressable>
          )}

          {event.description && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>About this event</Text>
              <Text style={styles.descriptionText}>{event.description}</Text>
            </View>
          )}

          {skills.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <Tag color={joyTheme.primaryDark} size={16} />
                <Text style={styles.sectionLabel}>Skills Needed</Text>
              </View>
              <View style={styles.skillsGrid}>
                {skills.map((skill) => (
                  <View key={skill} style={styles.skillChip}>
                    <Text style={styles.skillChipText}>{skill}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.eventInfoCard}>
            <Text style={styles.sectionLabel}>Event Details</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <View style={styles.infoItemIcon}>
                  <Calendar color={joyTheme.primary} size={16} />
                </View>
                <View style={styles.infoItemContent}>
                  <Text style={styles.infoItemLabel}>Date</Text>
                  <Text style={styles.infoItemValue}>{formatEventDate(event.start_time)}</Text>
                </View>
              </View>
              <View style={styles.infoItem}>
                <View style={styles.infoItemIcon}>
                  <Clock color={joyTheme.primary} size={16} />
                </View>
                <View style={styles.infoItemContent}>
                  <Text style={styles.infoItemLabel}>Time</Text>
                  <Text style={styles.infoItemValue}>{formatEventTime(event.start_time, event.end_time)}</Text>
                </View>
              </View>
              {event.capacity && (
                <View style={styles.infoItem}>
                  <View style={styles.infoItemIcon}>
                    <Users color={joyTheme.primary} size={16} />
                  </View>
                  <View style={styles.infoItemContent}>
                    <Text style={styles.infoItemLabel}>Capacity</Text>
                    <Text style={styles.infoItemValue}>{event.capacity} volunteers</Text>
                  </View>
                </View>
              )}
              {event.min_age && (
                <View style={styles.infoItem}>
                  <View style={styles.infoItemIcon}>
                    <Star color={joyTheme.primary} size={16} />
                  </View>
                  <View style={styles.infoItemContent}>
                    <Text style={styles.infoItemLabel}>Minimum Age</Text>
                    <Text style={styles.infoItemValue}>{event.min_age}+</Text>
                  </View>
                </View>
              )}
              {event.event_type && (
                <View style={styles.infoItem}>
                  <View style={styles.infoItemIcon}>
                    <Tag color={joyTheme.primary} size={16} />
                  </View>
                  <View style={styles.infoItemContent}>
                    <Text style={styles.infoItemLabel}>Type</Text>
                    <Text style={styles.infoItemValue}>{event.event_type}</Text>
                  </View>
                </View>
              )}
              {event.waiver_required && (
                <View style={styles.infoItem}>
                  <View style={styles.infoItemIcon}>
                    <Shield color={joyTheme.warning} size={16} />
                  </View>
                  <View style={styles.infoItemContent}>
                    <Text style={styles.infoItemLabel}>Waiver</Text>
                    <Text style={styles.infoItemValue}>Required</Text>
                  </View>
                </View>
              )}
              {event.photo_release_required && (
                <View style={styles.infoItem}>
                  <View style={styles.infoItemIcon}>
                    <Camera color={joyTheme.warning} size={16} />
                  </View>
                  <View style={styles.infoItemContent}>
                    <Text style={styles.infoItemLabel}>Photo Release</Text>
                    <Text style={styles.infoItemValue}>Required</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {isPast && (event.recap_summary || event.impact_joy_dealt || event.impact_reach || event.community_benefited) && (
            <View style={styles.recapCard}>
              <LinearGradient colors={['#0E3C73', '#164D8F']} style={StyleSheet.absoluteFillObject} />
              <Text style={styles.recapTitle}>Event Recap</Text>
              {event.recap_summary && (
                <Text style={styles.recapText}>{event.recap_summary}</Text>
              )}
              <View style={styles.recapStats}>
                {event.community_benefited && (
                  <View style={styles.recapStatItem}>
                    <Text style={styles.recapStatLabel}>Community</Text>
                    <Text style={styles.recapStatValue}>{event.community_benefited}</Text>
                  </View>
                )}
                {event.impact_joy_dealt && (
                  <View style={styles.recapStatItem}>
                    <Text style={styles.recapStatLabel}>Joy Dealt</Text>
                    <Text style={styles.recapStatValue}>{event.impact_joy_dealt}</Text>
                  </View>
                )}
                {event.impact_reach && (
                  <View style={styles.recapStatItem}>
                    <Text style={styles.recapStatLabel}>Reach</Text>
                    <Text style={styles.recapStatValue}>{event.impact_reach}</Text>
                  </View>
                )}
                {event.impact_funds_generated && (
                  <View style={styles.recapStatItem}>
                    <Text style={styles.recapStatLabel}>Funds</Text>
                    <Text style={styles.recapStatValue}>{event.impact_funds_generated}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {isPast && isUserSignedUp && userSignup && (
            <View style={styles.attendanceStatusCard}>
              <View style={styles.attendanceStatusHeader}>
                <View style={[
                  styles.attendanceStatusIconWrap,
                  { backgroundColor: userSignup.checked_in ? '#DCFCE7' : '#FEF3C7' },
                ]}>
                  {userSignup.checked_in ? (
                    <CheckCircle2 color={joyTheme.success} size={22} />
                  ) : (
                    <Clock color={joyTheme.warning} size={22} />
                  )}
                </View>
                <View style={styles.attendanceStatusInfo}>
                  <Text style={styles.attendanceStatusTitle}>
                    {userSignup.checked_in ? 'Attended' : userSignup.status === 'confirmed' ? 'Registered' : 'Pending Review'}
                  </Text>
                  <Text style={styles.attendanceStatusSubtitle}>
                    {userSignup.checked_in
                      ? `Checked in${userSignup.check_in_time ? ` at ${new Date(userSignup.check_in_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}`
                      : 'Your attendance is being reviewed'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {isPast && isUserSignedUp && userSignup && (
            <View style={styles.yourImpactCard}>
              <Text style={styles.yourImpactTitle}>Your Contribution</Text>
              <View style={styles.yourImpactRow}>
                {userSignup.hours_logged != null && userSignup.hours_logged > 0 && (
                  <View style={styles.yourImpactItem}>
                    <Clock color={joyTheme.primary} size={16} />
                    <Text style={styles.yourImpactValue}>{userSignup.hours_logged}h</Text>
                    <Text style={styles.yourImpactLabel}>Hours</Text>
                  </View>
                )}
                {userSignup.points_earned != null && userSignup.points_earned > 0 && (
                  <View style={styles.yourImpactItem}>
                    <Star color={joyTheme.warning} size={16} />
                    <Text style={styles.yourImpactValue}>{userSignup.points_earned}</Text>
                    <Text style={styles.yourImpactLabel}>Points</Text>
                  </View>
                )}
                {userSignup.checked_in && (
                  <View style={styles.yourImpactItem}>
                    <CheckCircle2 color={joyTheme.success} size={16} />
                    <Text style={styles.yourImpactValue}>Yes</Text>
                    <Text style={styles.yourImpactLabel}>Attended</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {(photos.length > 0 || (isAuthenticated && isUserSignedUp)) && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Camera color={joyTheme.primaryDark} size={18} />
                  <Text style={styles.sectionLabel}>Event Photos</Text>
                </View>
                <View style={styles.photoBadge}>
                  <Text style={styles.photoBadgeText}>{photos.length}</Text>
                </View>
              </View>

              {isAuthenticated && isUserSignedUp && (
                <Pressable
                  style={styles.uploadPhotoBtn}
                  onPress={async () => {
                    if (!user || !id) return;
                    try {
                      const ImagePicker = await import('expo-image-picker');
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
                      const filePath = `event-photos/${id}/${user.id}_${Date.now()}.${ext}`;

                      console.log('[EventDetail] Uploading photo:', filePath);
                      const publicUrl = await uploadPhotoToStorage('event-photos', filePath, asset.uri);
                      await uploadEventPhoto(id, user.id, publicUrl);

                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                      void queryClient.invalidateQueries({ queryKey: ['event-photos', id] });
                      Alert.alert('Photo Uploaded!', 'Your photo has been submitted for review.');
                    } catch (err: unknown) {
                      const msg = err instanceof Error ? err.message : 'Failed to upload photo';
                      console.error('[EventDetail] Photo upload error:', msg);
                      Alert.alert('Upload Failed', msg);
                    } finally {
                      setIsUploading(false);
                    }
                  }}
                  disabled={isUploading}
                  testID="upload-photo-btn"
                >
                  {isUploading ? (
                    <ActivityIndicator size="small" color={joyTheme.primary} />
                  ) : (
                    <ImagePlus color={joyTheme.primary} size={18} />
                  )}
                  <Text style={styles.uploadPhotoBtnText}>
                    {isUploading ? 'Uploading...' : 'Add a Photo'}
                  </Text>
                </Pressable>
              )}
              <View style={styles.photoGrid}>
                {photos.map((photo, index) => (
                  <Pressable
                    key={photo.id}
                    onPress={() => handlePhotoPress(photo)}
                    style={styles.photoCell}
                    testID={`event-photo-${index}`}
                  >
                    <Image source={{ uri: resolveImageUrl(photo.photo_url) ?? photo.photo_url }} style={styles.photoImage} contentFit="cover" />
                    {photo.caption && (
                      <View style={styles.photoCaptionWrap}>
                        <Text style={styles.photoCaption} numberOfLines={1}>{photo.caption}</Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {signups.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Users color={joyTheme.primaryDark} size={18} />
                  <Text style={styles.sectionLabel}>Volunteers</Text>
                </View>
                <View style={styles.photoBadge}>
                  <Text style={styles.photoBadgeText}>{signups.length}</Text>
                </View>
              </View>
              <View style={styles.volunteersGrid}>
                {signups.slice(0, 12).map((signup) => {
                  const profile = signup.profiles;
                  if (!profile) return null;
                  const initials = (profile.full_name ?? 'JD')
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();
                  return (
                    <View key={signup.id} style={styles.volunteerChip}>
                      {resolveImageUrl(profile.avatar_url) ? (
                        <Image source={{ uri: resolveImageUrl(profile.avatar_url)! }} style={styles.volunteerAvatar} contentFit="cover" />
                      ) : (
                        <View style={[styles.volunteerAvatar, styles.volunteerAvatarPlaceholder]}>
                          <Text style={styles.volunteerInitials}>{initials}</Text>
                        </View>
                      )}
                      <Text style={styles.volunteerName} numberOfLines={1}>
                        {profile.full_name ?? 'Volunteer'}
                      </Text>
                      {signup.checked_in && (
                        <View style={styles.checkedInDot} />
                      )}
                    </View>
                  );
                })}
              </View>
              {signups.length > 12 && (
                <Text style={styles.moreText}>+{signups.length - 12} more volunteers</Text>
              )}
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>

      <Modal
        visible={showShareChat}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowShareChat(false); setShareChatSearch(''); }}
        testID="share-chat-modal"
      >
        <View style={styles.shareChatOverlay}>
          <View style={styles.shareChatSheet}>
            <View style={styles.shareChatHeader}>
              <Text style={styles.shareChatTitle}>Send to a Friend</Text>
              <Pressable
                onPress={() => { setShowShareChat(false); setShareChatSearch(''); }}
                hitSlop={12}
              >
                <X color={joyTheme.text} size={22} />
              </Pressable>
            </View>
            <View style={styles.shareChatSearchWrap}>
              <Search color={joyTheme.textMuted} size={16} />
              <TextInput
                style={styles.shareChatSearchInput}
                placeholder="Search contacts..."
                placeholderTextColor={joyTheme.textMuted}
                value={shareChatSearch}
                onChangeText={setShareChatSearch}
                autoCapitalize="none"
                testID="share-chat-search"
              />
            </View>
            {(followingQuery.isLoading || followingOrgsQuery.isLoading) ? (
              <View style={styles.shareChatLoading}>
                <ActivityIndicator size="small" color={joyTheme.primary} />
                <Text style={styles.shareChatLoadingText}>Loading contacts...</Text>
              </View>
            ) : shareChatContacts.length === 0 ? (
              <View style={styles.shareChatEmpty}>
                <MessageCircle color={joyTheme.textMuted} size={28} />
                <Text style={styles.shareChatEmptyText}>
                  {shareChatSearch ? 'No contacts found' : 'Follow people to share events with them'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={shareChatContacts}
                keyExtractor={(item) => item.id}
                style={styles.shareChatList}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const initials = item.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();
                  return (
                    <Pressable
                      style={({ pressed }) => [
                        styles.shareChatContact,
                        pressed && { backgroundColor: '#F3F4F6' },
                      ]}
                      onPress={() => handleShareToChat(item)}
                      testID={`share-contact-${item.id}`}
                    >
                      {item.avatar ? (
                        <Image source={{ uri: item.avatar }} style={styles.shareChatAvatar} contentFit="cover" />
                      ) : (
                        <View style={[styles.shareChatAvatar, styles.shareChatAvatarPlaceholder]}>
                          <Text style={styles.shareChatInitials}>{initials}</Text>
                        </View>
                      )}
                      <View style={styles.shareChatContactInfo}>
                        <Text style={styles.shareChatContactName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.shareChatContactType}>
                          {item.type === 'org' ? 'Organization' : 'Person'}
                        </Text>
                      </View>
                      <View style={styles.shareChatSendBtn}>
                        <Send color={joyTheme.primary} size={14} />
                      </View>
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!lightboxPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxPhoto(null)}
      >
        <Pressable style={styles.lightbox} onPress={() => setLightboxPhoto(null)}>
          <View style={[styles.lightboxClose, { top: insets.top + 16 }]}>
            <Text style={styles.lightboxCloseText}>Close</Text>
          </View>
          {lightboxPhoto && (
            <Image
              source={{ uri: resolveImageUrl(lightboxPhoto.photo_url) ?? lightboxPhoto.photo_url }}
              style={styles.lightboxImage}
              contentFit="contain"
            />
          )}
          {lightboxPhoto?.caption && (
            <View style={[styles.lightboxCaptionWrap, { paddingBottom: insets.bottom + 20 }]}>
              <Text style={styles.lightboxCaption}>{lightboxPhoto.caption}</Text>
            </View>
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
  backBtn: {
    marginTop: 12,
    backgroundColor: joyTheme.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backBtnText: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroSection: {
    height: 380,
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    gap: 8,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  heroTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroTypeText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: fonts.extraBold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pastBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pastBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  registeredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(43,182,115,0.7)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  registeredBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 28,
    fontFamily: fonts.black,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroMetaText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontFamily: fonts.semiBold,
  },
  body: {
    paddingHorizontal: 20,
    gap: 16,
    marginTop: -20,
  },
  quickStats: {
    flexDirection: 'row',
    gap: 10,
  },
  quickStatItem: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: joyTheme.border,
    shadowColor: joyTheme.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  quickStatValue: {
    fontSize: 20,
    fontFamily: fonts.black,
    color: joyTheme.text,
  },
  quickStatLabel: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
  },
  signupSection: {
    gap: 0,
  },
  signupCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: joyTheme.border,
    shadowColor: joyTheme.shadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  spotsRow: {
    gap: 8,
  },
  spotsBarBg: {
    height: 6,
    backgroundColor: joyTheme.backgroundAlt,
    borderRadius: 3,
    overflow: 'hidden',
  },
  spotsBarFill: {
    height: '100%',
    backgroundColor: joyTheme.primary,
    borderRadius: 3,
  },
  spotsText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requirementText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  signUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: joyTheme.primary,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 4,
  },
  signUpBtnDisabled: {
    backgroundColor: joyTheme.textMuted,
    opacity: 0.6,
  },
  signUpBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: fonts.extraBold,
  },
  signedUpCard: {
    backgroundColor: '#EBF8F1',
    borderRadius: 24,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: '#B3E5CC',
  },
  signedUpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  signedUpIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: joyTheme.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signedUpInfo: {
    flex: 1,
    gap: 2,
  },
  signedUpTitle: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: '#1A6B3F',
  },
  signedUpSubtitle: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: '#3D9B66',
  },
  cancelBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  cancelBtnText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  locationIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationTextWrap: {
    flex: 1,
    gap: 3,
  },
  locationName: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
  },
  locationAddress: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: joyTheme.textMuted,
    lineHeight: 20,
  },
  locationCityState: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  locationActions: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingTop: 2,
  },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: joyTheme.primarySoft,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  directionsBtnText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: joyTheme.primary,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionLabel: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 23,
    color: joyTheme.textMuted,
    fontFamily: fonts.medium,
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillChip: {
    backgroundColor: joyTheme.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#A8D4F5',
  },
  skillChipText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: joyTheme.primaryDark,
  },
  eventInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  infoGrid: {
    gap: 14,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoItemContent: {
    flex: 1,
    gap: 2,
  },
  infoItemLabel: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoItemValue: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: joyTheme.text,
  },
  recapCard: {
    borderRadius: 24,
    padding: 20,
    gap: 14,
    overflow: 'hidden',
  },
  recapTitle: {
    fontSize: 18,
    fontFamily: fonts.black,
    color: '#FFD84D',
  },
  recapText: {
    fontSize: 15,
    lineHeight: 23,
    color: 'rgba(255,255,255,0.85)',
  },
  recapStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  recapStatItem: {
    flex: 1,
    minWidth: 120,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  recapStatLabel: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recapStatValue: {
    fontSize: 14,
    fontFamily: fonts.extraBold,
    color: '#fff',
  },
  attendanceStatusCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: joyTheme.border,
    shadowColor: joyTheme.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  attendanceStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  attendanceStatusIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendanceStatusInfo: {
    flex: 1,
    gap: 3,
  },
  attendanceStatusTitle: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
  },
  attendanceStatusSubtitle: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  yourImpactCard: {
    backgroundColor: joyTheme.primarySoft,
    borderRadius: 24,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: '#A8D4F5',
  },
  yourImpactTitle: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: joyTheme.primaryDark,
  },
  yourImpactRow: {
    flexDirection: 'row',
    gap: 12,
  },
  yourImpactItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
  },
  yourImpactValue: {
    fontSize: 18,
    fontFamily: fonts.black,
    color: joyTheme.text,
  },
  yourImpactLabel: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
  },
  photoBadge: {
    backgroundColor: joyTheme.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  photoBadgeText: {
    fontSize: 13,
    fontFamily: fonts.extraBold,
    color: joyTheme.primaryDark,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PHOTO_GRID_GAP,
  },
  photoCell: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: joyTheme.backgroundAlt,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoCaptionWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  photoCaption: {
    color: '#fff',
    fontSize: 10,
    fontFamily: fonts.semiBold,
  },
  volunteersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  volunteerChip: {
    alignItems: 'center',
    gap: 5,
    width: 68,
  },
  volunteerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  volunteerAvatarPlaceholder: {
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volunteerInitials: {
    fontSize: 14,
    fontFamily: fonts.extraBold,
    color: joyTheme.primaryDark,
  },
  volunteerName: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: joyTheme.text,
    textAlign: 'center',
  },
  checkedInDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: joyTheme.success,
    position: 'absolute',
    top: 0,
    right: 8,
  },
  moreText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: joyTheme.primary,
    textAlign: 'center',
    paddingTop: 4,
  },
  orgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: joyTheme.border,
    shadowColor: joyTheme.shadow,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  orgCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orgCardLogo: {
    width: 48,
    height: 48,
  },
  orgCardInfo: {
    flex: 1,
    gap: 2,
  },
  orgCardLabel: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  orgCardName: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
  },
  orgCardLocation: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: joyTheme.primary,
  },
  uploadPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: joyTheme.primarySoft,
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#A8D4F5',
  },
  uploadPhotoBtnText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: joyTheme.primaryDark,
  },
  signedUpActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shareChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: joyTheme.primarySoft,
    borderWidth: 1,
    borderColor: '#A8D4F5',
  },
  shareChatBtnText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: joyTheme.primaryDark,
  },
  shareChatOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  shareChatSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingTop: 8,
  },
  shareChatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: joyTheme.border,
  },
  shareChatTitle: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
  },
  shareChatSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginVertical: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  shareChatSearchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: joyTheme.text,
  },
  shareChatLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  shareChatLoadingText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  shareChatEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
    gap: 10,
  },
  shareChatEmptyText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
    textAlign: 'center',
  },
  shareChatList: {
    maxHeight: 400,
  },
  shareChatContact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  shareChatAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  shareChatAvatarPlaceholder: {
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareChatInitials: {
    fontSize: 14,
    fontFamily: fonts.extraBold,
    color: joyTheme.primaryDark,
  },
  shareChatContactInfo: {
    flex: 1,
    gap: 2,
  },
  shareChatContactName: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: joyTheme.text,
  },
  shareChatContactType: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: joyTheme.textMuted,
  },
  shareChatSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSpacer: {
    height: 40,
  },
  lightbox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxClose: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  lightboxCloseText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: fonts.bold,
  },
  lightboxImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  lightboxCaptionWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  lightboxCaption: {
    color: '#fff',
    fontSize: 15,
    fontFamily: fonts.semiBold,
    textAlign: 'center',
  },
});
