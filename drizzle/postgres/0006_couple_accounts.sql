ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_wedding_members_one_workspace" ON "wedding_members" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_wedding_members_one_partner" ON "wedding_members" ("wedding_id") WHERE "role" = 'partner';
CREATE TABLE IF NOT EXISTS "wedding_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "wedding_id" uuid NOT NULL REFERENCES "weddings"("id") ON DELETE CASCADE,
  "invited_by" text NOT NULL REFERENCES "users"("id"),
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "accepted_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_wedding_invites_token_hash" ON "wedding_invites" ("token_hash");
CREATE INDEX IF NOT EXISTS "idx_wedding_invites_wedding" ON "wedding_invites" ("wedding_id");
