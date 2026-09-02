import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { db, getSnapshot, id, now, requireWeddingId } from '@/lib/wedding-data';

const paymentSchema = z.object({
  title: z.string().trim().min(2).max(100),
  vendorName: z.string().trim().max(100).default(''),
  categoryId: z.uuid().nullable(),
  amountCents: z.number().int().positive().max(100_000_000),
  dueDate: z.iso.date(),
  payer: z.string().trim().min(2).max(40),
});

const vendorSchema = z.object({
  name: z.string().trim().min(2).max(100),
  company: z.string().trim().max(100).default(''),
  category: z.string().trim().min(2).max(60),
  phone: z.string().trim().max(30).default(''),
  email: z.string().trim().pipe(z.email()).or(z.literal('')),
  quotedCents: z.number().int().nonnegative().max(100_000_000),
  status: z.enum(['pesquisando', 'favorito', 'negociando', 'contratado']),
});

const guestSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  side: z.enum(['Pessoa 1', 'Pessoa 2', 'Ambos']),
  groupName: z.string().trim().max(100).default(''),
  ageGroup: z.enum(['adulto', 'adolescente', 'criança', 'bebê']),
  rsvp: z.enum(['ainda não convidado', 'aguardando', 'confirmado', 'não irá', 'talvez']),
});

const taskSchema = z.object({
  title: z.string().trim().min(2).max(140),
  category: z.string().trim().min(2).max(60),
  responsible: z.string().trim().min(2).max(60),
  priority: z.enum(['essencial', 'importante', 'opcional', 'dispensável']),
  dueDate: z.iso.date(),
});

const idSchema = z.object({ id: z.uuid() });
const rsvpSchema = idSchema.extend({
  rsvp: z.enum(['ainda não convidado', 'aguardando', 'confirmado', 'não irá', 'talvez']),
});

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: 'Sessão necessária.' }, { status: 401 });

  try {
    const body = (await request.json()) as { action?: string; payload?: unknown };
    const weddingId = await requireWeddingId(user.userId);
    const createdAt = now();

    switch (body.action) {
      case 'add_payment': {
        const payload = paymentSchema.parse(body.payload);
        const entityId = id();
        const statements = [
          db()
            .prepare(`INSERT INTO payments (
              id, wedding_id, category_id, title, vendor_name, amount_cents,
              due_date, status, payer, paid_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(
              entityId,
              weddingId,
              payload.categoryId,
              payload.title,
              payload.vendorName,
              payload.amountCents,
              payload.dueDate,
              'futuro',
              payload.payer,
              null,
              createdAt,
            ),
          db()
            .prepare(`INSERT INTO activity_log (
              id, wedding_id, user_id, action, entity_type, entity_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`)
            .bind(id(), weddingId, user.userId, 'Pagamento criado', 'payment', entityId, createdAt),
        ];
        if (payload.categoryId) {
          statements.push(
            db()
              .prepare('UPDATE budget_categories SET contracted_cents = contracted_cents + ? WHERE id = ? AND wedding_id = ?')
              .bind(payload.amountCents, payload.categoryId, weddingId),
          );
        }
        await db().batch(statements);
        break;
      }
      case 'mark_payment_paid': {
        const { id: paymentId } = idSchema.parse(body.payload);
        const payment = await db()
          .prepare('SELECT category_id, amount_cents, status FROM payments WHERE id = ? AND wedding_id = ?')
          .bind(paymentId, weddingId)
          .first<Record<string, unknown>>();
        if (!payment) return NextResponse.json({ error: 'Pagamento não encontrado.' }, { status: 404 });
        if (payment.status !== 'pago') {
          const statements = [
            db()
              .prepare('UPDATE payments SET status = ?, paid_at = ? WHERE id = ? AND wedding_id = ?')
              .bind('pago', createdAt.slice(0, 10), paymentId, weddingId),
            db()
              .prepare('INSERT INTO activity_log (id, wedding_id, user_id, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
              .bind(id(), weddingId, user.userId, 'Pagamento marcado como pago', 'payment', paymentId, createdAt),
          ];
          if (typeof payment.category_id === 'string') {
            statements.push(
              db()
                .prepare('UPDATE budget_categories SET paid_cents = paid_cents + ? WHERE id = ? AND wedding_id = ?')
                .bind(Number(payment.amount_cents ?? 0), payment.category_id, weddingId),
            );
          }
          await db().batch(statements);
        }
        break;
      }
      case 'add_vendor': {
        const payload = vendorSchema.parse(body.payload);
        const entityId = id();
        await db().batch([
          db()
            .prepare(`INSERT INTO vendors (
              id, wedding_id, name, company, category, phone, email,
              quoted_cents, status, rating, favorite, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(entityId, weddingId, payload.name, payload.company, payload.category, payload.phone, payload.email, payload.quotedCents, payload.status, 0, payload.status === 'favorito' ? 1 : 0, createdAt),
          db()
            .prepare('INSERT INTO activity_log (id, wedding_id, user_id, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .bind(id(), weddingId, user.userId, 'Fornecedor adicionado', 'vendor', entityId, createdAt),
        ]);
        break;
      }
      case 'add_guest': {
        const payload = guestSchema.parse(body.payload);
        const entityId = id();
        await db().batch([
          db()
            .prepare(`INSERT INTO guests (
              id, wedding_id, full_name, side, group_name, age_group, rsvp, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(entityId, weddingId, payload.fullName, payload.side, payload.groupName, payload.ageGroup, payload.rsvp, createdAt),
          db()
            .prepare('INSERT INTO activity_log (id, wedding_id, user_id, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .bind(id(), weddingId, user.userId, 'Convidado adicionado', 'guest', entityId, createdAt),
        ]);
        break;
      }
      case 'set_guest_rsvp': {
        const payload = rsvpSchema.parse(body.payload);
        const result = await db()
          .prepare('UPDATE guests SET rsvp = ? WHERE id = ? AND wedding_id = ?')
          .bind(payload.rsvp, payload.id, weddingId)
          .run();
        if (!result.meta.changes) return NextResponse.json({ error: 'Convidado não encontrado.' }, { status: 404 });
        break;
      }
      case 'add_task': {
        const payload = taskSchema.parse(body.payload);
        const entityId = id();
        await db().batch([
          db()
            .prepare(`INSERT INTO checklist_items (
              id, wedding_id, title, category, responsible, priority,
              due_date, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(entityId, weddingId, payload.title, payload.category, payload.responsible, payload.priority, payload.dueDate, 'pendente', createdAt),
          db()
            .prepare('INSERT INTO activity_log (id, wedding_id, user_id, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .bind(id(), weddingId, user.userId, 'Tarefa adicionada', 'checklist', entityId, createdAt),
        ]);
        break;
      }
      case 'toggle_task': {
        const { id: taskId } = idSchema.parse(body.payload);
        const task = await db()
          .prepare('SELECT status FROM checklist_items WHERE id = ? AND wedding_id = ?')
          .bind(taskId, weddingId)
          .first<Record<string, unknown>>();
        if (!task) return NextResponse.json({ error: 'Tarefa não encontrada.' }, { status: 404 });
        const nextStatus = task.status === 'concluído' ? 'pendente' : 'concluído';
        await db()
          .prepare('UPDATE checklist_items SET status = ? WHERE id = ? AND wedding_id = ?')
          .bind(nextStatus, taskId, weddingId)
          .run();
        break;
      }
      default:
        return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
    }

    const snapshot = await getSnapshot({
      userId: user.userId,
      email: user.email,
      displayName: user.displayName,
    });
    return NextResponse.json({ snapshot });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Revise os campos informados.' }, { status: 422 });
    }
    console.error('Wedding action failed', error instanceof Error ? error.message : 'unknown_error');
    return NextResponse.json({ error: 'Não foi possível salvar agora.' }, { status: 500 });
  }
}
