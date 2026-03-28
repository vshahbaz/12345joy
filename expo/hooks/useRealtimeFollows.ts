import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useRealtimeFollows(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    console.log('[RealtimeFollows] Setting up real-time subscriptions for user:', userId);

    const channel = supabase
      .channel('follows-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_follows' },
        (payload) => {
          console.log('[RealtimeFollows] user_follows change detected:', payload.eventType);
          void queryClient.invalidateQueries({ queryKey: ['followers-count'] });
          void queryClient.invalidateQueries({ queryKey: ['following-count'] });
          void queryClient.invalidateQueries({ queryKey: ['followers-list'] });
          void queryClient.invalidateQueries({ queryKey: ['following-list'] });
          void queryClient.invalidateQueries({ queryKey: ['following-ids'] });
          void queryClient.invalidateQueries({ queryKey: ['leaderboard', 'friends'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'organization_follows' },
        (payload) => {
          console.log('[RealtimeFollows] organization_follows change detected:', payload.eventType);
          void queryClient.invalidateQueries({ queryKey: ['org-followers-count'] });
          void queryClient.invalidateQueries({ queryKey: ['following-orgs'] });
          void queryClient.invalidateQueries({ queryKey: ['following-org-ids'] });
          void queryClient.invalidateQueries({ queryKey: ['following-count'] });
        }
      )
      .subscribe((status) => {
        console.log('[RealtimeFollows] Subscription status:', status);
      });

    const friendsChannel = supabase
      .channel('friends-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friends',
          filter: `requester_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[RealtimeFollows] friends change detected (requester):', payload.eventType);
          void queryClient.invalidateQueries({ queryKey: ['friends'] });
          void queryClient.invalidateQueries({ queryKey: ['friend-ids'] });
          void queryClient.invalidateQueries({ queryKey: ['friends-list'] });
          void queryClient.invalidateQueries({ queryKey: ['leaderboard', 'friends'] });
          void queryClient.invalidateQueries({ queryKey: ['followers-list'] });
          void queryClient.invalidateQueries({ queryKey: ['following-list'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friends',
          filter: `addressee_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[RealtimeFollows] friends change detected (addressee):', payload.eventType);
          void queryClient.invalidateQueries({ queryKey: ['friends'] });
          void queryClient.invalidateQueries({ queryKey: ['friend-ids'] });
          void queryClient.invalidateQueries({ queryKey: ['friends-list'] });
          void queryClient.invalidateQueries({ queryKey: ['leaderboard', 'friends'] });
          void queryClient.invalidateQueries({ queryKey: ['followers-list'] });
          void queryClient.invalidateQueries({ queryKey: ['following-list'] });
        }
      )
      .subscribe((status) => {
        console.log('[RealtimeFollows] Friends subscription status:', status);
      });

    return () => {
      console.log('[RealtimeFollows] Cleaning up real-time subscriptions');
      void supabase.removeChannel(channel);
      void supabase.removeChannel(friendsChannel);
    };
  }, [userId, queryClient]);
}
