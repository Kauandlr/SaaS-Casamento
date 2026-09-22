ALTER TABLE "weddings" ADD COLUMN "public_slug" text;
ALTER TABLE "weddings" ADD COLUMN "whatsapp_message_template" text;
CREATE UNIQUE INDEX "idx_weddings_public_slug" ON "weddings" ("public_slug");

CREATE TABLE "guest_invitation_groups" (
  "id" uuid PRIMARY KEY,
  "wedding_id" uuid NOT NULL REFERENCES "weddings"("id") ON DELETE CASCADE,
  "group_key" text NOT NULL,
  "name" text NOT NULL,
  "type" text NOT NULL DEFAULT 'individual',
  "responsible_name" text NOT NULL,
  "responsible_phone" text NOT NULL DEFAULT '',
  "family_name" text NOT NULL DEFAULT '',
  "custom_salutation" text NOT NULL DEFAULT '',
  "additional_guest_limit" integer NOT NULL DEFAULT 0 CHECK ("additional_guest_limit" BETWEEN 0 AND 20),
  "public_token" text NOT NULL,
  "last_shared_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
CREATE UNIQUE INDEX "idx_guest_invitation_groups_token" ON "guest_invitation_groups" ("public_token");
CREATE UNIQUE INDEX "idx_guest_invitation_groups_wedding_key" ON "guest_invitation_groups" ("wedding_id", "group_key");
CREATE INDEX "idx_guest_invitation_groups_wedding" ON "guest_invitation_groups" ("wedding_id");

ALTER TABLE "guests" ADD COLUMN "invitation_group_id" uuid REFERENCES "guest_invitation_groups"("id") ON DELETE SET NULL;
CREATE INDEX "idx_guests_invitation_group" ON "guests" ("invitation_group_id");

CREATE TABLE "invitation_companions" (
  "id" uuid PRIMARY KEY,
  "invitation_group_id" uuid NOT NULL REFERENCES "guest_invitation_groups"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "age_group" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
CREATE INDEX "idx_invitation_companions_group" ON "invitation_companions" ("invitation_group_id");

CREATE TABLE "invitation_share_attempts" (
  "id" uuid PRIMARY KEY,
  "wedding_id" uuid NOT NULL REFERENCES "weddings"("id") ON DELETE CASCADE,
  "invitation_group_id" uuid REFERENCES "guest_invitation_groups"("id") ON DELETE SET NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "kind" text NOT NULL CHECK ("kind" IN ('convite inicial', 'lembrete', 'site geral')),
  "channel" text NOT NULL CHECK ("channel" = 'WhatsApp manual'),
  "created_at" timestamp with time zone NOT NULL
);
CREATE INDEX "idx_invitation_share_attempts_wedding" ON "invitation_share_attempts" ("wedding_id", "created_at");
CREATE INDEX "idx_invitation_share_attempts_group" ON "invitation_share_attempts" ("invitation_group_id");
