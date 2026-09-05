CREATE TABLE `activity_log` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_activity_wedding_created` ON `activity_log` (`wedding_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `budget_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`name` text NOT NULL,
	`planned_cents` integer DEFAULT 0 NOT NULL,
	`estimated_cents` integer DEFAULT 0 NOT NULL,
	`contracted_cents` integer DEFAULT 0 NOT NULL,
	`paid_cents` integer DEFAULT 0 NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_budget_categories_wedding` ON `budget_categories` (`wedding_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_budget_categories_wedding_name` ON `budget_categories` (`wedding_id`,`name`);--> statement-breakpoint
CREATE TABLE `checklist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`responsible` text DEFAULT 'Casal' NOT NULL,
	`priority` text NOT NULL,
	`due_date` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_checklist_wedding_status` ON `checklist_items` (`wedding_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_checklist_wedding_due` ON `checklist_items` (`wedding_id`,`due_date`);--> statement-breakpoint
CREATE TABLE `guests` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`full_name` text NOT NULL,
	`side` text NOT NULL,
	`group_name` text DEFAULT '' NOT NULL,
	`age_group` text NOT NULL,
	`rsvp` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_guests_wedding_rsvp` ON `guests` (`wedding_id`,`rsvp`);--> statement-breakpoint
CREATE INDEX `idx_guests_wedding_group` ON `guests` (`wedding_id`,`group_name`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`category_id` text,
	`title` text NOT NULL,
	`vendor_name` text DEFAULT '' NOT NULL,
	`amount_cents` integer NOT NULL,
	`due_date` text NOT NULL,
	`status` text NOT NULL,
	`payer` text DEFAULT 'Casal' NOT NULL,
	`paid_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `budget_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_payments_wedding_due` ON `payments` (`wedding_id`,`due_date`);--> statement-breakpoint
CREATE INDEX `idx_payments_wedding_status` ON `payments` (`wedding_id`,`status`);--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`name` text NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`category` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`quoted_cents` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`rating` integer DEFAULT 0 NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_vendors_wedding_category` ON `vendors` (`wedding_id`,`category`);--> statement-breakpoint
CREATE INDEX `idx_vendors_wedding_status` ON `vendors` (`wedding_id`,`status`);--> statement-breakpoint
CREATE TABLE `wedding_members` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`permissions` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_wedding_members_wedding_user` ON `wedding_members` (`wedding_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_wedding_members_user_id` ON `wedding_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `weddings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`title` text NOT NULL,
	`person_one` text NOT NULL,
	`person_two` text NOT NULL,
	`wedding_date` text NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`budget_cents` integer DEFAULT 0 NOT NULL,
	`saved_cents` integer DEFAULT 0 NOT NULL,
	`monthly_capacity_cents` integer DEFAULT 0 NOT NULL,
	`reserve_percent` integer DEFAULT 10 NOT NULL,
	`guest_estimate` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_weddings_owner_user_id` ON `weddings` (`owner_user_id`);