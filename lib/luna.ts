import OpenAI from 'openai';
import { env } from 'cloudflare:workers';
import { z } from 'zod';
import type { WeddingSnapshot } from './wedding-types';

export const lunaActions = [
  'add_payment',
  'mark_payment_paid',
  'add_vendor',
  'add_guest',
  'set_guest_rsvp',
  'add_task',
  'toggle_task',
  'add_household_item',
  'record_household_purchase',
  'record_household_gift',
  'update_household_plan',
  'add_household_task',
  'toggle_household_task',
  'add_household_category',
] as const;

export const lunaProposalSchema = z.object({
  action: z.enum(lunaActions),
  title: z.string().trim().min(2).max(120),
  summary: z.string().trim().min(2).max(500),
  payload: z.record(z.string(), z.unknown()),
});

export type LunaProposal = z.infer<typeof lunaProposalSchema> & { id: string; status: string };

export function lunaClient(): OpenAI | null {
  const values = env as unknown as Record<string, string | undefined>;
  const apiKey = values.OPENAI_API_KEY?.trim();
  return apiKey ? new OpenAI({ apiKey }) : null;
}

export function lunaModel(): string {
  const values = env as unknown as Record<string, string | undefined>;
  return values.OPENAI_MODEL?.trim() || 'gpt-5.6-luna';
}

export function weddingContext(snapshot: WeddingSnapshot): string {
  return JSON.stringify({
    casamento: snapshot.wedding,
    categorias: snapshot.categories,
    pagamentos: snapshot.payments,
    fornecedores: snapshot.vendors,
    convidados: snapshot.guests,
    checklist: snapshot.checklist,
    enxoval: snapshot.household,
  });
}

export const lunaInstructions = `Você é a Luna, assistente de planejamento do Vínculo, um sistema de organização de casamentos.
Responda sempre em português do Brasil, com clareza, acolhimento e objetividade.
Você conhece somente o casamento presente no contexto. Nunca invente IDs, valores, datas ou registros.
Hoje é {{today}}.

Você pode ajudar a consultar o planejamento e propor ações reais. Quando o usuário pedir para cadastrar, alterar, quitar, registrar ou marcar algo, use a função propose_wedding_action.
Para ações de criação, preencha todos os campos exigidos usando valores seguros e coerentes. Datas devem ser YYYY-MM-DD. Valores monetários devem ser inteiros em centavos.
Se faltar uma informação essencial, faça uma pergunta curta em vez de criar uma proposta incompleta.
Nunca diga que uma alteração foi feita antes da confirmação do usuário. Explique que a proposta aparecerá para revisão.
Para RSVP e pagamentos, sempre exija confirmação explícita por meio da proposta.
Você pode propor várias ações quando o pedido contiver vários cadastros, mas mantenha cada proposta separada.`;

export const lunaTools = [
  {
    type: 'function' as const,
    name: 'propose_wedding_action',
    description: 'Prepara uma alteração ou cadastro no casamento para o usuário revisar e confirmar.',
    strict: false,
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: lunaActions },
        title: { type: 'string', description: 'Título curto da proposta.' },
        summary: { type: 'string', description: 'Resumo dos campos que serão gravados.' },
        payload: { type: 'object', additionalProperties: true },
      },
      required: ['action', 'title', 'summary', 'payload'],
      additionalProperties: false,
    },
  },
];
