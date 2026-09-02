import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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
    monthlyCapacityCents: integer('monthly_capacity_cents').notNull().default(0),
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
    weddingId: text('wedding_id').notNull().references(() => weddings.id),
    userId: text('user_id').notNull(),
    email: text('email').notNull(),
    role: text('role').notNull(),
    permissions: text('permissions').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_wedding_members_wedding_user').on(table.weddingId, table.userId),
    index('idx_wedding_members_user_id').on(table.userId),
  ],
);

export const budgetCategories = sqliteTable(
  'budget_categories',
  {
    id: text('id').primaryKey(),
    weddingId: text('wedding_id').notNull().references(() => weddings.id),
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
    uniqueIndex('idx_budget_categories_wedding_name').on(table.weddingId, table.name),
  ],
);

export const payments = sqliteTable(
  'payments',
  {
    id: text('id').primaryKey(),
    weddingId: text('wedding_id').notNull().references(() => weddings.id),
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
    weddingId: text('wedding_id').notNull().references(() => weddings.id),
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
    weddingId: text('wedding_id').notNull().references(() => weddings.id),
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
    weddingId: text('wedding_id').notNull().references(() => weddings.id),
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
    weddingId: text('wedding_id').notNull().references(() => weddings.id),
    userId: text('user_id').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_activity_wedding_created').on(table.weddingId, table.createdAt)],
);
