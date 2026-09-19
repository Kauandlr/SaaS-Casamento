import OpenAI from 'openai';
import { env } from 'cloudflare:workers';
import type { WeddingSnapshot } from './wedding-types';
import { householdItemToolPayloadSchema } from './household-item-input';
import { lunaActions } from './luna-proposal';
export {
  lunaActions,
  lunaProposalFromToolCall,
  lunaProposalSchema,
  type LunaProposal,
} from './luna-proposal';

const genericLunaActions = lunaActions.filter(
  (action) => action !== 'add_household_item',
);

export function lunaClient(): OpenAI | null {
  const values = env as unknown as Record<string, string | undefined>;
  const apiKey = values.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const baseURL = values.OPENAI_BASE_URL?.trim();
  return new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
    // Keep requests on the Workers fetch implementation instead of a Node transport.
    fetch: globalThis.fetch.bind(globalThis),
    timeout: 30_000,
    maxRetries: 1,
  });
}

export function lunaEndpoint(): string {
  const values = env as unknown as Record<string, string | undefined>;
  return values.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1';
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

Você pode ajudar a consultar o planejamento e propor ações reais. Para cadastrar um item do enxoval, use propose_household_item. Para cadastrar, alterar, quitar, registrar ou marcar qualquer outra coisa, use propose_wedding_action.
Para ações de criação, preencha todos os campos exigidos usando valores seguros e coerentes. Datas devem ser YYYY-MM-DD. Valores monetários devem ser inteiros em centavos.
Se faltar uma informação essencial, faça uma pergunta curta em vez de criar uma proposta incompleta.
Nunca diga que uma alteração foi feita antes da confirmação do usuário. Explique que a proposta aparecerá para revisão.
Para RSVP e pagamentos, sempre exija confirmação explícita por meio da proposta.
Você pode propor várias ações quando o pedido contiver vários cadastros, mas mantenha cada proposta separada.`;

export const lunaTools = [
  {
    type: 'function' as const,
    name: 'propose_household_item',
    description:
      'Prepara o cadastro de um item do enxoval para o usuário revisar e confirmar. Pode ser chamada mais de uma vez quando houver vários itens.',
    strict: false,
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título curto da proposta.' },
        summary: {
          type: 'string',
          description: 'Resumo dos dados do item que serão gravados.',
        },
        payload: householdItemToolPayloadSchema,
      },
      required: ['title', 'summary', 'payload'],
      additionalProperties: false,
    },
  },
  {
    type: 'function' as const,
    name: 'propose_wedding_action',
    description: 'Prepara uma alteração ou cadastro no casamento para o usuário revisar e confirmar.',
    strict: false,
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: genericLunaActions },
        title: { type: 'string', description: 'Título curto da proposta.' },
        summary: { type: 'string', description: 'Resumo dos campos que serão gravados.' },
        payload: { type: 'object', additionalProperties: true },
      },
      required: ['action', 'title', 'summary', 'payload'],
      additionalProperties: false,
    },
  },
];
