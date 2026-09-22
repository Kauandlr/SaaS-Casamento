ALTER TABLE "weddings" ADD COLUMN "rsvp_deadline" date;
ALTER TABLE "weddings" ADD COLUMN "show_venue_after_rsvp" boolean DEFAULT false NOT NULL;
ALTER TABLE "weddings" ADD COLUMN "venue_name" text DEFAULT '' NOT NULL;
ALTER TABLE "weddings" ADD COLUMN "venue_address" text DEFAULT '' NOT NULL;
ALTER TABLE "weddings" ADD COLUMN "venue_maps_url" text DEFAULT '' NOT NULL;

ALTER TABLE "guest_invitation_groups" ADD COLUMN "last_response_at" timestamp with time zone;
ALTER TABLE "guest_invitation_groups" ADD COLUMN "rsvp_note" text DEFAULT '' NOT NULL;
ALTER TABLE "guests" ADD COLUMN "rsvp_responded_at" timestamp with time zone;

CREATE TABLE "rsvp_lookup_challenges" (
  "token_hash" text PRIMARY KEY,
  "wedding_id" uuid NOT NULL REFERENCES "weddings"("id") ON DELETE CASCADE,
  "invitation_ids" jsonb NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);
CREATE INDEX "idx_rsvp_lookup_challenges_expiry" ON "rsvp_lookup_challenges" ("expires_at");

CREATE TABLE "rsvp_access_sessions" (
  "token_hash" text PRIMARY KEY,
  "wedding_id" uuid NOT NULL REFERENCES "weddings"("id") ON DELETE CASCADE,
  "invitation_group_id" uuid NOT NULL REFERENCES "guest_invitation_groups"("id") ON DELETE CASCADE,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);
CREATE INDEX "idx_rsvp_access_sessions_invitation" ON "rsvp_access_sessions" ("invitation_group_id");
CREATE INDEX "idx_rsvp_access_sessions_expiry" ON "rsvp_access_sessions" ("expires_at");

CREATE TABLE "rsvp_submissions" (
  "id" uuid PRIMARY KEY,
  "wedding_id" uuid NOT NULL REFERENCES "weddings"("id") ON DELETE CASCADE,
  "invitation_group_id" uuid NOT NULL REFERENCES "guest_invitation_groups"("id") ON DELETE CASCADE,
  "source" text NOT NULL CHECK ("source" IN ('guest', 'admin')),
  "actor_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "note" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);
CREATE INDEX "idx_rsvp_submissions_invitation_created" ON "rsvp_submissions" ("invitation_group_id", "created_at");

CREATE TABLE "rsvp_response_history" (
  "id" uuid PRIMARY KEY,
  "submission_id" uuid NOT NULL REFERENCES "rsvp_submissions"("id") ON DELETE CASCADE,
  "guest_id" uuid REFERENCES "guests"("id") ON DELETE SET NULL,
  "subject_name" text NOT NULL,
  "subject_age_group" text DEFAULT '' NOT NULL,
  "previous_response" text NOT NULL,
  "new_response" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);
CREATE INDEX "idx_rsvp_response_history_submission" ON "rsvp_response_history" ("submission_id");

CREATE TABLE "rsvp_security_events" (
  "id" uuid PRIMARY KEY,
  "wedding_id" uuid REFERENCES "weddings"("id") ON DELETE CASCADE,
  "invitation_group_id" uuid REFERENCES "guest_invitation_groups"("id") ON DELETE SET NULL,
  "fingerprint" text NOT NULL,
  "kind" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);
CREATE INDEX "idx_rsvp_security_events_created" ON "rsvp_security_events" ("created_at");
