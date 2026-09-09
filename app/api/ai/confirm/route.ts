import { NextResponse } from 'next/server';
import { z } from 'zod';
import { closeDb } from '@/db';
import { getCurrentUser, isSameOrigin } from '@/lib/auth';
import { db, id, now, requireWeddingId } from '@/lib/wedding-data';
import { lunaActions } from '@/lib/luna';

const schema = z.object({
  proposalId: z.uuid(),
  decision: z.enum(['confirm', 'cancel']).default('confirm'),
  payload: z.record(z.string(), z.unknown()).optional(),
});

type Row = Record<string, unknown>;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sessão necessária.' }, { status: 401 });
  try {
    const input = schema.parse(await request.json());
    const weddingId = await requireWeddingId(user.userId);
    const proposal = await db().prepare(`SELECT id, action, payload_json, status FROM ai_action_proposals
      WHERE id = ? AND wedding_id = ? AND expires_at > NOW()`).bind(input.proposalId, weddingId).first<Row>();
    if (!proposal) return NextResponse.json({ error: 'Proposta expirada ou não encontrada.' }, { status: 404 });
    if (String(proposal.status) !== 'pendente') return NextResponse.json({ error: 'Esta proposta já foi processada.' }, { status: 409 });
    if (input.decision === 'cancel') {
      await db().prepare('UPDATE ai_action_proposals SET status = ?, confirmed_at = ? WHERE id = ? AND wedding_id = ?')
        .bind('cancelada', now(), input.proposalId, weddingId).run();
      return NextResponse.json({ ok: true, status: 'cancelada' });
    }
    const action = String(proposal.action);
    if (!lunaActions.includes(action as (typeof lunaActions)[number])) return NextResponse.json({ error: 'Ação não permitida.' }, { status: 422 });
    const payload = input.payload ?? JSON.parse(String(proposal.payload_json));
    const headers = new Headers(request.headers);
    headers.set('content-type', 'application/json');
    headers.set('origin', new URL(request.url).origin);
    const actionResponse = await fetch(new URL('/api/actions', request.url), {
      method: 'POST', headers, body: JSON.stringify({ action, payload }),
    });
    const actionBody = (await actionResponse.json()) as { snapshot?: unknown; error?: string };
    if (!actionResponse.ok || !actionBody.snapshot) return NextResponse.json({ error: actionBody.error ?? 'Não foi possível aplicar a proposta.' }, { status: actionResponse.status || 422 });
    await db().prepare('UPDATE ai_action_proposals SET status = ?, confirmed_at = ? WHERE id = ? AND wedding_id = ?')
      .bind('confirmada', now(), input.proposalId, weddingId).run();
    await db().prepare('INSERT INTO activity_log (id, wedding_id, user_id, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id(), weddingId, user.userId, 'Ação confirmada pela Luna', 'ai_action', input.proposalId, now()).run();
    return NextResponse.json({ ok: true, status: 'confirmada', snapshot: actionBody.snapshot });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Confirmação inválida.' }, { status: 422 });
    console.error('Luna confirmation failed', error instanceof Error ? error.message : 'unknown_error');
    return NextResponse.json({ error: 'Não foi possível confirmar a proposta.' }, { status: 500 });
  } finally {
    await closeDb();
  }
}
