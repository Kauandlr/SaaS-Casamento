import { env } from 'cloudflare:workers';
import type { WeddingSnapshot } from './wedding-types';

type SeedIdentity = {
  userId: string;
  email: string;
  displayName: string;
};

type Row = Record<string, unknown>;

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function text(row: Row, key: string): string {
  return typeof row[key] === 'string' ? row[key] : '';
}

function number(row: Row, key: string): number {
  return typeof row[key] === 'number' ? row[key] : Number(row[key] ?? 0);
}

function db() {
  if (!env.DB) throw new Error('Banco de dados indisponível.');
  return env.DB;
}

async function memberWeddingId(userId: string): Promise<string | null> {
  const row = await db()
    .prepare('SELECT wedding_id FROM wedding_members WHERE user_id = ? LIMIT 1')
    .bind(userId)
    .first<Row>();
  return row ? text(row, 'wedding_id') : null;
}

export async function ensureWorkspace(identity: SeedIdentity): Promise<string> {
  const existing = await memberWeddingId(identity.userId);
  if (existing) return existing;

  const weddingId = id();
  const createdAt = now();
  const weddingDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 228)
    .toISOString()
    .slice(0, 10);

  const categories = [
    ['Espaço & buffet', 1760000, 1284000, 640000],
    ['Foto & filme', 800000, 464000, 180000],
    ['Música', 500000, 205000, 80000],
    ['Decoração', 420000, 0, 0],
    ['Trajes & beleza', 310000, 176000, 94000],
    ['Papelaria', 145000, 53000, 26000],
  ] as const;
  const categoryRows = categories.map(([name, planned, contracted, paid], position) => ({
    id: id(),
    name,
    planned,
    contracted,
    paid,
    position,
  }));

  const statements = [
    db()
      .prepare(`INSERT INTO weddings (
        id, owner_user_id, title, person_one, person_two, wedding_date, city,
        budget_cents, saved_cents, monthly_capacity_cents, reserve_percent,
        guest_estimate, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        weddingId,
        identity.userId,
        'Casamento Kauan & Luana',
        'Kauan',
        'Luana',
        weddingDate,
        'São Paulo, SP',
        3450000,
        1640000,
        270000,
        10,
        92,
        createdAt,
        createdAt,
      ),
    db()
      .prepare(`INSERT INTO wedding_members (
        id, wedding_id, user_id, email, role, permissions, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(id(), weddingId, identity.userId, identity.email, 'owner', '["*"]', createdAt),
    ...categoryRows.map((category) =>
      db()
        .prepare(`INSERT INTO budget_categories (
          id, wedding_id, name, planned_cents, estimated_cents, contracted_cents,
          paid_cents, position, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          category.id,
          weddingId,
          category.name,
          category.planned,
          category.contracted,
          category.contracted,
          category.paid,
          category.position,
          createdAt,
        ),
    ),
    db()
      .prepare(`INSERT INTO payments (
        id, wedding_id, category_id, title, vendor_name, amount_cents, due_date,
        status, payer, paid_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id(), weddingId, categoryRows[0].id, 'Parcela do espaço', 'Casa Ipê', 164000, offsetDate(4), 'próximo', 'Casal', null, createdAt),
    db()
      .prepare(`INSERT INTO payments (
        id, wedding_id, category_id, title, vendor_name, amount_cents, due_date,
        status, payer, paid_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id(), weddingId, categoryRows[2].id, 'Sinal da banda', 'Banda Aurora', 80000, offsetDate(16), 'futuro', 'Kauan', null, createdAt),
    db()
      .prepare(`INSERT INTO payments (
        id, wedding_id, category_id, title, vendor_name, amount_cents, due_date,
        status, payer, paid_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id(), weddingId, categoryRows[1].id, 'Entrada fotografia', 'Clara Luz Estúdio', 180000, offsetDate(-9), 'pago', 'Luana', offsetDate(-9), createdAt),
    db()
      .prepare(`INSERT INTO vendors (
        id, wedding_id, name, company, category, phone, email, quoted_cents,
        status, rating, favorite, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id(), weddingId, 'Marina Salles', 'Clara Luz Estúdio', 'Fotografia', '(11) 98432-7716', 'marina@claraluz.com.br', 464000, 'favorito', 5, 1, createdAt),
    db()
      .prepare(`INSERT INTO vendors (
        id, wedding_id, name, company, category, phone, email, quoted_cents,
        status, rating, favorite, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id(), weddingId, 'Rafael Moura', 'Casa Ipê', 'Espaço', '(11) 96318-4205', 'eventos@casaipe.com.br', 1284000, 'contratado', 5, 1, createdAt),
    ...[
      ['Helena Ribeiro', 'Pessoa 1', 'Família Ribeiro', 'adulto', 'confirmado'],
      ['Caio Ribeiro', 'Pessoa 1', 'Família Ribeiro', 'adulto', 'confirmado'],
      ['Beatriz Nogueira', 'Pessoa 2', 'Amigos faculdade', 'adulto', 'aguardando'],
      ['Miguel Nogueira', 'Pessoa 2', 'Amigos faculdade', 'criança', 'aguardando'],
      ['Paula Martins', 'Ambos', 'Padrinhos', 'adulto', 'confirmado'],
    ].map(([fullName, side, groupName, ageGroup, rsvp]) =>
      db()
        .prepare(`INSERT INTO guests (
          id, wedding_id, full_name, side, group_name, age_group, rsvp, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id(), weddingId, fullName, side, groupName, ageGroup, rsvp, createdAt),
    ),
    ...[
      ['Escolher fornecedor de fotografia', 'Fornecedores', 'Casal', 'essencial', offsetDate(12), 'em andamento'],
      ['Revisar lista inicial de convidados', 'Convidados', 'Luana', 'importante', offsetDate(7), 'pendente'],
      ['Definir orçamento de decoração', 'Financeiro', 'Kauan', 'importante', offsetDate(18), 'pendente'],
      ['Agendar degustação do buffet', 'Alimentação', 'Casal', 'opcional', offsetDate(26), 'aguardando'],
    ].map(([title, category, responsible, priority, dueDate, status]) =>
      db()
        .prepare(`INSERT INTO checklist_items (
          id, wedding_id, title, category, responsible, priority, due_date,
          status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id(), weddingId, title, category, responsible, priority, dueDate, status, createdAt),
    ),
  ];

  await db().batch(statements);
  return weddingId;
}

function offsetDate(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function rows(statement: D1PreparedStatement): Promise<Row[]> {
  const result = await statement.all<Row>();
  return result.results ?? [];
}

export async function getSnapshot(identity: SeedIdentity): Promise<WeddingSnapshot> {
  const weddingId = await ensureWorkspace(identity);
  const [weddingRow, categoryRows, paymentRows, vendorRows, guestRows, checklistRows] = await Promise.all([
    db().prepare('SELECT * FROM weddings WHERE id = ? AND owner_user_id = ?').bind(weddingId, identity.userId).first<Row>(),
    rows(db().prepare('SELECT * FROM budget_categories WHERE wedding_id = ? ORDER BY position, name').bind(weddingId)),
    rows(db().prepare('SELECT * FROM payments WHERE wedding_id = ? ORDER BY due_date').bind(weddingId)),
    rows(db().prepare('SELECT * FROM vendors WHERE wedding_id = ? ORDER BY favorite DESC, name').bind(weddingId)),
    rows(db().prepare('SELECT * FROM guests WHERE wedding_id = ? ORDER BY full_name').bind(weddingId)),
    rows(db().prepare(`SELECT * FROM checklist_items WHERE wedding_id = ? ORDER BY CASE status WHEN 'concluído' THEN 1 ELSE 0 END, due_date`).bind(weddingId)),
  ]);

  if (!weddingRow) throw new Error('Workspace não encontrado.');

  return {
    wedding: {
      id: text(weddingRow, 'id'),
      title: text(weddingRow, 'title'),
      personOne: text(weddingRow, 'person_one'),
      personTwo: text(weddingRow, 'person_two'),
      weddingDate: text(weddingRow, 'wedding_date'),
      city: text(weddingRow, 'city'),
      budgetCents: number(weddingRow, 'budget_cents'),
      savedCents: number(weddingRow, 'saved_cents'),
      monthlyCapacityCents: number(weddingRow, 'monthly_capacity_cents'),
      reservePercent: number(weddingRow, 'reserve_percent'),
      guestEstimate: number(weddingRow, 'guest_estimate'),
    },
    categories: categoryRows.map((row) => ({
      id: text(row, 'id'),
      name: text(row, 'name'),
      plannedCents: number(row, 'planned_cents'),
      contractedCents: number(row, 'contracted_cents'),
      paidCents: number(row, 'paid_cents'),
    })),
    payments: paymentRows.map((row) => ({
      id: text(row, 'id'),
      title: text(row, 'title'),
      vendorName: text(row, 'vendor_name'),
      categoryId: text(row, 'category_id') || null,
      amountCents: number(row, 'amount_cents'),
      dueDate: text(row, 'due_date'),
      status: text(row, 'status'),
      payer: text(row, 'payer'),
    })),
    vendors: vendorRows.map((row) => ({
      id: text(row, 'id'),
      name: text(row, 'name'),
      company: text(row, 'company'),
      category: text(row, 'category'),
      phone: text(row, 'phone'),
      email: text(row, 'email'),
      quotedCents: number(row, 'quoted_cents'),
      status: text(row, 'status'),
      rating: number(row, 'rating'),
      favorite: number(row, 'favorite') === 1,
    })),
    guests: guestRows.map((row) => ({
      id: text(row, 'id'),
      fullName: text(row, 'full_name'),
      side: text(row, 'side'),
      groupName: text(row, 'group_name'),
      ageGroup: text(row, 'age_group'),
      rsvp: text(row, 'rsvp'),
    })),
    checklist: checklistRows.map((row) => ({
      id: text(row, 'id'),
      title: text(row, 'title'),
      category: text(row, 'category'),
      responsible: text(row, 'responsible'),
      priority: text(row, 'priority'),
      dueDate: text(row, 'due_date'),
      status: text(row, 'status'),
    })),
  };
}

export async function requireWeddingId(userId: string): Promise<string> {
  const weddingId = await memberWeddingId(userId);
  if (!weddingId) throw new Error('Workspace não encontrado.');
  return weddingId;
}

export async function logActivity(
  weddingId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
): Promise<void> {
  await db()
    .prepare('INSERT INTO activity_log (id, wedding_id, user_id, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id(), weddingId, userId, action, entityType, entityId, now())
    .run();
}

export { db, id, now };
