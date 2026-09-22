import { NextResponse } from 'next/server';
import { APIConnectionError, APIConnectionTimeoutError } from 'openai';
import { z } from 'zod';
import { withRequestDb } from '@/db';
import { getCurrentUser, isSameOrigin } from '@/lib/auth';
import { db, getSnapshot, id, now, requireWeddingId } from '@/lib/wedding-data';
import {
  lunaClient,
  lunaEndpoint,
  lunaInstructions,
  lunaModel,
  lunaProposalFromToolCall,
  lunaTools,
  weddingContext,
  type LunaProposal,
} from '@/lib/luna';
import { explainActionValidationError } from '@/lib/wedding-action-input';

const requestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  conversationId: z.uuid().optional(),
});

type Row = Record<string, unknown>;

async function getConversation(weddingId: string, requestedId?: string): Promise<string> {
  const existing = requestedId
    ? await db()
        .prepare('SELECT id FROM ai_conversations WHERE id = ? AND wedding_id = ?')
        .bind(requestedId, weddingId)
        .first<Row>()
    : await db()
        .prepare(
          'SELECT id FROM ai_conversations WHERE wedding_id = ? ORDER BY updated_at DESC LIMIT 1',
        )
        .bind(weddingId)
        .first<Row>();
  if (existing?.id) return String(existing.id);
  const conversationId = id();
  const timestamp = now();
  await db()
    .prepare(`INSERT INTO ai_conversations (id, wedding_id, created_at, updated_at)
    VALUES (?, ?, ?, ?)`)
    .bind(conversationId, weddingId, timestamp, timestamp)
    .run();
  return conversationId;
}

async function listConversations(weddingId: string) {
  const result = await db()
    .prepare(`SELECT c.id, c.created_at, c.updated_at,
    COALESCE((SELECT m.content FROM ai_messages m
      WHERE m.conversation_id = c.id AND m.role = 'user'
      ORDER BY m.created_at ASC LIMIT 1), 'Novo chat') AS title
    FROM ai_conversations c WHERE c.wedding_id = ?
    ORDER BY c.updated_at DESC LIMIT 50`)
    .bind(weddingId)
    .all<Row>();
  return result.results.map((row) => ({
    id: String(row.id),
    title: String(row.title).slice(0, 80),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
}

async function history(conversationId: string) {
  const result = await db()
    .prepare(`SELECT role, content FROM ai_messages
    WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 24`)
    .bind(conversationId)
    .all<Row>();
  return result.results.reverse().map((row) => ({
    role: String(row.role) as 'user' | 'assistant',
    content: String(row.content),
  }));
}

export async function GET(request: Request) {
  return withRequestDb(async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return NextResponse.json({ error: 'Sessão necessária.' }, { status: 401 });
      const weddingId = await requireWeddingId(user.userId);
      const requestedId = new URL(request.url).searchParams.get('conversationId') ?? undefined;
      const conversationId = await getConversation(weddingId, requestedId);
      const conversations = await listConversations(weddingId);
      const messages = await db()
        .prepare(`SELECT id, role, content, created_at FROM ai_messages
      WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 50`)
        .bind(conversationId)
        .all<Row>();
      const proposals = await db()
        .prepare(`SELECT id, action, title, summary, payload_json, status
      FROM ai_action_proposals WHERE conversation_id = ? AND status = 'pendente' AND expires_at > NOW()
      ORDER BY created_at ASC`)
        .bind(conversationId)
        .all<Row>();
      return NextResponse.json({
        conversationId,
        conversations,
        messages: messages.results.map((row) => ({
          id: String(row.id),
          role: String(row.role),
          content: String(row.content),
        })),
        pendingProposals: proposals.results.map((row) => ({
          id: String(row.id),
          action: String(row.action),
          title: String(row.title),
          summary: String(row.summary),
          payload: JSON.parse(String(row.payload_json)),
          status: String(row.status),
        })),
      });
    } catch (error) {
      console.error(
        'Luna history failed',
        error instanceof Error ? error.message : 'unknown_error',
      );
      return NextResponse.json({ error: 'Não foi possível carregar a conversa.' }, { status: 500 });
    }
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  return withRequestDb(async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return NextResponse.json({ error: 'Sessão necessária.' }, { status: 401 });
      const input = requestSchema.parse(await request.json());
      const client = lunaClient();
      if (!client)
        return NextResponse.json(
          { error: 'Luna ainda não está configurada. Defina OPENAI_API_KEY no ambiente.' },
          { status: 503 },
        );
      const weddingId = await requireWeddingId(user.userId);
      const conversationId = await getConversation(weddingId, input.conversationId);
      const snapshot = await getSnapshot({
        userId: user.userId,
        email: user.email,
        displayName: user.displayName,
      });
      const previous = await history(conversationId);
      const prompt = `${input.message}\n\nCONTEXTO ATUAL DO CASAMENTO (JSON confiável; use os IDs existentes):\n${weddingContext(snapshot)}`;
      const response = await client.responses.create({
        model: lunaModel(),
        instructions: lunaInstructions.replace('{{today}}', new Date().toISOString().slice(0, 10)),
        input: [...previous, { role: 'user', content: prompt }] as never,
        tools: lunaTools,
        tool_choice: 'auto',
        store: false,
        // This limit also includes reasoning tokens. A low value can cut a
        // function call in the middle of its JSON arguments.
        max_output_tokens: 4000,
      });
      if (response.status && response.status !== 'completed') {
        const reason =
          response.incomplete_details?.reason ?? response.error?.code ?? response.status;
        console.error('Incomplete Luna response', { status: response.status, reason });
        return NextResponse.json(
          {
            error:
              reason === 'max_output_tokens'
                ? 'A resposta da Luna excedeu o limite. Tente um pedido menor ou mais direto.'
                : 'A Luna não concluiu a resposta. Tente novamente em instantes.',
          },
          { status: 502 },
        );
      }
      const proposals: Array<LunaProposal> = [];
      let proposalCalls = 0;
      const validationPrompts: string[] = [];
      for (const item of response.output as unknown as Array<Record<string, unknown>>) {
        if (item.type !== 'function_call') continue;
        proposalCalls += 1;
        if (item.status === 'incomplete') {
          validationPrompts.push(
            'Não consegui completar os dados da proposta. Pode repetir os detalhes que deseja cadastrar?',
          );
          continue;
        }
        try {
          const parsed = lunaProposalFromToolCall(item.name, item.arguments);
          if (!parsed) continue;
          proposals.push({ ...parsed, id: id(), status: 'pendente' });
        } catch (error) {
          validationPrompts.push(
            error instanceof z.ZodError
              ? explainActionValidationError(error)
              : 'Não consegui validar todos os dados. Pode confirmar as informações obrigatórias?',
          );
          console.error(
            'Invalid Luna proposal',
            error instanceof Error ? error.message : 'unknown_error',
          );
        }
      }
      const assistantContent =
        validationPrompts.length > 0
          ? [...new Set(validationPrompts)].join(' ')
          : response.output_text?.trim() ||
            (proposals.length
              ? 'Preparei as alterações abaixo para vocês revisarem antes de salvar.'
              : proposalCalls > 0
                ? 'Não consegui preparar a proposta. Pode confirmar os dados obrigatórios?'
                : 'Posso ajudar a consultar ou organizar o planejamento. O que vocês querem fazer?');
      const assistantId = id();
      const responseTimestamp = now();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await db().batch([
        db()
          .prepare(
            'INSERT INTO ai_messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
          )
          .bind(id(), conversationId, 'user', input.message, responseTimestamp),
        db()
          .prepare('UPDATE ai_conversations SET updated_at = ? WHERE id = ?')
          .bind(responseTimestamp, conversationId),
        db()
          .prepare(
            'INSERT INTO ai_messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
          )
          .bind(assistantId, conversationId, 'assistant', assistantContent, responseTimestamp),
        ...proposals.map((proposal) =>
          db()
            .prepare(`INSERT INTO ai_action_proposals
        (id, conversation_id, wedding_id, action, title, summary, payload_json, status, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(
              proposal.id,
              conversationId,
              weddingId,
              proposal.action,
              proposal.title,
              proposal.summary,
              JSON.stringify(proposal.payload),
              'pendente',
              responseTimestamp,
              expiresAt,
            ),
        ),
      ]);
      return NextResponse.json({
        conversationId,
        conversations: await listConversations(weddingId),
        message: { id: assistantId, role: 'assistant', content: assistantContent },
        proposals,
      });
    } catch (error) {
      if (error instanceof z.ZodError)
        return NextResponse.json({ error: 'Envie uma mensagem válida.' }, { status: 422 });
      const message = error instanceof Error ? error.message : 'unknown_error';
      const cause =
        error instanceof Error && error.cause instanceof Error ? error.cause.message : undefined;
      const details = `${message} ${cause ?? ''}`;
      const isTimeout = error instanceof APIConnectionTimeoutError;
      const isConnectionFailure =
        error instanceof APIConnectionError ||
        /connection error|tls|certificate|fetch failed|issuer/i.test(details);
      const isTlsFailure = /tls|certificate|issuer|cert_|self.signed|unable.to.verify/i.test(
        details,
      );
      console.error('Luna chat failed', {
        name: error instanceof Error ? error.name : 'unknown',
        message,
        cause,
        endpoint: lunaEndpoint(),
      });
      if (isTimeout) {
        return NextResponse.json(
          {
            error: 'A conexão com a Luna demorou demais. Tente novamente em instantes.',
          },
          { status: 504 },
        );
      }
      if (isConnectionFailure) {
        return NextResponse.json(
          {
            error: isTlsFailure
              ? 'Não foi possível estabelecer uma conexão segura com a Luna. Verifique o certificado TLS do endpoint configurado.'
              : 'Não foi possível conectar à Luna. Verifique o endereço configurado em OPENAI_BASE_URL e a rede do servidor.',
          },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: 'A Luna não conseguiu responder agora.' }, { status: 500 });
    }
  });
}
