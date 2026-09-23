UPDATE "guests" SET "side" = 'Ambos' WHERE "side" <> 'Ambos';
UPDATE "guests"
SET "group_name" = '', "group_type" = 'individual'
WHERE "group_name" ~* '^convidados[[:space:]]*[—-]';
ALTER TABLE "guests" ALTER COLUMN "side" SET DEFAULT 'Ambos';
ALTER TABLE "guests" ADD CONSTRAINT "guests_side_couple_check" CHECK ("side" = 'Ambos');
