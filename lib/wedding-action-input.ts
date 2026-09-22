import { z } from 'zod';
import { householdItemInputSchema } from './household-item-input';

export const linkUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => value === '' || /^https?:\/\//i.test(value),
    'Informe um link iniciado por http:// ou https://.',
  )
  .default('')
  .describe('Link opcional iniciado por http:// ou https://; use string vazia quando ausente.');

export const paymentSchema = z.object({
  title: z.string().trim().min(2).max(100).describe('Descrição curta do pagamento.'),
  vendorName: z.string().trim().max(100).default('').describe('Fornecedor ou string vazia.'),
  categoryId: z.uuid().nullable().default(null).describe('ID de categoria existente ou null.'),
  amountCents: z.number().int().positive().max(100_000_000).describe('Valor em centavos.'),
  dueDate: z.iso.date().describe('Vencimento no formato YYYY-MM-DD.'),
  payer: z.string().trim().min(2).max(40).describe('Responsável pelo pagamento.'),
  linkUrl: linkUrlSchema,
});

export const vendorSchema = z.object({
  name: z.string().trim().min(2).max(100).describe('Nome do fornecedor ou contato.'),
  company: z.string().trim().max(100).default('').describe('Empresa ou string vazia.'),
  category: z.string().trim().min(2).max(60).describe('Categoria do serviço.'),
  phone: z.string().trim().max(30).default('').describe('Telefone ou string vazia.'),
  email: z.string().trim().pipe(z.email()).or(z.literal('')).default('').describe('E-mail ou string vazia.'),
  linkUrl: linkUrlSchema,
  quotedCents: z.number().int().nonnegative().max(100_000_000).default(0).describe('Orçamento em centavos; use 0 quando desconhecido.'),
  status: z.enum(['pesquisando', 'favorito', 'negociando', 'contratado']).default('pesquisando'),
});

export const guestSchema = z.object({
  fullName: z.string().trim().min(2).max(120).describe('Nome completo do convidado.'),
  side: z.enum(['Pessoa 1', 'Pessoa 2', 'Ambos']).describe('Lado do convidado; pergunte se não estiver claro.'),
  groupName: z.string().trim().max(100).default('').describe('Família ou grupo; use string vazia quando ausente.'),
  ageGroup: z.enum(['adulto', 'adolescente', 'criança', 'bebê']).describe('Faixa etária; pergunte se não estiver clara.'),
  rsvp: z.enum(['ainda não convidado', 'aguardando', 'confirmado', 'não irá', 'talvez']).default('ainda não convidado'),
  linkUrl: linkUrlSchema,
});

export const taskSchema = z.object({
  title: z.string().trim().min(2).max(140).describe('Descrição da tarefa.'),
  category: z.string().trim().min(2).max(60).default('Geral'),
  responsible: z.string().trim().min(2).max(60).default('Casal'),
  priority: z.enum(['essencial', 'importante', 'opcional', 'dispensável']).default('importante'),
  dueDate: z.iso.date().describe('Prazo no formato YYYY-MM-DD; pergunte quando não houver prazo.'),
  linkUrl: linkUrlSchema,
});

export const idSchema = z.object({
  id: z.uuid().describe('ID exato de um registro existente no contexto.'),
});

export const rsvpSchema = idSchema.extend({
  rsvp: z.enum(['ainda não convidado', 'aguardando', 'confirmado', 'não irá', 'talvez']),
});

export const householdPlanSchema = z.object({
  budgetCents: z.number().int().nonnegative().max(100_000_000),
  allocatedSavingsCents: z.number().int().nonnegative().max(100_000_000),
  includeInGeneral: z.boolean(),
  targetDate: z.iso.date(),
  housingType: z.enum([
    'imóvel próprio',
    'aluguel',
    'morar com familiares temporariamente',
    'ainda não definido',
  ]),
});

export const householdPurchaseSchema = idSchema.extend({
  quantity: z.number().int().positive().max(999).default(1),
  amountCents: z.number().int().nonnegative().max(100_000_000).describe('Valor total em centavos.'),
  paymentMethod: z.enum(['à vista', 'entrada', 'parcelado']),
  installments: z.number().int().positive().max(48).default(1),
  purchasedAt: z.iso.date().describe('Data da compra no formato YYYY-MM-DD.'),
});

export const householdGiftSchema = idSchema.extend({
  quantity: z.number().int().positive().max(999).default(1),
  giver: z.string().trim().min(2).max(120),
  giftedAt: z.iso.date().describe('Data do presente no formato YYYY-MM-DD.'),
  approximateValueCents: z.number().int().nonnegative().max(100_000_000).default(0),
  notes: z.string().trim().max(500).default(''),
});

export const householdTaskSchema = z.object({
  title: z.string().trim().min(2).max(140),
  responsible: z.string().trim().min(2).max(60).default('Casal'),
  dueDate: z.iso.date().describe('Prazo no formato YYYY-MM-DD; pergunte quando não houver prazo.'),
  linkUrl: linkUrlSchema,
});

export const householdCategorySchema = z.object({
  name: z.string().trim().min(2).max(60),
});

export const giftListItemSchema = idSchema.extend({
  name: z.string().trim().min(2).max(120),
  categoryId: z.uuid().nullable(),
  desiredQuantity: z.number().int().positive().max(999),
  estimatedUnitCents: z.number().int().nonnegative().max(100_000_000),
  productUrl: linkUrlSchema,
  notes: z.string().trim().max(800).default(''),
});

export const paletteSchema = z.object({
  name: z.string().trim().min(2).max(80),
  colors: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(40),
        hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      }),
    )
    .min(2)
    .max(8),
});

export const palettesSchema = z.array(paletteSchema.extend({
  id: z.string().min(1).max(64),
})).max(20).refine(
  (palettes) => new Set(palettes.map((palette) => palette.id)).size === palettes.length,
  'Cada paleta precisa ter um identificador único.',
);

export const weddingDateSchema = z.object({
  weddingDate: z.iso.date().describe('Nova data no formato YYYY-MM-DD.'),
});

export const weddingActionNames = [
  'update_wedding_date',
  'save_wedding_palette',
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

export type WeddingActionName = (typeof weddingActionNames)[number];

export const weddingActionSchemas: Record<WeddingActionName, z.ZodType> = {
  update_wedding_date: weddingDateSchema,
  save_wedding_palette: paletteSchema,
  add_payment: paymentSchema,
  mark_payment_paid: idSchema,
  add_vendor: vendorSchema,
  add_guest: guestSchema,
  set_guest_rsvp: rsvpSchema,
  add_task: taskSchema,
  toggle_task: idSchema,
  add_household_item: householdItemInputSchema,
  record_household_purchase: householdPurchaseSchema,
  record_household_gift: householdGiftSchema,
  update_household_plan: householdPlanSchema,
  add_household_task: householdTaskSchema,
  toggle_household_task: idSchema,
  add_household_category: householdCategorySchema,
};

export function isWeddingActionName(value: unknown): value is WeddingActionName {
  return typeof value === 'string' && weddingActionNames.includes(value as WeddingActionName);
}

export function parseWeddingActionPayload(action: WeddingActionName, payload: unknown): unknown {
  return weddingActionSchemas[action].parse(payload);
}

const fieldLabels: Record<string, string> = {
  fullName: 'nome completo',
  side: 'lado (Pessoa 1, Pessoa 2 ou Ambos)',
  ageGroup: 'faixa etária (adulto, adolescente, criança ou bebê)',
  rsvp: 'confirmação de presença (ainda não convidado, aguardando, confirmado, não irá ou talvez)',
  title: 'título',
  category: 'categoria',
  amountCents: 'valor',
  dueDate: 'data de vencimento',
  payer: 'responsável pelo pagamento',
  responsible: 'responsável',
  weddingDate: 'data do casamento',
  targetDate: 'data-alvo',
  paymentMethod: 'forma de pagamento',
  installments: 'quantidade de parcelas',
  purchasedAt: 'data da compra',
  giver: 'quem deu o presente',
  giftedAt: 'data do presente',
  id: 'registro existente',
  name: 'nome',
};

export function explainActionValidationError(error: z.ZodError): string {
  const fields = [...new Set(error.issues.map((issue) => fieldLabels[String(issue.path[0])] ?? String(issue.path[0] || 'dados')))]
    .slice(0, 5);
  return fields.length
    ? `Antes de preparar a proposta, confirme: ${fields.join(', ')}.`
    : 'Alguns dados não estão no formato esperado. Peça ao usuário para confirmá-los.';
}
