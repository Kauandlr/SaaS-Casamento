import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser, isSameOrigin, type AuthUser } from '@/lib/auth';
import { db, getSnapshot, id, now, requireWeddingId } from '@/lib/wedding-data';
import { withRequestDb } from '@/db';
import { householdItemInputSchema } from '@/lib/household-item-input';
import { readWeddingPalettes } from '@/lib/wedding-palettes';
import {
  explainActionValidationError,
  giftListItemSchema,
  guestSchema,
  updateGuestSchema,
  householdCategorySchema,
  householdGiftSchema,
  householdPlanSchema,
  householdPurchaseSchema,
  householdTaskSchema,
  idSchema,
  paletteSchema,
  palettesSchema,
  paymentSchema,
  rsvpSchema,
  taskSchema,
  vendorSchema,
  weddingDateSchema,
} from '@/lib/wedding-action-input';

export async function executeWeddingAction(
  user: AuthUser,
  body: { action?: string; payload?: unknown },
) {
  try {
    const weddingId = await requireWeddingId(user.userId);
    const createdAt = now();

    switch (body.action) {
      case 'update_wedding_date': {
        const payload = weddingDateSchema.parse(body.payload);
        await db().batch([
          db()
            .prepare('UPDATE weddings SET wedding_date = ?, updated_at = ? WHERE id = ?')
            .bind(payload.weddingDate, createdAt, weddingId),
          db()
            .prepare(`INSERT INTO activity_log (
              id, wedding_id, user_id, action, entity_type, entity_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`)
            .bind(
              id(),
              weddingId,
              user.userId,
              'Data do casamento atualizada',
              'wedding',
              weddingId,
              createdAt,
            ),
        ]);
        break;
      }
      case 'save_wedding_palette': {
        const payload = paletteSchema.parse(body.payload);
        const row = await db()
          .prepare('SELECT palette FROM weddings WHERE id = ?')
          .bind(weddingId)
          .first<Record<string, unknown>>();
        const palettes = palettesSchema.parse([
          ...readWeddingPalettes(row?.palette),
          { id: id(), ...payload },
        ]);
        await db()
          .prepare('UPDATE weddings SET palette = ?::jsonb, updated_at = ? WHERE id = ?')
          .bind(JSON.stringify(palettes), createdAt, weddingId)
          .run();
        break;
      }
      case 'save_wedding_palettes': {
        const payload = palettesSchema.parse(body.payload);
        await db()
          .prepare('UPDATE weddings SET palette = ?::jsonb, updated_at = ? WHERE id = ?')
          .bind(JSON.stringify(payload), createdAt, weddingId)
          .run();
        break;
      }
      case 'add_payment': {
        const payload = paymentSchema.parse(body.payload);
        const entityId = id();
        const statements = [
          db()
            .prepare(`INSERT INTO payments (
              id, wedding_id, category_id, title, vendor_name, amount_cents,
              due_date, status, payer, link_url, paid_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
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
              payload.linkUrl,
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
              .prepare(
                'UPDATE budget_categories SET contracted_cents = contracted_cents + ? WHERE id = ? AND wedding_id = ?',
              )
              .bind(payload.amountCents, payload.categoryId, weddingId),
          );
        }
        await db().batch(statements);
        break;
      }
      case 'mark_payment_paid': {
        const { id: paymentId } = idSchema.parse(body.payload);
        const payment = await db()
          .prepare(
            'SELECT category_id, amount_cents, status FROM payments WHERE id = ? AND wedding_id = ?',
          )
          .bind(paymentId, weddingId)
          .first<Record<string, unknown>>();
        if (!payment)
          return NextResponse.json({ error: 'Pagamento não encontrado.' }, { status: 404 });
        if (payment.status !== 'pago') {
          const statements = [
            db()
              .prepare(
                'UPDATE payments SET status = ?, paid_at = ? WHERE id = ? AND wedding_id = ?',
              )
              .bind('pago', createdAt.slice(0, 10), paymentId, weddingId),
            db()
              .prepare(
                'INSERT INTO activity_log (id, wedding_id, user_id, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
              )
              .bind(
                id(),
                weddingId,
                user.userId,
                'Pagamento marcado como pago',
                'payment',
                paymentId,
                createdAt,
              ),
          ];
          if (typeof payment.category_id === 'string') {
            statements.push(
              db()
                .prepare(
                  'UPDATE budget_categories SET paid_cents = paid_cents + ? WHERE id = ? AND wedding_id = ?',
                )
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
              id, wedding_id, name, company, category, phone, email, link_url,
              quoted_cents, status, rating, favorite, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(
              entityId,
              weddingId,
              payload.name,
              payload.company,
              payload.category,
              payload.phone,
              payload.email,
              payload.linkUrl,
              payload.quotedCents,
              payload.status,
              0,
              payload.status === 'favorito' ? 1 : 0,
              createdAt,
            ),
          db()
            .prepare(
              'INSERT INTO activity_log (id, wedding_id, user_id, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            )
            .bind(
              id(),
              weddingId,
              user.userId,
              'Fornecedor adicionado',
              'vendor',
              entityId,
              createdAt,
            ),
        ]);
        break;
      }
      case 'add_guest': {
        const payload = guestSchema.parse(body.payload);
        const entityId = id();
        await db().batch([
          db()
            .prepare(`INSERT INTO guests (
              id, wedding_id, full_name, side, group_name, group_type, "role", age_group, rsvp, link_url, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(
              entityId,
              weddingId,
              payload.fullName,
              payload.side,
              payload.groupName,
              payload.groupType,
              payload.role,
              payload.ageGroup,
              payload.rsvp,
              payload.linkUrl,
              createdAt,
            ),
          db()
            .prepare(
              'INSERT INTO activity_log (id, wedding_id, user_id, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            )
            .bind(
              id(),
              weddingId,
              user.userId,
              'Convidado adicionado',
              'guest',
              entityId,
              createdAt,
            ),
        ]);
        break;
      }
      case 'update_guest': {
        const payload = updateGuestSchema.parse(body.payload);
        const result = await db()
          .prepare(`UPDATE guests SET full_name = ?, side = ?, group_name = ?, group_type = ?,
            "role" = ?, age_group = ?, rsvp = ?, link_url = ? WHERE id = ? AND wedding_id = ?`)
          .bind(
            payload.fullName,
            payload.side,
            payload.groupName,
            payload.groupType,
            payload.role,
            payload.ageGroup,
            payload.rsvp,
            payload.linkUrl,
            payload.id,
            weddingId,
          )
          .run();
        if (!result.meta.changes)
          return NextResponse.json({ error: 'Convidado não encontrado.' }, { status: 404 });
        break;
      }
      case 'set_guest_rsvp': {
        const payload = rsvpSchema.parse(body.payload);
        const result = await db()
          .prepare('UPDATE guests SET rsvp = ? WHERE id = ? AND wedding_id = ?')
          .bind(payload.rsvp, payload.id, weddingId)
          .run();
        if (!result.meta.changes)
          return NextResponse.json({ error: 'Convidado não encontrado.' }, { status: 404 });
        break;
      }
      case 'add_task': {
        const payload = taskSchema.parse(body.payload);
        const entityId = id();
        await db().batch([
          db()
            .prepare(`INSERT INTO checklist_items (
              id, wedding_id, title, category, responsible, priority,
              due_date, status, link_url, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(
              entityId,
              weddingId,
              payload.title,
              payload.category,
              payload.responsible,
              payload.priority,
              payload.dueDate,
              'pendente',
              payload.linkUrl,
              createdAt,
            ),
          db()
            .prepare(
              'INSERT INTO activity_log (id, wedding_id, user_id, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            )
            .bind(
              id(),
              weddingId,
              user.userId,
              'Tarefa adicionada',
              'checklist',
              entityId,
              createdAt,
            ),
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
      case 'add_household_item': {
        const payload = householdItemInputSchema.parse(body.payload);
        if (payload.categoryId) {
          const category = await db()
            .prepare('SELECT id FROM household_categories WHERE id = ? AND wedding_id = ?')
            .bind(payload.categoryId, weddingId)
            .first();
          if (!category)
            return NextResponse.json({ error: 'Categoria não encontrada.' }, { status: 404 });
        }
        const entityId = id();
        const initialAcquired = ['comprado', 'recebido de presente', 'já possuímos'].includes(
          payload.status,
        )
          ? payload.desiredQuantity
          : 0;
        await db().batch([
          db()
            .prepare(`INSERT INTO household_items (
            id, wedding_id, category_id, name, desired_quantity, acquired_quantity,
            priority, status, estimated_unit_cents, min_price_cents, max_price_cents,
            actual_paid_cents, brand, model, store, product_url, responsible,
            notes, gift_intent, purchase_timing, desired_date, favorite, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(
              entityId,
              weddingId,
              payload.categoryId,
              payload.name,
              payload.desiredQuantity,
              initialAcquired,
              payload.priority,
              payload.status,
              payload.estimatedUnitCents,
              payload.minPriceCents,
              payload.maxPriceCents,
              0,
              payload.brand,
              payload.model,
              payload.store,
              payload.productUrl,
              payload.responsible,
              payload.notes,
              payload.giftIntent,
              payload.purchaseTiming,
              payload.desiredDate,
              0,
              createdAt,
              createdAt,
            ),
          db()
            .prepare(
              'INSERT INTO activity_log (id, wedding_id, user_id, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            )
            .bind(
              id(),
              weddingId,
              user.userId,
              'Item do enxoval adicionado',
              'household_item',
              entityId,
              createdAt,
            ),
        ]);
        break;
      }
      case 'update_gift_list_item': {
        const payload = giftListItemSchema.parse(body.payload);
        const item = await db()
          .prepare('SELECT acquired_quantity, gift_intent FROM household_items WHERE id = ? AND wedding_id = ?')
          .bind(payload.id, weddingId)
          .first<Record<string, unknown>>();
        if (!item || !['lista de presentes', 'ambos'].includes(String(item.gift_intent)))
          return NextResponse.json({ error: 'Presente não encontrado na lista.' }, { status: 404 });
        if (payload.desiredQuantity < Number(item.acquired_quantity ?? 0))
          return NextResponse.json({ error: 'A quantidade não pode ser menor que a já recebida.' }, { status: 422 });
        if (payload.categoryId) {
          const category = await db()
            .prepare('SELECT id FROM household_categories WHERE id = ? AND wedding_id = ?')
            .bind(payload.categoryId, weddingId)
            .first();
          if (!category)
            return NextResponse.json({ error: 'Categoria não encontrada.' }, { status: 404 });
        }
        await db()
          .prepare(`UPDATE household_items SET name = ?, category_id = ?, desired_quantity = ?, estimated_unit_cents = ?, max_price_cents = ?, product_url = ?, notes = ?, updated_at = ? WHERE id = ? AND wedding_id = ?`)
          .bind(payload.name, payload.categoryId, payload.desiredQuantity, payload.estimatedUnitCents, payload.estimatedUnitCents, payload.productUrl, payload.notes, createdAt, payload.id, weddingId)
          .run();
        break;
      }
      case 'remove_gift_list_item': {
        const payload = idSchema.parse(body.payload);
        const item = await db()
          .prepare('SELECT gift_intent FROM household_items WHERE id = ? AND wedding_id = ?')
          .bind(payload.id, weddingId)
          .first<Record<string, unknown>>();
        if (!item || !['lista de presentes', 'ambos'].includes(String(item.gift_intent)))
          return NextResponse.json({ error: 'Presente não encontrado na lista.' }, { status: 404 });
        await db()
          .prepare('UPDATE household_items SET gift_intent = ?, updated_at = ? WHERE id = ? AND wedding_id = ?')
          .bind(item.gift_intent === 'ambos' ? 'comprar' : 'a decidir', createdAt, payload.id, weddingId)
          .run();
        break;
      }
      case 'record_household_purchase': {
        const payload = householdPurchaseSchema.parse(body.payload);
        const item = await db()
          .prepare(
            'SELECT desired_quantity, acquired_quantity FROM household_items WHERE id = ? AND wedding_id = ?',
          )
          .bind(payload.id, weddingId)
          .first<Record<string, unknown>>();
        if (!item) return NextResponse.json({ error: 'Item não encontrado.' }, { status: 404 });
        const purchaseId = id();
        const nextQuantity = Number(item.acquired_quantity ?? 0) + payload.quantity;
        const installmentValue = Math.floor(payload.amountCents / payload.installments);
        const statements = [
          db()
            .prepare(`INSERT INTO household_purchases (
            id, wedding_id, item_id, amount_cents, quantity, payment_method,
            installments, purchased_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(
              purchaseId,
              weddingId,
              payload.id,
              payload.amountCents,
              payload.quantity,
              payload.paymentMethod,
              payload.installments,
              payload.purchasedAt,
              createdAt,
            ),
          db()
            .prepare(
              `UPDATE household_items SET acquired_quantity = ?, actual_paid_cents = actual_paid_cents + ?, status = ?, purchased_at = ?, updated_at = ? WHERE id = ? AND wedding_id = ?`,
            )
            .bind(
              nextQuantity,
              payload.amountCents,
              nextQuantity >= Number(item.desired_quantity ?? 1) ? 'comprado' : 'escolhido',
              payload.purchasedAt,
              createdAt,
              payload.id,
              weddingId,
            ),
          db()
            .prepare(
              'INSERT INTO activity_log (id, wedding_id, user_id, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            )
            .bind(
              id(),
              weddingId,
              user.userId,
              'Compra do enxoval registrada',
              'household_purchase',
              purchaseId,
              createdAt,
            ),
        ];
        for (let installment = 1; installment <= payload.installments; installment += 1) {
          const due = new Date(`${payload.purchasedAt}T12:00:00Z`);
          due.setUTCMonth(due.getUTCMonth() + installment - 1);
          const amount =
            installment === payload.installments
              ? payload.amountCents - installmentValue * (payload.installments - 1)
              : installmentValue;
          statements.push(
            db()
              .prepare(`INSERT INTO household_payments (
            id, wedding_id, purchase_id, item_id, installment_number, amount_cents,
            due_date, status, paid_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
              .bind(
                id(),
                weddingId,
                purchaseId,
                payload.id,
                installment,
                amount,
                due.toISOString().slice(0, 10),
                installment === 1 && payload.paymentMethod === 'à vista' ? 'pago' : 'pendente',
                installment === 1 && payload.paymentMethod === 'à vista'
                  ? payload.purchasedAt
                  : null,
                createdAt,
              ),
          );
        }
        await db().batch(statements);
        break;
      }
      case 'record_household_gift': {
        const payload = householdGiftSchema.parse(body.payload);
        const item = await db()
          .prepare(
            'SELECT desired_quantity, acquired_quantity FROM household_items WHERE id = ? AND wedding_id = ?',
          )
          .bind(payload.id, weddingId)
          .first<Record<string, unknown>>();
        if (!item)
          return NextResponse.json(
            { error: 'Item não encontrado.' },
            { status: 404 },
          );
        if (Number(item.acquired_quantity ?? 0) + payload.quantity > Number(item.desired_quantity ?? 0))
          return NextResponse.json({ error: 'A quantidade supera o que ainda falta receber.' }, { status: 422 });
        const giftId = id();
        const nextQuantity = Number(item.acquired_quantity ?? 0) + payload.quantity;
        await db().batch([
          db()
            .prepare(`INSERT INTO household_gifts (
            id, wedding_id, item_id, quantity, giver, gifted_at,
            approximate_value_cents, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(
              giftId,
              weddingId,
              payload.id,
              payload.quantity,
              payload.giver,
              payload.giftedAt,
              payload.approximateValueCents,
              payload.notes,
              createdAt,
            ),
          db()
            .prepare(
              'UPDATE household_items SET acquired_quantity = ?, status = ?, updated_at = ? WHERE id = ? AND wedding_id = ?',
            )
            .bind(nextQuantity, 'recebido de presente', createdAt, payload.id, weddingId),
          db()
            .prepare(
              'INSERT INTO activity_log (id, wedding_id, user_id, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            )
            .bind(
              id(),
              weddingId,
              user.userId,
              'Presente do enxoval recebido',
              'household_gift',
              giftId,
              createdAt,
            ),
        ]);
        break;
      }
      case 'update_household_plan': {
        const payload = householdPlanSchema.parse(body.payload);
        await db()
          .prepare(
            `UPDATE household_plans SET budget_cents = ?, allocated_savings_cents = ?, include_in_general = ?, target_date = ?, housing_type = ?, updated_at = ? WHERE wedding_id = ?`,
          )
          .bind(
            payload.budgetCents,
            payload.allocatedSavingsCents,
            payload.includeInGeneral ? 1 : 0,
            payload.targetDate,
            payload.housingType,
            createdAt,
            weddingId,
          )
          .run();
        break;
      }
      case 'add_household_task': {
        const payload = householdTaskSchema.parse(body.payload);
        await db()
          .prepare(`INSERT INTO household_checklist_items (
          id, wedding_id, title, responsible, due_date, status, link_url, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(
            id(),
            weddingId,
            payload.title,
            payload.responsible,
            payload.dueDate,
            'pendente',
            payload.linkUrl,
            createdAt,
          )
          .run();
        break;
      }
      case 'toggle_household_task': {
        const payload = idSchema.parse(body.payload);
        const task = await db()
          .prepare('SELECT status FROM household_checklist_items WHERE id = ? AND wedding_id = ?')
          .bind(payload.id, weddingId)
          .first<Record<string, unknown>>();
        if (!task) return NextResponse.json({ error: 'Tarefa não encontrada.' }, { status: 404 });
        await db()
          .prepare(
            'UPDATE household_checklist_items SET status = ? WHERE id = ? AND wedding_id = ?',
          )
          .bind(task.status === 'concluído' ? 'pendente' : 'concluído', payload.id, weddingId)
          .run();
        break;
      }
      case 'add_household_category': {
        const payload = householdCategorySchema.parse(body.payload);
        const last = await db()
          .prepare(
            'SELECT COALESCE(MAX(position), -1) AS position FROM household_categories WHERE wedding_id = ?',
          )
          .bind(weddingId)
          .first<Record<string, unknown>>();
        await db()
          .prepare(
            'INSERT INTO household_categories (id, wedding_id, name, position, created_at) VALUES (?, ?, ?, ?, ?)',
          )
          .bind(id(), weddingId, payload.name, Number(last?.position ?? -1) + 1, createdAt)
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
      return NextResponse.json({ error: explainActionValidationError(error) }, { status: 422 });
    }
    console.error(
      'Wedding action failed',
      error instanceof Error ? error.message : 'unknown_error',
    );
    return NextResponse.json({ error: 'Não foi possível salvar agora.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });

  return withRequestDb(async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return NextResponse.json({ error: 'Sessão necessária.' }, { status: 401 });

      const body = (await request.json()) as {
        action?: string;
        payload?: unknown;
      };
      return await executeWeddingAction(user, body);
    } catch (error) {
      console.error(
        'Wedding action request failed',
        error instanceof Error ? error.message : 'unknown_error',
      );
      return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });
    }
  });
}
