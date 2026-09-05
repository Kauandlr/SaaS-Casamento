CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL,
	"attempted_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"name" text NOT NULL,
	"planned_cents" integer DEFAULT 0 NOT NULL,
	"estimated_cents" integer DEFAULT 0 NOT NULL,
	"contracted_cents" integer DEFAULT 0 NOT NULL,
	"paid_cents" integer DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"responsible" text DEFAULT 'Casal' NOT NULL,
	"priority" text NOT NULL,
	"due_date" date NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"side" text NOT NULL,
	"group_name" text DEFAULT '' NOT NULL,
	"age_group" text NOT NULL,
	"rsvp" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"title" text NOT NULL,
	"responsible" text DEFAULT 'Casal' NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"filename" text NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_gifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"giver" text NOT NULL,
	"gifted_at" date NOT NULL,
	"approximate_value_cents" integer DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_item_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"brand" text DEFAULT '' NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"store" text DEFAULT '' NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"capacity" text DEFAULT '' NOT NULL,
	"product_url" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"selected" boolean DEFAULT false NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"category_id" uuid,
	"name" text NOT NULL,
	"desired_quantity" integer DEFAULT 1 NOT NULL,
	"acquired_quantity" integer DEFAULT 0 NOT NULL,
	"priority" text NOT NULL,
	"status" text NOT NULL,
	"estimated_unit_cents" integer DEFAULT 0 NOT NULL,
	"min_price_cents" integer DEFAULT 0 NOT NULL,
	"max_price_cents" integer DEFAULT 0 NOT NULL,
	"actual_paid_cents" integer DEFAULT 0 NOT NULL,
	"brand" text DEFAULT '' NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"store" text DEFAULT '' NOT NULL,
	"product_url" text DEFAULT '' NOT NULL,
	"responsible" text DEFAULT 'Casal' NOT NULL,
	"owner" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"gift_intent" text DEFAULT 'a decidir' NOT NULL,
	"purchase_timing" text DEFAULT 'antes do casamento' NOT NULL,
	"desired_date" date,
	"purchased_at" date,
	"order_number" text DEFAULT '' NOT NULL,
	"warranty_months" integer DEFAULT 0 NOT NULL,
	"warranty_ends_at" date,
	"image_url" text DEFAULT '' NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"purchase_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"installment_number" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"paid_at" date,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"budget_cents" integer DEFAULT 0 NOT NULL,
	"allocated_savings_cents" integer DEFAULT 0 NOT NULL,
	"include_in_general" boolean DEFAULT false NOT NULL,
	"target_date" date NOT NULL,
	"housing_type" text DEFAULT 'ainda não definido' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"payment_method" text DEFAULT 'à vista' NOT NULL,
	"installments" integer DEFAULT 1 NOT NULL,
	"purchased_at" date NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"category_id" uuid,
	"title" text NOT NULL,
	"vendor_name" text DEFAULT '' NOT NULL,
	"amount_cents" integer NOT NULL,
	"due_date" date NOT NULL,
	"status" text NOT NULL,
	"payer" text DEFAULT 'Casal' NOT NULL,
	"paid_at" date,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "payments_amount_cents_nonnegative" CHECK ("payments"."amount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"name" text NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"category" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"quoted_cents" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"rating" integer DEFAULT 0 NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wedding_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"permissions" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" text NOT NULL,
	"title" text NOT NULL,
	"person_one" text NOT NULL,
	"person_two" text NOT NULL,
	"wedding_date" date NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"budget_cents" integer DEFAULT 0 NOT NULL,
	"saved_cents" integer DEFAULT 0 NOT NULL,
	"monthly_capacity_cents" integer DEFAULT 0 NOT NULL,
	"reserve_percent" integer DEFAULT 10 NOT NULL,
	"guest_estimate" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_categories" ADD CONSTRAINT "household_categories_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_checklist_items" ADD CONSTRAINT "household_checklist_items_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_files" ADD CONSTRAINT "household_files_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_files" ADD CONSTRAINT "household_files_item_id_household_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."household_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_gifts" ADD CONSTRAINT "household_gifts_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_gifts" ADD CONSTRAINT "household_gifts_item_id_household_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."household_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_item_options" ADD CONSTRAINT "household_item_options_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_item_options" ADD CONSTRAINT "household_item_options_item_id_household_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."household_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_items" ADD CONSTRAINT "household_items_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_items" ADD CONSTRAINT "household_items_category_id_household_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."household_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_payments" ADD CONSTRAINT "household_payments_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_payments" ADD CONSTRAINT "household_payments_purchase_id_household_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."household_purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_payments" ADD CONSTRAINT "household_payments_item_id_household_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."household_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_plans" ADD CONSTRAINT "household_plans_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_purchases" ADD CONSTRAINT "household_purchases_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_purchases" ADD CONSTRAINT "household_purchases_item_id_household_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."household_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_category_id_budget_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."budget_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wedding_members" ADD CONSTRAINT "wedding_members_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wedding_members" ADD CONSTRAINT "wedding_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weddings" ADD CONSTRAINT "weddings_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activity_wedding_created" ON "activity_log" USING btree ("wedding_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_auth_attempts_fingerprint_time" ON "auth_login_attempts" USING btree ("fingerprint","attempted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_auth_sessions_token_hash" ON "auth_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_auth_sessions_user" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_auth_sessions_expiry" ON "auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_budget_categories_wedding" ON "budget_categories" USING btree ("wedding_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_budget_categories_wedding_name" ON "budget_categories" USING btree ("wedding_id","name");--> statement-breakpoint
CREATE INDEX "idx_checklist_wedding_status" ON "checklist_items" USING btree ("wedding_id","status");--> statement-breakpoint
CREATE INDEX "idx_checklist_wedding_due" ON "checklist_items" USING btree ("wedding_id","due_date");--> statement-breakpoint
CREATE INDEX "idx_guests_wedding_rsvp" ON "guests" USING btree ("wedding_id","rsvp");--> statement-breakpoint
CREATE INDEX "idx_guests_wedding_group" ON "guests" USING btree ("wedding_id","group_name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_household_categories_wedding_name" ON "household_categories" USING btree ("wedding_id","name");--> statement-breakpoint
CREATE INDEX "idx_household_categories_wedding" ON "household_categories" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "idx_household_checklist_wedding_status" ON "household_checklist_items" USING btree ("wedding_id","status");--> statement-breakpoint
CREATE INDEX "idx_household_files_wedding_item" ON "household_files" USING btree ("wedding_id","item_id");--> statement-breakpoint
CREATE INDEX "idx_household_gifts_wedding_item" ON "household_gifts" USING btree ("wedding_id","item_id");--> statement-breakpoint
CREATE INDEX "idx_household_options_item" ON "household_item_options" USING btree ("wedding_id","item_id");--> statement-breakpoint
CREATE INDEX "idx_household_items_wedding_status" ON "household_items" USING btree ("wedding_id","status");--> statement-breakpoint
CREATE INDEX "idx_household_items_wedding_category" ON "household_items" USING btree ("wedding_id","category_id");--> statement-breakpoint
CREATE INDEX "idx_household_items_wedding_priority" ON "household_items" USING btree ("wedding_id","priority");--> statement-breakpoint
CREATE INDEX "idx_household_payments_wedding_due" ON "household_payments" USING btree ("wedding_id","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_household_plans_wedding" ON "household_plans" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "idx_household_purchases_wedding_date" ON "household_purchases" USING btree ("wedding_id","purchased_at");--> statement-breakpoint
CREATE INDEX "idx_payments_wedding_due" ON "payments" USING btree ("wedding_id","due_date");--> statement-breakpoint
CREATE INDEX "idx_payments_wedding_status" ON "payments" USING btree ("wedding_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_vendors_wedding_category" ON "vendors" USING btree ("wedding_id","category");--> statement-breakpoint
CREATE INDEX "idx_vendors_wedding_status" ON "vendors" USING btree ("wedding_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_wedding_members_wedding_user" ON "wedding_members" USING btree ("wedding_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_wedding_members_user_id" ON "wedding_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_weddings_owner_user_id" ON "weddings" USING btree ("owner_user_id");