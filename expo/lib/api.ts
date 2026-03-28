import { supabase } from './supabase';
import type {
  DbEvent, DbProfile, DbClientPartner, DbClientPartnerPhoto,
  DbEventSignup, DbEventPhoto, DbNotification, DbShopItem,
  DbRedemption, DbRedemptionMessage, DbOrganization, DbMessage,
  DbVolunteerConversation, DbVolunteerConversationParticipant,
  ConversationThread, DbOrgVolunteerConversation, DbOrgVolunteerMessage,
  DbBadge, DbUserBadgeWithBadge, DbChallenge, DbChallengePoke,
  DbFriend, DbWishlist, DbDeviceToken, DbTimeLog, DbVolunteerFeedback,
  DbVolunteerRating, DbPostEventReview, DbEventSubmission, DbEventQuestion,
  DbEventQuestionResponse, DbEventLink, DbEventDayOfAgenda,
  DbEventDayOfContact, DbEventDayOfIncident, DbEventDayOfMedia,
  DbEventDayOfMessage, DbEventApprover, DbWaiver, DbUserWaiver,
  DbUserRole, DbDealtJoyVideo, DbLeaderboardProfile,
  DbOrganizationEventPhoto, DbEventPhotoTag,
} from '@/types/database';

function enrichSignup(raw: Record<string, unknown>): DbEventSignup {
  const checkInTime = raw.check_in_time as string | null;
  const checkOutTime = raw.check_out_time as string | null;
  let hoursLogged: number | null = null;
  if (checkInTime && checkOutTime) {
    const diff = new Date(checkOutTime).getTime() - new Date(checkInTime).getTime();
    hoursLogged = Math.round((diff / (1000 * 60 * 60)) * 10) / 10;
  }
  return {
    id: raw.id as string,
    user_id: raw.user_id as string,
    event_id: raw.event_id as string,
    status: raw.status as string,
    signup_time: (raw.signup_time ?? raw.created_at ?? '') as string,
    check_in_time: checkInTime,
    check_out_time: checkOutTime,
    check_in_code: (raw.check_in_code ?? null) as string | null,
    is_lead: (raw.is_lead ?? false) as boolean,
    assigned_station: (raw.assigned_station ?? null) as string | null,
    assigned_role: (raw.assigned_role ?? null) as string | null,
    checked_in: checkInTime != null,
    hours_logged: hoursLogged,
    points_earned: (raw.points_earned ?? null) as number | null,
  };
}

function enrichSignups(rawList: Record<string, unknown>[]): DbEventSignup[] {
  return rawList.map(enrichSignup);
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export async function fetchUpcomingEvents(): Promise<DbEvent[]> {
  console.log('[API] Fetching upcoming events');
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .gte('start_time', now)
    .order('start_time', { ascending: true })
    .limit(20);

  if (error) {
    console.error('[API] Error fetching upcoming events:', error.message, error.code);
    throw new Error(error.message ?? 'Failed to fetch upcoming events');
  }

  console.log('[API] Fetched upcoming events:', data?.length ?? 0);
  return data ?? [];
}

export async function fetchAllEvents(): Promise<DbEvent[]> {
  console.log('[API] Fetching all events');
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('start_time', { ascending: true });

  if (error) {
    console.error('[API] Error fetching all events:', error);
    throw new Error(error.message);
  }

  console.log('[API] Fetched all events:', data?.length ?? 0);
  return data ?? [];
}

export async function fetchPastEventsWithRecaps(): Promise<DbEvent[]> {
  console.log('[API] Fetching past events with recaps');
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .not('recap_published_at', 'is', null)
    .order('start_time', { ascending: false })
    .limit(5);

  if (error) {
    console.error('[API] Error fetching recaps:', error.message, error.code);
    throw new Error(error.message ?? 'Failed to fetch recaps');
  }

  console.log('[API] Fetched recap events:', data?.length ?? 0);
  return data ?? [];
}

export async function fetchLeaderboard(): Promise<DbLeaderboardProfile[]> {
  console.log('[API] Fetching leaderboard from leaderboard_profiles view');
  const { data, error } = await supabase
    .from('leaderboard_profiles')
    .select('id, full_name, username, avatar_url, total_points, total_hours, city, is_verified')
    .order('total_points', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[API] Error fetching leaderboard:', error);
    throw new Error(error.message);
  }

  const normalized = (data ?? []).map((p) => ({
    ...p,
    total_points: p.total_points ?? 0,
  }));

  console.log('[API] Fetched leaderboard:', normalized.length, 'total users');
  return normalized as DbLeaderboardProfile[];
}

export async function fetchChallenges(userId: string): Promise<DbChallenge[]> {
  console.log('[API] Fetching challenges for user:', userId);
  try {
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .or(`challenger_id.eq.${userId},challenged_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[API] Error fetching challenges:', error.message);
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('[API] challenges table does not exist, returning empty array');
        return [];
      }
      return [];
    }

    console.log('[API] Fetched challenges:', data?.length ?? 0);
    return (data ?? []) as DbChallenge[];
  } catch (e) {
    console.error('[API] Exception fetching challenges:', e);
    return [];
  }
}

export async function createChallenge(challengerId: string, challengedId: string, challengeType: string = 'monthly'): Promise<DbChallenge | null> {
  console.log('[API] Creating challenge:', challengerId, '->', challengedId);
  const { data, error } = await supabase
    .from('challenges')
    .insert({
      challenger_id: challengerId,
      challenged_id: challengedId,
      challenge_type: challengeType,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('[API] Error creating challenge:', error);
    return null;
  }
  return data as DbChallenge;
}

export async function updateChallengeStatus(challengeId: string, status: string): Promise<void> {
  console.log('[API] Updating challenge status:', challengeId, status);
  const { error } = await supabase
    .from('challenges')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', challengeId);

  if (error) {
    console.error('[API] Error updating challenge:', error);
    throw new Error(error.message);
  }
}

export async function sendChallengePoke(challengeId: string, senderId: string, receiverId: string, pokeType: string): Promise<DbChallengePoke | null> {
  console.log('[API] Sending challenge poke');
  const { data, error } = await supabase
    .from('challenge_pokes')
    .insert({ challenge_id: challengeId, sender_id: senderId, receiver_id: receiverId, poke_type: pokeType })
    .select()
    .single();

  if (error) {
    console.error('[API] Error sending poke:', error);
    return null;
  }
  return data as DbChallengePoke;
}

export async function fetchClientPartners(): Promise<DbClientPartner[]> {
  console.log('[API] Fetching client partners');
  try {
    const { data, error } = await supabase
      .from('client_partners')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[API] Error fetching partners:', JSON.stringify(error));
      console.error('[API] Partner error details - code:', error.code, 'message:', error.message, 'hint:', error.hint);
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('[API] client_partners table does not exist, returning empty array');
        return [];
      }
      throw new Error(error.message ?? 'Failed to fetch partners');
    }

    console.log('[API] Fetched partners:', data?.length ?? 0);
    if (data && data.length > 0) {
      console.log('[API] First partner image_url:', data[0].image_url);
      console.log('[API] First partner logo_url:', data[0].logo_url);
      console.log('[API] First partner name:', data[0].name);
    }
    return data ?? [];
  } catch (err: unknown) {
    console.error('[API] Unexpected error fetching partners:', err instanceof Error ? err.message : JSON.stringify(err));
    return [];
  }
}

export interface ImpactNumbers {
  totalVolunteers: number;
  totalEvents: number;
  totalHours: number;
}

export async function fetchUserEvents(userId: string): Promise<(DbEventSignup & { events: DbEvent })[]> {
  console.log('[API] Fetching user events for:', userId);
  const { data, error } = await supabase
    .from('event_signups')
    .select('*, events(*)')
    .eq('user_id', userId);

  if (error) {
    console.error('[API] Error fetching user events:', error);
    return [];
  }

  console.log('[API] Fetched user events:', data?.length ?? 0);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...enrichSignup(row),
    events: row.events as DbEvent,
  }));
}

export async function fetchUserPhotos(userId: string): Promise<DbEventPhoto[]> {
  console.log('[API] Fetching user photos for:', userId);
  const { data, error } = await supabase
    .from('event_photos')
    .select('*')
    .eq('uploaded_by', userId)
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[API] Error fetching user photos:', error);
    return [];
  }

  console.log('[API] Fetched user photos:', data?.length ?? 0);
  return (data ?? []) as DbEventPhoto[];
}

export async function fetchUserLeaderboardRank(userId: string): Promise<number | null> {
  console.log('[API] Fetching leaderboard rank for:', userId);
  const { data, error } = await supabase
    .from('profiles')
    .select('id, total_points')
    .gt('total_points', 0)
    .order('total_points', { ascending: false });

  if (error) {
    console.error('[API] Error fetching rank:', error);
    return null;
  }

  const idx = (data ?? []).findIndex((p) => p.id === userId);
  const rank = idx >= 0 ? idx + 1 : null;
  console.log('[API] User rank:', rank);
  return rank;
}

export async function fetchEventPhotos(eventId: string): Promise<DbEventPhoto[]> {
  console.log('[API] Fetching photos for event:', eventId);
  const { data, error } = await supabase
    .from('event_photos')
    .select('*')
    .eq('event_id', eventId)
    .eq('approved', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[API] Error fetching event photos:', error);
    return [];
  }

  console.log('[API] Fetched event photos:', data?.length ?? 0);
  return (data ?? []) as DbEventPhoto[];
}

export async function fetchEventById(eventId: string): Promise<(DbEvent & { organizations?: DbOrganization }) | null> {
  console.log('[API] Fetching event by id:', eventId);
  try {
    const { data, error } = await supabase
      .from('events')
      .select(`
        *, organizations:organization_id (
          id, name, logo_url, description, city, state, website, contact_email, contact_phone, is_verified
        )
      `)
      .eq('id', eventId)
      .single();

    if (!error && data) {
      console.log('[API] Fetched event with org:', data?.title);
      return data as (DbEvent & { organizations?: DbOrganization });
    }

    console.warn('[API] Event join query failed, falling back:', error?.message);
  } catch (err) {
    console.warn('[API] Event join query threw, falling back:', err);
  }

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (error) {
    console.error('[API] Error fetching event:', error);
    return null;
  }

  console.log('[API] Fetched event (fallback):', data?.title);
  return data as DbEvent;
}

export async function fetchEventSignups(eventId: string): Promise<(DbEventSignup & { profiles: DbProfile })[]> {
  console.log('[API] Fetching signups for event:', eventId);

  try {
    const { data, error } = await supabase
      .from('event_signups')
      .select('*, profiles(*)')
      .eq('event_id', eventId);

    if (!error && data) {
      console.log('[API] Fetched event signups with join:', data.length);
      return (data as Record<string, unknown>[]).map((row) => ({
        ...enrichSignup(row),
        profiles: row.profiles as DbProfile,
      }));
    }

    console.warn('[API] Join query failed, falling back to separate queries:', error?.message, error?.code);
  } catch (err) {
    console.warn('[API] Join query threw, falling back:', err);
  }

  const { data: signups, error: signupsError } = await supabase
    .from('event_signups')
    .select('*')
    .eq('event_id', eventId);

  if (signupsError) {
    console.error('[API] Error fetching event signups (fallback):', signupsError.message);
    return [];
  }

  if (!signups || signups.length === 0) {
    console.log('[API] No signups found for event:', eventId);
    return [];
  }

  const userIds = [...new Set(signups.map((s) => s.user_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .in('id', userIds);

  if (profilesError) {
    console.error('[API] Error fetching signup profiles:', profilesError.message);
  }

  const profileMap: Record<string, DbProfile> = {};
  (profiles ?? []).forEach((p: DbProfile) => {
    profileMap[p.id] = p;
  });

  const result = signups.map((signup) => ({
    ...enrichSignup(signup as unknown as Record<string, unknown>),
    profiles: profileMap[signup.user_id] ?? {
      id: signup.user_id,
      full_name: 'Volunteer',
      email: '',
      phone: null,
      city: null,
      interests: null,
      emergency_contact_name: null,
      emergency_contact_phone: null,
      terms_accepted: false,
      total_points: 0,
      total_hours: 0,
      created_at: '',
      updated_at: '',
      redeemed_points: 0,
      username: null,
      avatar_url: null,
      date_of_birth: null,
      has_arrest_record: false,
      arrest_explanation: null,
      liability_waiver_accepted: false,
      liability_waiver_accepted_at: null,
      photo_waiver_accepted: false,
      photo_waiver_accepted_at: null,
      username_changed_at: null,
      is_verified: false,
      verification_requested_at: null,
    },
  })) as (DbEventSignup & { profiles: DbProfile })[];

  console.log('[API] Fetched event signups (fallback):', result.length);
  return result;
}

export async function fetchAllEventPhotos(): Promise<DbEventPhoto[]> {
  console.log('[API] Fetching all event photos');
  const { data, error } = await supabase
    .from('event_photos')
    .select('*')
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[API] Error fetching all event photos:', error);
    return [];
  }

  console.log('[API] Fetched all event photos:', data?.length ?? 0);
  return (data ?? []) as DbEventPhoto[];
}

export async function fetchEventFirstPhotos(): Promise<Record<string, string>> {
  console.log('[API] Fetching first photo for each event');
  const { data, error } = await supabase
    .from('event_photos')
    .select('event_id, photo_url')
    .eq('approved', true)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[API] Error fetching first photos:', error.message, error.code);
    return {};
  }

  const firstPhotos: Record<string, string> = {};
  (data ?? []).forEach((row: { event_id: string; photo_url: string }) => {
    if (!firstPhotos[row.event_id]) {
      firstPhotos[row.event_id] = row.photo_url;
    }
  });

  console.log('[API] First photos for', Object.keys(firstPhotos).length, 'events');
  return firstPhotos;
}

export async function fetchUserEventPhotos(userId: string): Promise<DbEventPhoto[]> {
  console.log('[API] Fetching photos from user attended events:', userId);
  const { data: signups, error: signupError } = await supabase
    .from('event_signups')
    .select('event_id')
    .eq('user_id', userId);

  if (signupError || !signups || signups.length === 0) {
    console.log('[API] No event signups found for user photos');
    return [];
  }

  const eventIds = signups.map((s) => s.event_id);
  const { data, error } = await supabase
    .from('event_photos')
    .select('*')
    .in('event_id', eventIds)
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[API] Error fetching user event photos:', error);
    return [];
  }

  console.log('[API] Fetched user event photos:', data?.length ?? 0);
  return (data ?? []) as DbEventPhoto[];
}

export async function fetchEventPhotoCounts(): Promise<Record<string, number>> {
  console.log('[API] Fetching event photo counts');
  const { data, error } = await supabase
    .from('event_photos')
    .select('event_id')
    .eq('approved', true);

  if (error) {
    console.error('[API] Error fetching photo counts:', error.message, error.code);
    return {};
  }

  const counts: Record<string, number> = {};
  (data ?? []).forEach((row: { event_id: string }) => {
    counts[row.event_id] = (counts[row.event_id] ?? 0) + 1;
  });

  console.log('[API] Photo counts for', Object.keys(counts).length, 'events');
  return counts;
}

export async function fetchEventSignupCounts(): Promise<Record<string, number>> {
  console.log('[API] Fetching event signup counts');
  const { data, error } = await supabase
    .from('event_signups')
    .select('event_id');

  if (error) {
    console.error('[API] Error fetching signup counts:', error);
    return {};
  }

  const counts: Record<string, number> = {};
  (data ?? []).forEach((row: { event_id: string }) => {
    counts[row.event_id] = (counts[row.event_id] ?? 0) + 1;
  });

  console.log('[API] Signup counts for', Object.keys(counts).length, 'events');
  return counts;
}

export async function fetchUserSignups(userId: string): Promise<DbEventSignup[]> {
  console.log('[API] Fetching user signups for:', userId);
  const { data, error } = await supabase
    .from('event_signups')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'confirmed');

  if (error) {
    console.error('[API] Error fetching user signups:', error);
    return [];
  }

  console.log('[API] Fetched user confirmed signups:', data?.length ?? 0);
  return enrichSignups((data ?? []) as Record<string, unknown>[]);
}

export async function signUpForEvent(eventId: string, userId: string): Promise<DbEventSignup> {
  console.log('[API] Signing up for event:', eventId, 'user:', userId);

  try {
    const { data: existing, error: checkError } = await supabase
      .from('event_signups')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    if (checkError) {
      console.error('[API] Error checking existing signup:', checkError.message, checkError.code);
    }

    if (existing) {
      console.log('[API] User already signed up, returning existing signup:', existing.id);
      return existing as DbEventSignup;
    }

    const { data, error } = await supabase
      .from('event_signups')
      .insert({
        event_id: eventId,
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      console.error('[API] Error signing up for event:', error.message, error.code, error.details, error.hint);
      if (error.code === '23505') {
        const { data: dupSignup } = await supabase
          .from('event_signups')
          .select('*')
          .eq('event_id', eventId)
          .eq('user_id', userId)
          .single();
        if (dupSignup) return dupSignup as DbEventSignup;
        throw new Error('You are already signed up for this event.');
      }
      if (error.code === '42501' || error.message?.includes('policy') || error.message?.includes('RLS')) {
        throw new Error('Permission denied. Please sign out and sign back in, then try again.');
      }
      if (error.code === '23503') {
        throw new Error('This event or your account could not be found. Please try again.');
      }
      throw new Error(error.message || 'Failed to sign up for event. Please try again.');
    }

    if (!data) {
      throw new Error('Sign up succeeded but no data returned. Please refresh and check your registration.');
    }

    console.log('[API] Successfully signed up for event:', data.id);
    return data as DbEventSignup;
  } catch (err) {
    if (err instanceof Error) throw err;
    console.error('[API] Unexpected signup error:', err);
    throw new Error('An unexpected error occurred. Please try again.');
  }
}

export async function cancelEventSignup(eventId: string, userId: string): Promise<void> {
  console.log('[API] Cancelling signup for event:', eventId, 'user:', userId);
  const { error } = await supabase
    .from('event_signups')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId);

  if (error) {
    console.error('[API] Error cancelling signup:', error);
    throw new Error(error.message);
  }

  console.log('[API] Successfully cancelled signup');
}

export async function fetchAllPhotosWithEvents(): Promise<(DbEventPhoto & { events?: DbEvent })[]> {
  console.log('[API] Fetching all photos with event info');
  const { data, error } = await supabase
    .from('event_photos')
    .select('*, events(*)')
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[API] Error fetching all photos with events:', error);
    return [];
  }

  console.log('[API] Fetched all photos with events:', data?.length ?? 0);
  return (data ?? []) as (DbEventPhoto & { events?: DbEvent })[];
}

export async function fetchFriendsLeaderboard(userId: string): Promise<DbLeaderboardProfile[]> {
  console.log('[API] Fetching friends leaderboard for:', userId);

  const [followingResult, friendsResult] = await Promise.all([
    supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', userId),
    supabase
      .from('friends')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
  ]);

  const followingIds = (followingResult.data ?? []).map((f) => f.following_id);
  const friendIds = (friendsResult.data ?? []).map((f: { requester_id: string; addressee_id: string }) =>
    f.requester_id === userId ? f.addressee_id : f.requester_id
  );

  const allIds = new Set([...followingIds, ...friendIds, userId]);

  if (allIds.size <= 1) {
    console.log('[API] No friends/following found, returning empty friends leaderboard');
    return [];
  }

  const { data, error } = await supabase
    .from('leaderboard_profiles')
    .select('id, full_name, username, avatar_url, total_points, total_hours, city, is_verified')
    .in('id', Array.from(allIds))
    .order('total_points', { ascending: false });

  if (error) {
    console.error('[API] Error fetching friends leaderboard:', error);
    throw new Error(error.message);
  }

  console.log('[API] Fetched friends leaderboard:', data?.length ?? 0);
  return (data ?? []) as DbLeaderboardProfile[];
}

export async function fetchPartnerById(partnerId: string): Promise<DbClientPartner | null> {
  console.log('[API] Fetching partner by id:', partnerId);
  const { data, error } = await supabase
    .from('client_partners')
    .select('*')
    .eq('id', partnerId)
    .single();

  if (error) {
    console.error('[API] Error fetching partner:', error);
    return null;
  }

  return data as DbClientPartner;
}

export async function fetchClientPartnerPhotos(partnerId: string): Promise<DbClientPartnerPhoto[]> {
  console.log('[API] Fetching photos for client partner:', partnerId);
  try {
    const { data, error } = await supabase
      .from('client_partner_photos')
      .select('*')
      .eq('client_partner_id', partnerId)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[API] Error fetching partner photos:', error.message, error.code);
      if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
        console.warn('[API] client_partner_photos table does not exist or not in schema cache');
        return [];
      }
      return [];
    }

    console.log('[API] Fetched partner photos:', data?.length ?? 0);
    return (data ?? []) as DbClientPartnerPhoto[];
  } catch (err) {
    console.error('[API] Unexpected error fetching partner photos:', err);
    return [];
  }
}

export async function fetchAllClientPartnerPhotos(): Promise<DbClientPartnerPhoto[]> {
  console.log('[API] Fetching all client partner photos');
  try {
    const { data, error } = await supabase
      .from('client_partner_photos')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[API] Error fetching all partner photos:', error.message, error.code);
      if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
        console.warn('[API] client_partner_photos table does not exist or not in schema cache');
        return [];
      }
      return [];
    }

    console.log('[API] Fetched all partner photos:', data?.length ?? 0);
    return (data ?? []) as DbClientPartnerPhoto[];
  } catch (err) {
    console.error('[API] Unexpected error fetching all partner photos:', err);
    return [];
  }
}

export async function fetchImpactBreakdown(): Promise<{
  byEventType: Record<string, number>;
  byCity: Record<string, number>;
  monthlyEvents: { month: string; count: number }[];
  topVolunteers: DbProfile[];
}> {
  console.log('[API] Fetching impact breakdown');

  const [eventsRes, profilesRes] = await Promise.all([
    supabase.from('events').select('*').order('start_time', { ascending: false }),
    supabase.from('profiles').select('*').gt('total_points', 0).order('total_points', { ascending: false }).limit(5),
  ]);

  const events = (eventsRes.data ?? []) as DbEvent[];
  const topVolunteers = (profilesRes.data ?? []) as DbProfile[];

  const byEventType: Record<string, number> = {};
  const byCity: Record<string, number> = {};
  const monthlyMap: Record<string, number> = {};

  events.forEach((event) => {
    const type = event.event_type || 'Other';
    byEventType[type] = (byEventType[type] ?? 0) + 1;

    if (event.city) {
      byCity[event.city] = (byCity[event.city] ?? 0) + 1;
    }

    const month = new Date(event.start_time).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    monthlyMap[month] = (monthlyMap[month] ?? 0) + 1;
  });

  const monthlyEvents = Object.entries(monthlyMap)
    .map(([month, count]) => ({ month, count }))
    .slice(-12);

  return { byEventType, byCity, monthlyEvents, topVolunteers };
}

export async function fetchFollowersCount(userId: string): Promise<number> {
  console.log('[API] Fetching followers count for:', userId);

  const { count, error } = await supabase
    .from('user_follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', userId);

  if (error) {
    console.error('[API] Error fetching followers count:', error.message, error.code, error.details);
    return 0;
  }

  const total = count ?? 0;
  console.log('[API] Followers count:', total);
  return total;
}

export async function fetchFollowingCount(userId: string): Promise<number> {
  console.log('[API] Fetching following count for:', userId);

  const [userFollowsResult, orgFollowsResult] = await Promise.all([
    supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId),
    supabase
      .from('organization_follows')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
  ]);

  if (userFollowsResult.error) {
    console.error('[API] Error fetching user following count:', userFollowsResult.error.message);
  }
  if (orgFollowsResult.error) {
    console.error('[API] Error fetching org following count:', orgFollowsResult.error.message);
  }

  const userCount = userFollowsResult.count ?? 0;
  const orgCount = orgFollowsResult.count ?? 0;
  const total = userCount + orgCount;
  console.log('[API] Following count (users:', userCount, '+ orgs:', orgCount, '= total:', total, ')');
  return total;
}

export async function fetchFollowers(userId: string): Promise<DbProfile[]> {
  console.log('[API] Fetching followers for:', userId);
  const { data, error } = await supabase
    .from('user_follows')
    .select('follower_id')
    .eq('following_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[API] Error fetching followers:', error.message, error.code);
    return [];
  }

  if (!data || data.length === 0) {
    console.log('[API] No followers found');
    return [];
  }

  const followerIds = data.map((row) => row.follower_id);
  console.log('[API] Found follower IDs:', followerIds.length);

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .in('id', followerIds);

  if (profilesError) {
    console.error('[API] Error fetching follower profiles:', profilesError.message);
    return [];
  }

  console.log('[API] Fetched follower profiles:', profiles?.length ?? 0);
  return (profiles ?? []) as DbProfile[];
}

export async function fetchFollowing(userId: string): Promise<DbProfile[]> {
  console.log('[API] Fetching following for:', userId);
  const { data, error } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[API] Error fetching following:', error.message, error.code);
    return [];
  }

  if (!data || data.length === 0) {
    console.log('[API] No following found');
    return [];
  }

  const followingIds = data.map((row) => row.following_id);
  console.log('[API] Found following IDs:', followingIds.length);

  if (followingIds.length === 0) {
    return [];
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .in('id', followingIds);

  if (profilesError) {
    console.error('[API] Error fetching following profiles:', profilesError.message);
    return [];
  }

  console.log('[API] Fetched following profiles:', profiles?.length ?? 0);
  return (profiles ?? []) as DbProfile[];
}

export async function fetchFollowingOrganizations(userId: string): Promise<DbOrganization[]> {
  console.log('[API] Fetching following organizations for:', userId);
  const { data, error } = await supabase
    .from('organization_follows')
    .select('organization_id')
    .eq('user_id', userId);

  if (error || !data || data.length === 0) {
    if (error) console.error('[API] Error fetching following orgs:', error.message);
    return [];
  }

  const orgIds = data.map((r: { organization_id: string }) => r.organization_id);
  console.log('[API] Found', orgIds.length, 'followed org IDs');

  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('*')
    .in('id', orgIds);

  if (orgsError) {
    console.error('[API] Error fetching following organizations:', orgsError.message);
    return [];
  }

  console.log('[API] Found', orgs?.length ?? 0, 'followed organizations');
  return (orgs ?? []) as DbOrganization[];
}

export async function followUser(followerId: string, followingId: string): Promise<void> {
  console.log('[API] Following user:', followingId);
  const { error } = await supabase
    .from('user_follows')
    .insert({ follower_id: followerId, following_id: followingId });

  if (error) {
    console.error('[API] Error following user:', error);
    if (error.code === '23505') return;
    throw new Error(error.message);
  }
  console.log('[API] Successfully followed user');
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  console.log('[API] Unfollowing user:', followingId);
  const { error } = await supabase
    .from('user_follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);

  if (error) {
    console.error('[API] Error unfollowing user:', error);
    throw new Error(error.message);
  }
  console.log('[API] Successfully unfollowed user');
}

export async function fetchNotifications(userId: string): Promise<DbNotification[]> {
  console.log('[API] Fetching notifications for:', userId);
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[API] Error fetching notifications:', error);
    return [];
  }

  console.log('[API] Fetched notifications:', data?.length ?? 0);
  return (data ?? []) as DbNotification[];
}

export async function fetchUnreadNotificationCount(userId: string): Promise<number> {
  console.log('[API] Fetching unread notification count for:', userId);
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) {
    console.error('[API] Error fetching unread count:', error);
    return 0;
  }

  console.log('[API] Unread notifications:', count);
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  console.log('[API] Marking notification as read:', notificationId);
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) {
    console.error('[API] Error marking notification read:', error);
  }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  console.log('[API] Marking all notifications as read for:', userId);
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) {
    console.error('[API] Error marking all read:', error);
  }
}

export async function fetchOrgNotifications(adminUserId: string): Promise<DbNotification[]> {
  console.log('[API] Fetching org notifications for admin:', adminUserId);
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', adminUserId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[API] Error fetching org notifications:', error);
    return [];
  }

  console.log('[API] Fetched org notifications:', data?.length ?? 0);
  return (data ?? []) as DbNotification[];
}

export async function fetchShopItems(): Promise<DbShopItem[]> {
  console.log('[API] Fetching shop items');
  const { data, error } = await supabase
    .from('shop_items')
    .select('*')
    .eq('active', true)
    .order('points_cost', { ascending: true });

  if (error) {
    console.error('[API] Error fetching shop items:', error);
    return [];
  }

  console.log('[API] Fetched shop items:', data?.length ?? 0);
  return (data ?? []) as DbShopItem[];
}

export async function fetchUserRedemptions(userId: string): Promise<DbRedemption[]> {
  console.log('[API] Fetching redemptions for:', userId);
  const { data, error } = await supabase
    .from('redemptions')
    .select('*, shop_items(*)')
    .eq('user_id', userId)
    .order('id', { ascending: false });

  if (error) {
    console.error('[API] Error fetching redemptions:', error);
    return [];
  }

  console.log('[API] Fetched redemptions:', data?.length ?? 0);
  return (data ?? []) as DbRedemption[];
}

export async function redeemShopItem(userId: string, itemId: string, pointsCost: number, notes?: string): Promise<DbRedemption> {
  console.log('[API] Redeeming item:', itemId, 'for user:', userId, 'cost:', pointsCost, 'notes:', notes);

  const { data: currentProfile, error: profileFetchError } = await supabase
    .from('profiles')
    .select('total_points, redeemed_points')
    .eq('id', userId)
    .single();

  if (profileFetchError || !currentProfile) {
    console.error('[API] Error fetching profile for redemption:', profileFetchError);
    throw new Error('Could not verify your points balance. Please try again.');
  }

  const available = (currentProfile.total_points ?? 0) - (currentProfile.redeemed_points ?? 0);
  console.log('[API] Available points:', available, 'Cost:', pointsCost);

  if (available < pointsCost) {
    throw new Error(`Not enough points. You have ${available} but need ${pointsCost}.`);
  }

  const insertPayload: Record<string, unknown> = {
    user_id: userId,
    shop_item_id: itemId,
    points_spent: pointsCost,
    status: 'pending',
  };
  if (notes) {
    insertPayload.notes = notes;
  }

  const { data, error } = await supabase
    .from('redemptions')
    .insert(insertPayload)
    .select('*, shop_items(*)')
    .single();

  if (error) {
    console.error('[API] Error redeeming item:', error);
    throw new Error(error.message || 'Failed to redeem item');
  }

  const newRedeemedPoints = (currentProfile.redeemed_points ?? 0) + pointsCost;
  console.log('[API] Updating redeemed_points to:', newRedeemedPoints);

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ redeemed_points: newRedeemedPoints })
    .eq('id', userId);

  if (updateError) {
    console.error('[API] Error updating redeemed_points:', updateError);
  }

  const { data: shopItem } = await supabase
    .from('shop_items')
    .select('inventory')
    .eq('id', itemId)
    .single();

  if (shopItem && shopItem.inventory !== null && shopItem.inventory > 0) {
    const newInventory = shopItem.inventory - 1;
    console.log('[API] Updating shop item inventory to:', newInventory);
    await supabase
      .from('shop_items')
      .update({ inventory: newInventory })
      .eq('id', itemId);
  }

  console.log('[API] Successfully redeemed item:', data?.id);
  return data as DbRedemption;
}

export async function fetchRedemptionMessages(redemptionId: string): Promise<DbRedemptionMessage[]> {
  console.log('[API] Fetching redemption messages for:', redemptionId);
  try {
    const { data, error } = await supabase
      .from('redemption_messages')
      .select('*')
      .eq('redemption_id', redemptionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[API] Error fetching redemption messages:', error);
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('[API] redemption_messages table does not exist');
        return [];
      }
      return [];
    }

    console.log('[API] Fetched redemption messages:', data?.length ?? 0);
    return (data ?? []) as DbRedemptionMessage[];
  } catch (err) {
    console.error('[API] Unexpected error fetching redemption messages:', err);
    return [];
  }
}

export async function sendRedemptionMessage(
  redemptionId: string,
  senderId: string,
  message: string,
  senderType: 'user' | 'admin' = 'user'
): Promise<DbRedemptionMessage | null> {
  console.log('[API] Sending redemption message for:', redemptionId);
  try {
    const { data, error } = await supabase
      .from('redemption_messages')
      .insert({
        redemption_id: redemptionId,
        sender_id: senderId,
        sender_type: senderType,
        message,
      })
      .select()
      .single();

    if (error) {
      console.error('[API] Error sending redemption message:', error);
      const errorMsg = error.message ?? '';
      const isTableMissing =
        error.code === '42P01' ||
        errorMsg.includes('does not exist') ||
        errorMsg.includes('relation') ||
        errorMsg.includes('permission denied') ||
        errorMsg.includes('not found');
      if (isTableMissing) {
        console.warn('[API] redemption_messages table issue:', errorMsg);
        return null;
      }
      return null;
    }

    console.log('[API] Sent redemption message:', data?.id);
    return data as DbRedemptionMessage;
  } catch (err) {
    console.error('[API] Unexpected error sending redemption message:', err);
    return null;
  }
}

export async function searchUsers(query: string): Promise<DbProfile[]> {
  console.log('[API] Searching users with query:', query);
  if (!query || query.trim().length < 2) return [];

  const searchTerm = `%${query.trim()}%`;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`full_name.ilike.${searchTerm},username.ilike.${searchTerm},email.ilike.${searchTerm}`)
    .order('total_points', { ascending: false })
    .limit(30);

  if (error) {
    console.error('[API] Error searching users:', error);
    return [];
  }

  console.log('[API] Search results:', data?.length ?? 0);
  return (data ?? []) as DbProfile[];
}

export async function fetchAllOrganizations(): Promise<DbOrganization[]> {
  console.log('[API] Fetching all organizations');
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('[API] Error fetching all organizations:', error);
    return [];
  }

  console.log('[API] Fetched all organizations:', data?.length ?? 0);
  return (data ?? []) as DbOrganization[];
}

export async function searchOrganizations(query: string): Promise<DbOrganization[]> {
  console.log('[API] Searching organizations with query:', query);
  if (!query || query.trim().length < 2) return [];

  const searchTerm = `%${query.trim()}%`;

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .or(`name.ilike.${searchTerm},city.ilike.${searchTerm}`)
    .order('name', { ascending: true })
    .limit(30);

  if (error) {
    console.error('[API] Error searching organizations:', JSON.stringify(error));
    return [];
  }

  console.log('[API] Organization search results:', data?.length ?? 0);
  return (data ?? []) as DbOrganization[];
}

export async function fetchOrganizationsByIds(orgIds: string[]): Promise<Record<string, DbOrganization>> {
  console.log('[API] Fetching organizations by IDs:', orgIds.length);
  if (orgIds.length === 0) return {};

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .in('id', orgIds);

  if (error) {
    console.error('[API] Error fetching organizations by IDs:', error);
    return {};
  }

  const map: Record<string, DbOrganization> = {};
  (data ?? []).forEach((org: DbOrganization) => {
    map[org.id] = org;
  });

  console.log('[API] Fetched organizations map:', Object.keys(map).length);
  return map;
}

export async function fetchOrganizationById(orgId: string): Promise<DbOrganization | null> {
  console.log('[API] Fetching organization by id:', orgId);
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .single();

  if (error) {
    console.error('[API] Error fetching organization:', error);
    return null;
  }

  return data as DbOrganization;
}

export async function fetchOrganizationEventsByOrgId(orgId: string): Promise<DbEvent[]> {
  console.log('[API] Fetching events for org id:', orgId);
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('organization_id', orgId)
    .order('start_time', { ascending: false });

  if (error) {
    console.error('[API] Error fetching org events by id:', error);
    return [];
  }

  console.log('[API] Fetched org events:', data?.length ?? 0);
  return (data ?? []) as DbEvent[];
}

export async function fetchOrganizationStatsByOrgId(orgId: string): Promise<{
  totalEvents: number;
  totalVolunteers: number;
  totalPhotos: number;
  upcomingEvents: number;
}> {
  console.log('[API] Fetching org stats for org id:', orgId);
  const now = new Date().toISOString();

  const [eventsRes, upcomingRes] = await Promise.all([
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).gte('start_time', now),
  ]);

  const { data: eventIds } = await supabase
    .from('events')
    .select('id')
    .eq('organization_id', orgId);

  let totalVolunteers = 0;
  let totalPhotos = 0;

  if (eventIds && eventIds.length > 0) {
    const ids = eventIds.map((e) => e.id);
    const [signupsRes, photosRes] = await Promise.all([
      supabase.from('event_signups').select('user_id').in('event_id', ids),
      supabase.from('event_photos').select('id', { count: 'exact', head: true }).in('event_id', ids).eq('approved', true),
    ]);
    const uniqueVolunteerIds = new Set((signupsRes.data ?? []).map((s: { user_id: string }) => s.user_id));
    totalVolunteers = uniqueVolunteerIds.size;
    totalPhotos = photosRes.count ?? 0;
  }

  console.log('[API] Org stats - events:', eventsRes.count, 'unique volunteers:', totalVolunteers, 'photos:', totalPhotos);
  return {
    totalEvents: eventsRes.count ?? 0,
    totalVolunteers,
    totalPhotos,
    upcomingEvents: upcomingRes.count ?? 0,
  };
}

export async function followOrganization(followerId: string, orgId: string): Promise<void> {
  console.log('[API] Following organization:', orgId);
  const { error } = await supabase
    .from('organization_follows')
    .insert({ user_id: followerId, organization_id: orgId });

  if (error) {
    if (error.code === '23505') return;
    console.error('[API] Error following organization:', error);
    throw new Error(error.message);
  }
  console.log('[API] Successfully followed organization');
}

export async function unfollowOrganization(followerId: string, orgId: string): Promise<void> {
  console.log('[API] Unfollowing organization:', orgId);
  const { error } = await supabase
    .from('organization_follows')
    .delete()
    .eq('user_id', followerId)
    .eq('organization_id', orgId);

  if (error) {
    console.error('[API] Error unfollowing organization:', error);
    throw new Error(error.message);
  }
  console.log('[API] Successfully unfollowed organization');
}

export async function fetchOrgFollowersCount(orgId: string): Promise<number> {
  console.log('[API] Fetching org followers count for:', orgId);
  const { count, error } = await supabase
    .from('organization_follows')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId);

  if (error) {
    console.error('[API] Error fetching org followers count:', error);
    return 0;
  }
  return count ?? 0;
}

export async function fetchFollowingIds(userId: string): Promise<string[]> {
  console.log('[API] Fetching following IDs for:', userId);
  const { data, error } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', userId);

  if (error) {
    console.error('[API] Error fetching following IDs:', error);
    return [];
  }

  return (data ?? []).map((r) => r.following_id);
}

export async function fetchFollowingOrgIds(userId: string): Promise<string[]> {
  console.log('[API] Fetching following org IDs for:', userId);
  const { data, error } = await supabase
    .from('organization_follows')
    .select('organization_id')
    .eq('user_id', userId);

  if (error) {
    console.error('[API] Error fetching following org IDs:', error);
    return [];
  }

  return (data ?? []).map((r: { organization_id: string }) => r.organization_id);
}

export async function updateProfile(userId: string, updates: Partial<Pick<DbProfile, 'full_name' | 'phone' | 'city' | 'interests' | 'username' | 'avatar_url'>>): Promise<DbProfile> {
  console.log('[API] Updating profile for:', userId);
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('[API] Error updating profile:', error);
    throw new Error(error.message);
  }

  console.log('[API] Profile updated successfully');
  return data as DbProfile;
}

export async function updateOrganization(orgId: string, updates: Partial<Pick<DbOrganization, 'name' | 'description' | 'website' | 'contact_phone' | 'city' | 'state' | 'contact_email' | 'logo_url' | 'banner_url'>>): Promise<DbOrganization> {
  console.log('[API] Updating organization:', orgId);
  const { data, error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', orgId)
    .select()
    .single();

  if (error) {
    console.error('[API] Error updating organization:', error);
    throw new Error(error.message);
  }

  console.log('[API] Organization updated successfully');
  return data as DbOrganization;
}

export async function fetchProfileById(userId: string): Promise<DbProfile | null> {
  console.log('[API] Fetching profile by id:', userId);
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!error && data) {
    return data as DbProfile;
  }

  console.log('[API] profiles table returned error, falling back to leaderboard_profiles:', error?.message);
  const { data: lbData, error: lbError } = await supabase
    .from('leaderboard_profiles')
    .select('id, full_name, username, avatar_url, total_points, total_hours, city, is_verified')
    .eq('id', userId)
    .single();

  if (lbError) {
    console.error('[API] Error fetching profile from leaderboard_profiles:', lbError.message);
    return null;
  }

  return (lbData ?? null) as DbProfile | null;
}

export async function fetchOrganizationEvents(orgUserId: string): Promise<DbEvent[]> {
  console.log('[API] Fetching events for organization user:', orgUserId);

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', orgUserId)
    .single();

  if (!org) {
    console.log('[API] No organization found for user');
    return [];
  }

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('organization_id', org.id)
    .order('start_time', { ascending: false });

  if (error) {
    console.error('[API] Error fetching org events:', error);
    return [];
  }

  console.log('[API] Fetched org events:', data?.length ?? 0);
  return (data ?? []) as DbEvent[];
}

export async function fetchOrganizationStats(orgUserId: string): Promise<{
  totalEvents: number;
  totalVolunteers: number;
  totalPhotos: number;
  upcomingEvents: number;
}> {
  console.log('[API] Fetching org stats for:', orgUserId);

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', orgUserId)
    .single();

  if (!org) return { totalEvents: 0, totalVolunteers: 0, totalPhotos: 0, upcomingEvents: 0 };

  const now = new Date().toISOString();

  const [eventsRes, upcomingRes] = await Promise.all([
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('organization_id', org.id),
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).gte('start_time', now),
  ]);

  const { data: eventIds } = await supabase
    .from('events')
    .select('id')
    .eq('organization_id', org.id);

  let totalVolunteers = 0;
  let totalPhotos = 0;

  if (eventIds && eventIds.length > 0) {
    const ids = eventIds.map((e) => e.id);
    const [signupsRes, photosRes] = await Promise.all([
      supabase.from('event_signups').select('user_id').in('event_id', ids),
      supabase.from('event_photos').select('id', { count: 'exact', head: true }).in('event_id', ids).eq('approved', true),
    ]);
    const uniqueVolunteerIds = new Set((signupsRes.data ?? []).map((s: { user_id: string }) => s.user_id));
    totalVolunteers = uniqueVolunteerIds.size;
    totalPhotos = photosRes.count ?? 0;
  }

  console.log('[API] Org stats (legacy) - events:', eventsRes.count, 'unique volunteers:', totalVolunteers, 'photos:', totalPhotos);
  return {
    totalEvents: eventsRes.count ?? 0,
    totalVolunteers,
    totalPhotos,
    upcomingEvents: upcomingRes.count ?? 0,
  };
}

export async function createEvent(eventData: {
  title: string;
  description?: string;
  event_type: string;
  location?: string;
  venue?: string;
  address?: string;
  city?: string;
  state?: string;
  start_time: string;
  end_time: string;
  capacity?: number;
  min_age?: number;
  skills_needed?: string;
  waiver_required?: boolean;
  photo_release_required?: boolean;
  image_url?: string;
  organization_id?: string;
  created_by?: string;
}, adminSessionToken?: string | null): Promise<DbEvent> {
  console.log('[API] Creating event:', eventData.title, 'admin:', !!adminSessionToken);

  if (adminSessionToken) {
    console.log('[API] Using admin-events Edge Function to create event');
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/admin-events`;
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'x-admin-token': adminSessionToken,
      },
      body: JSON.stringify({
        action: 'create',
        event: eventData,
      }),
    });

    const responseText = await response.text();
    console.log('[API] Admin-events response status:', response.status);

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      console.error('[API] Failed to parse admin-events response:', responseText.substring(0, 200));
      throw new Error('Invalid response from server. Please try again.');
    }

    if (!response.ok) {
      const errorMsg = (result.error as string) ?? (result.message as string) ?? 'Failed to create event';
      console.error('[API] Admin-events error:', errorMsg);
      throw new Error(errorMsg);
    }

    const eventResult = (result.event ?? result.data ?? result) as DbEvent;
    console.log('[API] Event created via Edge Function:', eventResult?.id);
    return eventResult;
  }

  const { data, error } = await supabase
    .from('events')
    .insert(eventData)
    .select()
    .single();

  if (error) {
    console.error('[API] Error creating event:', error);
    throw new Error(error.message);
  }

  console.log('[API] Event created:', data?.id);
  return data as DbEvent;
}

export async function uploadEventPhoto(eventId: string, userId: string, photoUrl: string, caption?: string): Promise<DbEventPhoto> {
  console.log('[API] Uploading event photo for event:', eventId);
  const { data, error } = await supabase
    .from('event_photos')
    .insert({
      event_id: eventId,
      uploaded_by: userId,
      photo_url: photoUrl,
      caption: caption ?? null,
      approved: false,
    })
    .select()
    .single();

  if (error) {
    console.error('[API] Error uploading photo:', error);
    throw new Error(error.message);
  }

  console.log('[API] Photo uploaded:', data?.id);
  return data as DbEventPhoto;
}

export async function uploadPhotoToStorage(
  bucket: string,
  filePath: string,
  fileUri: string,
  contentType: string = 'image/jpeg'
): Promise<string> {
  console.log('[API] Uploading file to storage:', bucket, filePath, 'from URI:', fileUri.substring(0, 80));

  try {
    const response = await fetch(fileUri);
    console.log('[API] Fetch response status:', response.status, 'ok:', response.ok);
    if (!response.ok) {
      throw new Error(`Failed to read file: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log('[API] ArrayBuffer size:', arrayBuffer.byteLength, 'bytes');

    if (arrayBuffer.byteLength === 0) {
      throw new Error('File is empty (0 bytes). Please try selecting the photo again.');
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, arrayBuffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.error('[API] Storage upload error:', JSON.stringify(error));
      throw new Error(error.message ?? 'Failed to upload photo');
    }

    console.log('[API] Upload successful, path:', data.path);
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    console.log('[API] File uploaded, public URL:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (err) {
    console.error('[API] uploadPhotoToStorage error:', err instanceof Error ? err.message : err);
    throw err;
  }
}

export async function resetPassword(email: string): Promise<void> {
  console.log('[API] Sending password reset for:', email);
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) {
    console.error('[API] Error sending reset email:', error);
    throw new Error(error.message);
  }
  console.log('[API] Password reset email sent');
}

export async function fetchUserEventsCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('event_signups')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) return 0;
  return count ?? 0;
}

export async function fetchUserTotalPhotos(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('event_photos')
    .select('*', { count: 'exact', head: true })
    .eq('uploaded_by', userId)
    .eq('approved', true);
  if (error) return 0;
  return count ?? 0;
}

export async function fetchOrgPendingPhotos(orgId: string): Promise<DbEventPhoto[]> {
  console.log('[API] Fetching pending photos for org:', orgId);
  const { data: eventIds } = await supabase
    .from('events')
    .select('id')
    .eq('organization_id', orgId);

  if (!eventIds || eventIds.length === 0) return [];

  const ids = eventIds.map((e) => e.id);
  const { data, error } = await supabase
    .from('event_photos')
    .select('*')
    .in('event_id', ids)
    .eq('approved', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[API] Error fetching pending photos:', error);
    return [];
  }

  console.log('[API] Fetched pending photos:', data?.length ?? 0);
  return (data ?? []) as DbEventPhoto[];
}

export async function approveEventPhoto(photoId: string): Promise<void> {
  console.log('[API] Approving photo:', photoId);
  const { error } = await supabase
    .from('event_photos')
    .update({ approved: true })
    .eq('id', photoId);

  if (error) {
    console.error('[API] Error approving photo:', error);
    throw new Error(error.message);
  }
  console.log('[API] Photo approved');
}

export async function rejectEventPhoto(photoId: string): Promise<void> {
  console.log('[API] Rejecting (deleting) photo:', photoId);
  const { error } = await supabase
    .from('event_photos')
    .delete()
    .eq('id', photoId);

  if (error) {
    console.error('[API] Error rejecting photo:', error);
    throw new Error(error.message);
  }
  console.log('[API] Photo rejected');
}

export async function replaceEventPhoto(photoId: string, newPhotoUrl: string): Promise<DbEventPhoto> {
  console.log('[API] Replacing photo:', photoId, 'with new URL');
  const { data, error } = await supabase
    .from('event_photos')
    .update({ photo_url: newPhotoUrl })
    .eq('id', photoId)
    .select()
    .single();

  if (error) {
    console.error('[API] Error replacing photo:', error);
    throw new Error(error.message);
  }

  console.log('[API] Photo replaced successfully:', data?.id);
  return data as DbEventPhoto;
}

export async function checkInVolunteer(signupId: string): Promise<void> {
  console.log('[API] Checking in volunteer:', signupId);
  const { error } = await supabase
    .from('event_signups')
    .update({ check_in_time: new Date().toISOString(), status: 'checked_in' })
    .eq('id', signupId);

  if (error) {
    console.error('[API] Error checking in:', error);
    throw new Error(error.message);
  }
  console.log('[API] Volunteer checked in');
}

export async function uncheckInVolunteer(signupId: string): Promise<void> {
  console.log('[API] Unchecking volunteer:', signupId);
  const { error } = await supabase
    .from('event_signups')
    .update({ check_in_time: null, check_out_time: null, status: 'confirmed' })
    .eq('id', signupId);

  if (error) {
    console.error('[API] Error unchecking:', error);
    throw new Error(error.message);
  }
  console.log('[API] Volunteer unchecked');
}

export async function logVolunteerHours(signupId: string, hours: number): Promise<void> {
  console.log('[API] Logging hours for signup:', signupId, hours);
  const { data: signup, error: fetchErr } = await supabase
    .from('event_signups')
    .select('user_id, event_id')
    .eq('id', signupId)
    .single();

  if (fetchErr || !signup) {
    console.error('[API] Error fetching signup for hours:', fetchErr);
    throw new Error(fetchErr?.message ?? 'Signup not found');
  }

  const { error } = await supabase
    .from('time_logs')
    .upsert({
      user_id: signup.user_id,
      event_id: signup.event_id,
      hours,
      status: 'approved',
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'user_id,event_id' });

  if (error) {
    console.error('[API] Error logging hours to time_logs:', error);
    const { error: profileErr } = await supabase
      .from('time_logs')
      .insert({
        user_id: signup.user_id,
        event_id: signup.event_id,
        hours,
        status: 'approved',
      });
    if (profileErr) {
      console.error('[API] Fallback insert also failed:', profileErr);
      throw new Error(profileErr.message);
    }
  }
  console.log('[API] Hours logged to time_logs');
}

export async function awardVolunteerPoints(signupId: string, points: number, userId: string): Promise<void> {
  console.log('[API] Awarding points:', signupId, points, 'to user:', userId);

  const { data: signup } = await supabase
    .from('event_signups')
    .select('event_id')
    .eq('id', signupId)
    .single();

  if (signup) {
    const { error: reviewErr } = await supabase
      .from('post_event_reviews')
      .upsert({
        signup_id: signupId,
        event_id: signup.event_id,
        volunteer_id: userId,
        attendance_status: 'attended',
        joy_points_awarded: points,
      }, { onConflict: 'signup_id' });

    if (reviewErr) {
      console.warn('[API] Could not insert post_event_review:', reviewErr.message);
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('total_points')
    .eq('id', userId)
    .single();

  if (profile) {
    const newTotal = (profile.total_points ?? 0) + points;
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ total_points: newTotal })
      .eq('id', userId);

    if (updateErr) {
      console.error('[API] Error updating profile points:', updateErr);
      throw new Error(updateErr.message);
    }
  }

  console.log('[API] Points awarded');
}

export async function fetchOrgRedemptions(orgId: string): Promise<DbRedemption[]> {
  console.log('[API] Fetching redemptions for org:', orgId);
  const { data, error } = await supabase
    .from('redemptions')
    .select('*, shop_items(*), profiles:user_id(id, full_name, email, avatar_url)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[API] Error fetching org redemptions:', error);
    return [];
  }

  console.log('[API] Fetched org redemptions:', data?.length ?? 0);
  return (data ?? []) as DbRedemption[];
}

export async function updateRedemptionStatus(redemptionId: string, status: string): Promise<void> {
  console.log('[API] Updating redemption status:', redemptionId, status);
  const { error } = await supabase
    .from('redemptions')
    .update({ status })
    .eq('id', redemptionId);

  if (error) {
    console.error('[API] Error updating redemption:', error);
    throw new Error(error.message);
  }
  console.log('[API] Redemption status updated');
}

export async function updateEvent(
  eventId: string,
  updates: Partial<Omit<DbEvent, 'id' | 'created_at' | 'updated_at'>>,
  adminSessionToken?: string | null
): Promise<DbEvent> {
  console.log('[API] Updating event:', eventId, 'admin:', !!adminSessionToken);

  if (adminSessionToken) {
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/admin-events`;
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'x-admin-token': adminSessionToken,
      },
      body: JSON.stringify({
        action: 'update',
        event_id: eventId,
        event: updates,
      }),
    });

    const responseText = await response.text();
    let result: Record<string, unknown>;
    try {
      result = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      throw new Error('Invalid response from server.');
    }

    if (!response.ok) {
      throw new Error((result.error as string) ?? 'Failed to update event');
    }

    return (result.event ?? result.data ?? result) as DbEvent;
  }

  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', eventId)
    .select()
    .single();

  if (error) {
    console.error('[API] Error updating event:', error);
    throw new Error(error.message);
  }

  return data as DbEvent;
}

export async function deleteEvent(eventId: string, adminSessionToken?: string | null): Promise<void> {
  console.log('[API] Deleting event:', eventId);

  if (adminSessionToken) {
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/admin-events`;
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'x-admin-token': adminSessionToken,
      },
      body: JSON.stringify({
        action: 'delete',
        event_id: eventId,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      let msg = 'Failed to delete event';
      try { const r = JSON.parse(text); msg = (r as Record<string, string>).error ?? msg; } catch {}
      throw new Error(msg);
    }
    return;
  }

  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);

  if (error) throw new Error(error.message);
}

export async function fetchOrgAllPhotos(orgId: string): Promise<DbEventPhoto[]> {
  console.log('[API] Fetching all photos for org:', orgId);
  const { data: eventIds } = await supabase
    .from('events')
    .select('id')
    .eq('organization_id', orgId);

  if (!eventIds || eventIds.length === 0) return [];

  const ids = eventIds.map((e) => e.id);
  const { data, error } = await supabase
    .from('event_photos')
    .select('*')
    .in('event_id', ids)
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[API] Error fetching org photos:', error);
    return [];
  }

  return (data ?? []) as DbEventPhoto[];
}

export async function fetchOrgUploadedPhotos(orgId: string, _uploaderId?: string): Promise<DbEventPhoto[]> {
  console.log('[API] Fetching all org-uploaded photos for org:', orgId);
  const { data: eventIds } = await supabase
    .from('events')
    .select('id')
    .eq('organization_id', orgId);

  if (!eventIds || eventIds.length === 0) return [];

  const ids = eventIds.map((e) => e.id);
  const { data, error } = await supabase
    .from('event_photos')
    .select('*')
    .in('event_id', ids)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('[API] Error fetching org-uploaded photos:', error);
    return [];
  }

  console.log('[API] Fetched org-uploaded photos:', data?.length ?? 0);
  return (data ?? []) as DbEventPhoto[];
}

export async function fetchOrgEventsList(orgId: string): Promise<DbEvent[]> {
  if (!orgId) {
    console.warn('[API] fetchOrgEventsList called with empty orgId');
    return [];
  }
  console.log('[API] Fetching events list for org:', orgId);
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('organization_id', orgId)
    .order('start_time', { ascending: false });

  if (error) {
    console.error('[API] Error fetching org events list:', error?.message ?? JSON.stringify(error));
    return [];
  }

  return (data ?? []) as DbEvent[];
}

export async function fetchOrgRecentActivity(orgId: string): Promise<{
  recentSignups: (DbEventSignup & { profiles: DbProfile; events: DbEvent })[];
  recentPhotos: DbEventPhoto[];
}> {
  console.log('[API] Fetching org recent activity:', orgId);

  const { data: eventIds } = await supabase
    .from('events')
    .select('id')
    .eq('organization_id', orgId);

  if (!eventIds || eventIds.length === 0) {
    return { recentSignups: [], recentPhotos: [] };
  }

  const ids = eventIds.map((e) => e.id);

  const [signupsRes, photosRes] = await Promise.all([
    supabase
      .from('event_signups')
      .select('*, profiles:user_id(*), events:event_id(*)')
      .in('event_id', ids)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('event_photos')
      .select('*')
      .in('event_id', ids)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  return {
    recentSignups: (signupsRes.data ?? []) as (DbEventSignup & { profiles: DbProfile; events: DbEvent })[],
    recentPhotos: (photosRes.data ?? []) as DbEventPhoto[],
  };
}

export async function fetchOrgVolunteers(orgId: string): Promise<DbProfile[]> {
  console.log('[API] Fetching all volunteers for org:', orgId);
  const { data: eventIds } = await supabase
    .from('events')
    .select('id')
    .eq('organization_id', orgId);

  if (!eventIds || eventIds.length === 0) return [];

  const ids = eventIds.map((e) => e.id);
  const { data: signups, error } = await supabase
    .from('event_signups')
    .select('user_id')
    .in('event_id', ids);

  if (error) {
    console.error('[API] Error fetching org volunteers:', error.message ?? JSON.stringify(error));
    return [];
  }

  const uniqueUserIds = [...new Set((signups ?? []).map((s: Record<string, unknown>) => s.user_id as string))];
  if (uniqueUserIds.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .in('id', uniqueUserIds);

  if (profilesError) {
    console.error('[API] Error fetching volunteer profiles:', profilesError);
    return [];
  }

  console.log('[API] Fetched unique org volunteers:', (profiles ?? []).length);
  return (profiles ?? []) as DbProfile[];
}

export async function fetchOrgEventVolunteers(eventId: string): Promise<DbProfile[]> {
  console.log('[API] Fetching volunteers for event:', eventId);
  const { data: signups, error } = await supabase
    .from('event_signups')
    .select('user_id')
    .eq('event_id', eventId);

  if (error || !signups || signups.length === 0) {
    console.log('[API] No signups found for event:', eventId);
    return [];
  }

  const userIds = [...new Set(signups.map((s) => s.user_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .in('id', userIds);

  if (profilesError) {
    console.error('[API] Error fetching event volunteer profiles:', profilesError);
    return [];
  }

  return (profiles ?? []) as DbProfile[];
}

export async function sendAnnouncement(
  orgId: string,
  orgName: string,
  eventIds: string[],
  title: string,
  message: string
): Promise<{ sent: number; failed: number }> {
  console.log('[API] Sending announcement to events:', eventIds.length, 'title:', title);

  const allSignups = await Promise.all(
    eventIds.map(async (eventId) => {
      const { data } = await supabase
        .from('event_signups')
        .select('user_id')
        .eq('event_id', eventId);
      return (data ?? []).map((s) => s.user_id);
    })
  );

  const uniqueUserIds = [...new Set(allSignups.flat())];
  console.log('[API] Unique recipients:', uniqueUserIds.length);

  if (uniqueUserIds.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const notifications = uniqueUserIds.map((userId) => ({
    user_id: userId,
    type: 'announcement',
    title,
    message,
    read: false,
    data: { organization_id: orgId, organization_name: orgName },
  }));

  const batchSize = 50;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < notifications.length; i += batchSize) {
    const batch = notifications.slice(i, i + batchSize);
    const { error } = await supabase
      .from('notifications')
      .insert(batch);

    if (error) {
      console.error('[API] Error sending announcement batch:', error);
      failed += batch.length;
    } else {
      sent += batch.length;
    }
  }

  console.log('[API] Announcement sent:', sent, 'failed:', failed);
  return { sent, failed };
}

export async function fetchAnnouncementHistory(orgId: string): Promise<DbNotification[]> {
  console.log('[API] Fetching announcement history for org:', orgId);
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('type', 'announcement')
    .eq('data->>organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[API] Error fetching announcement history:', error);
    return [];
  }

  const seen = new Set<string>();
  const unique: DbNotification[] = [];
  for (const n of (data ?? []) as DbNotification[]) {
    const key = `${n.title}|${n.message}|${n.created_at.slice(0, 16)}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(n);
    }
  }

  console.log('[API] Fetched unique announcements:', unique.length);
  return unique;
}

export interface OrgNewsArticle {
  id: string;
  organization_id: string;
  title: string;
  url: string;
  source: string | null;
  published_at: string | null;
  created_at: string;
}

export async function fetchOrgNewsArticles(orgId: string): Promise<OrgNewsArticle[]> {
  console.log('[API] Fetching news articles for org:', orgId);
  try {
    const { data, error } = await supabase
      .from('organization_news')
      .select('*')
      .eq('organization_id', orgId)
      .order('published_at', { ascending: false })
      .limit(20);

    if (error) {
      console.log('[API] News articles table may not exist or error:', error.message);
      return [];
    }

    console.log('[API] Fetched news articles:', data?.length ?? 0);
    return (data ?? []) as OrgNewsArticle[];
  } catch (e) {
    console.log('[API] News articles fetch failed (table may not exist):', e);
    return [];
  }
}



export async function fetchTodayEvents(orgId: string): Promise<DbEvent[]> {
  console.log('[API] Fetching today events for org:', orgId);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('organization_id', orgId)
    .gte('start_time', startOfDay)
    .lt('start_time', endOfDay)
    .order('start_time', { ascending: true });

  if (error) {
    console.error('[API] Error fetching today events:', error);
    return [];
  }

  console.log('[API] Fetched today events:', data?.length ?? 0);
  return (data ?? []) as DbEvent[];
}

export async function findOrCreateConversation(userId: string, otherPartyId: string): Promise<string | null> {
  console.log('[API] Finding or creating conversation between', userId, 'and', otherPartyId);
  try {
    const { data: myConvos, error: myError } = await supabase
      .from('volunteer_conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId);

    if (myError) {
      console.error('[API] Error fetching my conversations:', myError.message);
      return null;
    }

    const myConvoIds = (myConvos ?? []).map((c: { conversation_id: string }) => c.conversation_id);

    if (myConvoIds.length > 0) {
      const { data: sharedConvos, error: sharedError } = await supabase
        .from('volunteer_conversation_participants')
        .select('conversation_id')
        .eq('user_id', otherPartyId)
        .in('conversation_id', myConvoIds);

      if (sharedError) {
        console.error('[API] Error finding shared conversations:', sharedError.message);
      } else if (sharedConvos && sharedConvos.length > 0) {
        for (const sc of sharedConvos) {
          const { data: convo } = await supabase
            .from('volunteer_conversations')
            .select('id, is_group')
            .eq('id', sc.conversation_id)
            .eq('is_group', false)
            .single();
          if (convo) {
            console.log('[API] Found existing 1:1 conversation:', convo.id);
            return convo.id;
          }
        }
      }
    }

    const { data: newConvo, error: createError } = await supabase
      .from('volunteer_conversations')
      .insert({ is_group: false, created_by: userId })
      .select()
      .single();

    if (createError || !newConvo) {
      console.error('[API] Error creating conversation:', createError?.message);
      return null;
    }

    console.log('[API] Created new conversation:', newConvo.id);

    const { error: partError } = await supabase
      .from('volunteer_conversation_participants')
      .insert([
        { conversation_id: newConvo.id, user_id: userId },
        { conversation_id: newConvo.id, user_id: otherPartyId },
      ]);

    if (partError) {
      console.error('[API] Error adding participants:', partError.message);
    }

    return newConvo.id;
  } catch (err) {
    console.error('[API] Exception in findOrCreateConversation:', err);
    return null;
  }
}

export async function fetchMessages(userId: string, otherPartyId: string, conversationType: string = 'volunteer', conversationId?: string): Promise<DbMessage[]> {
  console.log('[API] Fetching messages between', userId, 'and', otherPartyId, 'type:', conversationType);
  try {
    if (conversationType === 'org_volunteer') {
      return await fetchOrgVolunteerMessages(conversationId ?? '', userId);
    }

    const convoId = conversationId ?? await findOrCreateConversation(userId, otherPartyId);
    if (!convoId) {
      console.warn('[API] No conversation found/created');
      return [];
    }

    const { data, error } = await supabase
      .from('volunteer_messages')
      .select('*')
      .eq('conversation_id', convoId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[API] Error fetching messages:', error.message, error.code);
      return [];
    }

    console.log('[API] Fetched messages:', data?.length ?? 0);
    return (data ?? []) as DbMessage[];
  } catch (err) {
    console.error('[API] Exception fetching messages:', err);
    return [];
  }
}

async function fetchOrgVolunteerMessages(conversationId: string, _userId: string): Promise<DbMessage[]> {
  console.log('[API] Fetching org-volunteer messages for conversation:', conversationId);
  if (!conversationId) {
    console.warn('[API] No org-volunteer conversation ID provided');
    return [];
  }

  const { data, error } = await supabase
    .from('org_volunteer_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[API] Error fetching org-vol messages:', error.message, error.code);
    return [];
  }

  const messages: DbMessage[] = (data ?? []).map((m: DbOrgVolunteerMessage) => ({
    id: m.id,
    conversation_id: m.conversation_id,
    sender_id: m.sender_id,
    content: m.content,
    message_type: 'text',
    shared_event_id: null,
    shared_photo_url: null,
    created_at: m.created_at,
  }));

  console.log('[API] Fetched org-vol messages:', messages.length);
  return messages;
}

export async function sendMessage(
  senderId: string,
  receiverId: string,
  content: string,
  senderType: 'user' | 'organization' = 'user',
  _receiverType: 'user' | 'organization' = 'user',
  conversationType: string = 'volunteer',
  conversationId?: string
): Promise<DbMessage | null> {
  console.log('[API] Sending message from', senderId, 'to', receiverId, 'type:', conversationType);
  try {
    if (conversationType === 'org_volunteer' && conversationId) {
      return await sendOrgVolunteerMessage(conversationId, senderId, senderType === 'organization' ? 'organization' : 'volunteer', content);
    }

    const convoId = conversationId ?? await findOrCreateConversation(senderId, receiverId);
    if (!convoId) {
      console.error('[API] Could not find or create conversation');
      return null;
    }

    const { data, error } = await supabase
      .from('volunteer_messages')
      .insert({
        conversation_id: convoId,
        sender_id: senderId,
        content,
        message_type: 'text',
      })
      .select()
      .single();

    if (error) {
      console.error('[API] Error sending message:', error.message, error.code);
      return null;
    }

    await supabase
      .from('volunteer_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', convoId);

    console.log('[API] Message sent:', data?.id);
    return data as DbMessage;
  } catch (err) {
    console.error('[API] Exception sending message:', err);
    return null;
  }
}

async function sendOrgVolunteerMessage(
  conversationId: string,
  senderId: string,
  senderType: string,
  content: string
): Promise<DbMessage | null> {
  console.log('[API] Sending org-volunteer message in conversation:', conversationId);
  const { data, error } = await supabase
    .from('org_volunteer_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      sender_type: senderType,
      content,
    })
    .select()
    .single();

  if (error) {
    console.error('[API] Error sending org-vol message:', error.message, error.code);
    return null;
  }

  await supabase
    .from('org_volunteer_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  console.log('[API] Org-vol message sent:', data?.id);
  return {
    id: data.id,
    conversation_id: data.conversation_id,
    sender_id: data.sender_id,
    content: data.content,
    message_type: 'text',
    shared_event_id: null,
    shared_photo_url: null,
    created_at: data.created_at,
  };
}

export async function markMessagesRead(userId: string, otherPartyId: string, conversationType: string = 'volunteer', conversationId?: string): Promise<void> {
  console.log('[API] Marking messages read for', userId, 'type:', conversationType);
  try {
    if (conversationType === 'org_volunteer' && conversationId) {
      const { error } = await supabase
        .from('org_volunteer_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      if (error) {
        console.error('[API] Error marking org-vol messages read:', error.message);
      }
      return;
    }

    const convoId = conversationId ?? await findOrCreateConversation(userId, otherPartyId);
    if (!convoId) return;

    const { error } = await supabase
      .from('volunteer_conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', convoId)
      .eq('user_id', userId);

    if (error) {
      console.error('[API] Error marking messages read:', error.message);
    }
  } catch (err) {
    console.error('[API] Exception marking messages read:', err);
  }
}

export async function findOrCreateOrgVolunteerConversation(
  organizationId: string,
  volunteerId: string
): Promise<string | null> {
  console.log('[API] Finding or creating org-volunteer conversation:', organizationId, volunteerId);
  try {
    const { data: existing, error: findError } = await supabase
      .from('org_volunteer_conversations')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('volunteer_id', volunteerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) {
      console.error('[API] Error finding org-vol conversation:', findError.message);
      return null;
    }

    if (existing) {
      console.log('[API] Found existing org-vol conversation:', existing.id);
      return existing.id;
    }

    const { data: newConvo, error: createError } = await supabase
      .from('org_volunteer_conversations')
      .insert({
        organization_id: organizationId,
        volunteer_id: volunteerId,
      })
      .select()
      .single();

    if (createError || !newConvo) {
      console.error('[API] Error creating org-vol conversation:', createError?.message);
      return null;
    }

    console.log('[API] Created new org-vol conversation:', newConvo.id);
    return newConvo.id;
  } catch (err) {
    console.error('[API] Exception in findOrCreateOrgVolunteerConversation:', err);
    return null;
  }
}

export async function fetchConversations(userId: string): Promise<ConversationThread[]> {
  console.log('[API] Fetching conversations for:', userId);
  try {
    const { data: participantData, error: participantError } = await supabase
      .from('volunteer_conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', userId);

    if (participantError) {
      console.error('[API] Error fetching participant conversations:', participantError.message, participantError.code);
      return [];
    }

    const myParticipations = participantData ?? [];
    if (myParticipations.length === 0) {
      console.log('[API] User has no conversations');
      return [];
    }

    const convoIds = myParticipations.map((p: { conversation_id: string }) => p.conversation_id);
    const lastReadMap = new Map<string, string>(
      myParticipations.map((p: { conversation_id: string; last_read_at: string }) => [p.conversation_id, p.last_read_at])
    );

    const [convoRes, allParticipantsRes, messagesRes] = await Promise.all([
      supabase.from('volunteer_conversations').select('*').in('id', convoIds),
      supabase.from('volunteer_conversation_participants').select('*').in('conversation_id', convoIds).neq('user_id', userId),
      supabase.from('volunteer_messages').select('*').in('conversation_id', convoIds).order('created_at', { ascending: false }),
    ]);

    if (convoRes.error) {
      console.error('[API] Error fetching conversations:', convoRes.error.message);
      return [];
    }
    if (messagesRes.error) {
      console.error('[API] Error fetching messages:', messagesRes.error.message);
      return [];
    }

    const conversations = (convoRes.data ?? []) as DbVolunteerConversation[];
    const otherParticipants = (allParticipantsRes.data ?? []) as DbVolunteerConversationParticipant[];
    const allMessages = (messagesRes.data ?? []) as DbMessage[];

    const otherPartyByConvo = new Map<string, string>();
    for (const p of otherParticipants) {
      if (!otherPartyByConvo.has(p.conversation_id)) {
        otherPartyByConvo.set(p.conversation_id, p.user_id);
      }
    }

    const otherPartyIds = [...new Set(otherParticipants.map((p) => p.user_id))];
    if (otherPartyIds.length === 0) return [];

    const [profilesRes, orgsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, avatar_url').in('id', otherPartyIds),
      supabase.from('organizations').select('id, name, logo_url').in('id', otherPartyIds),
    ]);

    const profileMap = new Map<string, { name: string; avatar: string | null }>(
      (profilesRes.data ?? []).map((p: { id: string; full_name: string | null; avatar_url: string | null }) => [
        p.id,
        { name: p.full_name ?? 'User', avatar: p.avatar_url },
      ])
    );
    const orgMap = new Map<string, { name: string; avatar: string | null }>(
      (orgsRes.data ?? []).map((o: { id: string; name: string; logo_url: string | null }) => [
        o.id,
        { name: o.name ?? 'Organization', avatar: o.logo_url },
      ])
    );

    const messagesByConvo = new Map<string, DbMessage[]>();
    for (const msg of allMessages) {
      if (!messagesByConvo.has(msg.conversation_id)) {
        messagesByConvo.set(msg.conversation_id, []);
      }
      messagesByConvo.get(msg.conversation_id)!.push(msg);
    }

    const threads: ConversationThread[] = [];
    for (const convo of conversations) {
      const otherPartyId = otherPartyByConvo.get(convo.id);
      if (!otherPartyId) continue;

      const convoMessages = messagesByConvo.get(convo.id) ?? [];
      if (convoMessages.length === 0) continue;

      const lastMsg = convoMessages[0];
      const lastReadAt = lastReadMap.get(convo.id) ?? '1970-01-01T00:00:00Z';
      const unreadCount = convoMessages.filter(
        (m) => m.sender_id !== userId && new Date(m.created_at) > new Date(lastReadAt)
      ).length;

      const isOrg = orgMap.has(otherPartyId);
      const info = profileMap.get(otherPartyId) ?? orgMap.get(otherPartyId);

      threads.push({
        id: convo.id,
        otherPartyId,
        otherPartyName: convo.name ?? info?.name ?? 'Unknown',
        otherPartyAvatar: info?.avatar ?? null,
        otherPartyType: isOrg ? 'organization' : 'user',
        lastMessage: lastMsg.content,
        lastMessageAt: lastMsg.created_at,
        unreadCount,
        conversationType: 'volunteer',
      });
    }

    const orgVolThreads = await fetchOrgVolunteerConversationThreads(userId);
    const allThreads = [...threads, ...orgVolThreads];

    allThreads.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    console.log('[API] Fetched conversation threads:', allThreads.length, '(volunteer:', threads.length, ', org-vol:', orgVolThreads.length, ')');
    return allThreads;
  } catch (err) {
    console.error('[API] Exception fetching conversations:', err);
    return [];
  }
}

async function fetchOrgVolunteerConversationThreads(userId: string): Promise<ConversationThread[]> {
  console.log('[API] Fetching org-volunteer conversations for:', userId);
  try {
    const { data: volConvos, error: volError } = await supabase
      .from('org_volunteer_conversations')
      .select('*')
      .eq('volunteer_id', userId);

    const { data: orgConvos, error: orgError } = await supabase
      .from('org_volunteer_conversations')
      .select('*')
      .eq('organization_id', userId);

    if (volError) console.error('[API] Error fetching vol org conversations:', volError.message);
    if (orgError) console.error('[API] Error fetching org org conversations:', orgError.message);

    const allOrgVolConvos = [
      ...((volConvos ?? []) as DbOrgVolunteerConversation[]),
      ...((orgConvos ?? []) as DbOrgVolunteerConversation[]),
    ];

    const uniqueConvos = allOrgVolConvos.filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);

    if (uniqueConvos.length === 0) return [];

    const convoIds = uniqueConvos.map((c) => c.id);
    const { data: messagesData, error: messagesError } = await supabase
      .from('org_volunteer_messages')
      .select('*')
      .in('conversation_id', convoIds)
      .order('created_at', { ascending: false });

    if (messagesError) {
      console.error('[API] Error fetching org-vol messages:', messagesError.message);
      return [];
    }

    const allMessages = (messagesData ?? []) as DbOrgVolunteerMessage[];
    const messagesByConvo = new Map<string, DbOrgVolunteerMessage[]>();
    for (const msg of allMessages) {
      if (!messagesByConvo.has(msg.conversation_id)) {
        messagesByConvo.set(msg.conversation_id, []);
      }
      messagesByConvo.get(msg.conversation_id)!.push(msg);
    }

    const orgIds = [...new Set(uniqueConvos.map((c) => c.organization_id))];
    const volIds = [...new Set(uniqueConvos.map((c) => c.volunteer_id))];

    const [orgsRes, profilesRes] = await Promise.all([
      supabase.from('organizations').select('id, name, logo_url').in('id', orgIds),
      supabase.from('profiles').select('id, full_name, avatar_url').in('id', volIds),
    ]);

    const orgMap = new Map<string, { name: string; avatar: string | null }>(
      (orgsRes.data ?? []).map((o: { id: string; name: string; logo_url: string | null }) => [
        o.id,
        { name: o.name ?? 'Organization', avatar: o.logo_url },
      ])
    );
    const profileMap = new Map<string, { name: string; avatar: string | null }>(
      (profilesRes.data ?? []).map((p: { id: string; full_name: string | null; avatar_url: string | null }) => [
        p.id,
        { name: p.full_name ?? 'Volunteer', avatar: p.avatar_url },
      ])
    );

    const threads: ConversationThread[] = [];
    for (const convo of uniqueConvos) {
      const convoMessages = messagesByConvo.get(convo.id) ?? [];
      if (convoMessages.length === 0) continue;

      const lastMsg = convoMessages[0];
      const isVolunteer = convo.volunteer_id === userId;
      const otherPartyId = isVolunteer ? convo.organization_id : convo.volunteer_id;
      const otherPartyType = isVolunteer ? 'organization' as const : 'user' as const;
      const info = isVolunteer ? orgMap.get(otherPartyId) : profileMap.get(otherPartyId);

      const unreadCount = convoMessages.filter(
        (m) => m.sender_id !== userId && new Date(m.created_at) > new Date(convo.updated_at)
      ).length;

      threads.push({
        id: convo.id,
        otherPartyId,
        otherPartyName: info?.name ?? 'Unknown',
        otherPartyAvatar: info?.avatar ?? null,
        otherPartyType,
        lastMessage: lastMsg.content,
        lastMessageAt: lastMsg.created_at,
        unreadCount,
        conversationType: 'org_volunteer',
      });
    }

    console.log('[API] Fetched org-volunteer threads:', threads.length);
    return threads;
  } catch (err) {
    console.error('[API] Exception fetching org-volunteer conversations:', err);
    return [];
  }
}

export async function fetchBadges(): Promise<DbBadge[]> {
  console.log('[API] Fetching badges');
  const { data, error } = await supabase
    .from('badges')
    .select('*')
    .order('points_required', { ascending: true });

  if (error) {
    console.error('[API] Error fetching badges:', error);
    return [];
  }
  return (data ?? []) as DbBadge[];
}

export async function fetchUserBadges(userId: string): Promise<DbUserBadgeWithBadge[]> {
  console.log('[API] Fetching user badges for:', userId);
  const { data, error } = await supabase
    .from('user_badges')
    .select('*, badges(*)')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false });

  if (error) {
    console.error('[API] Error fetching user badges:', error);
    return [];
  }
  return (data ?? []) as DbUserBadgeWithBadge[];
}

export async function fetchFriends(userId: string): Promise<DbFriend[]> {
  console.log('[API] Fetching friends for:', userId);
  const { data, error } = await supabase
    .from('friends')
    .select('*')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[API] Error fetching friends:', error);
    return [];
  }
  console.log('[API] Fetched accepted friends:', (data ?? []).length);
  return (data ?? []) as DbFriend[];
}

export async function fetchAcceptedFriendIds(userId: string): Promise<string[]> {
  console.log('[API] Fetching accepted friend IDs for:', userId);
  const { data, error } = await supabase
    .from('friends')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  if (error) {
    console.error('[API] Error fetching friend IDs:', error);
    return [];
  }

  const friendIds = (data ?? []).map((f: { requester_id: string; addressee_id: string }) =>
    f.requester_id === userId ? f.addressee_id : f.requester_id
  );
  console.log('[API] Fetched accepted friend IDs:', friendIds.length);
  return friendIds;
}

export async function fetchFriendProfiles(userId: string): Promise<DbProfile[]> {
  console.log('[API] Fetching friend profiles for:', userId);
  const friendIds = await fetchAcceptedFriendIds(userId);
  if (friendIds.length === 0) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('id', friendIds)
    .order('full_name', { ascending: true });

  if (error) {
    console.error('[API] Error fetching friend profiles:', error);
    return [];
  }
  console.log('[API] Fetched friend profiles:', (data ?? []).length);
  return (data ?? []) as DbProfile[];
}

export async function sendFriendRequest(requesterId: string, addresseeId: string): Promise<DbFriend | null> {
  console.log('[API] Sending friend request:', requesterId, '->', addresseeId);
  const { data, error } = await supabase
    .from('friends')
    .insert({ requester_id: requesterId, addressee_id: addresseeId, status: 'pending' })
    .select()
    .single();

  if (error) {
    console.error('[API] Error sending friend request:', error);
    if (error.code === '23505') return null;
    throw new Error(error.message);
  }
  return data as DbFriend;
}

export async function respondToFriendRequest(friendId: string, status: 'accepted' | 'rejected'): Promise<void> {
  console.log('[API] Responding to friend request:', friendId, status);
  const { error } = await supabase
    .from('friends')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', friendId);

  if (error) {
    console.error('[API] Error responding to friend request:', error);
    throw new Error(error.message);
  }
}

export async function removeFriend(friendId: string): Promise<void> {
  console.log('[API] Removing friend:', friendId);
  const { error } = await supabase
    .from('friends')
    .delete()
    .eq('id', friendId);

  if (error) {
    console.error('[API] Error removing friend:', error);
    throw new Error(error.message);
  }
}

export async function fetchWishlist(userId: string): Promise<(DbWishlist & { shop_items: DbShopItem })[]> {
  console.log('[API] Fetching wishlist for:', userId);
  const { data, error } = await supabase
    .from('wishlist')
    .select('*, shop_items(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[API] Error fetching wishlist:', error);
    return [];
  }
  return (data ?? []) as (DbWishlist & { shop_items: DbShopItem })[];
}

export async function addToWishlist(userId: string, shopItemId: string): Promise<DbWishlist | null> {
  console.log('[API] Adding to wishlist:', shopItemId);
  const { data, error } = await supabase
    .from('wishlist')
    .insert({ user_id: userId, shop_item_id: shopItemId })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return null;
    console.error('[API] Error adding to wishlist:', error);
    throw new Error(error.message);
  }
  return data as DbWishlist;
}

export async function removeFromWishlist(userId: string, shopItemId: string): Promise<void> {
  console.log('[API] Removing from wishlist:', shopItemId);
  const { error } = await supabase
    .from('wishlist')
    .delete()
    .eq('user_id', userId)
    .eq('shop_item_id', shopItemId);

  if (error) {
    console.error('[API] Error removing from wishlist:', error);
    throw new Error(error.message);
  }
}

export async function registerDeviceToken(userId: string, token: string, platform: string, deviceId?: string): Promise<DbDeviceToken | null> {
  console.log('[API] Registering device token for:', userId, 'platform:', platform);
  const { data, error } = await supabase
    .from('device_tokens')
    .upsert({
      user_id: userId,
      token,
      platform,
      device_id: deviceId ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,token' })
    .select()
    .single();

  if (error) {
    console.error('[API] Error registering device token:', error);
    const { data: insertData, error: insertErr } = await supabase
      .from('device_tokens')
      .insert({ user_id: userId, token, platform, device_id: deviceId ?? null })
      .select()
      .single();
    if (insertErr) {
      console.error('[API] Fallback insert device token failed:', insertErr);
      return null;
    }
    return insertData as DbDeviceToken;
  }
  return data as DbDeviceToken;
}

export async function removeDeviceToken(userId: string, token: string): Promise<void> {
  console.log('[API] Removing device token for:', userId);
  const { error } = await supabase
    .from('device_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('token', token);

  if (error) {
    console.error('[API] Error removing device token:', error);
  }
}

export async function fetchTimeLogs(userId: string): Promise<DbTimeLog[]> {
  console.log('[API] Fetching time logs for:', userId);
  const { data, error } = await supabase
    .from('time_logs')
    .select('*')
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false });

  if (error) {
    console.error('[API] Error fetching time logs:', error);
    return [];
  }
  return (data ?? []) as DbTimeLog[];
}

export async function fetchEventTimeLogs(eventId: string): Promise<DbTimeLog[]> {
  console.log('[API] Fetching time logs for event:', eventId);
  const { data, error } = await supabase
    .from('time_logs')
    .select('*')
    .eq('event_id', eventId)
    .order('submitted_at', { ascending: false });

  if (error) {
    console.error('[API] Error fetching event time logs:', error);
    return [];
  }
  return (data ?? []) as DbTimeLog[];
}

export async function submitTimeLog(userId: string, eventId: string, hours: number, notes?: string): Promise<DbTimeLog | null> {
  console.log('[API] Submitting time log:', userId, eventId, hours);
  const { data, error } = await supabase
    .from('time_logs')
    .insert({
      user_id: userId,
      event_id: eventId,
      hours,
      notes: notes ?? null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('[API] Error submitting time log:', error);
    throw new Error(error.message);
  }
  return data as DbTimeLog;
}

export async function fetchVolunteerFeedback(userId: string): Promise<DbVolunteerFeedback[]> {
  console.log('[API] Fetching volunteer feedback for:', userId);
  const { data, error } = await supabase
    .from('volunteer_feedback')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[API] Error fetching volunteer feedback:', error);
    return [];
  }
  return (data ?? []) as DbVolunteerFeedback[];
}

export async function submitVolunteerFeedback(feedback: {
  user_id: string;
  event_id: string;
  signup_id: string;
  did_attend?: boolean;
  lead_name?: string;
  received_clear_instructions?: boolean;
  instructions_feedback?: string;
  experience_feedback?: string;
  volunteer_likelihood_rating?: number;
  joy_spread_rating?: number;
}): Promise<DbVolunteerFeedback | null> {
  console.log('[API] Submitting volunteer feedback for event:', feedback.event_id);
  const { data, error } = await supabase
    .from('volunteer_feedback')
    .insert(feedback)
    .select()
    .single();

  if (error) {
    console.error('[API] Error submitting feedback:', error);
    throw new Error(error.message);
  }
  return data as DbVolunteerFeedback;
}

export async function checkFeedbackExistsForSignup(signupId: string): Promise<boolean> {
  console.log('[API] Checking if feedback exists for signup:', signupId);
  const { data, error } = await supabase
    .from('volunteer_feedback')
    .select('id')
    .eq('signup_id', signupId)
    .maybeSingle();

  if (error) {
    console.error('[API] Error checking feedback existence:', error);
    return false;
  }
  console.log('[API] Feedback exists:', !!data);
  return !!data;
}

export async function fetchVolunteerRatings(volunteerId: string): Promise<DbVolunteerRating[]> {
  console.log('[API] Fetching volunteer ratings for:', volunteerId);
  const { data, error } = await supabase
    .from('volunteer_ratings')
    .select('*')
    .eq('volunteer_id', volunteerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[API] Error fetching volunteer ratings:', error);
    return [];
  }
  return (data ?? []) as DbVolunteerRating[];
}

export async function fetchPostEventReviews(volunteerId: string): Promise<DbPostEventReview[]> {
  console.log('[API] Fetching post event reviews for:', volunteerId);
  const { data, error } = await supabase
    .from('post_event_reviews')
    .select('*')
    .eq('volunteer_id', volunteerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[API] Error fetching post event reviews:', error);
    return [];
  }
  return (data ?? []) as DbPostEventReview[];
}

export async function fetchEventSubmissions(userId: string): Promise<DbEventSubmission[]> {
  console.log('[API] Fetching event submissions for:', userId);
  const { data, error } = await supabase
    .from('event_submissions')
    .select('*')
    .eq('submitted_by', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[API] Error fetching event submissions:', error);
    return [];
  }
  return (data ?? []) as DbEventSubmission[];
}

export async function submitEventProposal(submission: {
  submitted_by: string;
  title: string;
  description?: string;
  proposed_date?: string;
  proposed_end_date?: string;
  city?: string;
  state?: string;
  venue?: string;
  address?: string;
  capacity?: number;
  signup_mode?: string;
  suggested_approver_name?: string;
  suggested_approver_email?: string;
  notes?: string;
}): Promise<DbEventSubmission | null> {
  console.log('[API] Submitting event proposal:', submission.title);
  const { data, error } = await supabase
    .from('event_submissions')
    .insert({ ...submission, status: 'pending' })
    .select()
    .single();

  if (error) {
    console.error('[API] Error submitting event proposal:', error);
    throw new Error(error.message);
  }
  return data as DbEventSubmission;
}

export async function fetchEventQuestions(eventId: string): Promise<DbEventQuestion[]> {
  console.log('[API] Fetching event questions for:', eventId);
  const { data, error } = await supabase
    .from('event_questions')
    .select('*')
    .or(`event_id.eq.${eventId},is_generic.eq.true`)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[API] Error fetching event questions:', error);
    return [];
  }
  return (data ?? []) as DbEventQuestion[];
}

export async function submitQuestionResponse(signupId: string, questionId: string, responseText?: string, responseBoolean?: boolean): Promise<DbEventQuestionResponse | null> {
  console.log('[API] Submitting question response for signup:', signupId);
  const { data, error } = await supabase
    .from('event_question_responses')
    .insert({
      signup_id: signupId,
      question_id: questionId,
      response_text: responseText ?? null,
      response_boolean: responseBoolean ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('[API] Error submitting question response:', error);
    return null;
  }
  return data as DbEventQuestionResponse;
}

export async function fetchEventLinks(eventId: string): Promise<DbEventLink[]> {
  console.log('[API] Fetching event links for:', eventId);
  const { data, error } = await supabase
    .from('event_links')
    .select('*')
    .eq('event_id', eventId)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[API] Error fetching event links:', error);
    return [];
  }
  return (data ?? []) as DbEventLink[];
}

export async function fetchEventDayOfAgenda(eventId: string): Promise<DbEventDayOfAgenda[]> {
  console.log('[API] Fetching day-of agenda for:', eventId);
  const { data, error } = await supabase
    .from('event_day_of_agenda')
    .select('*')
    .eq('event_id', eventId)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[API] Error fetching day-of agenda:', error);
    return [];
  }
  return (data ?? []) as DbEventDayOfAgenda[];
}

export async function fetchEventDayOfContacts(eventId: string): Promise<DbEventDayOfContact[]> {
  console.log('[API] Fetching day-of contacts for:', eventId);
  const { data, error } = await supabase
    .from('event_day_of_contacts')
    .select('*')
    .eq('event_id', eventId)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[API] Error fetching day-of contacts:', error);
    return [];
  }
  return (data ?? []) as DbEventDayOfContact[];
}

export async function fetchEventDayOfIncidents(eventId: string): Promise<DbEventDayOfIncident[]> {
  console.log('[API] Fetching day-of incidents for:', eventId);
  const { data, error } = await supabase
    .from('event_day_of_incidents')
    .select('*')
    .eq('event_id', eventId)
    .order('occurred_at', { ascending: false });

  if (error) {
    console.error('[API] Error fetching day-of incidents:', error);
    return [];
  }
  return (data ?? []) as DbEventDayOfIncident[];
}

export async function reportDayOfIncident(incident: {
  event_id: string;
  reported_by: string;
  incident_type: string;
  severity?: string;
  description: string;
  involved_parties?: string;
  witnesses?: string;
  photo_url?: string;
  follow_up_actions?: string;
}): Promise<DbEventDayOfIncident | null> {
  console.log('[API] Reporting day-of incident');
  const { data, error } = await supabase
    .from('event_day_of_incidents')
    .insert({ ...incident, status: 'reported', severity: incident.severity ?? 'low' })
    .select()
    .single();

  if (error) {
    console.error('[API] Error reporting incident:', error);
    throw new Error(error.message);
  }
  return data as DbEventDayOfIncident;
}

export async function fetchEventDayOfMedia(eventId: string): Promise<DbEventDayOfMedia[]> {
  console.log('[API] Fetching day-of media for:', eventId);
  const { data, error } = await supabase
    .from('event_day_of_media')
    .select('*')
    .eq('event_id', eventId)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[API] Error fetching day-of media:', error);
    return [];
  }
  return (data ?? []) as DbEventDayOfMedia[];
}

export async function fetchEventDayOfMessages(eventId: string): Promise<DbEventDayOfMessage[]> {
  console.log('[API] Fetching day-of messages for:', eventId);
  const { data, error } = await supabase
    .from('event_day_of_messages')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[API] Error fetching day-of messages:', error);
    return [];
  }
  return (data ?? []) as DbEventDayOfMessage[];
}

export async function sendDayOfMessage(msg: {
  event_id: string;
  sender_id: string;
  sender_type?: string;
  sender_name: string;
  recipient_id?: string;
  message: string;
  is_group?: boolean;
}): Promise<DbEventDayOfMessage | null> {
  console.log('[API] Sending day-of message');
  const { data, error } = await supabase
    .from('event_day_of_messages')
    .insert({
      event_id: msg.event_id,
      sender_id: msg.sender_id,
      sender_type: msg.sender_type ?? 'volunteer',
      sender_name: msg.sender_name,
      recipient_id: msg.recipient_id ?? null,
      message: msg.message,
      is_group: msg.is_group ?? true,
    })
    .select()
    .single();

  if (error) {
    console.error('[API] Error sending day-of message:', error);
    return null;
  }
  return data as DbEventDayOfMessage;
}

export async function fetchEventApprovers(eventId: string): Promise<DbEventApprover[]> {
  console.log('[API] Fetching event approvers for:', eventId);
  const { data, error } = await supabase
    .from('event_approvers')
    .select('*')
    .eq('event_id', eventId);

  if (error) {
    console.error('[API] Error fetching event approvers:', error);
    return [];
  }
  return (data ?? []) as DbEventApprover[];
}

export async function fetchActiveWaivers(): Promise<DbWaiver[]> {
  console.log('[API] Fetching active waivers');
  const { data, error } = await supabase
    .from('waivers')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[API] Error fetching waivers:', error);
    return [];
  }
  return (data ?? []) as DbWaiver[];
}

export async function fetchUserWaivers(userId: string): Promise<DbUserWaiver[]> {
  console.log('[API] Fetching user waivers for:', userId);
  const { data, error } = await supabase
    .from('user_waivers')
    .select('*')
    .eq('user_id', userId)
    .order('accepted_at', { ascending: false });

  if (error) {
    console.error('[API] Error fetching user waivers:', error);
    return [];
  }
  return (data ?? []) as DbUserWaiver[];
}

export async function acceptWaiver(userId: string, waiverId: string, waiverVersion: string): Promise<DbUserWaiver | null> {
  console.log('[API] Accepting waiver:', waiverId, 'version:', waiverVersion);
  const { data, error } = await supabase
    .from('user_waivers')
    .insert({ user_id: userId, waiver_id: waiverId, waiver_version: waiverVersion })
    .select()
    .single();

  if (error) {
    console.error('[API] Error accepting waiver:', error);
    throw new Error(error.message);
  }
  return data as DbUserWaiver;
}

export async function fetchUserRoles(userId: string): Promise<DbUserRole[]> {
  console.log('[API] Fetching user roles for:', userId);
  const { data, error } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('[API] Error fetching user roles:', error);
    return [];
  }
  return (data ?? []) as DbUserRole[];
}

export async function fetchDealtJoyVideos(): Promise<DbDealtJoyVideo[]> {
  console.log('[API] Fetching dealt joy videos');
  const { data, error } = await supabase
    .from('dealt_joy_videos')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[API] Error fetching dealt joy videos:', error);
    return [];
  }
  return (data ?? []) as DbDealtJoyVideo[];
}

export async function fetchLeaderboardProfiles(): Promise<DbLeaderboardProfile[]> {
  console.log('[API] Fetching leaderboard profiles view');
  const { data, error } = await supabase
    .from('leaderboard_profiles')
    .select('*')
    .order('total_points', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[API] Error fetching leaderboard profiles:', error);
    return [];
  }
  return (data ?? []) as DbLeaderboardProfile[];
}

export async function fetchOrganizationEventPhotos(eventId: string): Promise<DbOrganizationEventPhoto[]> {
  console.log('[API] Fetching org event photos for:', eventId);
  const { data, error } = await supabase
    .from('organization_event_photos')
    .select('*')
    .eq('event_id', eventId)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[API] Error fetching org event photos:', error);
    return [];
  }
  return (data ?? []) as DbOrganizationEventPhoto[];
}

export async function fetchEventPhotoTags(photoId: string): Promise<DbEventPhotoTag[]> {
  console.log('[API] Fetching photo tags for:', photoId);
  const { data, error } = await supabase
    .from('event_photo_tags')
    .select('*')
    .eq('photo_id', photoId);

  if (error) {
    console.error('[API] Error fetching photo tags:', error);
    return [];
  }
  return (data ?? []) as DbEventPhotoTag[];
}

export async function tagUserInPhoto(photoId: string, taggedUserId: string, taggedBy: string): Promise<DbEventPhotoTag | null> {
  console.log('[API] Tagging user in photo:', photoId);
  const { data, error } = await supabase
    .from('event_photo_tags')
    .insert({ photo_id: photoId, tagged_user_id: taggedUserId, tagged_by: taggedBy })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return null;
    console.error('[API] Error tagging user:', error);
    throw new Error(error.message);
  }
  return data as DbEventPhotoTag;
}

export async function searchProfilesSafe(query: string): Promise<DbProfile[]> {
  console.log('[API] Searching profiles (RPC) with query:', query);
  try {
    const { data, error } = await supabase
      .rpc('search_profiles_safe', { search_query: query });

    if (error) {
      console.warn('[API] RPC search_profiles_safe failed, falling back:', error.message);
      return searchUsers(query);
    }
    return (data ?? []) as DbProfile[];
  } catch {
    return searchUsers(query);
  }
}

export async function updateProfileStats(userId: string): Promise<void> {
  console.log('[API] Updating profile stats via RPC for:', userId);
  try {
    const { error } = await supabase
      .rpc('update_profile_stats', { user_id_param: userId });

    if (error) {
      console.warn('[API] RPC update_profile_stats failed:', error.message);
    }
  } catch (e) {
    console.warn('[API] RPC update_profile_stats exception:', e);
  }
}

export async function callEdgeFunction(functionName: string, body: Record<string, unknown>, adminToken?: string): Promise<Record<string, unknown> | null> {
  console.log('[API] Calling edge function:', functionName);
  const url = `${supabaseUrl}/functions/v1/${functionName}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAnonKey}`,
  };
  if (adminToken) {
    headers['x-admin-token'] = adminToken;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let result: Record<string, unknown> = {};
    try { result = JSON.parse(text) as Record<string, unknown>; } catch {}

    if (!response.ok) {
      console.error('[API] Edge function error:', functionName, response.status, text.substring(0, 200));
      return null;
    }

    return result;
  } catch (e) {
    console.error('[API] Edge function exception:', functionName, e);
    return null;
  }
}

export async function generateAvatar(userId: string): Promise<string | null> {
  console.log('[API] Generating avatar for:', userId);
  const result = await callEdgeFunction('generate-avatar', { user_id: userId });
  return (result?.avatar_url as string) ?? null;
}

export async function sendPushNotification(userId: string, title: string, body: string, data?: Record<string, string>): Promise<boolean> {
  console.log('[API] Sending push notification to:', userId);
  const result = await callEdgeFunction('send-push-notification', {
    user_id: userId,
    title,
    body,
    data: data ?? {},
  });
  return result !== null;
}

export async function verifyEin(ein: string): Promise<{ valid: boolean; name?: string } | null> {
  console.log('[API] Verifying EIN:', ein);
  const result = await callEdgeFunction('verify-ein', { ein });
  if (!result) return null;
  return { valid: (result.valid as boolean) ?? false, name: result.name as string | undefined };
}

export async function searchGooglePlaces(query: string): Promise<{ place_id: string; description: string }[]> {
  console.log('[API] Searching Google Places:', query);
  const result = await callEdgeFunction('google-places', { query, action: 'search' });
  if (!result) return [];
  return (result.predictions as { place_id: string; description: string }[]) ?? [];
}

export async function fetchImpactNumbers(): Promise<ImpactNumbers> {
  console.log('[API] Fetching impact numbers');

  const [profilesRes, eventsRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('events').select('id', { count: 'exact', head: true }),
  ]);

  const hoursRes = await supabase
    .from('profiles')
    .select('total_hours');

  const totalHours = (hoursRes.data ?? []).reduce(
    (sum: number, p: { total_hours: number }) => sum + (p.total_hours ?? 0),
    0
  );

  const result: ImpactNumbers = {
    totalVolunteers: profilesRes.count ?? 0,
    totalEvents: eventsRes.count ?? 0,
    totalHours: Math.round(totalHours),
  };

  console.log('[API] Impact numbers:', result);
  return result;
}
