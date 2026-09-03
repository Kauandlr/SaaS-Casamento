import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const weddings = sqliteTable(
  'weddings',
  {
    id: text('id').primaryKey(),
    ownerUserId: text('owner_user_id').notNull(),
    title: text('title').notNull(),
    personOne: text('person_one').notNull(),
    personTwo: text('person_two').notNull(),
    weddingDate: text('wedding_date').notNull(),
    city: text('city').notNull().default(''),
    budgetCents: integer('budget_cents').notNull().default(0),
    savedCents: integer('saved_cents').notNull().default(0),
    monthlyCapacityCents: integer('monthly_capacity_cents')
      .notNull()
      .default(0),
    reservePercent: integer('reserve_percent').notNull().default(10),
    guestEstimate: integer('guest_estimate').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('idx_weddings_owner_user_id').on(table.ownerUserId)],
);

export const weddingMembers = sqliteTable(
  'wedding_members',
  {
    id: text('id').primaryKey(),
    weddingId: text('wedding_id')
      .notNull()
      .references(() => weddings.id),
    userId: text('user_id').notNull(),
    email: text('email').notNull(),
    role: text('role').notNull(),
    permissions: text('permissions').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_wedding_members_wedding_user').on(
      table.weddingId,
      table.userId,
    ),
    index('idx_wedding_members_user_id').on(table.userId),
  ],
);

export const budgetCategories = sqliteTable(
  'budget_categories',
  {
    id: text('id').primaryKey(),
    weddingId: text('wedding_id')
      .notNull()
      .references(() => weddings.id),
    name: text('name').notNull(),
    plannedCents: integer('planned_cents').notNull().default(0),
    estimatedCents: integer('estimated_cents').notNull().default(0),
    contractedCents: integer('contracted_cents').notNull().default(0),
    paidCents: integer('paid_cents').notNull().default(0),
    position: integer('position').notNull().default(0),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_budget_categories_wedding').on(table.weddingId),
    uniqueIndex('idx_budget_categories_wedding_name').on(
      table.weddingId,
      table.name,
    ),
  ],
);

export const payments = sqliteTable(
  'payments',
  {
    id: text('id').primaryKey(),
    weddingId: text('wedding_id')
      .notNull()
      .references(() => weddings.id),
    categoryId: text('category_id').references(() => budgetCategories.id),
    title: text('title').notNull(),
    vendorName: text('vendor_name').notNull().default(''),
    amountCents: integer('amount_cents').notNull(),
    dueDate: text('due_date').notNull(),
    status: text('status').notNull(),
    payer: text('payer').notNull().default('Casal'),
    paidAt: text('paid_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_payments_wedding_due').on(table.weddingId, table.dueDate),
    index('idx_payments_wedding_status').on(table.weddingId, table.status),
  ],
);

export const vendors = sqliteTable(
  'vendors',
  {
    id: text('id').primaryKey(),
    weddingId: text('wedding_id')
      .notNull()
      .references(() => weddings.id),
    name: text('name').notNull(),
    company: text('company').notNull().default(''),
    category: text('category').notNull(),
    phone: text('phone').notNull().default(''),
    email: text('email').notNull().default(''),
    quotedCents: integer('quoted_cents').notNull().default(0),
    status: text('status').notNull(),
    rating: integer('rating').notNull().default(0),
    favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_vendors_wedding_category').on(table.weddingId, table.category),
    index('idx_vendors_wedding_status').on(table.weddingId, table.status),
  ],
);

export const guests = sqliteTable(
  'guests',
  {
    id: text('id').primaryKey(),
    weddingId: text('wedding_id')
      .notNull()
      .references(() => weddings.id),
    fullName: text('full_name').notNull(),
    side: text('side').notNull(),
    groupName: text('group_name').notNull().default(''),
    ageGroup: text('age_group').notNull(),
    rsvp: text('rsvp').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_guests_wedding_rsvp').on(table.weddingId, table.rsvp),
    index('idx_guests_wedding_group').on(table.weddingId, table.groupName),
  ],
);

export const checklistItems = sqliteTable(
  'checklist_items',
  {
    id: text('id').primaryKey(),
    weddingId: text('wedding_id')
      .notNull()
      .references(() => weddings.id),
    title: text('title').notNull(),
    category: text('category').notNull(),
    responsible: text('responsible').notNull().default('Casal'),
    priority: text('priority').notNull(),
    dueDate: text('due_date').notNull(),
    status: text('status').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_checklist_wedding_status').on(table.weddingId, table.status),
    index('idx_checklist_wedding_due').on(table.weddingId, table.dueDate),
  ],
);

export const activityLog = sqliteTable(
  'activity_log',
  {
    id: text('id').primaryKey(),
    weddingId: text('wedding_id')
      .notNull()
      .references(() => weddings.id),
    userId: text('user_id').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_activity_wedding_created').on(table.weddingId, table.createdAt),
  ],
);

export const householdPlans = sqliteTable(
  'household_plans',
  {
    id: text('id').primaryKey(),
    weddingId: text('wedding_id')
      .notNull()
      .references(() => weddings.id),
    budgetCents: integer('budget_cents').notNull().default(0),
    allocatedSavingsCents: integer('allocated_savings_cents')
      .notNull()
      .default(0),
    includeInGeneral: integer('include_in_general', { mode: 'boolean' })
      .notNull()
      .default(false),
    targetDate: text('target_date').notNull(),
    housingType: text('housing_type').notNull().default('ainda não definido'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('idx_household_plans_wedding').on(table.weddingId)],
);

export const householdCategories = sqliteTable(
  'household_categories',
  {
    id: text('id').primaryKey(),
    weddingId: text('wedding_id')
      .notNull()
      .references(() => weddings.id),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_household_categories_wedding_name').on(
      table.weddingId,
      table.name,
    ),
    index('idx_household_categories_wedding').on(table.weddingId),
  ],
);

export const householdItems = sqliteTable(
  'household_items',
  {
    id: text('id').primaryKey(),
    weddingId: text('wedding_id')
      .notNull()
      .references(() => weddings.id),
    categoryId: text('category_id').references(() => householdCategories.id),
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
    purchaseTiming: text('purchase_timing')
      .notNull()
      .default('antes do casamento'),
    desiredDate: text('desired_date'),
    purchasedAt: text('purchased_at'),
    orderNumber: text('order_number').notNull().default(''),
    warrantyMonths: integer('warranty_months').notNull().default(0),
    warrantyEndsAt: text('warranty_ends_at'),
    imageUrl: text('image_url').notNull().default(''),
    favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_household_items_wedding_status').on(
      table.weddingId,
      table.status,
    ),
    index('idx_household_items_wedding_category').on(
      table.weddingId,
      table.categoryId,
    ),
    index('idx_household_items_wedding_priority').on(
      table.weddingId,
      table.priority,
    ),
  ],
);

export const householdItemOptions = sqliteTable(
  'household_item_options',
  {
    id: text('id').primaryKey(),
    weddingId: text('wedding_id')
      .notNull()
      .references(() => weddings.id),
    itemId: text('item_id')
      .notNull()
      .references(() => householdItems.id),
    brand: text('brand').notNull().default(''),
    model: text('model').notNull().default(''),
    store: text('store').notNull().default(''),
    priceCents: integer('price_cents').notNull().default(0),
    capacity: text('capacity').notNull().default(''),
    productUrl: text('product_url').notNull().default(''),
    notes: text('notes').notNull().default(''),
    selected: integer('selected', { mode: 'boolean' }).notNull().default(false),
    favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_household_options_item').on(table.weddingId, table.itemId),
  ],
);

export const householdPurchases = sqliteTable(
  'household_purchases',
  {
    id: text('id').primaryKey(),
    weddingId: text('wedding_id')
      .notNull()
      .references(() => weddings.id),
    itemId: text('item_id')
      .notNull()
      .references(() => householdItems.id),
    amountCents: integer('amount_cents').notNull(),
    quantity: integer('quantity').notNull().default(1),
    paymentMethod: text('payment_method').notNull().default('à vista'),
    installments: integer('installments').notNull().default(1),
    purchasedAt: text('purchased_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_household_purchases_wedding_date').on(
      table.weddingId,
      table.purchasedAt,
    ),
  ],
);

export const householdPayments = sqliteTable(
  'household_payments',
  {
    id: text('id').primaryKey(),
    weddingId: text('wedding_id')
      .notNull()
      .references(() => weddings.id),
    purchaseId: text('purchase_id')
      .notNull()
      .references(() => householdPurchases.id),
    itemId: text('item_id')
      .notNull()
      .references(() => householdItems.id),
    installmentNumber: integer('installment_number').notNull(),
    amountCents: integer('amount_cents').notNull(),
    dueDate: text('due_date').notNull(),
    status: text('status').notNull().default('pendente'),
    paidAt: text('paid_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_household_payments_wedding_due').on(
      table.weddingId,
      table.dueDate,
    ),
  ],
);

export const householdGifts = sqliteTable(
  'household_gifts',
  {
    id: text('id').primaryKey(),
    weddingId: text('wedding_id')
      .notNull()
      .references(() => weddings.id),
    itemId: text('item_id')
      .notNull()
      .references(() => householdItems.id),
    quantity: integer('quantity').notNull().default(1),
    giver: text('giver').notNull(),
    giftedAt: text('gifted_at').notNull(),
    approximateValueCents: integer('approximate_value_cents')
      .notNull()
      .default(0),
    notes: text('notes').notNull().default(''),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_household_gifts_wedding_item').on(table.weddingId, table.itemId),
  ],
);

export const householdFiles = sqliteTable(
  'household_files',
  {
    id: text('id').primaryKey(),
    weddingId: text('wedding_id')
      .notNull()
      .references(() => weddings.id),
    itemId: text('item_id')
      .notNull()
      .references(() => householdItems.id),
    kind: text('kind').notNull(),
    filename: text('filename').notNull(),
    objectKey: text('object_key').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull().default(0),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_household_files_wedding_item').on(table.weddingId, table.itemId),
  ],
);

export const householdChecklistItems = sqliteTable(
  'household_checklist_items',
  {
    id: text('id').primaryKey(),
    weddingId: text('wedding_id')
      .notNull()
      .references(() => weddings.id),
    title: text('title').notNull(),
    responsible: text('responsible').notNull().default('Casal'),
    dueDate: text('due_date').notNull(),
    status: text('status').notNull().default('pendente'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_household_checklist_wedding_status').on(
      table.weddingId,
      table.status,
    ),
  ],
);
