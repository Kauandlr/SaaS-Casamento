ALTER TABLE "guests" ADD COLUMN "group_type" text DEFAULT 'individual' NOT NULL;
ALTER TABLE "guests" ADD COLUMN "role" text DEFAULT 'convidado' NOT NULL;
UPDATE "guests" SET "group_type" = CASE
  WHEN "group_name" ILIKE 'família%' THEN 'família'
  ELSE 'outro'
END WHERE "group_name" <> '';
