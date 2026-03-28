import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bell,
  BellOff,
  Calendar,
  Camera,
  CheckCheck,
  ChevronRight,
  Clock,
  Gift,
  Heart,
  Megaphone,
  MessageCircle,
  ShieldCheck,
  Star,
  Trophy,
  UserPlus,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { useAuth } from '@/providers/AuthProvider';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  fetchOrgNotifications,
} from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { DbNotification } from '@/types/database';

type NotificationTab = 'all' | 'events' | 'feedback' | 'social' | 'rewards' | 'other';

interface TabConfig {
  key: NotificationTab;
  label: string;
  icon: typeof Bell;
  types: string[];
}

const TABS: TabConfig[] = [
  { key: 'all', label: 'All', icon: Bell, types: [] },
  {
    key: 'events',
    label: 'Events',
    icon: Calendar,
    types: [
      'event_signup', 'event_reminder', 'event_update', 'event_cancelled', 'event_created',
      'event_share', 'new_event', 'event_recap', 'recap', 'recap_published',
      'signup_confirmed', 'signup_approved', 'signup_declined', 'signup_rejected',
      'signup_cancelled', 'signup_waitlisted', 'volunteer_confirmed', 'volunteer_approved',
      'volunteer_rejected', 'volunteer_declined', 'registration_confirmed',
      'registration_approved', 'registration_declined',
      'check_in', 'checked_in', 'checkin', 'check-in',
      'day_of', 'day_of_update', 'day_of_message', 'dayof', 'day-of',
      'event_complete', 'event_completed', 'event_ended',
      'waiver', 'waiver_required',
    ],
  },
  {
    key: 'feedback',
    label: 'Feedback',
    icon: MessageCircle,
    types: [
      'feedback_immediate', 'feedback_morning', 'feedback_final',
      'feedback_reminder', 'feedback_request', 'feedback',
      'post_event_feedback', 'event_feedback', 'review_reminder',
      'photo_approved', 'photo_rejected', 'photo_uploaded', 'photo_added',
      'photo', 'new_photo',
    ],
  },
  {
    key: 'social',
    label: 'Social',
    icon: UserPlus,
    types: [
      'new_follower', 'follow', 'followed', 'like', 'comment',
      'message', 'chat', 'new_message', 'org_message', 'direct_message', 'dm',
      'announcement', 'org_announcement', 'blast',
      'nomination', 'nominated', 'nominate',
      'challenge', 'challenge_poke', 'poke', 'challenge_accepted',
      'challenge_completed', 'challenge_update',
      'organization', 'org_update',
    ],
  },
  {
    key: 'rewards',
    label: 'Rewards',
    icon: Trophy,
    types: [
      'points_earned', 'badge_earned', 'points', 'badge', 'joy_points',
      'hours_approved', 'hours_logged', 'time_log_approved', 'time_log',
      'hours', 'hours_rejected', 'time_log_rejected',
      'reward_redeemed', 'redemption_update', 'redemption_approved',
      'redemption_denied', 'redemption_shipped', 'redemption_fulfilled',
      'reward', 'redemption',
      'leaderboard', 'leaderboard_update', 'ranking',
      'donation', 'donate',
      'impact', 'impact_update',
      'verification', 'profile_verified', 'verification_approved', 'verification_rejected', 'verified',
    ],
  },
  { key: 'other', label: 'Other', icon: Bell, types: [] },
];

function categorizeNotification(type: string): NotificationTab {
  const normalized = type?.toLowerCase().trim() ?? '';
  for (const tab of TABS) {
    if (tab.key === 'all' || tab.key === 'other') continue;
    if (tab.types.includes(normalized)) return tab.key;
  }
  return 'other';
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'event_signup':
    case 'event_reminder':
    case 'event_update':
    case 'event_cancelled':
    case 'event_created':
      return { Icon: Calendar, color: joyTheme.primary, bg: '#EEF4FF' };
    case 'event_recap':
      return { Icon: Camera, color: '#6366F1', bg: '#EEF2FF' };
    case 'signup_confirmed':
    case 'signup_approved':
    case 'volunteer_confirmed':
    case 'volunteer_approved':
      return { Icon: CheckCheck, color: '#22C55E', bg: '#F0FDF4' };
    case 'signup_declined':
    case 'signup_rejected':
    case 'signup_cancelled':
    case 'signup_waitlisted':
      return { Icon: Calendar, color: '#EF4444', bg: '#FEF2F2' };
    case 'points_earned':
    case 'badge_earned':
      return { Icon: Star, color: '#FFB020', bg: '#FFF8E6' };
    case 'new_follower':
    case 'follow':
      return { Icon: UserPlus, color: joyTheme.success, bg: '#F0FFF5' };
    case 'reward_redeemed':
    case 'redemption_update':
    case 'redemption_approved':
    case 'redemption_denied':
    case 'redemption_shipped':
      return { Icon: Gift, color: '#FF8C42', bg: '#FFF5EC' };
    case 'like':
      return { Icon: Heart, color: '#FF3B5C', bg: '#FFF0F3' };
    case 'comment':
      return { Icon: MessageCircle, color: '#8B5CF6', bg: '#F5F0FF' };
    case 'announcement':
      return { Icon: Megaphone, color: '#0EA5E9', bg: '#F0F9FF' };
    case 'check_in':
    case 'checked_in':
    case 'hours_logged':
    case 'hours_approved':
    case 'time_log_approved':
      return { Icon: Clock, color: '#10B981', bg: '#ECFDF5' };
    case 'hours_rejected':
    case 'time_log_rejected':
      return { Icon: Clock, color: '#EF4444', bg: '#FEF2F2' };
    case 'photo_approved':
    case 'photo_uploaded':
      return { Icon: Camera, color: '#8B5CF6', bg: '#F5F0FF' };
    case 'photo_rejected':
      return { Icon: Camera, color: '#EF4444', bg: '#FEF2F2' };
    case 'nomination':
    case 'nominated':
      return { Icon: Trophy, color: '#F59E0B', bg: '#FFFBEB' };
    case 'donation':
      return { Icon: Heart, color: '#EC4899', bg: '#FDF2F8' };
    case 'verification':
    case 'profile_verified':
    case 'verification_approved':
    case 'verification_rejected':
      return { Icon: ShieldCheck, color: '#22C55E', bg: '#F0FDF4' };
    case 'event_share':
      return { Icon: Heart, color: joyTheme.primary, bg: '#EEF4FF' };
    case 'feedback_immediate':
    case 'feedback_morning':
    case 'feedback_final':
      return { Icon: Clock, color: '#F59E0B', bg: '#FFFBEB' };
    case 'message':
    case 'chat':
    case 'new_message':
    case 'org_message':
      return { Icon: MessageCircle, color: joyTheme.primary, bg: '#EEF4FF' };
    case 'feedback_reminder':
    case 'feedback_request':
      return { Icon: Clock, color: '#F59E0B', bg: '#FFFBEB' };
    case 'challenge':
    case 'challenge_poke':
    case 'poke':
      return { Icon: Trophy, color: '#6366F1', bg: '#EEF2FF' };
    case 'leaderboard':
    case 'leaderboard_update':
      return { Icon: Trophy, color: '#FFB020', bg: '#FFF8E6' };
    case 'day_of':
    case 'day_of_update':
      return { Icon: Calendar, color: '#0EA5E9', bg: '#F0F9FF' };
    case 'organization':
      return { Icon: ShieldCheck, color: joyTheme.primary, bg: '#EEF4FF' };
    default:
      return { Icon: Bell, color: joyTheme.primary, bg: '#EEF4FF' };
  }
}

function timeAgo(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const FEEDBACK_TYPES = new Set([
  'feedback_immediate', 'feedback_morning', 'feedback_final',
  'feedback_reminder', 'feedback_request', 'feedback',
  'post_event_feedback', 'event_feedback', 'review_reminder',
]);

const FEEDBACK_WINDOW_HOURS = 48;

function useFeedbackDeadline(signupId: string | undefined, eventEndTime: string | undefined) {
  const [deadline, setDeadline] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!signupId) {
      setDeadline(null);
      return;
    }
    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const { data: extension } = await supabase
          .from('feedback_extensions')
          .select('new_deadline')
          .eq('signup_id', signupId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!cancelled) {
          if (extension?.new_deadline) {
            setDeadline(extension.new_deadline as string);
          } else if (eventEndTime) {
            const d = new Date(eventEndTime);
            d.setHours(d.getHours() + FEEDBACK_WINDOW_HOURS);
            setDeadline(d.toISOString());
          } else {
            setDeadline(null);
          }
        }
      } catch (err) {
        console.error('[Notifications] Error fetching feedback deadline:', err);
        if (!cancelled && eventEndTime) {
          const d = new Date(eventEndTime);
          d.setHours(d.getHours() + FEEDBACK_WINDOW_HOURS);
          setDeadline(d.toISOString());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [signupId, eventEndTime]);

  return { deadline, loading };
}

function FeedbackTimerSubtext({ signupId, eventId }: { signupId?: string; eventId?: string }) {
  const [eventEndTime, setEventEndTime] = useState<string | undefined>(undefined);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [timerColor, setTimerColor] = useState<string>('#3B82F6');
  const { deadline } = useFeedbackDeadline(signupId, eventEndTime);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase
          .from('events')
          .select('end_time')
          .eq('id', eventId)
          .single();
        if (!cancelled && data?.end_time) {
          setEventEndTime(data.end_time);
        }
      } catch (err) {
        console.error('[Notifications] Error fetching event end_time:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [eventId]);

  useEffect(() => {
    if (!deadline) {
      setTimeLeft(null);
      return;
    }

    const calculate = () => {
      const now = Date.now();
      const dl = new Date(deadline).getTime();
      const diff = dl - now;

      if (diff <= 0) {
        setTimeLeft('Expired — feedback window closed');
        setTimerColor(joyTheme.rose);
        return;
      }

      const totalHours = diff / (1000 * 60 * 60);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (totalHours < 6) {
        setTimerColor('#EF4444');
        setTimeLeft(`Hurry! ${hours}h ${minutes}m remaining`);
      } else if (totalHours < 24) {
        setTimerColor(joyTheme.gold);
        setTimeLeft(`${hours}h ${minutes}m remaining`);
      } else {
        setTimerColor('#3B82F6');
        setTimeLeft(`${hours}h ${minutes}m remaining`);
      }
    };

    calculate();
    const interval = setInterval(calculate, 60000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!timeLeft) return null;

  return (
    <View style={styles.feedbackTimerRow}>
      <Clock color={timerColor} size={12} />
      <Text style={[styles.feedbackTimerText, { color: timerColor }]}>{timeLeft}</Text>
    </View>
  );
}

function TabBar({
  activeTab,
  onTabChange,
  unreadCounts,
}: {
  activeTab: NotificationTab;
  onTabChange: (tab: NotificationTab) => void;
  unreadCounts: Record<NotificationTab, number>;
}) {
  const scrollRef = useRef<ScrollView>(null);

  return (
    <View style={styles.tabBarContainer}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBarScroll}
      >
        {TABS.map((tab) => {
          if (tab.key === 'other') return null;
          const isActive = activeTab === tab.key;
          const unread = unreadCounts[tab.key];
          const TabIcon = tab.icon;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onTabChange(tab.key);
              }}
              style={[styles.tabPill, isActive && styles.tabPillActive]}
            >
              <TabIcon
                color={isActive ? '#FFFFFF' : joyTheme.textMuted}
                size={15}
              />
              <Text style={[styles.tabPillText, isActive && styles.tabPillTextActive]}>
                {tab.label}
              </Text>
              {unread > 0 && (
                <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                    {unread > 99 ? '99+' : unread}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { user, adminUser, role } = useAuth();
  const queryClient = useQueryClient();
  const userId = role === 'organization' ? (adminUser?.id ?? user?.id ?? '') : (user?.id ?? '');
  const isOrg = role === 'organization';
  const [activeTab, setActiveTab] = useState<NotificationTab>('all');

  const notificationsQuery = useQuery({
    queryKey: ['notifications', userId, isOrg],
    queryFn: () => isOrg ? fetchOrgNotifications(userId) : fetchNotifications(userId),
    enabled: !!userId,
  });

  const markReadMutation = useMutation({
    mutationFn: (notifId: string) => markNotificationRead(notifId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
      void queryClient.invalidateQueries({ queryKey: ['unread-notifications', userId] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
      void queryClient.invalidateQueries({ queryKey: ['unread-notifications', userId] });
    },
  });

  const notifications = useMemo(() => notificationsQuery.data ?? [], [notificationsQuery.data]);
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const unreadCounts = useMemo(() => {
    const counts: Record<NotificationTab, number> = {
      all: 0,
      events: 0,
      social: 0,
      feedback: 0,
      rewards: 0,
      other: 0,
    };
    for (const n of notifications) {
      if (!n.read) {
        counts.all++;
        const cat = categorizeNotification(n.type);
        counts[cat]++;
      }
    }
    return counts;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'all') return notifications;
    return notifications.filter((n) => categorizeNotification(n.type) === activeTab);
  }, [notifications, activeTab]);

  const navigateFromWebUrl = useCallback((urlStr: string): boolean => {
    console.log('[Notifications] Attempting URL-based routing for:', urlStr);
    try {
      let path = urlStr;
      if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
        const parsed = new URL(urlStr);
        path = parsed.pathname + parsed.search + parsed.hash;
      }
      path = path.replace(/^\/+/, '').replace(/\/+$/, '');
      console.log('[Notifications] Parsed URL path:', path);

      const uuidPattern = '[0-9a-fA-F-]{36}';

      const eventDetailMatch = path.match(new RegExp('^events?/(' + uuidPattern + ')(?:/|$)'));
      if (eventDetailMatch) {
        router.push({ pathname: '/event-detail', params: { id: eventDetailMatch[1] } });
        return true;
      }

      const eventDayOfMatch = path.match(new RegExp('^events?/(' + uuidPattern + ')/day-?of'));
      if (eventDayOfMatch) {
        router.push('/(tabs)/day-of' as never);
        return true;
      }

      const eventRecapMatch = path.match(new RegExp('^events?/(' + uuidPattern + ')/(recap|feedback)'));
      if (eventRecapMatch) {
        if (isOrg) {
          router.push({ pathname: '/event-recap', params: { eventId: eventRecapMatch[1] } });
        } else {
          router.push({ pathname: '/event-detail', params: { id: eventRecapMatch[1] } });
        }
        return true;
      }

      const eventPhotosMatch = path.match(new RegExp('^events?/(' + uuidPattern + ')/photos'));
      if (eventPhotosMatch) {
        router.push('/(tabs)/photos');
        return true;
      }

      const eventVolunteersMatch = path.match(new RegExp('^events?/(' + uuidPattern + ')/volunteers'));
      if (eventVolunteersMatch) {
        router.push({ pathname: '/manage-volunteers', params: { eventId: eventVolunteersMatch[1] } });
        return true;
      }

      const userProfileMatch = path.match(new RegExp('^(?:users?|profile|volunteer|volunteers)/(' + uuidPattern + ')'));
      if (userProfileMatch) {
        router.push({ pathname: '/user-profile', params: { id: userProfileMatch[1] } });
        return true;
      }

      const orgProfileMatch = path.match(new RegExp('^(?:organizations?|orgs?)/(' + uuidPattern + ')'));
      if (orgProfileMatch) {
        router.push({ pathname: '/org-profile', params: { id: orgProfileMatch[1] } });
        return true;
      }

      const conversationMatch = path.match(new RegExp('^(?:conversations?|messages?|chats?)/(' + uuidPattern + ')'));
      if (conversationMatch) {
        router.push({ pathname: '/conversation', params: { id: conversationMatch[1], name: 'Chat', type: 'volunteer', avatar: '' } });
        return true;
      }

      const donateMatch = path.match(new RegExp('^donate/(' + uuidPattern + ')'));
      if (donateMatch) {
        router.push({ pathname: '/donate', params: { partnerId: donateMatch[1] } });
        return true;
      }

      const clientMatch = path.match(new RegExp('^(?:clients?|partners?)/(' + uuidPattern + ')'));
      if (clientMatch) {
        router.push({ pathname: '/client-detail', params: { id: clientMatch[1] } });
        return true;
      }

      const simpleRoutes: Record<string, string> = {
        'events': '/(tabs)/events',
        'leaderboard': '/(tabs)/leaderboard',
        'photos': '/(tabs)/photos',
        'photo': '/(tabs)/photos',
        'chat': '/(tabs)/chat',
        'messages': '/(tabs)/chat',
        'profile': '/(tabs)/profile',
        'shop': '/shop',
        'store': '/shop',
        'rewards': '/shop',
        'donate': '/donate',
        'impact': '/impact',
        'day-of': '/(tabs)/day-of',
        'dayof': '/(tabs)/day-of',
        'nominate': '/nominate',
        'nominations': '/nominate',
        'settings': '/settings',
        'event-history': '/event-history',
        'history': '/event-history',
        'partners': '/partners',
        'notifications': '/notifications',
        'explore': '/(tabs)/explore',
        'home': '/(tabs)',
        'dashboard': '/(tabs)',
        'feedback': '/(tabs)/events',
      };

      const basePath = path.split('/')[0].split('?')[0].toLowerCase();
      if (simpleRoutes[basePath]) {
        router.push(simpleRoutes[basePath] as never);
        return true;
      }

      console.log('[Notifications] URL did not match any known route pattern:', path);
      return false;
    } catch (e) {
      console.log('[Notifications] Error parsing URL:', e);
      return false;
    }
  }, [router, isOrg]);

  const [announcementModal, setAnnouncementModal] = useState<{
    visible: boolean;
    title: string;
    orgName: string;
    senderName: string;
    message: string;
    timestamp: string;
  }>({ visible: false, title: '', orgName: '', senderName: '', message: '', timestamp: '' });

  const handleFeedbackNavigation = useCallback(async (data: Record<string, string>, eventId: string) => {
    const signupId = data.signupId ?? data.signup_id ?? '';
    if (!signupId) {
      console.log('[Notifications] No signupId for feedback, going to event detail');
      router.push({ pathname: '/event-detail', params: { id: eventId } });
      return;
    }
    try {
      const { data: existing } = await supabase
        .from('volunteer_feedback')
        .select('id')
        .eq('signup_id', signupId)
        .maybeSingle();
      if (existing) {
        console.log('[Notifications] Feedback already submitted for signup:', signupId);
        Alert.alert('Already Submitted', 'You have already submitted feedback for this event.');
        return;
      }
      const { data: event } = await supabase
        .from('events')
        .select('id, title, end_time')
        .eq('id', eventId)
        .single();
      console.log('[Notifications] Navigating to feedback screen for event:', event?.title);
      router.push({
        pathname: '/event-feedback',
        params: {
          signupId,
          eventId,
          eventTitle: event?.title ?? '',
        },
      });
    } catch (err) {
      console.error('[Notifications] Error checking feedback:', err);
      router.push({ pathname: '/event-detail', params: { id: eventId } });
    }
  }, [router]);

  const handleNotifPress = useCallback((notif: DbNotification) => {
    console.log('[Notifications] === NOTIFICATION PRESSED ===' );
    console.log('[Notifications] id:', notif.id);
    console.log('[Notifications] type:', notif.type);
    console.log('[Notifications] title:', notif.title);
    console.log('[Notifications] message:', notif.message);
    console.log('[Notifications] raw data:', JSON.stringify(notif.data, null, 2));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!notif.read) {
      markReadMutation.mutate(notif.id);
    }

    const raw = notif.data ?? {};
    const data: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v != null) data[k] = String(v);
    }
    const eventId = data.event_id ?? data.eventId ?? data.event ?? '';
    const conversationId = data.conversation_id ?? data.conversationId ?? data.conversation ?? '';
    const volUserId = data.user_id ?? data.userId ?? data.follower_id ?? data.followerId ?? data.volunteer_id ?? data.volunteerId ?? '';
    const orgId = data.organization_id ?? data.organizationId ?? data.org_id ?? data.orgId ?? '';
    const clientId = data.client_id ?? data.clientId ?? data.partner_id ?? data.partnerId ?? '';
    const url = data.url ?? data.link ?? data.action_url ?? data.actionUrl ?? data.redirect_url ?? data.redirectUrl ?? data.redirect ?? data.path ?? '';
    const action = (data.action ?? data.action_type ?? data.actionType ?? '').toLowerCase();

    console.log('[Notifications] Resolved — eventId:', eventId, 'conversationId:', conversationId, 'userId:', volUserId, 'orgId:', orgId, 'clientId:', clientId, 'url:', url, 'action:', action);

    if (url && navigateFromWebUrl(url)) {
      console.log('[Notifications] Routed via URL field');
      return;
    }

    if (action) {
      console.log('[Notifications] Checking action field:', action);
      const actionRouted = (() => {
        if (action.includes('feedback') || action.includes('review')) {
          if (eventId && !isOrg) {
            void handleFeedbackNavigation(data, eventId);
            return true;
          }
          if (eventId && isOrg) {
            router.push({ pathname: '/event-recap', params: { eventId } });
            return true;
          }
        }
        if (action.includes('recap')) {
          if (eventId) {
            if (isOrg) {
              router.push({ pathname: '/event-recap', params: { eventId } });
            } else {
              router.push({ pathname: '/event-detail', params: { id: eventId } });
            }
            return true;
          }
        }
        if (action.includes('day_of') || action.includes('day-of') || action.includes('dayof') || action.includes('check_in') || action.includes('checkin')) {
          if (eventId) {
            router.push({ pathname: '/event-day-of', params: { eventId } });
          } else {
            router.push('/(tabs)/day-of' as never);
          }
          return true;
        }
        if (action.includes('leaderboard') || action.includes('points') || action.includes('badge')) {
          router.push('/(tabs)/leaderboard');
          return true;
        }
        if (action.includes('shop') || action.includes('reward') || action.includes('redeem')) {
          router.push('/shop');
          return true;
        }
        if (action.includes('photo')) {
          router.push('/(tabs)/photos');
          return true;
        }
        if (action.includes('chat') || action.includes('message')) {
          router.push('/(tabs)/chat');
          return true;
        }
        if (action.includes('donate') || action.includes('donation')) {
          router.push('/donate');
          return true;
        }
        if (action.includes('profile')) {
          router.push('/(tabs)/profile');
          return true;
        }
        return false;
      })();
      if (actionRouted) {
        console.log('[Notifications] Routed via action field');
        return;
      }
    }

    let navigated = false;
    const normalizedType = notif.type?.toLowerCase().trim() ?? '';
    console.log('[Notifications] Routing by type:', normalizedType);

    switch (normalizedType) {
      case 'event_reminder':
      case 'event_share':
      case 'event_cancelled':
      case 'event_signup':
      case 'event_update':
      case 'event_created':
      case 'new_event':
        if (eventId) {
          router.push({ pathname: '/event-detail', params: { id: eventId } });
        } else {
          router.push('/(tabs)/events');
        }
        navigated = true;
        break;

      case 'feedback_immediate':
      case 'feedback_morning':
      case 'feedback_final':
      case 'feedback_reminder':
      case 'feedback_request':
      case 'feedback':
      case 'post_event_feedback':
      case 'event_feedback':
      case 'review_reminder':
        if (eventId) {
          if (isOrg) {
            router.push({ pathname: '/event-recap', params: { eventId } });
          } else {
            void handleFeedbackNavigation(data, eventId);
          }
        } else {
          router.push('/(tabs)/events');
        }
        navigated = true;
        break;

      case 'new_follower':
      case 'follow':
      case 'followed': {
        const followerId = data.follower_id ?? data.followerId ?? volUserId;
        if (followerId) {
          router.push({ pathname: '/user-profile', params: { id: followerId } });
        } else {
          router.push('/(tabs)/profile');
        }
        navigated = true;
        break;
      }

      case 'org_announcement':
      case 'announcement':
      case 'blast':
        setAnnouncementModal({
          visible: true,
          title: notif.title ?? 'Announcement',
          orgName: data.organization_name ?? data.org_name ?? '',
          senderName: data.sender_name ?? data.senderName ?? '',
          message: notif.message ?? '',
          timestamp: notif.created_at,
        });
        navigated = true;
        break;

      case 'hours_approved':
      case 'hours_logged':
      case 'time_log_approved':
      case 'time_log':
      case 'hours':
        router.push('/event-history');
        navigated = true;
        break;

      case 'hours_rejected':
      case 'time_log_rejected':
        if (eventId) {
          router.push({ pathname: '/event-detail', params: { id: eventId } });
        } else {
          router.push('/event-history');
        }
        navigated = true;
        break;

      case 'reward_redeemed':
      case 'redemption_update':
      case 'redemption_approved':
      case 'redemption_denied':
      case 'redemption_shipped':
      case 'redemption_fulfilled':
      case 'reward':
      case 'redemption':
        router.push('/shop');
        navigated = true;
        break;

      case 'verification_approved':
      case 'verification_rejected':
      case 'verification':
      case 'profile_verified':
      case 'verified':
        router.push('/(tabs)/profile');
        navigated = true;
        break;

      case 'signup_confirmed':
      case 'signup_approved':
      case 'signup_declined':
      case 'signup_rejected':
      case 'signup_cancelled':
      case 'signup_waitlisted':
      case 'volunteer_confirmed':
      case 'volunteer_approved':
      case 'volunteer_rejected':
      case 'volunteer_declined':
      case 'registration_confirmed':
      case 'registration_approved':
      case 'registration_declined':
        if (eventId) {
          router.push({ pathname: '/event-detail', params: { id: eventId } });
        } else {
          router.push('/(tabs)/events');
        }
        navigated = true;
        break;

      case 'event_recap':
      case 'recap':
      case 'recap_published':
        if (eventId) {
          if (isOrg) {
            router.push({ pathname: '/event-recap', params: { eventId } });
          } else {
            router.push({ pathname: '/event-detail', params: { id: eventId } });
          }
        } else {
          router.push('/(tabs)/events');
        }
        navigated = true;
        break;

      case 'points_earned':
      case 'badge_earned':
      case 'points':
      case 'badge':
      case 'joy_points':
        router.push('/(tabs)/leaderboard');
        navigated = true;
        break;

      case 'like':
      case 'comment':
        if (data.photo_id || data.photoId || data.photo) {
          router.push('/(tabs)/photos');
        } else if (eventId) {
          router.push({ pathname: '/event-detail', params: { id: eventId } });
        } else {
          router.push('/(tabs)/explore');
        }
        navigated = true;
        break;

      case 'nomination':
      case 'nominated':
      case 'nominate':
        router.push('/nominate');
        navigated = true;
        break;

      case 'donation':
      case 'donate':
        if (clientId) {
          router.push({ pathname: '/client-detail', params: { id: clientId } });
        } else {
          router.push('/donate');
        }
        navigated = true;
        break;

      case 'organization':
      case 'org_update':
        if (orgId) {
          router.push({ pathname: '/org-profile', params: { id: orgId } });
        } else {
          router.push('/(tabs)');
        }
        navigated = true;
        break;

      case 'message':
      case 'chat':
      case 'new_message':
      case 'org_message':
      case 'direct_message':
      case 'dm':
        if (conversationId) {
          router.push({
            pathname: '/conversation',
            params: {
              id: conversationId,
              name: data.sender_name ?? data.senderName ?? data.name ?? 'Chat',
              type: data.conversation_type ?? data.conversationType ?? 'volunteer',
              avatar: data.sender_avatar ?? data.senderAvatar ?? data.avatar ?? '',
            },
          });
        } else {
          router.push('/(tabs)/chat');
        }
        navigated = true;
        break;

      case 'check_in':
      case 'checked_in':
      case 'checkin':
      case 'check-in':
        if (eventId) {
          router.push({ pathname: '/event-day-of', params: { eventId } });
        } else {
          router.push('/(tabs)/day-of' as never);
        }
        navigated = true;
        break;

      case 'photo_approved':
      case 'photo_rejected':
      case 'photo_uploaded':
      case 'photo_added':
      case 'photo':
      case 'new_photo':
        router.push('/(tabs)/photos');
        navigated = true;
        break;

      case 'leaderboard':
      case 'leaderboard_update':
      case 'ranking':
        router.push('/(tabs)/leaderboard');
        navigated = true;
        break;

      case 'challenge':
      case 'challenge_poke':
      case 'poke':
      case 'challenge_accepted':
      case 'challenge_completed':
      case 'challenge_update':
        router.push('/(tabs)/leaderboard');
        navigated = true;
        break;

      case 'day_of':
      case 'day_of_update':
      case 'day_of_message':
      case 'dayof':
      case 'day-of':
        if (eventId) {
          router.push({ pathname: '/event-day-of', params: { eventId } });
        } else {
          router.push('/(tabs)/day-of' as never);
        }
        navigated = true;
        break;

      case 'event_complete':
      case 'event_completed':
      case 'event_ended':
        if (eventId) {
          if (isOrg) {
            router.push({ pathname: '/event-recap', params: { eventId } });
          } else {
            router.push({ pathname: '/event-detail', params: { id: eventId } });
          }
        } else {
          router.push('/event-history');
        }
        navigated = true;
        break;

      case 'waiver':
      case 'waiver_required':
        if (eventId) {
          router.push({ pathname: '/event-detail', params: { id: eventId } });
        } else {
          router.push('/(tabs)/events');
        }
        navigated = true;
        break;

      case 'impact':
      case 'impact_update':
        router.push('/impact');
        navigated = true;
        break;
    }

    if (!navigated) {
      console.log('[Notifications] No type handler matched for type:', normalizedType, '- using fallback');

      const title = (notif.title ?? '').toLowerCase();
      const message = (notif.message ?? '').toLowerCase();
      const combined = title + ' ' + message;

      if (combined.includes('feedback') || combined.includes('share your experience') || combined.includes('review')) {
        if (eventId && !isOrg) {
          void handleFeedbackNavigation(data, eventId);
          console.log('[Notifications] Fallback: matched feedback keyword, navigating to feedback');
          return;
        }
        if (eventId && isOrg) {
          router.push({ pathname: '/event-recap', params: { eventId } });
          console.log('[Notifications] Fallback: matched feedback/recap keyword, isOrg:', isOrg);
          return;
        }
      }
      if (combined.includes('recap')) {
        if (eventId) {
          if (isOrg) {
            router.push({ pathname: '/event-recap', params: { eventId } });
          } else {
            router.push({ pathname: '/event-detail', params: { id: eventId } });
          }
          console.log('[Notifications] Fallback: matched recap keyword');
          return;
        }
      }
      if (combined.includes('day of') || combined.includes('day-of') || combined.includes('check in') || combined.includes('check-in') || combined.includes('checked in')) {
        if (eventId) {
          router.push({ pathname: '/event-day-of', params: { eventId } });
        } else {
          router.push('/(tabs)/day-of' as never);
        }
        console.log('[Notifications] Fallback: matched day-of keyword');
        return;
      }
      if (combined.includes('photo')) {
        router.push('/(tabs)/photos');
        console.log('[Notifications] Fallback: matched photo keyword');
        return;
      }
      if (combined.includes('leaderboard') || combined.includes('points') || combined.includes('badge') || combined.includes('joy points')) {
        router.push('/(tabs)/leaderboard');
        console.log('[Notifications] Fallback: matched leaderboard keyword');
        return;
      }
      if (combined.includes('shop') || combined.includes('reward') || combined.includes('redeem')) {
        router.push('/shop');
        console.log('[Notifications] Fallback: matched shop keyword');
        return;
      }

      if (eventId) {
        router.push({ pathname: '/event-detail', params: { id: eventId } });
      } else if (conversationId) {
        router.push({
          pathname: '/conversation',
          params: {
            id: conversationId,
            name: data.sender_name ?? data.senderName ?? 'Chat',
            type: data.conversation_type ?? data.conversationType ?? 'volunteer',
            avatar: data.sender_avatar ?? data.senderAvatar ?? '',
          },
        });
      } else if (volUserId) {
        router.push({ pathname: '/user-profile', params: { id: volUserId } });
      } else if (orgId) {
        router.push({ pathname: '/org-profile', params: { id: orgId } });
      } else if (clientId) {
        router.push({ pathname: '/client-detail', params: { id: clientId } });
      } else {
        console.log('[Notifications] No actionable data found, navigating to home');
        router.push('/(tabs)');
      }
    }
  }, [markReadMutation, router, navigateFromWebUrl, isOrg, handleFeedbackNavigation]);

  const handleMarkAllRead = useCallback(() => {
    console.log('[Notifications] Marking all as read');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    markAllReadMutation.mutate();
  }, [markAllReadMutation]);

  return (
    <View style={styles.screen} testID="notifications-screen">
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.back();
            }}
            style={styles.backButton}
            hitSlop={12}
          >
            <ArrowLeft color={joyTheme.text} size={22} />
          </Pressable>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 ? (
            <Pressable onPress={handleMarkAllRead} style={styles.markAllBtn} hitSlop={8}>
              <CheckCheck color={joyTheme.primary} size={18} />
            </Pressable>
          ) : (
            <View style={styles.backButton} />
          )}
        </View>

        <TabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          unreadCounts={unreadCounts}
        />

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={notificationsQuery.isRefetching}
              onRefresh={() => void notificationsQuery.refetch()}
              tintColor={joyTheme.primary}
            />
          }
        >
          {notificationsQuery.isLoading && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={joyTheme.primary} size="large" />
            </View>
          )}

          {!notificationsQuery.isLoading && filteredNotifications.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <BellOff color={joyTheme.textMuted} size={40} />
              </View>
              <Text style={styles.emptyTitle}>
                {activeTab === 'all' ? 'No notifications yet' : `No ${activeTab} notifications`}
              </Text>
              <Text style={styles.emptyText}>
                {activeTab === 'all'
                  ? 'When you get updates about events, followers, or rewards, they\'ll appear here.'
                  : `You don't have any ${activeTab} notifications right now.`}
              </Text>
            </View>
          )}

          {filteredNotifications.map((notif) => {
            const { Icon, color, bg } = getNotificationIcon(notif.type);
            return (
              <Pressable
                key={notif.id}
                onPress={() => handleNotifPress(notif)}
                style={({ pressed }) => [
                  styles.notifRow,
                  !notif.read && styles.notifRowUnread,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={[styles.notifIcon, { backgroundColor: bg }]}>
                  <Icon color={color} size={18} />
                </View>
                <View style={styles.notifContent}>
                  <Text style={[styles.notifTitle, !notif.read && styles.notifTitleUnread]}>
                    {notif.title}
                  </Text>
                  <Text style={styles.notifMessage} numberOfLines={2}>
                    {notif.message}
                  </Text>
                  <Text style={styles.notifTime}>{timeAgo(notif.created_at)}</Text>
                  {FEEDBACK_TYPES.has(notif.type?.toLowerCase().trim() ?? '') && (() => {
                    const raw = notif.data ?? {};
                    const d: Record<string, string> = {};
                    for (const [k, v] of Object.entries(raw)) {
                      if (v != null) d[k] = String(v);
                    }
                    const sId = d.signupId ?? d.signup_id;
                    const eId = d.eventId ?? d.event_id ?? d.event;
                    return sId || eId ? (
                      <FeedbackTimerSubtext signupId={sId} eventId={eId} />
                    ) : null;
                  })()}
                </View>
                {!notif.read && <View style={styles.unreadDot} />}
                <ChevronRight color={joyTheme.textMuted} size={16} style={{ marginTop: 4 }} />
              </Pressable>
            );
          })}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={announcementModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setAnnouncementModal((prev) => ({ ...prev, visible: false }))}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setAnnouncementModal((prev) => ({ ...prev, visible: false }))}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalIconWrap}>
              <Megaphone color={joyTheme.primary} size={28} />
            </View>
            <Text style={styles.modalTitle}>{announcementModal.title}</Text>
            {!!announcementModal.orgName && (
              <Text style={styles.modalOrg}>{announcementModal.orgName}</Text>
            )}
            {!!announcementModal.senderName && (
              <Text style={styles.modalSender}>From: {announcementModal.senderName}</Text>
            )}
            <Text style={styles.modalMessage}>{announcementModal.message}</Text>
            {!!announcementModal.timestamp && (
              <Text style={styles.modalTimestamp}>
                {new Date(announcementModal.timestamp).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            )}
            <Pressable
              onPress={() => setAnnouncementModal((prev) => ({ ...prev, visible: false }))}
              style={({ pressed }) => [styles.modalDismissBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.modalDismissText}>Close</Text>
            </Pressable>
          </Pressable>
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
  markAllBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: joyTheme.primarySoft,
  },
  tabBarContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: joyTheme.border,
  },
  tabBarScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: joyTheme.backgroundAlt,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  tabPillActive: {
    backgroundColor: joyTheme.primary,
    borderColor: joyTheme.primary,
  },
  tabPillText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: joyTheme.text,
  },
  tabPillTextActive: {
    color: '#FFFFFF',
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: joyTheme.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabBadgeText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
  },
  tabBadgeTextActive: {
    color: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  loadingWrap: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
    gap: 12,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: joyTheme.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: joyTheme.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginTop: 8,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  notifRowUnread: {
    backgroundColor: '#F5FAFF',
    borderColor: 'rgba(10,132,255,0.15)',
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  notifContent: {
    flex: 1,
    gap: 4,
  },
  notifTitle: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: joyTheme.text,
  },
  notifTitleUnread: {
    fontFamily: fonts.extraBold,
  },
  notifMessage: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: joyTheme.textMuted,
    lineHeight: 20,
  },
  notifTime: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: joyTheme.primary,
    marginTop: 6,
  },
  feedbackTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  feedbackTimerText: {
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  bottomSpacer: {
    height: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: 10,
  },
  modalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
    textAlign: 'center',
  },
  modalOrg: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: joyTheme.primary,
  },
  modalSender: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: joyTheme.textMuted,
  },
  modalMessage: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: joyTheme.text,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 4,
  },
  modalTimestamp: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
    marginTop: 4,
  },
  modalDismissBtn: {
    backgroundColor: joyTheme.primary,
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 12,
    marginTop: 8,
  },
  modalDismissText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
});
