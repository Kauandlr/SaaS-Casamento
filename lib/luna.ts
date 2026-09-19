import OpenAI from 'openai';
import { env } from 'cloudflare:workers';
import type { WeddingSnapshot } from './wedding-types';
export {
  lunaActions,
  lunaProposalFromToolCall,
  lunaProposalSchema,
  type LunaProposal,
} from './luna-proposal';
export { lunaInstructions, lunaTools } from './luna-tools';

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
