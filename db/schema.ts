import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
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
    passwordHash: text('password_hash'),
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
    publicSlug: text('public_slug'),
    whatsappMessageTemplate: text('whatsapp_message_template'),
    rsvpDeadline: date('rsvp_deadline'),
    showVenueAfterRsvp: boolean('show_venue_after_rsvp').notNull().default(false),
    venueName: text('venue_name').notNull().default(''),
    venueAddress: text('venue_address').notNull().default(''),
    venueMapsUrl: text('venue_maps_url').notNull().default(''),
    palette: jsonb('palette'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('idx_weddings_owner_user_id').on(table.ownerUserId),
    uniqueIndex('idx_weddings_public_slug').on(table.publicSlug),
  ],
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
    uniqueIndex('idx_wedding_members_one_workspace').on(table.userId),
    uniqueIndex('idx_wedding_members_one_partner').on(table.weddingId).where(sql`${table.role} = 'partner'`),
  ],
);

export const securityRateLimits = pgTable(
  'security_rate_limits',
  {
    key: text('key').primaryKey(),
    windowStart: timestamp('window_start', { withTimezone: true, mode: 'string' }).notNull(),
    count: integer('count').notNull(),
  },
  (table) => [index('idx_security_rate_limits_window_start').on(table.windowStart)],
);

export const weddingInvites = pgTable(
  'wedding_invites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    weddingId: uuid('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
    invitedBy: text('invited_by').notNull().references(() => users.id),
    invitedEmail: text('invited_email').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'string' }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('idx_wedding_invites_token_hash').on(table.tokenHash),
    index('idx_wedding_invites_wedding').on(table.weddingId),
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

export const guestInvitationGroups = pgTable(
  'guest_invitation_groups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    groupKey: text('group_key').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull().default('individual'),
    responsibleName: text('responsible_name').notNull(),
    responsiblePhone: text('responsible_phone').notNull().default(''),
    familyName: text('family_name').notNull().default(''),
    customSalutation: text('custom_salutation').notNull().default(''),
    additionalGuestLimit: integer('additional_guest_limit').notNull().default(0),
    publicToken: text('public_token').notNull(),
    lastSharedAt: timestamp('last_shared_at', { withTimezone: true, mode: 'string' }),
    lastResponseAt: timestamp('last_response_at', { withTimezone: true, mode: 'string' }),
    rsvpNote: text('rsvp_note').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('idx_guest_invitation_groups_token').on(table.publicToken),
    uniqueIndex('idx_guest_invitation_groups_wedding_key').on(table.weddingId, table.groupKey),
    index('idx_guest_invitation_groups_wedding').on(table.weddingId),
  ],
);

export const guests = pgTable(
  'guests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    invitationGroupId: uuid('invitation_group_id').references(() => guestInvitationGroups.id, {
      onDelete: 'set null',
    }),
    fullName: text('full_name').notNull(),
    side: text('side').notNull(),
    groupName: text('group_name').notNull().default(''),
    groupType: text('group_type').notNull().default('individual'),
    role: text('role').notNull().default('convidado'),
    ageGroup: text('age_group').notNull(),
    rsvp: text('rsvp').notNull(),
    rsvpRespondedAt: timestamp('rsvp_responded_at', { withTimezone: true, mode: 'string' }),
    linkUrl: text('link_url').notNull().default(''),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_guests_wedding_rsvp').on(table.weddingId, table.rsvp),
    index('idx_guests_wedding_group').on(table.weddingId, table.groupName),
    index('idx_guests_invitation_group').on(table.invitationGroupId),
  ],
);

export const invitationCompanions = pgTable(
  'invitation_companions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    invitationGroupId: uuid('invitation_group_id')
      .notNull()
      .references(() => guestInvitationGroups.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    ageGroup: text('age_group').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('idx_invitation_companions_group').on(table.invitationGroupId)],
);

export const invitationShareAttempts = pgTable(
  'invitation_share_attempts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => weddings.id, { onDelete: 'cascade' }),
    invitationGroupId: uuid('invitation_group_id').references(() => guestInvitationGroups.id, {
      onDelete: 'set null',
    }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind').notNull(),
    channel: text('channel').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_invitation_share_attempts_wedding').on(table.weddingId, table.createdAt),
    index('idx_invitation_share_attempts_group').on(table.invitationGroupId),
  ],
);

export const rsvpLookupChallenges = pgTable(
  'rsvp_lookup_challenges',
  {
    tokenHash: text('token_hash').primaryKey(),
    weddingId: uuid('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
    invitationIds: jsonb('invitation_ids').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index('idx_rsvp_lookup_challenges_expiry').on(table.expiresAt)],
);

export const rsvpAccessSessions = pgTable(
  'rsvp_access_sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    weddingId: uuid('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
    invitationGroupId: uuid('invitation_group_id').notNull().references(() => guestInvitationGroups.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_rsvp_access_sessions_invitation').on(table.invitationGroupId),
    index('idx_rsvp_access_sessions_expiry').on(table.expiresAt),
  ],
);

export const rsvpSubmissions = pgTable(
  'rsvp_submissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    weddingId: uuid('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
    invitationGroupId: uuid('invitation_group_id').notNull().references(() => guestInvitationGroups.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    note: text('note').notNull().default(''),
    createdAt: createdAt(),
  },
  (table) => [index('idx_rsvp_submissions_invitation_created').on(table.invitationGroupId, table.createdAt)],
);

export const rsvpResponseHistory = pgTable(
  'rsvp_response_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    submissionId: uuid('submission_id').notNull().references(() => rsvpSubmissions.id, { onDelete: 'cascade' }),
    guestId: uuid('guest_id').references(() => guests.id, { onDelete: 'set null' }),
    subjectName: text('subject_name').notNull(),
    subjectAgeGroup: text('subject_age_group').notNull().default(''),
    previousResponse: text('previous_response').notNull(),
    newResponse: text('new_response').notNull(),
    createdAt: createdAt(),
  },
  (table) => [index('idx_rsvp_response_history_submission').on(table.submissionId)],
);

export const rsvpSecurityEvents = pgTable(
  'rsvp_security_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    weddingId: uuid('wedding_id').references(() => weddings.id, { onDelete: 'cascade' }),
    invitationGroupId: uuid('invitation_group_id').references(() => guestInvitationGroups.id, { onDelete: 'set null' }),
    fingerprint: text('fingerprint').notNull(),
    kind: text('kind').notNull(),
    createdAt: createdAt(),
  },
  (table) => [index('idx_rsvp_security_events_created').on(table.createdAt)],
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
  (table) => [index('idx_ai_conversations_wedding').on(table.weddingId)],
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
