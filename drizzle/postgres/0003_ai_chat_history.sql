DROP INDEX IF EXISTS "idx_ai_conversations_wedding";
CREATE INDEX IF NOT EXISTS "idx_ai_conversations_wedding" ON "ai_conversations" ("wedding_id");
