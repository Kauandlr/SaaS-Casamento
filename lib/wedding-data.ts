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
  const categoryRows = categories.map(
    ([name, planned, contracted, paid], position) => ({
      id: id(),
      name,
      planned,
      contracted,
      paid,
      position,
    }),
  );

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
      .bind(
        id(),
        weddingId,
        identity.userId,
        identity.email,
        'owner',
        '["*"]',
        createdAt,
      ),
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
      .bind(
        id(),
        weddingId,
        categoryRows[0].id,
        'Parcela do espaço',
        'Casa Ipê',
        164000,
        offsetDate(4),
        'próximo',
        'Casal',
        null,
        createdAt,
      ),
    db()
      .prepare(`INSERT INTO payments (
        id, wedding_id, category_id, title, vendor_name, amount_cents, due_date,
        status, payer, paid_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        id(),
        weddingId,
        categoryRows[2].id,
        'Sinal da banda',
        'Banda Aurora',
        80000,
        offsetDate(16),
        'futuro',
        'Kauan',
        null,
        createdAt,
      ),
    db()
      .prepare(`INSERT INTO payments (
        id, wedding_id, category_id, title, vendor_name, amount_cents, due_date,
        status, payer, paid_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        id(),
        weddingId,
        categoryRows[1].id,
        'Entrada fotografia',
        'Clara Luz Estúdio',
        180000,
        offsetDate(-9),
        'pago',
        'Luana',
        offsetDate(-9),
        createdAt,
      ),
    db()
      .prepare(`INSERT INTO vendors (
        id, wedding_id, name, company, category, phone, email, quoted_cents,
        status, rating, favorite, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        id(),
        weddingId,
        'Marina Salles',
        'Clara Luz Estúdio',
        'Fotografia',
        '(11) 98432-7716',
        'marina@claraluz.com.br',
        464000,
        'favorito',
        5,
        1,
        createdAt,
      ),
    db()
      .prepare(`INSERT INTO vendors (
        id, wedding_id, name, company, category, phone, email, quoted_cents,
        status, rating, favorite, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        id(),
        weddingId,
        'Rafael Moura',
        'Casa Ipê',
        'Espaço',
        '(11) 96318-4205',
        'eventos@casaipe.com.br',
        1284000,
        'contratado',
        5,
        1,
        createdAt,
      ),
    ...[
      ['Helena Ribeiro', 'Pessoa 1', 'Família Ribeiro', 'adulto', 'confirmado'],
      ['Caio Ribeiro', 'Pessoa 1', 'Família Ribeiro', 'adulto', 'confirmado'],
      [
        'Beatriz Nogueira',
        'Pessoa 2',
        'Amigos faculdade',
        'adulto',
        'aguardando',
      ],
      [
        'Miguel Nogueira',
        'Pessoa 2',
        'Amigos faculdade',
        'criança',
        'aguardando',
      ],
      ['Paula Martins', 'Ambos', 'Padrinhos', 'adulto', 'confirmado'],
    ].map(([fullName, side, groupName, ageGroup, rsvp]) =>
      db()
        .prepare(`INSERT INTO guests (
          id, wedding_id, full_name, side, group_name, age_group, rsvp, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          id(),
          weddingId,
          fullName,
          side,
          groupName,
          ageGroup,
          rsvp,
          createdAt,
        ),
    ),
    ...[
      [
        'Escolher fornecedor de fotografia',
        'Fornecedores',
        'Casal',
        'essencial',
        offsetDate(12),
        'em andamento',
      ],
      [
        'Revisar lista inicial de convidados',
        'Convidados',
        'Luana',
        'importante',
        offsetDate(7),
        'pendente',
      ],
      [
        'Definir orçamento de decoração',
        'Financeiro',
        'Kauan',
        'importante',
        offsetDate(18),
        'pendente',
      ],
      [
        'Agendar degustação do buffet',
        'Alimentação',
        'Casal',
        'opcional',
        offsetDate(26),
        'aguardando',
      ],
    ].map(([title, category, responsible, priority, dueDate, status]) =>
      db()
        .prepare(`INSERT INTO checklist_items (
          id, wedding_id, title, category, responsible, priority, due_date,
          status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          id(),
          weddingId,
          title,
          category,
          responsible,
          priority,
          dueDate,
          status,
          createdAt,
        ),
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

async function ensureHouseholdWorkspace(
  weddingId: string,
  weddingDate: string,
): Promise<void> {
  const existing = await db()
    .prepare('SELECT id FROM household_plans WHERE wedding_id = ? LIMIT 1')
    .bind(weddingId)
    .first<Row>();
  if (existing) return;

  const createdAt = now();
  const categoryNames = [
    'Cozinha',
    'Quarto',
    'Banheiro',
    'Lavanderia',
    'Sala',
    'Sala de jantar',
    'Eletrodomésticos',
    'Móveis',
    'Organização',
    'Limpeza',
    'Decoração',
  ];
  const categories = categoryNames.map((name, position) => ({
    id: id(),
    name,
    position,
  }));
  const categoryId = (name: string) =>
    categories.find((item) => item.name === name)?.id ?? null;
  const items = [
    [
      'Geladeira',
      'Eletrodomésticos',
      1,
      0,
      'essencial',
      'pesquisando',
      289900,
      250000,
      320000,
      0,
      'Casal',
      'comprar próximo ao casamento',
      'comprar',
      'Garantia começa na data da compra.',
    ],
    [
      'Jogo de panelas',
      'Cozinha',
      1,
      1,
      'essencial',
      'recebido de presente',
      64900,
      50000,
      76000,
      0,
      'Presente',
      'antes do casamento',
      'lista de presentes',
      'Presente da família.',
    ],
    [
      'Toalhas de banho',
      'Banheiro',
      4,
      2,
      'essencial',
      'precisamos',
      8900,
      6900,
      10900,
      0,
      'Casal',
      'próximos meses',
      'ambos',
      'Preferência por algodão.',
    ],
    [
      'Cama queen',
      'Quarto',
      1,
      1,
      'essencial',
      'já possuímos',
      219900,
      180000,
      260000,
      0,
      'Kauan',
      'comprar próximo ao casamento',
      'comprar',
      'Já pertence ao casal.',
    ],
    [
      'Micro-ondas',
      'Eletrodomésticos',
      1,
      0,
      'importante',
      'escolhido',
      64900,
      54000,
      72000,
      0,
      'Luana',
      'comprar próximo ao casamento',
      'lista de presentes',
      'Modelo compacto para a bancada.',
    ],
    [
      'Aspirador vertical',
      'Limpeza',
      1,
      0,
      'pode esperar',
      'não comprar agora',
      49900,
      39000,
      59000,
      0,
      'Casal',
      'depois do casamento',
      'a decidir',
      'Pode ser adiado sem afetar a mudança.',
    ],
    [
      'Jogo de pratos',
      'Cozinha',
      2,
      1,
      'importante',
      'recebido de presente',
      32900,
      26000,
      39000,
      0,
      'Presente',
      'próximos meses',
      'lista de presentes',
      'Falta um conjunto.',
    ],
    [
      'Sofá',
      'Sala',
      1,
      0,
      'importante',
      'pesquisando',
      239900,
      190000,
      280000,
      0,
      'Casal',
      'comprar próximo ao casamento',
      'comprar',
      'Confirmar medidas antes de fechar.',
    ],
    [
      'Cafeteira',
      'Eletrodomésticos',
      1,
      0,
      'opcional',
      'precisamos',
      39900,
      29000,
      48000,
      0,
      'Casal',
      'depois do casamento',
      'lista de presentes',
      'Comprar somente se couber no orçamento.',
    ],
  ] as const;
  const itemRows = items.map((item) => ({ id: id(), item }));
  const checklist = [
    ['Contratar internet', 'Casal', offsetDate(120)],
    ['Solicitar ligação de energia', 'Kauan', offsetDate(135)],
    ['Organizar limpeza antes da mudança', 'Luana', offsetDate(150)],
    ['Conferir medidas dos móveis', 'Casal', offsetDate(90)],
  ] as const;

  await db().batch([
    db()
      .prepare(`INSERT INTO household_plans (
      id, wedding_id, budget_cents, allocated_savings_cents, include_in_general,
      target_date, housing_type, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        id(),
        weddingId,
        800000,
        180000,
        1,
        weddingDate,
        'aluguel',
        createdAt,
        createdAt,
      ),
    ...categories.map((category) =>
      db()
        .prepare(`INSERT INTO household_categories (
      id, wedding_id, name, position, created_at
    ) VALUES (?, ?, ?, ?, ?)`)
        .bind(
          category.id,
          weddingId,
          category.name,
          category.position,
          createdAt,
        ),
    ),
    ...itemRows.map(({ id: itemId, item }) =>
      db()
        .prepare(`INSERT INTO household_items (
      id, wedding_id, category_id, name, desired_quantity, acquired_quantity,
      priority, status, estimated_unit_cents, min_price_cents, max_price_cents,
      actual_paid_cents, responsible, notes, gift_intent, purchase_timing,
      favorite, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          itemId,
          weddingId,
          categoryId(item[1]),
          item[0],
          item[2],
          item[3],
          item[4],
          item[5],
          item[6],
          item[7],
          item[8],
          item[9],
          item[10],
          item[13],
          item[12],
          item[11],
          0,
          createdAt,
          createdAt,
        ),
    ),
    ...checklist.map(([title, responsible, dueDate]) =>
      db()
        .prepare(`INSERT INTO household_checklist_items (
      id, wedding_id, title, responsible, due_date, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          id(),
          weddingId,
          title,
          responsible,
          dueDate,
          'pendente',
          createdAt,
        ),
    ),
  ]);
}

async function rows(statement: D1PreparedStatement): Promise<Row[]> {
  const result = await statement.all<Row>();
  return result.results ?? [];
}

export async function getSnapshot(
  identity: SeedIdentity,
): Promise<WeddingSnapshot> {
  const weddingId = await ensureWorkspace(identity);
  const ownerWedding = await db()
    .prepare(
      'SELECT wedding_date FROM weddings WHERE id = ? AND owner_user_id = ?',
    )
    .bind(weddingId, identity.userId)
    .first<Row>();
  if (!ownerWedding) throw new Error('Workspace não encontrado.');
  await ensureHouseholdWorkspace(weddingId, text(ownerWedding, 'wedding_date'));
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
    db()
      .prepare('SELECT * FROM weddings WHERE id = ? AND owner_user_id = ?')
      .bind(weddingId, identity.userId)
      .first<Row>(),
    rows(
      db()
        .prepare(
          'SELECT * FROM budget_categories WHERE wedding_id = ? ORDER BY position, name',
        )
        .bind(weddingId),
    ),
    rows(
      db()
        .prepare(
          'SELECT * FROM payments WHERE wedding_id = ? ORDER BY due_date',
        )
        .bind(weddingId),
    ),
    rows(
      db()
        .prepare(
          'SELECT * FROM vendors WHERE wedding_id = ? ORDER BY favorite DESC, name',
        )
        .bind(weddingId),
    ),
    rows(
      db()
        .prepare('SELECT * FROM guests WHERE wedding_id = ? ORDER BY full_name')
        .bind(weddingId),
    ),
    rows(
      db()
        .prepare(
          `SELECT * FROM checklist_items WHERE wedding_id = ? ORDER BY CASE status WHEN 'concluído' THEN 1 ELSE 0 END, due_date`,
        )
        .bind(weddingId),
    ),
    db()
      .prepare('SELECT * FROM household_plans WHERE wedding_id = ?')
      .bind(weddingId)
      .first<Row>(),
    rows(
      db()
        .prepare(
          'SELECT * FROM household_categories WHERE wedding_id = ? ORDER BY position, name',
        )
        .bind(weddingId),
    ),
    rows(
      db()
        .prepare(
          `SELECT * FROM household_items WHERE wedding_id = ? ORDER BY CASE status WHEN 'removido da lista' THEN 1 ELSE 0 END, CASE priority WHEN 'essencial' THEN 0 WHEN 'importante' THEN 1 WHEN 'pode esperar' THEN 2 ELSE 3 END, name`,
        )
        .bind(weddingId),
    ),
    rows(
      db()
        .prepare(
          'SELECT * FROM household_gifts WHERE wedding_id = ? ORDER BY gifted_at DESC',
        )
        .bind(weddingId),
    ),
    rows(
      db()
        .prepare(
          `SELECT * FROM household_checklist_items WHERE wedding_id = ? ORDER BY CASE status WHEN 'concluído' THEN 1 ELSE 0 END, due_date`,
        )
        .bind(weddingId),
    ),
    rows(
      db()
        .prepare(
          `SELECT hp.*, hi.name AS item_name FROM household_payments hp JOIN household_items hi ON hi.id = hp.item_id WHERE hp.wedding_id = ? ORDER BY hp.due_date`,
        )
        .bind(weddingId),
    ),
  ]);

  if (!weddingRow || !householdPlanRow)
    throw new Error('Workspace não encontrado.');

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
    household: {
      plan: {
        id: text(householdPlanRow, 'id'),
        budgetCents: number(householdPlanRow, 'budget_cents'),
        allocatedSavingsCents: number(
          householdPlanRow,
          'allocated_savings_cents',
        ),
        includeInGeneral: number(householdPlanRow, 'include_in_general') === 1,
        targetDate: text(householdPlanRow, 'target_date'),
        housingType: text(householdPlanRow, 'housing_type'),
      },
      categories: householdCategoryRows.map((row) => ({
        id: text(row, 'id'),
        name: text(row, 'name'),
        position: number(row, 'position'),
      })),
      items: householdItemRows.map((row) => ({
        id: text(row, 'id'),
        categoryId: text(row, 'category_id') || null,
        name: text(row, 'name'),
        desiredQuantity: number(row, 'desired_quantity'),
        acquiredQuantity: number(row, 'acquired_quantity'),
        priority: text(row, 'priority'),
        status: text(row, 'status'),
        estimatedUnitCents: number(row, 'estimated_unit_cents'),
        minPriceCents: number(row, 'min_price_cents'),
        maxPriceCents: number(row, 'max_price_cents'),
        actualPaidCents: number(row, 'actual_paid_cents'),
        brand: text(row, 'brand'),
        model: text(row, 'model'),
        store: text(row, 'store'),
        productUrl: text(row, 'product_url'),
        responsible: text(row, 'responsible'),
        owner: text(row, 'owner'),
        notes: text(row, 'notes'),
        giftIntent: text(row, 'gift_intent'),
        purchaseTiming: text(row, 'purchase_timing'),
        desiredDate: text(row, 'desired_date') || null,
        purchasedAt: text(row, 'purchased_at') || null,
        warrantyMonths: number(row, 'warranty_months'),
        warrantyEndsAt: text(row, 'warranty_ends_at') || null,
        imageUrl: text(row, 'image_url'),
        favorite: number(row, 'favorite') === 1,
      })),
      gifts: householdGiftRows.map((row) => ({
        id: text(row, 'id'),
        itemId: text(row, 'item_id'),
        quantity: number(row, 'quantity'),
        giver: text(row, 'giver'),
        giftedAt: text(row, 'gifted_at'),
        approximateValueCents: number(row, 'approximate_value_cents'),
        notes: text(row, 'notes'),
      })),
      checklist: householdChecklistRows.map((row) => ({
        id: text(row, 'id'),
        title: text(row, 'title'),
        responsible: text(row, 'responsible'),
        dueDate: text(row, 'due_date'),
        status: text(row, 'status'),
      })),
      payments: householdPaymentRows.map((row) => ({
        id: text(row, 'id'),
        itemId: text(row, 'item_id'),
        itemName: text(row, 'item_name'),
        installmentNumber: number(row, 'installment_number'),
        amountCents: number(row, 'amount_cents'),
        dueDate: text(row, 'due_date'),
        status: text(row, 'status'),
      })),
    },
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
    .prepare(
      'INSERT INTO activity_log (id, wedding_id, user_id, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(id(), weddingId, userId, action, entityType, entityId, now())
    .run();
}

export { db, id, now };
