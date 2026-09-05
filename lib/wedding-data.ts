import type { PgPreparedStatement } from '@/db';
import { getDb } from '@/db';
import type { WeddingSnapshot } from './wedding-types';

export type WorkspaceIdentity = {
  userId: string;
  email: string;
  displayName: string;
};

export type WorkspaceInput = {
  personOne: string;
  personTwo: string;
  weddingDate: string;
  city: string;
  budgetCents: number;
  savedCents: number;
  monthlyCapacityCents: number;
  reservePercent: number;
  guestEstimate: number;
  categories: Array<{ name: string; plannedCents: number }>;
};

type Row = Record<string, unknown>;
const db = getDb;
export const id = () => crypto.randomUUID();
export const now = () => new Date().toISOString();

function text(row: Row, key: string): string {
  if (typeof row[key] === 'string') return row[key] as string;
  if (row[key] instanceof Date) return row[key].toISOString().slice(0, 10);
  return '';
}

function number(row: Row, key: string): number {
  const value = row[key];
  return typeof value === 'number' ? value : Number(value ?? 0);
}

function bool(row: Row, key: string): boolean {
  return row[key] === true || row[key] === 1 || row[key] === '1';
}

async function rows(statement: PgPreparedStatement): Promise<Row[]> {
  const result = await statement.all<Row>();
  return result.results;
}

async function memberWeddingId(userId: string): Promise<string | null> {
  const row = await db()
    .prepare('SELECT wedding_id FROM wedding_members WHERE user_id = $1 LIMIT 1')
    .bind(userId)
    .first<Row>();
  return row ? text(row, 'wedding_id') : null;
}

export async function hasWorkspace(userId: string): Promise<boolean> {
  return Boolean(await memberWeddingId(userId));
}

export async function createWorkspace(
  identity: WorkspaceIdentity,
  input: WorkspaceInput,
): Promise<string> {
  const existing = await memberWeddingId(identity.userId);
  if (existing) return existing;

  const weddingId = id();
  const createdAt = now();
  const title = `Casamento ${input.personOne} & ${input.personTwo}`;
  const statements = [
    db()
      .prepare(`INSERT INTO users (id, email, display_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name, updated_at = EXCLUDED.updated_at`)
      .bind(identity.userId, identity.email, identity.displayName, createdAt, createdAt),
    db()
      .prepare(`INSERT INTO weddings (
        id, owner_user_id, title, person_one, person_two, wedding_date, city,
        budget_cents, saved_cents, monthly_capacity_cents, reserve_percent,
        guest_estimate, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        weddingId, identity.userId, title, input.personOne, input.personTwo,
        input.weddingDate, input.city, input.budgetCents, input.savedCents,
        input.monthlyCapacityCents, input.reservePercent, input.guestEstimate,
        createdAt, createdAt,
      ),
    db()
      .prepare(`INSERT INTO wedding_members (
        id, wedding_id, user_id, email, role, permissions, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(id(), weddingId, identity.userId, identity.email, 'owner', '["*"]', createdAt),
    db()
      .prepare(`INSERT INTO household_plans (
        id, wedding_id, budget_cents, allocated_savings_cents, include_in_general,
        target_date, housing_type, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id(), weddingId, 0, 0, false, input.weddingDate, 'ainda não definido', createdAt, createdAt),
    ...input.categories.map((category, position) =>
      db()
        .prepare(`INSERT INTO budget_categories (
          id, wedding_id, name, planned_cents, estimated_cents, contracted_cents,
          paid_cents, position, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id(), weddingId, category.name, category.plannedCents, category.plannedCents, 0, 0, position, createdAt),
    ),
  ];
  await db().batch(statements);
  return weddingId;
}

export async function getSnapshot(identity: WorkspaceIdentity): Promise<WeddingSnapshot> {
  const weddingId = await requireWeddingId(identity.userId);
  const [
    weddingRow,
    categoryRows,
    paymentRows,
    vendorRows,
    guestRows,
    checklistRows,
    householdPlanRow,
    householdCategoryRows,
    householdItemRows,
    householdGiftRows,
    householdChecklistRows,
    householdPaymentRows,
  ] = await Promise.all([
    db().prepare('SELECT * FROM weddings WHERE id = ? AND owner_user_id = ?').bind(weddingId, identity.userId).first<Row>(),
    rows(db().prepare('SELECT * FROM budget_categories WHERE wedding_id = ? ORDER BY position, name').bind(weddingId)),
    rows(db().prepare('SELECT * FROM payments WHERE wedding_id = ? ORDER BY due_date').bind(weddingId)),
    rows(db().prepare('SELECT * FROM vendors WHERE wedding_id = ? ORDER BY favorite DESC, name').bind(weddingId)),
    rows(db().prepare('SELECT * FROM guests WHERE wedding_id = ? ORDER BY full_name').bind(weddingId)),
    rows(db().prepare(`SELECT * FROM checklist_items WHERE wedding_id = ? ORDER BY CASE status WHEN 'concluído' THEN 1 ELSE 0 END, due_date`).bind(weddingId)),
    db().prepare('SELECT * FROM household_plans WHERE wedding_id = ?').bind(weddingId).first<Row>(),
    rows(db().prepare('SELECT * FROM household_categories WHERE wedding_id = ? ORDER BY position, name').bind(weddingId)),
    rows(db().prepare(`SELECT * FROM household_items WHERE wedding_id = ? ORDER BY CASE status WHEN 'removido da lista' THEN 1 ELSE 0 END, CASE priority WHEN 'essencial' THEN 0 WHEN 'importante' THEN 1 WHEN 'pode esperar' THEN 2 ELSE 3 END, name`).bind(weddingId)),
    rows(db().prepare('SELECT * FROM household_gifts WHERE wedding_id = ? ORDER BY gifted_at DESC').bind(weddingId)),
    rows(db().prepare(`SELECT * FROM household_checklist_items WHERE wedding_id = ? ORDER BY CASE status WHEN 'concluído' THEN 1 ELSE 0 END, due_date`).bind(weddingId)),
    rows(db().prepare(`SELECT hp.*, hi.name AS item_name FROM household_payments hp JOIN household_items hi ON hi.id = hp.item_id WHERE hp.wedding_id = ? ORDER BY hp.due_date`).bind(weddingId)),
  ]);

  if (!weddingRow || !householdPlanRow) throw new Error('Workspace não encontrado.');

  return {
    wedding: {
      id: text(weddingRow, 'id'), title: text(weddingRow, 'title'),
      personOne: text(weddingRow, 'person_one'), personTwo: text(weddingRow, 'person_two'),
      weddingDate: text(weddingRow, 'wedding_date'), city: text(weddingRow, 'city'),
      budgetCents: number(weddingRow, 'budget_cents'), savedCents: number(weddingRow, 'saved_cents'),
      monthlyCapacityCents: number(weddingRow, 'monthly_capacity_cents'),
      reservePercent: number(weddingRow, 'reserve_percent'), guestEstimate: number(weddingRow, 'guest_estimate'),
    },
    categories: categoryRows.map((row) => ({ id: text(row, 'id'), name: text(row, 'name'), plannedCents: number(row, 'planned_cents'), contractedCents: number(row, 'contracted_cents'), paidCents: number(row, 'paid_cents') })),
    payments: paymentRows.map((row) => ({ id: text(row, 'id'), title: text(row, 'title'), vendorName: text(row, 'vendor_name'), categoryId: text(row, 'category_id') || null, amountCents: number(row, 'amount_cents'), dueDate: text(row, 'due_date'), status: text(row, 'status'), payer: text(row, 'payer'), linkUrl: text(row, 'link_url') })),
    vendors: vendorRows.map((row) => ({ id: text(row, 'id'), name: text(row, 'name'), company: text(row, 'company'), category: text(row, 'category'), phone: text(row, 'phone'), email: text(row, 'email'), linkUrl: text(row, 'link_url'), quotedCents: number(row, 'quoted_cents'), status: text(row, 'status'), rating: number(row, 'rating'), favorite: bool(row, 'favorite') })),
    guests: guestRows.map((row) => ({ id: text(row, 'id'), fullName: text(row, 'full_name'), side: text(row, 'side'), groupName: text(row, 'group_name'), ageGroup: text(row, 'age_group'), rsvp: text(row, 'rsvp'), linkUrl: text(row, 'link_url') })),
    checklist: checklistRows.map((row) => ({ id: text(row, 'id'), title: text(row, 'title'), category: text(row, 'category'), responsible: text(row, 'responsible'), priority: text(row, 'priority'), dueDate: text(row, 'due_date'), status: text(row, 'status'), linkUrl: text(row, 'link_url') })),
    household: {
      plan: { id: text(householdPlanRow, 'id'), budgetCents: number(householdPlanRow, 'budget_cents'), allocatedSavingsCents: number(householdPlanRow, 'allocated_savings_cents'), includeInGeneral: bool(householdPlanRow, 'include_in_general'), targetDate: text(householdPlanRow, 'target_date'), housingType: text(householdPlanRow, 'housing_type') },
      categories: householdCategoryRows.map((row) => ({ id: text(row, 'id'), name: text(row, 'name'), position: number(row, 'position') })),
      items: householdItemRows.map((row) => ({ id: text(row, 'id'), categoryId: text(row, 'category_id') || null, name: text(row, 'name'), desiredQuantity: number(row, 'desired_quantity'), acquiredQuantity: number(row, 'acquired_quantity'), priority: text(row, 'priority'), status: text(row, 'status'), estimatedUnitCents: number(row, 'estimated_unit_cents'), minPriceCents: number(row, 'min_price_cents'), maxPriceCents: number(row, 'max_price_cents'), actualPaidCents: number(row, 'actual_paid_cents'), brand: text(row, 'brand'), model: text(row, 'model'), store: text(row, 'store'), productUrl: text(row, 'product_url'), responsible: text(row, 'responsible'), owner: text(row, 'owner'), notes: text(row, 'notes'), giftIntent: text(row, 'gift_intent'), purchaseTiming: text(row, 'purchase_timing'), desiredDate: text(row, 'desired_date') || null, purchasedAt: text(row, 'purchased_at') || null, warrantyMonths: number(row, 'warranty_months'), warrantyEndsAt: text(row, 'warranty_ends_at') || null, imageUrl: text(row, 'image_url'), favorite: bool(row, 'favorite') })),
      gifts: householdGiftRows.map((row) => ({ id: text(row, 'id'), itemId: text(row, 'item_id'), quantity: number(row, 'quantity'), giver: text(row, 'giver'), giftedAt: text(row, 'gifted_at'), approximateValueCents: number(row, 'approximate_value_cents'), notes: text(row, 'notes') })),
      checklist: householdChecklistRows.map((row) => ({ id: text(row, 'id'), title: text(row, 'title'), responsible: text(row, 'responsible'), dueDate: text(row, 'due_date'), status: text(row, 'status'), linkUrl: text(row, 'link_url') })),
      payments: householdPaymentRows.map((row) => ({ id: text(row, 'id'), itemId: text(row, 'item_id'), itemName: text(row, 'item_name'), installmentNumber: number(row, 'installment_number'), amountCents: number(row, 'amount_cents'), dueDate: text(row, 'due_date'), status: text(row, 'status') })),
    },
  };
}

export async function requireWeddingId(userId: string): Promise<string> {
  const weddingId = await memberWeddingId(userId);
  if (!weddingId) throw new Error('Workspace não encontrado.');
  return weddingId;
}

export async function logActivity(weddingId: string, userId: string, action: string, entityType: string, entityId: string): Promise<void> {
  await db().prepare('INSERT INTO activity_log (id, wedding_id, user_id, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id(), weddingId, userId, action, entityType, entityId, now()).run();
}

export { db };
