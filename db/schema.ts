import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const createdAt = () =>
  timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull();

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex('idx_users_email').on(table.email)],
);

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('idx_auth_sessions_token_hash').on(table.tokenHash),
    index('idx_auth_sessions_user').on(table.userId),
    index('idx_auth_sessions_expiry').on(table.expiresAt),
  ],
);

export const authLoginAttempts = pgTable(
  'auth_login_attempts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fingerprint: text('fingerprint').notNull(),
    attemptedAt: timestamp('attempted_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
  },
  (table) => [
    index('idx_auth_attempts_fingerprint_time').on(
      table.fingerprint,
      table.attemptedAt,
    ),
  ],
);

export const weddings = pgTable(
  'weddings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    personOne: text('person_one').notNull(),
    personTwo: text('person_two').notNull(),
    weddingDate: date('wedding_date').notNull(),
    city: text('city').notNull().default(''),
    budgetCents: integer('budget_cents').notNull().default(0),
    savedCents: integer('saved_cents').notNull().default(0),
    monthlyCapacityCents: integer('monthly_capacity_cents').notNull().default(0),
    reservePercent: integer('reserve_percent').notNull().default(10),
    guestEstimate: integer('guest_estimate').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex('idx_weddings_owner_user_id').on(table.ownerUserId)],
);

export const weddingMembers = pgTable(
  'wedding_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull(),
    permissions: text('permissions').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('idx_wedding_members_wedding_user').on(
      table.weddingId,
      table.userId,
    ),
    index('idx_wedding_members_user_id').on(table.userId),
  ],
);

export const budgetCategories = pgTable(
  'budget_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    plannedCents: integer('planned_cents').notNull().default(0),
    estimatedCents: integer('estimated_cents').notNull().default(0),
    contractedCents: integer('contracted_cents').notNull().default(0),
    paidCents: integer('paid_cents').notNull().default(0),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_budget_categories_wedding').on(table.weddingId),
    uniqueIndex('idx_budget_categories_wedding_name').on(
      table.weddingId,
      table.name,
    ),
  ],
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => budgetCategories.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    vendorName: text('vendor_name').notNull().default(''),
    amountCents: integer('amount_cents').notNull(),
    dueDate: date('due_date').notNull(),
    status: text('status').notNull(),
    payer: text('payer').notNull().default('Casal'),
    linkUrl: text('link_url').notNull().default(''),
    paidAt: date('paid_at'),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_payments_wedding_due').on(table.weddingId, table.dueDate),
    index('idx_payments_wedding_status').on(table.weddingId, table.status),
    check(
      'payments_amount_cents_nonnegative',
      sql`${table.amountCents} >= 0`,
    ),
  ],
);

export const vendors = pgTable(
  'vendors',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    company: text('company').notNull().default(''),
    category: text('category').notNull(),
    phone: text('phone').notNull().default(''),
    email: text('email').notNull().default(''),
    linkUrl: text('link_url').notNull().default(''),
    quotedCents: integer('quoted_cents').notNull().default(0),
    status: text('status').notNull(),
    rating: integer('rating').notNull().default(0),
    favorite: boolean('favorite').notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_vendors_wedding_category').on(table.weddingId, table.category),
    index('idx_vendors_wedding_status').on(table.weddingId, table.status),
  ],
);

export const guests = pgTable(
  'guests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    fullName: text('full_name').notNull(),
    side: text('side').notNull(),
    groupName: text('group_name').notNull().default(''),
    ageGroup: text('age_group').notNull(),
    rsvp: text('rsvp').notNull(),
    linkUrl: text('link_url').notNull().default(''),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_guests_wedding_rsvp').on(table.weddingId, table.rsvp),
    index('idx_guests_wedding_group').on(table.weddingId, table.groupName),
  ],
);

export const checklistItems = pgTable(
  'checklist_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    category: text('category').notNull(),
    responsible: text('responsible').notNull().default('Casal'),
    priority: text('priority').notNull(),
    dueDate: date('due_date').notNull(),
    status: text('status').notNull(),
    linkUrl: text('link_url').notNull().default(''),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_checklist_wedding_status').on(table.weddingId, table.status),
    index('idx_checklist_wedding_due').on(table.weddingId, table.dueDate),
  ],
);

export const activityLog = pgTable(
  'activity_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    createdAt: createdAt(),
  },
  (table) => [index('idx_activity_wedding_created').on(table.weddingId, table.createdAt)],
);

export const aiConversations = pgTable(
  'ai_conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex('idx_ai_conversations_wedding').on(table.weddingId)],
);

export const aiMessages = pgTable(
  'ai_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => aiConversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    createdAt: createdAt(),
  },
  (table) => [index('idx_ai_messages_conversation_created').on(table.conversationId, table.createdAt)],
);

export const aiActionProposals = pgTable(
  'ai_action_proposals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => aiConversations.id, { onDelete: 'cascade' }),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    action: text('action').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    payloadJson: text('payload_json').notNull(),
    status: text('status').notNull().default('pendente'),
    createdAt: createdAt(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_ai_proposals_wedding_status').on(table.weddingId, table.status),
    index('idx_ai_proposals_conversation').on(table.conversationId),
  ],
);

export const householdPlans = pgTable(
  'household_plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    budgetCents: integer('budget_cents').notNull().default(0),
    allocatedSavingsCents: integer('allocated_savings_cents').notNull().default(0),
    includeInGeneral: boolean('include_in_general').notNull().default(false),
    targetDate: date('target_date').notNull(),
    housingType: text('housing_type').notNull().default('ainda não definido'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex('idx_household_plans_wedding').on(table.weddingId)],
);

export const householdCategories = pgTable(
  'household_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('idx_household_categories_wedding_name').on(
      table.weddingId,
      table.name,
    ),
    index('idx_household_categories_wedding').on(table.weddingId),
  ],
);

export const householdItems = pgTable(
  'household_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => householdCategories.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    desiredQuantity: integer('desired_quantity').notNull().default(1),
    acquiredQuantity: integer('acquired_quantity').notNull().default(0),
    priority: text('priority').notNull(),
    status: text('status').notNull(),
    estimatedUnitCents: integer('estimated_unit_cents').notNull().default(0),
    minPriceCents: integer('min_price_cents').notNull().default(0),
    maxPriceCents: integer('max_price_cents').notNull().default(0),
    actualPaidCents: integer('actual_paid_cents').notNull().default(0),
    brand: text('brand').notNull().default(''),
    model: text('model').notNull().default(''),
    store: text('store').notNull().default(''),
    productUrl: text('product_url').notNull().default(''),
    responsible: text('responsible').notNull().default('Casal'),
    owner: text('owner').notNull().default(''),
    notes: text('notes').notNull().default(''),
    giftIntent: text('gift_intent').notNull().default('a decidir'),
    purchaseTiming: text('purchase_timing').notNull().default('antes do casamento'),
    desiredDate: date('desired_date'),
    purchasedAt: date('purchased_at'),
    orderNumber: text('order_number').notNull().default(''),
    warrantyMonths: integer('warranty_months').notNull().default(0),
    warrantyEndsAt: date('warranty_ends_at'),
    imageUrl: text('image_url').notNull().default(''),
    favorite: boolean('favorite').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('idx_household_items_wedding_status').on(table.weddingId, table.status),
    index('idx_household_items_wedding_category').on(table.weddingId, table.categoryId),
    index('idx_household_items_wedding_priority').on(table.weddingId, table.priority),
  ],
);

export const householdItemOptions = pgTable(
  'household_item_options',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => householdItems.id, { onDelete: 'cascade' }),
    brand: text('brand').notNull().default(''),
    model: text('model').notNull().default(''),
    store: text('store').notNull().default(''),
    priceCents: integer('price_cents').notNull().default(0),
    capacity: text('capacity').notNull().default(''),
    productUrl: text('product_url').notNull().default(''),
    notes: text('notes').notNull().default(''),
    selected: boolean('selected').notNull().default(false),
    favorite: boolean('favorite').notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [index('idx_household_options_item').on(table.weddingId, table.itemId)],
);

export const householdPurchases = pgTable(
  'household_purchases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => householdItems.id, { onDelete: 'cascade' }),
    amountCents: integer('amount_cents').notNull(),
    quantity: integer('quantity').notNull().default(1),
    paymentMethod: text('payment_method').notNull().default('à vista'),
    installments: integer('installments').notNull().default(1),
    purchasedAt: date('purchased_at').notNull(),
    createdAt: createdAt(),
  },
  (table) => [index('idx_household_purchases_wedding_date').on(table.weddingId, table.purchasedAt)],
);

export const householdPayments = pgTable(
  'household_payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    purchaseId: uuid('purchase_id')
      .notNull()
      .references(() => householdPurchases.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => householdItems.id, { onDelete: 'cascade' }),
    installmentNumber: integer('installment_number').notNull(),
    amountCents: integer('amount_cents').notNull(),
    dueDate: date('due_date').notNull(),
    status: text('status').notNull().default('pendente'),
    paidAt: date('paid_at'),
    createdAt: createdAt(),
  },
  (table) => [index('idx_household_payments_wedding_due').on(table.weddingId, table.dueDate)],
);

export const householdGifts = pgTable(
  'household_gifts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => householdItems.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull().default(1),
    giver: text('giver').notNull(),
    giftedAt: date('gifted_at').notNull(),
    approximateValueCents: integer('approximate_value_cents').notNull().default(0),
    notes: text('notes').notNull().default(''),
    createdAt: createdAt(),
  },
  (table) => [index('idx_household_gifts_wedding_item').on(table.weddingId, table.itemId)],
);

export const householdFiles = pgTable(
  'household_files',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => householdItems.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    filename: text('filename').notNull(),
    objectKey: text('object_key').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [index('idx_household_files_wedding_item').on(table.weddingId, table.itemId)],
);

export const householdChecklistItems = pgTable(
  'household_checklist_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    responsible: text('responsible').notNull().default('Casal'),
    dueDate: date('due_date').notNull(),
    status: text('status').notNull().default('pendente'),
    linkUrl: text('link_url').notNull().default(''),
    createdAt: createdAt(),
  },
  (table) => [index('idx_household_checklist_wedding_status').on(table.weddingId, table.status)],
);
