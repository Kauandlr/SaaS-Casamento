ALTER TABLE "wedding_invites" ADD COLUMN "invited_email" text NOT NULL DEFAULT '';
DELETE FROM "wedding_invites" WHERE "accepted_at" IS NULL AND "invited_email" = '';
ALTER TABLE "wedding_invites" ALTER COLUMN "invited_email" DROP DEFAULT;
