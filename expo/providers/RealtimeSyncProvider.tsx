import { useEffect, useMemo, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';
import createContextHook from '@nkzw/create-context-hook';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

const FOREGROUND_REFETCH_INTERVAL = 300000;

export const [RealtimeSyncProvider, useRealtimeSync] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { user, adminUser, isAuthenticated, refreshProfile } = useAuth();
  const userId = user?.id ?? adminUser?.id ?? '';
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshProfileRef = useRef(refreshProfile);
  useEffect(() => {
    refreshProfileRef.current = refreshProfile;
  }, [refreshProfile]);

  const invalidateAll = useCallback(() => {
    console.log('[RealtimeSync] Invalidating active queries only');
    void queryClient.invalidateQueries({ refetchType: 'active' });
  }, [queryClient]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[RealtimeSync] App came to foreground, invalidating all queries');
        invalidateAll();
        if (isAuthenticated && refreshProfileRef.current) {
          void refreshProfileRef.current();
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [queryClient, invalidateAll, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    intervalRef.current = setInterval(() => {
      if (appStateRef.current === 'active') {
        console.log('[RealtimeSync] Periodic background refresh');
        invalidateAll();
      }
    }, FOREGROUND_REFETCH_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated, invalidateAll]);

  useEffect(() => {
    if (!isAuthenticated) return;

    console.log('[RealtimeSync] Setting up global realtime subscriptions');

    const eventsChannel = supabase
      .channel('global-events-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'events',
      }, (payload) => {
        console.log('[RealtimeSync] Events table changed:', payload.eventType);
        void queryClient.invalidateQueries({ queryKey: ['all-events'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['upcoming-events'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['org-events'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['org-events-list'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['event'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['user-events'], refetchType: 'active' });
      })
      .subscribe((status) => {
        console.log('[RealtimeSync] Events channel status:', status);
      });

    const signupsChannel = supabase
      .channel('global-signups-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'event_signups',
      }, (payload) => {
        console.log('[RealtimeSync] Event signups changed:', payload.eventType);
        void queryClient.invalidateQueries({ queryKey: ['event-signups'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['event-signup-counts'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['event-signups-count'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['user-events'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['user-signups'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['all-events'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['upcoming-events'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['org-volunteers'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['org-stats'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['org-recent-activity'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['org-events'], refetchType: 'active' });
      })
      .subscribe((status) => {
        console.log('[RealtimeSync] Signups channel status:', status);
      });

    const userSignupsChannel = userId ? supabase
      .channel('user-signups-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'event_signups',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        console.log('[RealtimeSync] User-specific signup changed:', payload.eventType);
        void queryClient.invalidateQueries({ queryKey: ['user-signups'], refetchType: 'all' });
        void queryClient.invalidateQueries({ queryKey: ['user-events'], refetchType: 'all' });
        void queryClient.invalidateQueries({ queryKey: ['event-signups'], refetchType: 'all' });
        void queryClient.invalidateQueries({ queryKey: ['event-signup-counts'], refetchType: 'all' });
        void queryClient.invalidateQueries({ queryKey: ['event-signups-count'], refetchType: 'all' });
        void queryClient.invalidateQueries({ queryKey: ['all-events'], refetchType: 'all' });
        void queryClient.invalidateQueries({ queryKey: ['upcoming-events'], refetchType: 'all' });
      })
      .subscribe((status) => {
        console.log('[RealtimeSync] User signups channel status:', status);
      }) : null;

    const profilesChannel = supabase
      .channel('global-profiles-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'profiles',
      }, (payload) => {
        console.log('[RealtimeSync] Profiles changed:', payload.eventType);
        void queryClient.invalidateQueries({ queryKey: ['leaderboard'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['profile'], refetchType: 'active' });
        if (refreshProfileRef.current) {
          void refreshProfileRef.current();
        }
      })
      .subscribe((status) => {
        console.log('[RealtimeSync] Profiles channel status:', status);
      });

    const followsChannel = supabase
      .channel('global-follows-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_follows',
      }, (payload) => {
        console.log('[RealtimeSync] User follows changed:', payload.eventType);
        void queryClient.invalidateQueries({ queryKey: ['followers-count'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['following-count'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['followers-list'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['following-list'], refetchType: 'active' });
      })
      .subscribe((status) => {
        console.log('[RealtimeSync] Follows channel status:', status);
      });

    const photosChannel = supabase
      .channel('global-photos-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'event_photos',
      }, (payload) => {
        console.log('[RealtimeSync] Event photos changed:', payload.eventType);
        void queryClient.invalidateQueries({ queryKey: ['event-photos'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['event-photo-counts'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['user-photos'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['org-all-photos'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['org-pending-photos'], refetchType: 'active' });
      })
      .subscribe((status) => {
        console.log('[RealtimeSync] Photos channel status:', status);
      });

    const notificationsChannel = supabase
      .channel('user-notifications-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: userId ? `user_id=eq.${userId}` : undefined,
      }, (payload) => {
        console.log('[RealtimeSync] Notifications changed:', payload.eventType);
        void queryClient.invalidateQueries({ queryKey: ['unread-notifications'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['notifications'], refetchType: 'active' });
      })
      .subscribe((status) => {
        console.log('[RealtimeSync] Notifications channel status:', status);
      });

    const redemptionsChannel = supabase
      .channel('global-redemptions-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'redemptions',
      }, (payload) => {
        console.log('[RealtimeSync] Redemptions changed:', payload.eventType);
        void queryClient.invalidateQueries({ queryKey: ['redemptions'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['shop-items'], refetchType: 'active' });
      })
      .subscribe((status) => {
        console.log('[RealtimeSync] Redemptions channel status:', status);
      });

    const shopChannel = supabase
      .channel('global-shop-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'shop_items',
      }, (payload) => {
        console.log('[RealtimeSync] Shop items changed:', payload.eventType);
        void queryClient.invalidateQueries({ queryKey: ['shop-items'], refetchType: 'active' });
      })
      .subscribe((status) => {
        console.log('[RealtimeSync] Shop channel status:', status);
      });

    const orgsChannel = supabase
      .channel('global-orgs-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'organizations',
      }, (payload) => {
        console.log('[RealtimeSync] Organizations changed:', payload.eventType);
        void queryClient.invalidateQueries({ queryKey: ['all-organizations'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['organization'], refetchType: 'active' });
      })
      .subscribe((status) => {
        console.log('[RealtimeSync] Orgs channel status:', status);
      });

    const clientPartnersChannel = supabase
      .channel('global-client-partners-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'client_partners',
      }, (payload) => {
        console.log('[RealtimeSync] Client partners changed:', payload.eventType);
        void queryClient.invalidateQueries({ queryKey: ['client-partners'], refetchType: 'active' });
      })
      .subscribe((status) => {
        console.log('[RealtimeSync] Client partners channel status:', status);
      });

    const clientPartnerPhotosChannel = supabase
      .channel('global-client-partner-photos-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'client_partner_photos',
      }, (payload) => {
        console.log('[RealtimeSync] Client partner photos changed:', payload.eventType);
        void queryClient.invalidateQueries({ queryKey: ['client-partner-photos'], refetchType: 'active' });
      })
      .subscribe((status) => {
        console.log('[RealtimeSync] Client partner photos channel status:', status);
      });

    const challengesChannel = supabase
      .channel('global-challenges-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'challenges',
      }, (payload) => {
        console.log('[RealtimeSync] Challenges changed:', payload.eventType);
        void queryClient.invalidateQueries({ queryKey: ['challenges'], refetchType: 'active' });
      })
      .subscribe((status) => {
        console.log('[RealtimeSync] Challenges channel status:', status);
      });

    // event_documents table does not exist yet - skip realtime subscription
    const eventDocumentsChannel: { unsubscribe: () => void } | null = null;

    const redemptionMessagesChannel = supabase
      .channel('global-redemption-messages-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'redemption_messages',
      }, (payload) => {
        console.log('[RealtimeSync] Redemption messages changed:', payload.eventType);
        void queryClient.invalidateQueries({ queryKey: ['redemption-messages'], refetchType: 'active' });
      })
      .subscribe((status) => {
        console.log('[RealtimeSync] Redemption messages channel status:', status);
      });

    const orgFollowsChannel = supabase
      .channel('global-org-follows-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'organization_follows',
      }, (payload) => {
        console.log('[RealtimeSync] Organization follows changed:', payload.eventType);
        void queryClient.invalidateQueries({ queryKey: ['org-followers-count'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['following-orgs'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['following-org-ids'], refetchType: 'active' });
      })
      .subscribe((status) => {
        console.log('[RealtimeSync] Org follows channel status:', status);
      });

    const orgNewsChannel = supabase
      .channel('global-org-news-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'organization_news',
      }, (payload) => {
        console.log('[RealtimeSync] Organization news changed:', payload.eventType);
        void queryClient.invalidateQueries({ queryKey: ['org-news'], refetchType: 'active' });
      })
      .subscribe((status) => {
        console.log('[RealtimeSync] Org news channel status:', status);
      });

    const volunteerMessagesChannel = supabase
      .channel('global-volunteer-messages-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'volunteer_messages',
      }, (payload) => {
        console.log('[RealtimeSync] Volunteer messages changed:', payload.eventType);
        void queryClient.invalidateQueries({ queryKey: ['messages'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['conversations'], refetchType: 'active' });
      })
      .subscribe((status) => {
        console.log('[RealtimeSync] Volunteer messages channel status:', status);
      });

    const orgVolunteerMessagesChannel = supabase
      .channel('global-org-volunteer-messages-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'org_volunteer_messages',
      }, (payload) => {
        console.log('[RealtimeSync] Org-volunteer messages changed:', payload.eventType);
        void queryClient.invalidateQueries({ queryKey: ['messages'], refetchType: 'active' });
        void queryClient.invalidateQueries({ queryKey: ['conversations'], refetchType: 'active' });
      })
      .subscribe((status) => {
        console.log('[RealtimeSync] Org-volunteer messages channel status:', status);
      });

    const orgVolunteerConversationsChannel = supabase
      .channel('global-org-volunteer-conversations-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'org_volunteer_conversations',
      }, (payload) => {
        console.log('[RealtimeSync] Org-volunteer conversations changed:', payload.eventType);
        void queryClient.invalidateQueries({ queryKey: ['conversations'], refetchType: 'active' });
      })
      .subscribe((status) => {
        console.log('[RealtimeSync] Org-volunteer conversations channel status:', status);
      });

    const volunteerConversationsChannel = supabase
      .channel('global-volunteer-conversations-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'volunteer_conversations',
      }, (payload) => {
        console.log('[RealtimeSync] Volunteer conversations changed:', payload.eventType);
        void queryClient.invalidateQueries({ queryKey: ['conversations'], refetchType: 'active' });
      })
      .subscribe((status) => {
        console.log('[RealtimeSync] Volunteer conversations channel status:', status);
      });

    const volunteerParticipantsChannel = supabase
      .channel('global-volunteer-participants-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'volunteer_conversation_participants',
      }, (payload) => {
        console.log('[RealtimeSync] Volunteer conversation participants changed:', payload.eventType);
        void queryClient.invalidateQueries({ queryKey: ['conversations'], refetchType: 'active' });
      })
      .subscribe((status) => {
        console.log('[RealtimeSync] Volunteer participants channel status:', status);
      });

    const friendsChannel = supabase
      .channel('friends-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friends',
          filter: userId ? `requester_id=eq.${userId}` : undefined,
        },
        (payload) => {
          console.log('[RealtimeSync] Friends table changed (requester):', payload.eventType);
          void queryClient.invalidateQueries({ queryKey: ['friends'], refetchType: 'active' });
          void queryClient.invalidateQueries({ queryKey: ['friend-ids'], refetchType: 'active' });
          void queryClient.invalidateQueries({ queryKey: ['friends-list'], refetchType: 'active' });
          void queryClient.invalidateQueries({ queryKey: ['leaderboard', 'friends'], refetchType: 'active' });
          void queryClient.invalidateQueries({ queryKey: ['followers-list'], refetchType: 'active' });
          void queryClient.invalidateQueries({ queryKey: ['following-list'], refetchType: 'active' });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friends',
          filter: userId ? `addressee_id=eq.${userId}` : undefined,
        },
        (payload) => {
          console.log('[RealtimeSync] Friends table changed (addressee):', payload.eventType);
          void queryClient.invalidateQueries({ queryKey: ['friends'], refetchType: 'active' });
          void queryClient.invalidateQueries({ queryKey: ['friend-ids'], refetchType: 'active' });
          void queryClient.invalidateQueries({ queryKey: ['friends-list'], refetchType: 'active' });
          void queryClient.invalidateQueries({ queryKey: ['leaderboard', 'friends'], refetchType: 'active' });
          void queryClient.invalidateQueries({ queryKey: ['followers-list'], refetchType: 'active' });
          void queryClient.invalidateQueries({ queryKey: ['following-list'], refetchType: 'active' });
        }
      )
      .subscribe((status) => {
        console.log('[RealtimeSync] Friends channel status:', status);
      });

    return () => {
      console.log('[RealtimeSync] Cleaning up global realtime subscriptions');
      void supabase.removeChannel(eventsChannel);
      void supabase.removeChannel(signupsChannel);
      if (userSignupsChannel) void supabase.removeChannel(userSignupsChannel);
      void supabase.removeChannel(profilesChannel);
      void supabase.removeChannel(followsChannel);
      void supabase.removeChannel(photosChannel);
      void supabase.removeChannel(notificationsChannel);
      void supabase.removeChannel(redemptionsChannel);
      void supabase.removeChannel(shopChannel);
      void supabase.removeChannel(orgsChannel);
      void supabase.removeChannel(clientPartnersChannel);
      void supabase.removeChannel(clientPartnerPhotosChannel);
      void supabase.removeChannel(challengesChannel);
      if (eventDocumentsChannel) void supabase.removeChannel(eventDocumentsChannel);
      void supabase.removeChannel(redemptionMessagesChannel);
      void supabase.removeChannel(orgFollowsChannel);
      void supabase.removeChannel(orgNewsChannel);
      void supabase.removeChannel(volunteerMessagesChannel);
      void supabase.removeChannel(volunteerConversationsChannel);
      void supabase.removeChannel(volunteerParticipantsChannel);
      void supabase.removeChannel(orgVolunteerMessagesChannel);
      void supabase.removeChannel(orgVolunteerConversationsChannel);
      void supabase.removeChannel(friendsChannel);
    };
  }, [isAuthenticated, userId, queryClient]);

  return useMemo(() => ({ isSubscribed: isAuthenticated }), [isAuthenticated]);
});
