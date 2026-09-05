CREATE TABLE `household_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_household_categories_wedding_name` ON `household_categories` (`wedding_id`,`name`);--> statement-breakpoint
CREATE INDEX `idx_household_categories_wedding` ON `household_categories` (`wedding_id`);--> statement-breakpoint
CREATE TABLE `household_checklist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`title` text NOT NULL,
	`responsible` text DEFAULT 'Casal' NOT NULL,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'pendente' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_household_checklist_wedding_status` ON `household_checklist_items` (`wedding_id`,`status`);--> statement-breakpoint
CREATE TABLE `household_files` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`item_id` text NOT NULL,
	`kind` text NOT NULL,
	`filename` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `household_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_household_files_wedding_item` ON `household_files` (`wedding_id`,`item_id`);--> statement-breakpoint
CREATE TABLE `household_gifts` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`item_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`giver` text NOT NULL,
	`gifted_at` text NOT NULL,
	`approximate_value_cents` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `household_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_household_gifts_wedding_item` ON `household_gifts` (`wedding_id`,`item_id`);--> statement-breakpoint
CREATE TABLE `household_item_options` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`item_id` text NOT NULL,
	`brand` text DEFAULT '' NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`store` text DEFAULT '' NOT NULL,
	`price_cents` integer DEFAULT 0 NOT NULL,
	`capacity` text DEFAULT '' NOT NULL,
	`product_url` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`selected` integer DEFAULT false NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `household_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_household_options_item` ON `household_item_options` (`wedding_id`,`item_id`);--> statement-breakpoint
CREATE TABLE `household_items` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`category_id` text,
	`name` text NOT NULL,
	`desired_quantity` integer DEFAULT 1 NOT NULL,
	`acquired_quantity` integer DEFAULT 0 NOT NULL,
	`priority` text NOT NULL,
	`status` text NOT NULL,
	`estimated_unit_cents` integer DEFAULT 0 NOT NULL,
	`min_price_cents` integer DEFAULT 0 NOT NULL,
	`max_price_cents` integer DEFAULT 0 NOT NULL,
	`actual_paid_cents` integer DEFAULT 0 NOT NULL,
	`brand` text DEFAULT '' NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`store` text DEFAULT '' NOT NULL,
	`product_url` text DEFAULT '' NOT NULL,
	`responsible` text DEFAULT 'Casal' NOT NULL,
	`owner` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`gift_intent` text DEFAULT 'a decidir' NOT NULL,
	`purchase_timing` text DEFAULT 'antes do casamento' NOT NULL,
	`desired_date` text,
	`purchased_at` text,
	`order_number` text DEFAULT '' NOT NULL,
	`warranty_months` integer DEFAULT 0 NOT NULL,
	`warranty_ends_at` text,
	`image_url` text DEFAULT '' NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `household_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_household_items_wedding_status` ON `household_items` (`wedding_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_household_items_wedding_category` ON `household_items` (`wedding_id`,`category_id`);--> statement-breakpoint
CREATE INDEX `idx_household_items_wedding_priority` ON `household_items` (`wedding_id`,`priority`);--> statement-breakpoint
CREATE TABLE `household_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`purchase_id` text NOT NULL,
	`item_id` text NOT NULL,
	`installment_number` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'pendente' NOT NULL,
	`paid_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`purchase_id`) REFERENCES `household_purchases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `household_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_household_payments_wedding_due` ON `household_payments` (`wedding_id`,`due_date`);--> statement-breakpoint
CREATE TABLE `household_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`budget_cents` integer DEFAULT 0 NOT NULL,
	`allocated_savings_cents` integer DEFAULT 0 NOT NULL,
	`include_in_general` integer DEFAULT false NOT NULL,
	`target_date` text NOT NULL,
	`housing_type` text DEFAULT 'ainda não definido' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_household_plans_wedding` ON `household_plans` (`wedding_id`);--> statement-breakpoint
CREATE TABLE `household_purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`item_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`payment_method` text DEFAULT 'à vista' NOT NULL,
	`installments` integer DEFAULT 1 NOT NULL,
	`purchased_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `household_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_household_purchases_wedding_date` ON `household_purchases` (`wedding_id`,`purchased_at`);