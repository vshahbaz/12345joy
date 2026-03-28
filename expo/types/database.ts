export interface DbEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  location: string;
  location_url: string | null;
  start_time: string;
  end_time: string;
  capacity: number | null;
  min_age: number | null;
  skills_needed: string[] | null;
  waiver_required: boolean;
  image_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  signup_mode: string;
  city: string | null;
  state: string | null;
  venue: string | null;
  address: string | null;
  photo_release_required: boolean;
  admin_created_by: string | null;
  organization_id: string | null;
  review_completed_at: string | null;
  recap_published_at: string | null;
  recap_summary: string | null;
  community_benefited: string | null;
  impact_funds_generated: string | null;
  impact_joy_dealt: string | null;
  impact_reach: string | null;
}

export interface DbProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  interests: string[] | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  terms_accepted: boolean;
  total_points: number;
  total_hours: number;
  created_at: string;
  updated_at: string;
  redeemed_points: number;
  username: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  has_arrest_record: boolean;
  arrest_explanation: string | null;
  liability_waiver_accepted: boolean;
  liability_waiver_accepted_at: string | null;
  photo_waiver_accepted: boolean;
  photo_waiver_accepted_at: string | null;
  username_changed_at: string | null;
  is_verified: boolean;
  verification_requested_at: string | null;
}

export interface DbEventSignup {
  id: string;
  user_id: string;
  event_id: string;
  status: string;
  signup_time: string;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_code: string | null;
  is_lead: boolean;
  assigned_station: string | null;
  assigned_role: string | null;
  checked_in: boolean;
  hours_logged: number | null;
  points_earned: number | null;
}

export interface DbEventSignupWithEvent extends DbEventSignup {
  events: DbEvent;
}

export interface DbEventPhoto {
  id: string;
  event_id: string;
  uploaded_by: string;
  photo_url: string;
  caption: string | null;
  created_at: string;
  approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
}

export interface DbEventPhotoTag {
  id: string;
  photo_id: string;
  tagged_user_id: string;
  tagged_by: string;
  created_at: string;
}

export interface DbEventLink {
  id: string;
  event_id: string;
  label: string;
  url: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface DbEventQuestion {
  id: string;
  event_id: string | null;
  question_text: string;
  question_type: string;
  is_generic: boolean;
  is_required: boolean;
  display_order: number;
  created_at: string;
}

export interface DbEventQuestionResponse {
  id: string;
  signup_id: string;
  question_id: string;
  response_text: string | null;
  response_boolean: boolean | null;
  created_at: string;
}

export interface DbEventSubmission {
  id: string;
  submitted_by: string;
  title: string;
  description: string | null;
  proposed_date: string | null;
  proposed_end_date: string | null;
  city: string | null;
  state: string | null;
  venue: string | null;
  address: string | null;
  capacity: number | null;
  signup_mode: string;
  suggested_approver_name: string | null;
  suggested_approver_email: string | null;
  notes: string | null;
  status: string;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_event_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbEventApprover {
  id: string;
  event_id: string;
  approver_user_id: string;
  created_at: string;
}

export interface DbEventDayOfAgenda {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  item_type: string;
  start_time: string | null;
  end_time: string | null;
  location_note: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface DbEventDayOfContact {
  id: string;
  event_id: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  display_order: number;
  created_at: string;
}

export interface DbEventDayOfIncident {
  id: string;
  event_id: string;
  reported_by: string;
  incident_type: string;
  severity: string;
  description: string;
  involved_parties: string | null;
  witnesses: string | null;
  photo_url: string | null;
  follow_up_actions: string | null;
  status: string;
  occurred_at: string;
  created_at: string;
  updated_at: string;
}

export interface DbEventDayOfMedia {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  media_url: string;
  media_type: string;
  display_order: number;
  created_at: string;
}

export interface DbEventDayOfMessage {
  id: string;
  event_id: string;
  sender_id: string;
  sender_type: string;
  sender_name: string;
  recipient_id: string | null;
  message: string;
  is_group: boolean;
  created_at: string;
}

export interface DbClientPartner {
  id: string;
  name: string;
  foundation: string;
  description: string | null;
  sport: string | null;
  team: string | null;
  website: string | null;
  donate_url: string | null;
  mission: string | null;
  image_url: string | null;
  logo_url: string | null;
  initials: string | null;
  color: string | null;
  display_order: number;
  is_active: boolean;
  show_on_homepage: boolean;
  created_at: string;
  updated_at: string;
  organization_id: string | null;
}

export interface DbClientPartnerPhoto {
  id: string;
  client_partner_id: string;
  photo_url: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface DbFollower {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface DbFollowerWithProfile extends DbFollower {
  profiles: DbProfile;
}

export interface DbNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  data: Record<string, string> | null;
  created_at: string;
}

export interface DbShopItem {
  id: string;
  type: string;
  title: string;
  description: string | null;
  points_cost: number;
  inventory: number | null;
  image_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  category: string | null;
  delivery_method: string;
}

export interface DbRedemption {
  id: string;
  user_id: string;
  shop_item_id: string;
  points_spent: number;
  status: string;
  redeemed_at: string;
  fulfilled_at: string | null;
  used_at: string | null;
  notes: string | null;
  shipping_name: string | null;
  shipping_email: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip: string | null;
  shop_items?: DbShopItem;
}

export interface DbRedemptionMessage {
  id: string;
  redemption_id: string;
  sender_id: string;
  sender_type: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface DbMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  shared_event_id: string | null;
  shared_photo_url: string | null;
  created_at: string;
}

export interface DbVolunteerConversation {
  id: string;
  name: string | null;
  is_group: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DbVolunteerConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
}

export type ConversationType = 'volunteer' | 'org_volunteer';

export interface ConversationThread {
  id: string;
  otherPartyId: string;
  otherPartyName: string;
  otherPartyAvatar: string | null;
  otherPartyType: 'user' | 'organization';
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  conversationType: ConversationType;
}

export interface DbOrgVolunteerConversation {
  id: string;
  organization_id: string;
  volunteer_id: string;
  event_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbOrgVolunteerMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: string;
  content: string;
  created_at: string;
}

export interface DbOrganization {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  city: string | null;
  state: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbOrganizationFollow {
  id: string;
  user_id: string;
  organization_id: string;
  notify_events: boolean;
  created_at: string;
}

export interface DbOrganizationNews {
  id: string;
  organization_id: string;
  title: string;
  source_name: string;
  url: string;
  published_at: string | null;
  created_at: string;
  image_url: string | null;
}

export interface DbOrganizationEventPhoto {
  id: string;
  event_id: string;
  organization_id: string;
  photo_url: string;
  caption: string | null;
  uploaded_by_admin_id: string;
  display_order: number;
  created_at: string;
}

export interface DbBadge {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  points_required: number;
  created_at: string;
}

export interface DbUserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
}

export interface DbUserBadgeWithBadge extends DbUserBadge {
  badges: DbBadge;
}

export interface DbChallenge {
  id: string;
  challenger_id: string;
  challenged_id: string;
  challenge_type: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  challenger_points: number;
  challenged_points: number;
  created_at: string;
  updated_at: string;
}

export interface DbChallengePoke {
  id: string;
  challenge_id: string;
  sender_id: string;
  receiver_id: string;
  poke_type: string;
  created_at: string;
}

export interface DbFriend {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DbFriendWithProfile extends DbFriend {
  profiles: DbProfile;
}

export interface DbWishlist {
  id: string;
  user_id: string;
  shop_item_id: string;
  created_at: string;
}

export interface DbDeviceToken {
  id: string;
  user_id: string;
  token: string;
  platform: string;
  device_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbTimeLog {
  id: string;
  user_id: string;
  event_id: string;
  hours: number;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  status: string;
  submitted_at: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
}

export interface DbVolunteerFeedback {
  id: string;
  user_id: string;
  event_id: string;
  signup_id: string;
  did_attend: boolean | null;
  lead_name: string | null;
  received_clear_instructions: boolean | null;
  instructions_feedback: string | null;
  experience_feedback: string | null;
  volunteer_likelihood_rating: number | null;
  joy_spread_rating: number | null;
  created_at: string;
  updated_at: string;
  immediate_notification_sent: boolean;
  morning_notification_sent: boolean;
  final_notification_sent: boolean;
}

export interface DbVolunteerRating {
  id: string;
  volunteer_id: string;
  event_id: string;
  organization_id: string | null;
  rated_by_admin_id: string | null;
  rating: number;
  feedback: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbPostEventReview {
  id: string;
  signup_id: string;
  event_id: string;
  volunteer_id: string;
  reviewed_by_admin_id: string | null;
  attendance_status: string;
  joy_points_awarded: number;
  best_skills: string | null;
  impact_rating: number | null;
  reuse_likelihood_rating: number | null;
  created_at: string;
  updated_at: string;
}

export interface DbWaiver {
  id: string;
  type: string;
  version: string;
  content: string;
  created_at: string;
  active: boolean;
}

export interface DbUserWaiver {
  id: string;
  user_id: string;
  waiver_id: string;
  accepted_at: string;
  waiver_version: string;
}

export interface DbUserRole {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export interface DbDealtJoyVideo {
  id: string;
  title: string;
  summary: string | null;
  video_url: string;
  thumbnail_url: string | null;
  display_order: number;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbLeaderboardProfile {
  id: string | null;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  total_points: number | null;
  total_hours: number | null;
  city: string | null;
  is_verified: boolean | null;
}

export interface DbFeedbackExtension {
  id: string;
  user_id: string;
  event_id: string;
  signup_id: string;
  granted_at: string;
  new_deadline: string;
  created_at: string;
}

export interface DbFeedbackNotificationTracking {
  id: string;
  signup_id: string;
  event_id: string;
  user_id: string;
  event_end_time: string;
  immediate_sent_at: string | null;
  morning_sent_at: string | null;
  final_sent_at: string | null;
  feedback_submitted: boolean;
  created_at: string;
}

export type UserRole = 'volunteer' | 'organization';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  organization_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminSession {
  session_token: string;
  admin_user: AdminUser;
  expires_at: string;
}
