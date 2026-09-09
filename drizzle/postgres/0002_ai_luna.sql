CREATE TABLE IF NOT EXISTS "ai_conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "wedding_id" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "ai_conversations_wedding_id_fkey" FOREIGN KEY ("wedding_id") REFERENCES "weddings"("id") ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_ai_conversations_wedding" ON "ai_conversations" ("wedding_id");
CREATE TABLE IF NOT EXISTS "ai_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "idx_ai_messages_conversation_created" ON "ai_messages" ("conversation_id", "created_at");
CREATE TABLE IF NOT EXISTS "ai_action_proposals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL,
  "wedding_id" uuid NOT NULL,
  "action" text NOT NULL,
  "title" text NOT NULL,
  "summary" text NOT NULL,
  "payload_json" text NOT NULL,
  "status" text DEFAULT 'pendente' NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "confirmed_at" timestamp with time zone,
  CONSTRAINT "ai_action_proposals_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE cascade,
  CONSTRAINT "ai_action_proposals_wedding_id_fkey" FOREIGN KEY ("wedding_id") REFERENCES "weddings"("id") ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "idx_ai_proposals_wedding_status" ON "ai_action_proposals" ("wedding_id", "status");
CREATE INDEX IF NOT EXISTS "idx_ai_proposals_conversation" ON "ai_action_proposals" ("conversation_id");
