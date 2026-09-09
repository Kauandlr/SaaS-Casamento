import { NextResponse } from 'next/server';
import { z } from 'zod';
import { closeDb } from '@/db';
import { getCurrentUser, isSameOrigin } from '@/lib/auth';
import { db, getSnapshot, id, now, requireWeddingId } from '@/lib/wedding-data';
import {
  lunaClient,
  lunaInstructions,
  lunaModel,
  lunaProposalSchema,
  lunaTools,
  weddingContext,
  type LunaProposal,
} from '@/lib/luna';

const requestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  conversationId: z.uuid().optional(),
});

type Row = Record<string, unknown>;

async function getConversation(weddingId: string, requestedId?: string): Promise<string> {
  const existing = requestedId
    ? await db().prepare('SELECT id FROM ai_conversations WHERE id = ? AND wedding_id = ?').bind(requestedId, weddingId).first<Row>()
    : await db().prepare('SELECT id FROM ai_conversations WHERE wedding_id = ?').bind(weddingId).first<Row>();
  if (existing?.id) return String(existing.id);
  const conversationId = id();
  const timestamp = now();
  await db().prepare(`INSERT INTO ai_conversations (id, wedding_id, created_at, updated_at)
    VALUES (?, ?, ?, ?) ON CONFLICT (wedding_id) DO NOTHING`).bind(conversationId, weddingId, timestamp, timestamp).run();
  const created = await db().prepare('SELECT id FROM ai_conversations WHERE wedding_id = ?').bind(weddingId).first<Row>();
  return String(created?.id ?? conversationId);
}

async function history(conversationId: string) {
  const result = await db().prepare(`SELECT role, content FROM ai_messages
    WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 24`).bind(conversationId).all<Row>();
  return result.results.reverse().map((row) => ({
    role: String(row.role) as 'user' | 'assistant',
    content: String(row.content),
  }));
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sessão necessária.' }, { status: 401 });
  try {
    const weddingId = await requireWeddingId(user.userId);
    const conversationId = await getConversation(weddingId);
    const messages = await db().prepare(`SELECT id, role, content, created_at FROM ai_messages
      WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 50`).bind(conversationId).all<Row>();
    const proposals = await db().prepare(`SELECT id, action, title, summary, payload_json, status
      FROM ai_action_proposals WHERE conversation_id = ? AND status = 'pendente' AND expires_at > NOW()
      ORDER BY created_at ASC`).bind(conversationId).all<Row>();
    return NextResponse.json({
      conversationId,
      messages: messages.results.map((row) => ({ id: String(row.id), role: String(row.role), content: String(row.content) })),
      pendingProposals: proposals.results.map((row) => ({
        id: String(row.id), action: String(row.action), title: String(row.title), summary: String(row.summary),
        payload: JSON.parse(String(row.payload_json)), status: String(row.status),
      })),
    });
  } catch (error) {
    console.error('Luna history failed', error instanceof Error ? error.message : 'unknown_error');
    return NextResponse.json({ error: 'Não foi possível carregar a conversa.' }, { status: 500 });
  } finally {
    await closeDb();
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sessão necessária.' }, { status: 401 });
  try {
    const input = requestSchema.parse(await request.json());
    const client = lunaClient();
    if (!client) return NextResponse.json({ error: 'Luna ainda não está configurada. Defina OPENAI_API_KEY no ambiente.' }, { status: 503 });
    const weddingId = await requireWeddingId(user.userId);
    const conversationId = await getConversation(weddingId, input.conversationId);
    const snapshot = await getSnapshot({ userId: user.userId, email: user.email, displayName: user.displayName });
    const previous = await history(conversationId);
    const timestamp = now();
    await db().prepare('INSERT INTO ai_messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id(), conversationId, 'user', input.message, timestamp).run();
    await db().prepare('UPDATE ai_conversations SET updated_at = ? WHERE id = ?').bind(timestamp, conversationId).run();
    const prompt = `${input.message}\n\nCONTEXTO ATUAL DO CASAMENTO (JSON confiável; use os IDs existentes):\n${weddingContext(snapshot)}`;
    const response = await client.responses.create({
      model: lunaModel(),
      instructions: lunaInstructions.replace('{{today}}', new Date().toISOString().slice(0, 10)),
      input: [...previous, { role: 'user', content: prompt }] as never,
      tools: lunaTools,
      tool_choice: 'auto',
      store: false,
      max_output_tokens: 1200,
    });
    const proposals: Array<LunaProposal> = [];
    for (const item of response.output as unknown as Array<Record<string, unknown>>) {
      if (item.type !== 'function_call' || item.name !== 'propose_wedding_action') continue;
      try {
        const parsed = lunaProposalSchema.parse(JSON.parse(String(item.arguments)));
        proposals.push({ ...parsed, id: id(), status: 'pendente' });
      } catch (error) {
        console.error('Invalid Luna proposal', error instanceof Error ? error.message : 'unknown_error');
      }
    }
    const assistantContent = response.output_text?.trim() || (proposals.length
      ? 'Preparei as alterações abaixo para vocês revisarem antes de salvar.'
      : 'Posso ajudar a consultar ou organizar o planejamento. O que vocês querem fazer?');
    const assistantId = id();
    await db().prepare('INSERT INTO ai_messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(assistantId, conversationId, 'assistant', assistantContent, now()).run();
    for (const proposal of proposals) {
      await db().prepare(`INSERT INTO ai_action_proposals
        (id, conversation_id, wedding_id, action, title, summary, payload_json, status, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(proposal.id, conversationId, weddingId, proposal.action, proposal.title, proposal.summary,
          JSON.stringify(proposal.payload), 'pendente', now(), new Date(Date.now() + 30 * 60 * 1000).toISOString()).run();
    }
    return NextResponse.json({ conversationId, message: { id: assistantId, role: 'assistant', content: assistantContent }, proposals });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Envie uma mensagem válida.' }, { status: 422 });
    console.error('Luna chat failed', error instanceof Error ? error.message : 'unknown_error');
    return NextResponse.json({ error: 'A Luna não conseguiu responder agora.' }, { status: 500 });
  } finally {
    await closeDb();
  }
}
