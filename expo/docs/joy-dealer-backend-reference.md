# Joy Dealer — Complete Backend Reference

## Supabase Project

- **Project ID:** `kisrqvgwnjvaajxyfatk`
- **URL:** `https://kisrqvgwnjvaajxyfatk.supabase.co`
- **Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtpc3Jxdmd3bmp2YWFqeHlmYXRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MTgwMzksImV4cCI6MjA4MzE5NDAzOX0.1EDqhrcbBie1CiNoLX3HzwOp4On2ZExcUuWldBLkKhk`

## Storage Buckets

| Bucket | Public |
|--------|--------|
| event-photos | Yes |
| avatars | Yes |
| videos | Yes |

## Enums

| Enum | Values |
|------|--------|
| app_role | admin, user, event_approver |
| challenge_status | pending, active, completed, declined, expired |
| challenge_type | monthly, indefinite |
| event_signup_status | registered, waitlisted, cancelled |
| event_type | community, education, environment, health, other |
| redemption_status | redeemed, fulfilled, used, cancelled |
| shop_item_type | experience, merch |
| signup_mode | instant, approval_required |
| signup_status | pending, confirmed, declined, waitlisted, cancelled |
| submission_status | pending, needs_changes, approved, rejected |
| time_log_status | pending, approved, rejected |

---
## Database Tables

### `admin_announcement_reads`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| announcement_id | uuid | NO | — |
| admin_user_id | uuid | NO | — |
| read_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **No direct access to admin_announcement_reads** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `false`

### `admin_announcements`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| sender_id | uuid | NO | — |
| title | text | NO | — |
| message | text | NO | — |
| created_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **No direct access to admin_announcements** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `false`

### `admin_conversation_messages`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| conversation_id | uuid | NO | — |
| sender_id | uuid | NO | — |
| message | text | NO | — |
| read | boolean | YES | false |
| created_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **No direct access to admin_conversation_messages** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `false`

### `admin_conversations`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| participant_one | uuid | NO | — |
| participant_two | uuid | NO | — |
| last_message_at | timestamp with time zone | YES | now() |
| created_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **No direct access to admin_conversations** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `false`

### `admin_invites`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| email | text | NO | — |
| role | USER-DEFINED | NO | — |
| invited_by | uuid | NO | — |
| token | text | NO | encode(extensions.gen_random_bytes(32), 'hex'::text) |
| accepted | boolean | YES | false |
| accepted_at | timestamp with time zone | YES | — |
| expires_at | timestamp with time zone | YES | (now() + '7 days'::interval) |
| created_at | timestamp with time zone | YES | now() |

**RLS Policies:**

- **Admins can manage invites** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Anyone can accept invite with valid token** (`UPDATE`, permissive=PERMISSIVE, roles={public})
  - USING: `check_invite_token(token)`
  - WITH CHECK: `((accepted = true) AND (role = ( SELECT ai.role
   FROM admin_invites ai
  WHERE (ai.id = admin_invites.id))) AND (email = ( SELECT ai.email
   FROM admin_invites ai
  WHERE (ai.id = admin_invites.id)`
- **Only admins can view invites** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`

### `admin_sessions`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| admin_id | uuid | NO | — |
| session_token | text | NO | — |
| expires_at | timestamp with time zone | NO | — |
| created_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **No direct access to admin_sessions** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `false`

### `admin_users`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| email | text | NO | — |
| password_hash | text | NO | — |
| full_name | text | NO | — |
| is_active | boolean | NO | true |
| last_login_at | timestamp with time zone | YES | — |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |
| is_super_admin | boolean | NO | false |
| can_manage_all_events | boolean | NO | false |
| is_approved | boolean | YES | false |
| approved_by | uuid | YES | — |
| approved_at | timestamp with time zone | YES | — |
| organization_name | text | YES | — |
| position | text | YES | — |
| organization_id | uuid | YES | — |
| ein | text | YES | — |
| avatar_url | text | YES | — |
| username | text | YES | — |
| events_per_month | text | YES | — |
| app_purpose | text | YES | — |

**RLS Policies:**

- **No direct access to admin_users** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `false`

### `badges`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| name | text | NO | — |
| description | text | YES | — |
| icon | text | YES | — |
| points_required | integer | YES | 0 |
| created_at | timestamp with time zone | YES | now() |

**RLS Policies:**

- **Admins can manage badges** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Anyone can view badges** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `true`

### `challenge_pokes`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| challenge_id | uuid | NO | — |
| sender_id | uuid | NO | — |
| receiver_id | uuid | NO | — |
| poke_type | text | NO | — |
| created_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Participants can send pokes** (`INSERT`, permissive=PERMISSIVE, roles={public})
  - WITH CHECK: `(auth.uid() = sender_id)`
- **Participants can view pokes** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `((auth.uid() = sender_id) OR (auth.uid() = receiver_id))`

### `challenges`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| challenger_id | uuid | NO | — |
| challenged_id | uuid | NO | — |
| challenge_type | USER-DEFINED | NO | 'monthly'::challenge_type |
| status | USER-DEFINED | NO | 'pending'::challenge_status |
| start_date | timestamp with time zone | YES | — |
| end_date | timestamp with time zone | YES | — |
| challenger_points | integer | NO | 0 |
| challenged_points | integer | NO | 0 |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Challenger can delete pending challenges** (`DELETE`, permissive=PERMISSIVE, roles={public})
  - USING: `((auth.uid() = challenger_id) AND (status = 'pending'::challenge_status))`
- **Participants can update their challenges** (`UPDATE`, permissive=PERMISSIVE, roles={public})
  - USING: `((auth.uid() = challenger_id) OR (auth.uid() = challenged_id))`
- **Users can create challenges** (`INSERT`, permissive=PERMISSIVE, roles={public})
  - WITH CHECK: `(auth.uid() = challenger_id)`
- **Users can view their own challenges** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `((auth.uid() = challenger_id) OR (auth.uid() = challenged_id))`

### `client_partners`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| name | text | NO | — |
| foundation | text | NO | — |
| description | text | YES | — |
| sport | text | YES | — |
| team | text | YES | — |
| website | text | YES | — |
| donate_url | text | YES | — |
| mission | text | YES | — |
| image_url | text | YES | — |
| logo_url | text | YES | — |
| initials | text | YES | — |
| color | text | YES | 'from-primary to-primary'::text |
| display_order | integer | YES | 0 |
| is_active | boolean | YES | true |
| show_on_homepage | boolean | YES | false |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |
| organization_id | uuid | YES | — |

**RLS Policies:**

- **Admins can manage partners** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `(EXISTS ( SELECT 1
   FROM admin_users au
  WHERE (((au.id)::text = ((current_setting('request.headers'::text, true))::json ->> 'x-admin-id'::text)) AND (au.is_super_admin = true))))`
- **Anyone can view active partners** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(is_active = true)`

### `dealt_joy_videos`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| title | text | NO | — |
| summary | text | YES | — |
| video_url | text | NO | — |
| thumbnail_url | text | YES | — |
| display_order | integer | YES | 0 |
| is_featured | boolean | YES | false |
| is_active | boolean | YES | true |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Admins can manage videos** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `(EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::app_role))))`
- **Anyone can view active videos** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(is_active = true)`

### `device_tokens`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | — |
| token | text | NO | — |
| platform | text | NO | — |
| device_id | text | YES | — |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Admins can view all tokens** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Users can delete their own tokens** (`DELETE`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = user_id)`
- **Users can insert their own tokens** (`INSERT`, permissive=PERMISSIVE, roles={public})
  - WITH CHECK: `(auth.uid() = user_id)`
- **Users can update their own tokens** (`UPDATE`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = user_id)`
- **Users can view their own tokens** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = user_id)`

### `event_approvers`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| event_id | uuid | NO | — |
| approver_user_id | uuid | NO | — |
| created_at | timestamp with time zone | YES | now() |

**RLS Policies:**

- **Admins can manage event approvers** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Anyone can view event approvers** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `true`
- **Event approvers can view their assignments** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = approver_user_id)`

### `event_day_of_agenda`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| event_id | uuid | NO | — |
| title | text | NO | — |
| description | text | YES | — |
| item_type | text | NO | 'agenda'::text |
| start_time | time without time zone | YES | — |
| end_time | time without time zone | YES | — |
| location_note | text | YES | — |
| display_order | integer | NO | 0 |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Admins can manage agenda** (`ALL`, permissive=PERMISSIVE, roles={authenticated})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
  - WITH CHECK: `has_role(auth.uid(), 'admin'::app_role)`
- **Signed-up volunteers can view agenda** (`SELECT`, permissive=PERMISSIVE, roles={authenticated})
  - USING: `(EXISTS ( SELECT 1
   FROM event_signups
  WHERE ((event_signups.event_id = event_day_of_agenda.event_id) AND (event_signups.user_id = auth.uid()) AND (event_signups.status = 'confirmed'::signup_statu`

### `event_day_of_contacts`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| event_id | uuid | NO | — |
| name | text | NO | — |
| role | text | NO | — |
| phone | text | YES | — |
| email | text | YES | — |
| notes | text | YES | — |
| display_order | integer | NO | 0 |
| created_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Admins can manage contacts** (`ALL`, permissive=PERMISSIVE, roles={authenticated})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
  - WITH CHECK: `has_role(auth.uid(), 'admin'::app_role)`
- **Signed-up volunteers can view contacts** (`SELECT`, permissive=PERMISSIVE, roles={authenticated})
  - USING: `(EXISTS ( SELECT 1
   FROM event_signups
  WHERE ((event_signups.event_id = event_day_of_contacts.event_id) AND (event_signups.user_id = auth.uid()) AND (event_signups.status = 'confirmed'::signup_sta`

### `event_day_of_incidents`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| event_id | uuid | NO | — |
| reported_by | text | NO | — |
| incident_type | text | NO | — |
| severity | text | NO | 'low'::text |
| description | text | NO | — |
| involved_parties | text | YES | — |
| witnesses | text | YES | — |
| photo_url | text | YES | — |
| follow_up_actions | text | YES | — |
| status | text | NO | 'reported'::text |
| occurred_at | timestamp with time zone | NO | now() |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Admins can manage incidents** (`ALL`, permissive=PERMISSIVE, roles={authenticated})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
  - WITH CHECK: `has_role(auth.uid(), 'admin'::app_role)`
- **Signed-up volunteers can view incidents** (`SELECT`, permissive=PERMISSIVE, roles={authenticated})
  - USING: `(EXISTS ( SELECT 1
   FROM event_signups
  WHERE ((event_signups.event_id = event_day_of_incidents.event_id) AND (event_signups.user_id = auth.uid()) AND (event_signups.status = 'confirmed'::signup_st`

### `event_day_of_media`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| event_id | uuid | NO | — |
| title | text | NO | — |
| description | text | YES | — |
| media_url | text | NO | — |
| media_type | text | NO | 'document'::text |
| display_order | integer | NO | 0 |
| created_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Admins can manage media** (`ALL`, permissive=PERMISSIVE, roles={authenticated})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
  - WITH CHECK: `has_role(auth.uid(), 'admin'::app_role)`
- **Signed-up volunteers can view media** (`SELECT`, permissive=PERMISSIVE, roles={authenticated})
  - USING: `(EXISTS ( SELECT 1
   FROM event_signups
  WHERE ((event_signups.event_id = event_day_of_media.event_id) AND (event_signups.user_id = auth.uid()) AND (event_signups.status = 'confirmed'::signup_status`

### `event_day_of_messages`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| event_id | uuid | NO | — |
| sender_id | text | NO | — |
| sender_type | text | NO | 'volunteer'::text |
| sender_name | text | NO | — |
| recipient_id | uuid | YES | — |
| message | text | NO | — |
| is_group | boolean | NO | true |
| created_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Admins can manage day-of messages** (`ALL`, permissive=PERMISSIVE, roles={authenticated})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
  - WITH CHECK: `has_role(auth.uid(), 'admin'::app_role)`
- **Volunteers can send messages** (`INSERT`, permissive=PERMISSIVE, roles={authenticated})
  - WITH CHECK: `((sender_id = (auth.uid())::text) AND (EXISTS ( SELECT 1
   FROM event_signups
  WHERE ((event_signups.event_id = event_day_of_messages.event_id) AND (event_signups.user_id = auth.uid()) AND (event_si`
- **Volunteers can view group messages for their events** (`SELECT`, permissive=PERMISSIVE, roles={authenticated})
  - USING: `((is_group = true) AND (EXISTS ( SELECT 1
   FROM event_signups
  WHERE ((event_signups.event_id = event_day_of_messages.event_id) AND (event_signups.user_id = auth.uid()) AND (event_signups.status = `
- **Volunteers can view their own DMs** (`SELECT`, permissive=PERMISSIVE, roles={authenticated})
  - USING: `((is_group = false) AND ((sender_id = (auth.uid())::text) OR (recipient_id = auth.uid())))`

### `event_links`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| event_id | uuid | NO | — |
| label | text | NO | — |
| url | text | NO | — |
| display_order | integer | NO | 0 |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Admins can manage event links** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Anyone can view event links** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `true`

### `event_photo_tags`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| photo_id | uuid | NO | — |
| tagged_user_id | uuid | NO | — |
| tagged_by | uuid | NO | — |
| created_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Admins can manage all photo tags** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Anyone can view photo tags for approved photos** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(EXISTS ( SELECT 1
   FROM event_photos ep
  WHERE ((ep.id = event_photo_tags.photo_id) AND (ep.approved = true))))`
- **Photo owners can delete tags on their photos** (`DELETE`, permissive=PERMISSIVE, roles={public})
  - USING: `(EXISTS ( SELECT 1
   FROM event_photos ep
  WHERE ((ep.id = event_photo_tags.photo_id) AND (ep.uploaded_by = auth.uid()))))`
- **Photo uploaders can tag users** (`INSERT`, permissive=PERMISSIVE, roles={public})
  - WITH CHECK: `((auth.uid() = tagged_by) AND (EXISTS ( SELECT 1
   FROM event_photos ep
  WHERE ((ep.id = event_photo_tags.photo_id) AND (ep.uploaded_by = auth.uid())))))`
- **Taggers can remove their own tags** (`DELETE`, permissive=PERMISSIVE, roles={public})
  - USING: `(tagged_by = auth.uid())`
- **Users can view photos they are tagged in** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(tagged_user_id = auth.uid())`
- **Users can view tags on their own photos** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(EXISTS ( SELECT 1
   FROM event_photos ep
  WHERE ((ep.id = event_photo_tags.photo_id) AND (ep.uploaded_by = auth.uid()))))`

### `event_photos`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| event_id | uuid | NO | — |
| uploaded_by | uuid | NO | — |
| photo_url | text | NO | — |
| caption | text | YES | — |
| created_at | timestamp with time zone | NO | now() |
| approved | boolean | YES | false |
| approved_by | uuid | YES | — |
| approved_at | timestamp with time zone | YES | — |

**RLS Policies:**

- **Admins can manage event photos** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Admins can view all event photos** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Anyone can view approved event photos** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(approved = true)`
- **Attendees can upload photos** (`INSERT`, permissive=PERMISSIVE, roles={public})
  - WITH CHECK: `((auth.uid() = uploaded_by) AND ((EXISTS ( SELECT 1
   FROM event_signups es
  WHERE ((es.event_id = event_photos.event_id) AND (es.user_id = auth.uid()) AND (es.check_in_time IS NOT NULL)))) OR user_`
- **Users can delete their own photos** (`DELETE`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = uploaded_by)`
- **Users can view their own photos** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = uploaded_by)`

### `event_question_responses`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| signup_id | uuid | NO | — |
| question_id | uuid | NO | — |
| response_text | text | YES | — |
| response_boolean | boolean | YES | — |
| created_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Admins can view all responses** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Event approvers can view responses for their events** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(EXISTS ( SELECT 1
   FROM (event_signups es
     JOIN event_approvers ea ON ((ea.event_id = es.event_id)))
  WHERE ((es.id = event_question_responses.signup_id) AND (ea.approver_user_id = auth.uid())`
- **Users can create their own responses** (`INSERT`, permissive=PERMISSIVE, roles={public})
  - WITH CHECK: `(EXISTS ( SELECT 1
   FROM event_signups es
  WHERE ((es.id = event_question_responses.signup_id) AND (es.user_id = auth.uid()))))`
- **Users can view their own responses** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(EXISTS ( SELECT 1
   FROM event_signups es
  WHERE ((es.id = event_question_responses.signup_id) AND (es.user_id = auth.uid()))))`

### `event_questions`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| event_id | uuid | YES | — |
| question_text | text | NO | — |
| question_type | text | NO | 'text'::text |
| is_generic | boolean | NO | false |
| is_required | boolean | NO | true |
| display_order | integer | NO | 0 |
| created_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Admins can manage event questions** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Anyone can view event questions** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `true`

### `event_signups`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | — |
| event_id | uuid | NO | — |
| status | USER-DEFINED | YES | 'confirmed'::signup_status |
| signup_time | timestamp with time zone | YES | now() |
| check_in_time | timestamp with time zone | YES | — |
| check_out_time | timestamp with time zone | YES | — |
| check_in_code | text | YES | — |
| is_lead | boolean | YES | false |
| assigned_station | text | YES | — |
| assigned_role | text | YES | — |

**RLS Policies:**

- **Admins can manage all signups** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Admins can view all signups** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Event approvers can update signups for their events** (`UPDATE`, permissive=PERMISSIVE, roles={public})
  - USING: `(EXISTS ( SELECT 1
   FROM event_approvers ea
  WHERE ((ea.approver_user_id = auth.uid()) AND (ea.event_id = event_signups.event_id))))`
- **Event approvers can view signups for their events** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(EXISTS ( SELECT 1
   FROM event_approvers ea
  WHERE ((ea.approver_user_id = auth.uid()) AND (ea.event_id = event_signups.event_id))))`
- **Users can create their own signups** (`INSERT`, permissive=PERMISSIVE, roles={public})
  - WITH CHECK: `(auth.uid() = user_id)`
- **Users can delete their own signups** (`DELETE`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = user_id)`
- **Users can update their own signups** (`UPDATE`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = user_id)`
- **Users can view their own signups** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = user_id)`

### `event_submissions`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| submitted_by | uuid | NO | — |
| title | text | NO | — |
| description | text | YES | — |
| proposed_date | timestamp with time zone | YES | — |
| proposed_end_date | timestamp with time zone | YES | — |
| city | text | YES | — |
| state | text | YES | — |
| venue | text | YES | — |
| address | text | YES | — |
| capacity | integer | YES | — |
| signup_mode | USER-DEFINED | YES | 'instant'::signup_mode |
| suggested_approver_name | text | YES | — |
| suggested_approver_email | text | YES | — |
| notes | text | YES | — |
| status | USER-DEFINED | YES | 'pending'::submission_status |
| admin_notes | text | YES | — |
| reviewed_by | uuid | YES | — |
| reviewed_at | timestamp with time zone | YES | — |
| created_event_id | uuid | YES | — |
| created_at | timestamp with time zone | YES | now() |
| updated_at | timestamp with time zone | YES | now() |

**RLS Policies:**

- **Admins can manage all submissions** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Users can create submissions** (`INSERT`, permissive=PERMISSIVE, roles={public})
  - WITH CHECK: `(auth.uid() = submitted_by)`
- **Users can update their own pending submissions** (`UPDATE`, permissive=PERMISSIVE, roles={public})
  - USING: `((auth.uid() = submitted_by) AND (status = ANY (ARRAY['pending'::submission_status, 'needs_changes'::submission_status])))`
- **Users can view their own submissions** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = submitted_by)`

### `events`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| title | text | NO | — |
| description | text | YES | — |
| event_type | USER-DEFINED | YES | 'other'::event_type |
| location | text | NO | — |
| location_url | text | YES | — |
| start_time | timestamp with time zone | NO | — |
| end_time | timestamp with time zone | NO | — |
| capacity | integer | YES | — |
| min_age | integer | YES | — |
| skills_needed | ARRAY | YES | — |
| waiver_required | boolean | YES | false |
| image_url | text | YES | — |
| created_by | uuid | YES | — |
| created_at | timestamp with time zone | YES | now() |
| updated_at | timestamp with time zone | YES | now() |
| signup_mode | USER-DEFINED | YES | 'instant'::signup_mode |
| city | text | YES | — |
| state | text | YES | — |
| venue | text | YES | — |
| address | text | YES | — |
| photo_release_required | boolean | YES | false |
| admin_created_by | uuid | YES | — |
| organization_id | uuid | YES | — |
| review_completed_at | timestamp with time zone | YES | — |
| recap_published_at | timestamp with time zone | YES | — |
| recap_summary | text | YES | — |
| community_benefited | text | YES | — |
| impact_funds_generated | text | YES | — |
| impact_joy_dealt | text | YES | — |
| impact_reach | text | YES | — |

**RLS Policies:**

- **Admins can manage events** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Anyone can view events** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `true`

### `feedback_extensions`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | — |
| event_id | uuid | NO | — |
| signup_id | uuid | NO | — |
| granted_at | timestamp with time zone | NO | now() |
| new_deadline | timestamp with time zone | NO | — |
| created_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Admins can view all extensions** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Users can create their own extensions** (`INSERT`, permissive=PERMISSIVE, roles={public})
  - WITH CHECK: `(auth.uid() = user_id)`
- **Users can view their own extensions** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = user_id)`

### `feedback_notification_tracking`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| signup_id | uuid | NO | — |
| event_id | uuid | NO | — |
| user_id | uuid | NO | — |
| event_end_time | timestamp with time zone | NO | — |
| immediate_sent_at | timestamp with time zone | YES | — |
| morning_sent_at | timestamp with time zone | YES | — |
| final_sent_at | timestamp with time zone | YES | — |
| feedback_submitted | boolean | YES | false |
| created_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Admins can view feedback tracking** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`

### `friends`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| requester_id | uuid | NO | — |
| addressee_id | uuid | NO | — |
| status | text | NO | 'pending'::text |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Admins can manage all friends** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Users can delete their own requests or unfriend** (`DELETE`, permissive=PERMISSIVE, roles={public})
  - USING: `((auth.uid() = requester_id) OR (auth.uid() = addressee_id))`
- **Users can send friend requests** (`INSERT`, permissive=PERMISSIVE, roles={public})
  - WITH CHECK: `(auth.uid() = requester_id)`
- **Users can update requests addressed to them** (`UPDATE`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = addressee_id)`
- **Users can view their own friend requests** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `((auth.uid() = requester_id) OR (auth.uid() = addressee_id))`

### `leaderboard_profiles`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | YES | — |
| full_name | text | YES | — |
| username | text | YES | — |
| avatar_url | text | YES | — |
| total_points | integer | YES | — |
| total_hours | numeric | YES | — |
| city | text | YES | — |
| is_verified | boolean | YES | — |

### `notifications`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | — |
| type | text | NO | — |
| title | text | NO | — |
| message | text | YES | — |
| read | boolean | YES | false |
| data | jsonb | YES | — |
| created_at | timestamp with time zone | YES | now() |

**RLS Policies:**

- **Admins can manage all notifications** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Users can create their own notifications** (`INSERT`, permissive=PERMISSIVE, roles={public})
  - WITH CHECK: `((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))`
- **Users can delete their own notifications** (`DELETE`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = user_id)`
- **Users can update their own notifications** (`UPDATE`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = user_id)`
- **Users can view their own notifications** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = user_id)`

### `org_volunteer_conversations`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| organization_id | uuid | NO | — |
| volunteer_id | uuid | NO | — |
| event_id | uuid | YES | — |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Admin users can view org conversations via header** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `(EXISTS ( SELECT 1
   FROM admin_users au
  WHERE (((au.id)::text = ((current_setting('request.headers'::text, true))::json ->> 'x-admin-id'::text)) AND (au.organization_id = org_volunteer_conversatio`
- **Admins can view org conversations** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Volunteers can create org conversations** (`INSERT`, permissive=PERMISSIVE, roles={public})
  - WITH CHECK: `(auth.uid() = volunteer_id)`
- **Volunteers can update their own org conversations** (`UPDATE`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = volunteer_id)`
  - WITH CHECK: `(auth.uid() = volunteer_id)`
- **Volunteers can view their own org conversations** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = volunteer_id)`

### `org_volunteer_messages`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| conversation_id | uuid | NO | — |
| sender_id | text | NO | — |
| sender_type | text | NO | 'volunteer'::text |
| content | text | NO | — |
| created_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Admin users can manage messages via header** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `(EXISTS ( SELECT 1
   FROM (org_volunteer_conversations c
     JOIN admin_users au ON ((au.organization_id = c.organization_id)))
  WHERE ((c.id = org_volunteer_messages.conversation_id) AND ((au.id):`
- **Admins can view messages in their org conversations** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Volunteers can send messages** (`INSERT`, permissive=PERMISSIVE, roles={public})
  - WITH CHECK: `((sender_type = 'volunteer'::text) AND (sender_id = (auth.uid())::text) AND (EXISTS ( SELECT 1
   FROM org_volunteer_conversations c
  WHERE ((c.id = org_volunteer_messages.conversation_id) AND (c.vol`
- **Volunteers can view messages in their conversations** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(EXISTS ( SELECT 1
   FROM org_volunteer_conversations c
  WHERE ((c.id = org_volunteer_messages.conversation_id) AND (c.volunteer_id = auth.uid()))))`

### `organization_event_photos`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| event_id | uuid | NO | — |
| organization_id | uuid | NO | — |
| photo_url | text | NO | — |
| caption | text | YES | — |
| uploaded_by_admin_id | uuid | NO | — |
| display_order | integer | YES | 0 |
| created_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Admins can manage organization event photos** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
  - WITH CHECK: `has_role(auth.uid(), 'admin'::app_role)`
- **Anyone can view organization event photos** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `true`

### `organization_follows`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | — |
| organization_id | uuid | NO | — |
| notify_events | boolean | YES | true |
| created_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Admins can view all organization follows** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Users can follow organizations** (`INSERT`, permissive=PERMISSIVE, roles={public})
  - WITH CHECK: `(auth.uid() = user_id)`
- **Users can unfollow organizations** (`DELETE`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = user_id)`
- **Users can update their follow settings** (`UPDATE`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = user_id)`
- **Users can view their follows** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = user_id)`

### `organization_news`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| organization_id | uuid | NO | — |
| title | text | NO | — |
| source_name | text | NO | — |
| url | text | NO | — |
| published_at | date | YES | — |
| created_at | timestamp with time zone | NO | now() |
| image_url | text | YES | — |

**RLS Policies:**

- **Admins can manage organization news** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `(EXISTS ( SELECT 1
   FROM admin_users au
  WHERE (((au.id)::text = ((current_setting('request.headers'::text, true))::json ->> 'x-admin-id'::text)) AND (au.is_super_admin = true))))`
- **Anyone can view organization news** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = organization_news.organization_id) AND (o.is_active = true))))`

### `organizations`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| name | text | NO | — |
| description | text | YES | — |
| logo_url | text | YES | — |
| website | text | YES | — |
| contact_email | text | YES | — |
| contact_phone | text | YES | — |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |
| created_by | uuid | YES | — |
| is_active | boolean | NO | true |
| is_verified | boolean | YES | false |
| city | text | YES | — |
| state | text | YES | — |
| banner_url | text | YES | — |

**RLS Policies:**

- **Admins can manage organizations** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `(EXISTS ( SELECT 1
   FROM admin_users au
  WHERE (((au.id)::text = ((current_setting('request.headers'::text, true))::json ->> 'x-admin-id'::text)) AND (au.is_super_admin = true))))`
- **Anyone can view active organizations** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(is_active = true)`
- **Authenticated users can view organizations** (`SELECT`, permissive=PERMISSIVE, roles={authenticated})
  - USING: `(is_active = true)`

### `post_event_reviews`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| signup_id | uuid | NO | — |
| event_id | uuid | NO | — |
| volunteer_id | uuid | NO | — |
| reviewed_by_admin_id | uuid | YES | — |
| attendance_status | text | NO | — |
| joy_points_awarded | integer | YES | 0 |
| best_skills | text | YES | — |
| impact_rating | integer | YES | — |
| reuse_likelihood_rating | integer | YES | — |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Admins can manage all reviews** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
  - WITH CHECK: `has_role(auth.uid(), 'admin'::app_role)`
- **Event approvers can manage reviews for their events** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `(EXISTS ( SELECT 1
   FROM event_approvers ea
  WHERE ((ea.event_id = post_event_reviews.event_id) AND (ea.approver_user_id = auth.uid()))))`
  - WITH CHECK: `(EXISTS ( SELECT 1
   FROM event_approvers ea
  WHERE ((ea.event_id = post_event_reviews.event_id) AND (ea.approver_user_id = auth.uid()))))`
- **Volunteers can view their own reviews** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = volunteer_id)`

### `profiles`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | — |
| full_name | text | NO | — |
| email | text | NO | — |
| phone | text | YES | — |
| city | text | YES | — |
| interests | ARRAY | YES | — |
| emergency_contact_name | text | YES | — |
| emergency_contact_phone | text | YES | — |
| terms_accepted | boolean | YES | false |
| total_points | integer | YES | 0 |
| total_hours | numeric | YES | 0 |
| created_at | timestamp with time zone | YES | now() |
| updated_at | timestamp with time zone | YES | now() |
| redeemed_points | integer | YES | 0 |
| username | text | YES | — |
| avatar_url | text | YES | — |
| date_of_birth | date | YES | — |
| has_arrest_record | boolean | YES | false |
| arrest_explanation | text | YES | — |
| liability_waiver_accepted | boolean | YES | false |
| liability_waiver_accepted_at | timestamp with time zone | YES | — |
| photo_waiver_accepted | boolean | YES | false |
| photo_waiver_accepted_at | timestamp with time zone | YES | — |
| username_changed_at | timestamp with time zone | YES | — |
| is_verified | boolean | YES | false |
| verification_requested_at | timestamp with time zone | YES | — |

**RLS Policies:**

- **Admins can update profiles** (`UPDATE`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Admins can view all profiles** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Authenticated users can view profiles of connections** (`SELECT`, permissive=PERMISSIVE, roles={authenticated})
  - USING: `((auth.uid() IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM friends f
  WHERE ((f.status = 'accepted'::text) AND (((f.requester_id = auth.uid()) AND (f.addressee_id = profiles.id)) OR ((f.addressee_id =`
- **Event approvers can view participant profiles** (`SELECT`, permissive=PERMISSIVE, roles={authenticated})
  - USING: `(EXISTS ( SELECT 1
   FROM (event_signups es
     JOIN event_approvers ea ON ((ea.event_id = es.event_id)))
  WHERE ((ea.approver_user_id = auth.uid()) AND (es.user_id = profiles.id))))`
- **Users can insert their own profile** (`INSERT`, permissive=PERMISSIVE, roles={public})
  - WITH CHECK: `(auth.uid() = id)`
- **Users can update their own profile** (`UPDATE`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = id)`
- **Users can view their own profile** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = id)`

### `redemption_messages`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| redemption_id | uuid | NO | — |
| sender_id | text | NO | — |
| sender_type | text | NO | — |
| message | text | NO | — |
| read | boolean | YES | false |
| created_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Admins can read all redemption messages** (`SELECT`, permissive=PERMISSIVE, roles={authenticated})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Admins can send redemption messages** (`INSERT`, permissive=PERMISSIVE, roles={authenticated})
  - WITH CHECK: `has_role(auth.uid(), 'admin'::app_role)`
- **Users can read their redemption messages** (`SELECT`, permissive=PERMISSIVE, roles={authenticated})
  - USING: `(EXISTS ( SELECT 1
   FROM redemptions r
  WHERE ((r.id = redemption_messages.redemption_id) AND (r.user_id = auth.uid()))))`
- **Users can send messages on their redemptions** (`INSERT`, permissive=PERMISSIVE, roles={authenticated})
  - WITH CHECK: `((sender_type = 'volunteer'::text) AND (sender_id = (auth.uid())::text) AND (EXISTS ( SELECT 1
   FROM redemptions r
  WHERE ((r.id = redemption_messages.redemption_id) AND (r.user_id = auth.uid()))))`

### `redemptions`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | — |
| shop_item_id | uuid | NO | — |
| points_spent | integer | NO | — |
| status | USER-DEFINED | YES | 'redeemed'::redemption_status |
| redeemed_at | timestamp with time zone | YES | now() |
| fulfilled_at | timestamp with time zone | YES | — |
| used_at | timestamp with time zone | YES | — |
| notes | text | YES | — |
| shipping_name | text | YES | — |
| shipping_email | text | YES | — |
| shipping_address | text | YES | — |
| shipping_city | text | YES | — |
| shipping_state | text | YES | — |
| shipping_zip | text | YES | — |

**RLS Policies:**

- **Admins can manage all redemptions** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Users can create redemptions** (`INSERT`, permissive=PERMISSIVE, roles={public})
  - WITH CHECK: `(auth.uid() = user_id)`
- **Users can view their own redemptions** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = user_id)`

### `shop_items`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| type | USER-DEFINED | NO | — |
| title | text | NO | — |
| description | text | YES | — |
| points_cost | integer | NO | — |
| inventory | integer | YES | — |
| image_url | text | YES | — |
| active | boolean | YES | true |
| created_at | timestamp with time zone | YES | now() |
| updated_at | timestamp with time zone | YES | now() |
| expires_at | timestamp with time zone | YES | — |
| category | text | YES | — |
| delivery_method | text | NO | 'shipping'::text |

**RLS Policies:**

- **Admins can manage shop items** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Anyone can view active shop items** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(active = true)`

### `time_logs`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | — |
| event_id | uuid | NO | — |
| hours | numeric | NO | — |
| start_time | timestamp with time zone | YES | — |
| end_time | timestamp with time zone | YES | — |
| notes | text | YES | — |
| status | USER-DEFINED | YES | 'pending'::time_log_status |
| submitted_at | timestamp with time zone | YES | now() |
| approved_by | uuid | YES | — |
| approved_at | timestamp with time zone | YES | — |
| rejection_reason | text | YES | — |

**RLS Policies:**

- **Admins can manage all time logs** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Admins can view all time logs** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Event approvers can update logs for their events** (`UPDATE`, permissive=PERMISSIVE, roles={public})
  - USING: `(EXISTS ( SELECT 1
   FROM event_approvers ea
  WHERE ((ea.approver_user_id = auth.uid()) AND (ea.event_id = time_logs.event_id))))`
- **Event approvers can view logs for their events** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(EXISTS ( SELECT 1
   FROM event_approvers ea
  WHERE ((ea.approver_user_id = auth.uid()) AND (ea.event_id = time_logs.event_id))))`
- **Users can create their own time logs** (`INSERT`, permissive=PERMISSIVE, roles={public})
  - WITH CHECK: `(auth.uid() = user_id)`
- **Users can view their own time logs** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = user_id)`

### `user_badges`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | — |
| badge_id | uuid | NO | — |
| earned_at | timestamp with time zone | YES | now() |

**RLS Policies:**

- **Admins can manage user badges** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Users can view their own badges** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = user_id)`

### `user_follows`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| follower_id | uuid | NO | — |
| following_id | uuid | NO | — |
| created_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Admins can view all follows** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Users can follow others** (`INSERT`, permissive=PERMISSIVE, roles={public})
  - WITH CHECK: `(auth.uid() = follower_id)`
- **Users can unfollow** (`DELETE`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = follower_id)`
- **Users can view their follows** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `((auth.uid() = follower_id) OR (auth.uid() = following_id))`

### `user_roles`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | — |
| role | USER-DEFINED | NO | 'user'::app_role |
| created_at | timestamp with time zone | YES | now() |

**RLS Policies:**

- **Admins can manage all roles** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Users can view their own roles** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = user_id)`

### `user_waivers`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | — |
| waiver_id | uuid | NO | — |
| accepted_at | timestamp with time zone | YES | now() |
| waiver_version | text | NO | — |

**RLS Policies:**

- **Admins can view all waiver acceptances** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Users can accept waivers** (`INSERT`, permissive=PERMISSIVE, roles={public})
  - WITH CHECK: `(auth.uid() = user_id)`
- **Users can view their own waiver acceptances** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = user_id)`

### `volunteer_conversation_participants`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| conversation_id | uuid | NO | — |
| user_id | uuid | NO | — |
| joined_at | timestamp with time zone | NO | now() |
| last_read_at | timestamp with time zone | YES | now() |

**RLS Policies:**

- **Participants can view conversation members** (`SELECT`, permissive=PERMISSIVE, roles={authenticated})
  - USING: `((user_id = auth.uid()) OR is_conversation_participant(conversation_id, auth.uid()))`
- **Users can add participants to their conversations** (`INSERT`, permissive=PERMISSIVE, roles={public})
  - WITH CHECK: `((EXISTS ( SELECT 1
   FROM volunteer_conversations
  WHERE ((volunteer_conversations.id = volunteer_conversation_participants.conversation_id) AND (volunteer_conversations.created_by = auth.uid()))))`
- **Users can update their own participant record** (`UPDATE`, permissive=PERMISSIVE, roles={public})
  - USING: `(user_id = auth.uid())`

### `volunteer_conversations`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| name | text | YES | — |
| is_group | boolean | NO | false |
| created_by | uuid | NO | — |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Participants can update conversation** (`UPDATE`, permissive=PERMISSIVE, roles={public})
  - USING: `(EXISTS ( SELECT 1
   FROM volunteer_conversation_participants
  WHERE ((volunteer_conversation_participants.conversation_id = volunteer_conversations.id) AND (volunteer_conversation_participants.user`
  - WITH CHECK: `(EXISTS ( SELECT 1
   FROM volunteer_conversation_participants
  WHERE ((volunteer_conversation_participants.conversation_id = volunteer_conversations.id) AND (volunteer_conversation_participants.user`
- **Users can create conversations** (`INSERT`, permissive=PERMISSIVE, roles={public})
  - WITH CHECK: `(created_by = auth.uid())`
- **Users can view their conversations** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `((created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM volunteer_conversation_participants
  WHERE ((volunteer_conversation_participants.conversation_id = volunteer_conversations.id) AND (volunteer_`

### `volunteer_feedback`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | — |
| event_id | uuid | NO | — |
| signup_id | uuid | NO | — |
| did_attend | boolean | YES | — |
| lead_name | text | YES | — |
| received_clear_instructions | boolean | YES | — |
| instructions_feedback | text | YES | — |
| experience_feedback | text | YES | — |
| volunteer_likelihood_rating | integer | YES | — |
| joy_spread_rating | integer | YES | — |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |
| immediate_notification_sent | boolean | YES | false |
| morning_notification_sent | boolean | YES | false |
| final_notification_sent | boolean | YES | false |

**RLS Policies:**

- **Admins can manage all feedback** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Admins can view all feedback** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Event approvers can view feedback for their events** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(EXISTS ( SELECT 1
   FROM event_approvers ea
  WHERE ((ea.event_id = volunteer_feedback.event_id) AND (ea.approver_user_id = auth.uid()))))`
- **Users can create their own feedback** (`INSERT`, permissive=PERMISSIVE, roles={public})
  - WITH CHECK: `(auth.uid() = user_id)`
- **Users can update their own feedback** (`UPDATE`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = user_id)`
- **Users can view their own feedback** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = user_id)`

### `volunteer_messages`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| conversation_id | uuid | NO | — |
| sender_id | uuid | NO | — |
| content | text | YES | — |
| message_type | text | NO | 'text'::text |
| shared_event_id | uuid | YES | — |
| shared_photo_url | text | YES | — |
| created_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Participants can send messages** (`INSERT`, permissive=PERMISSIVE, roles={public})
  - WITH CHECK: `((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM volunteer_conversation_participants
  WHERE ((volunteer_conversation_participants.conversation_id = volunteer_messages.conversation_id) AND (vo`
- **Participants can view messages** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(EXISTS ( SELECT 1
   FROM volunteer_conversation_participants
  WHERE ((volunteer_conversation_participants.conversation_id = volunteer_messages.conversation_id) AND (volunteer_conversation_participa`

### `volunteer_ratings`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| volunteer_id | uuid | NO | — |
| event_id | uuid | NO | — |
| organization_id | uuid | YES | — |
| rated_by_admin_id | uuid | YES | — |
| rating | integer | NO | — |
| feedback | text | YES | — |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Admins can manage all ratings** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Event approvers can manage ratings for their events** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `(EXISTS ( SELECT 1
   FROM event_approvers ea
  WHERE ((ea.event_id = volunteer_ratings.event_id) AND (ea.approver_user_id = auth.uid()))))`
- **Users can view their own ratings** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = volunteer_id)`

### `waivers`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| type | text | NO | — |
| version | text | NO | — |
| content | text | NO | — |
| created_at | timestamp with time zone | YES | now() |
| active | boolean | YES | true |

**RLS Policies:**

- **Admins can manage waivers** (`ALL`, permissive=PERMISSIVE, roles={public})
  - USING: `has_role(auth.uid(), 'admin'::app_role)`
- **Anyone can view active waivers** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(active = true)`

### `wishlist`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | — |
| shop_item_id | uuid | NO | — |
| created_at | timestamp with time zone | NO | now() |

**RLS Policies:**

- **Users can add to their wishlist** (`INSERT`, permissive=PERMISSIVE, roles={public})
  - WITH CHECK: `(auth.uid() = user_id)`
- **Users can remove from their wishlist** (`DELETE`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = user_id)`
- **Users can view their own wishlist** (`SELECT`, permissive=PERMISSIVE, roles={public})
  - USING: `(auth.uid() = user_id)`

---
## Database Functions


### `has_role(uuid, app_role) → boolean`
Security definer. Checks if user has a specific role in `user_roles`.

### `search_profiles_safe(text, uuid?) → TABLE`
Security definer. Searches profiles by username/full_name (ILIKE), returns id, full_name, username, avatar_url, city, is_verified. Limit 10.

### `handle_new_user() → trigger`
Security definer. Auto-creates profile + user_role ('user') on auth.users INSERT.

### `is_event_approver(uuid, uuid) → boolean`
Security definer. Checks event_approvers table or admin role.

### `check_invite_token(text) → boolean`
Security definer. Validates admin invite tokens.

### `user_attended_event(uuid, uuid) → boolean`
Security definer. Checks post_event_reviews for attendance.

### `update_profile_stats() → trigger`
Security definer. On time_logs approved, adds hours/points to profiles.

### `update_updated_at_column() → trigger`
Sets updated_at = now() on UPDATE.

### `is_conversation_participant(uuid, uuid) → boolean`
Security definer. Checks volunteer_conversation_participants membership.

## Database Triggers

| Trigger | Table | Timing | Event | Function |
|---------|-------|--------|-------|----------|
| update_dealt_joy_videos_updated_at | dealt_joy_videos | BEFORE | UPDATE | update_updated_at_column() |
| update_device_tokens_updated_at | device_tokens | BEFORE | UPDATE | update_updated_at_column() |
| update_event_links_updated_at | event_links | BEFORE | UPDATE | update_updated_at_column() |
| update_organizations_updated_at | organizations | BEFORE | UPDATE | update_updated_at_column() |
| update_post_event_reviews_updated_at | post_event_reviews | BEFORE | UPDATE | update_updated_at_column() |
| on_time_log_approved | time_logs | AFTER | INSERT/UPDATE | update_profile_stats() |
| update_volunteer_feedback_updated_at | volunteer_feedback | BEFORE | UPDATE | update_updated_at_column() |
| update_volunteer_ratings_updated_at | volunteer_ratings | BEFORE | UPDATE | update_updated_at_column() |

---
## Edge Functions


### `admin-auth` (2278 lines)
Custom admin authentication system. Actions:
- `login` — Email/password login with PBKDF2 hashing, rate limiting
- `verify` — Session token validation
- `logout` — Session deletion
- `create` — Admin account registration (first admin auto-approved as super admin)
- `change-password` — Authenticated password change
- `request-reset` / `reset-password` — Password reset flow with 6-digit codes
- `update-profile` — Admin profile + organization updates
- `approve` / `reject` — Super admin approves/rejects pending admin accounts
- `list-pending` / `list-all` — Super admin account management
- `toggle-active` / `delete-admin` — Account lifecycle management
- `verify-user` / `reject-verification` — Volunteer verification management
- `grant-feedback-extension` — Extend feedback deadlines
- `create-invite` / `list-invites` / `delete-invite` — Admin invite management
- `toggle-manage-all-events` — Toggle org admin event permissions

### `admin-events` (2239 lines)
Event and data management. Actions:
- `create` / `update` / `delete` — Event CRUD
- `list_events` — Events with signup counts
- `list_signups` — Event signups with profiles
- `update_signup_status` — Approve/decline signups
- `check_in_volunteer` — Check-in/out management
- `get_post_event_review_data` / `submit_post_event_reviews` — Post-event reviews with Joy Points
- `create_organization` / `update_organization` — Organization management
- `add_event_link` / `delete_event_link` — Event links
- `add_organization_photo` / `delete_organization_photo` — Organization photos
- `add_organization_news` / `delete_organization_news` — News with OG metadata extraction
- `list_all_photos` — Photo gallery (bypasses RLS)
- `list_volunteers` / `get_joy_dealers_count` — Volunteer management
- `get_public_event_stats` — Public recap stats (no auth)
- Day-of management: agenda, contacts, incidents, media, messages
- `get_event_submissions` / `review_event_submission` — Event submission review
- `update_event_recap` / `publish_event_recap` — Event recaps
- Video CRUD: `list_videos`, `create_video`, `update_video`, `delete_video`
- Shop management: `list_shop_items`, `create_shop_item`, `update_shop_item`, `delete_shop_item`
- Redemption management: `list_redemptions`, `update_redemption_status`

### `admin-messages` (194 lines)
Redemption message threads for super admins:
- `get-threads` — Aggregated message threads with unread counts
- `get-messages` — Thread messages + mark as read
- `send-message` — Admin reply

### `admin-messaging` (619 lines)
Admin-to-admin and volunteer communication:
- `get-conversations` / `get-messages` / `send-message` / `start-conversation` — Admin DMs
- `get-announcements` / `send-announcement` / `mark-announcement-read` — Platform announcements
- `get-admin-list` — Available admins for DMs
- `get-vol-conversations` / `get-vol-messages` / `send-vol-message` — Volunteer inbox
- `get-org-events` / `get-event-volunteers` / `get-past-volunteer-ids` — Blast targeting
- `send-volunteer-announcement` — Mass notifications to volunteers

### `admin-upload` (149 lines)
Secure file upload. Validates MIME type (JPEG/PNG/WebP/GIF), max 10MB, allowed buckets only.

### `feedback-notifications` (219 lines)
Automated 3-tier feedback reminders: immediate (post-event), morning (next day 9AM), final (1hr before 48h deadline).

### `generate-avatar` (108 lines)
AI avatar generation using Lovable AI (Gemini Flash Image Preview). Uploads to avatars bucket.

### `google-places` (193 lines)
Google Places API (New) proxy: autocomplete (addresses + venues), place details with address parsing.

### `send-notification-email` (478 lines)
Email notifications via Resend API: time log approved/rejected, photo added, signup confirmed/declined, admin notifications, pending photos reminders.

### `send-push-notification` (148 lines)
FCM Legacy HTTP API push notifications. Supports single/batch users via device_tokens table.

### `verify-ein` (150 lines)
EIN verification via Candid Charity Check API. Validates 501(c) tax-exempt status.

## Required Secrets

| Secret | Used By |
|--------|---------|
| SUPABASE_URL | All edge functions |
| SUPABASE_SERVICE_ROLE_KEY | All edge functions (bypasses RLS) |
| SUPABASE_ANON_KEY | generate-avatar, send-notification-email, send-push-notification |
| GOOGLE_MAPS_API_KEY | google-places |
| FCM_SERVER_KEY | send-push-notification |
| RESEND_API_KEY | send-notification-email |
| CANDID_API_KEY | verify-ein |
| LOVABLE_API_KEY | generate-avatar |

---
## Authentication Architecture


### Volunteer/User Auth
- Standard Supabase Auth (`auth.users` → `profiles` table)
- Apple Sign-In + email/password
- `handle_new_user` trigger auto-creates profile + role
- Session managed via `onAuthStateChange`

### Admin Auth (Custom)
- Separate `admin_users` table with PBKDF2 password hashing
- Session tokens stored in `admin_sessions` (24h expiry)
- All admin operations via Edge Functions using service role key
- Rate limiting: 5 attempts per 15 minutes per email+IP
- Two-tier: Super Admin (platform-wide) vs Organization Admin (scoped)

## Realtime Subscriptions


The following tables use Supabase Realtime for live updates:
- `volunteer_messages` — Friend-to-friend chat
- `volunteer_conversation_participants` — Unread tracking
- `notifications` — In-app notification badges
- `event_signups` — Live signup counts
- `event_day_of_messages` — Day-of event chat

Admin messaging uses 5-second polling (not Realtime) due to custom auth.
