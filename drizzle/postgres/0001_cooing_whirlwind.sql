ALTER TABLE "checklist_items" ADD COLUMN "link_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "link_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "household_checklist_items" ADD COLUMN "link_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "link_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "link_url" text DEFAULT '' NOT NULL;