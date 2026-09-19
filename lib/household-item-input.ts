import { z } from 'zod';

/**
 * The AI and the compact model-context tool only need to provide the fields a
 * user would normally know when first adding an item. The remaining values are
 * initialized exactly as they are in the manual quick-create flow.
 */
export const householdItemInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  categoryId: z.uuid().nullable().default(null),
  desiredQuantity: z.number().int().positive().max(999).default(1),
  priority: z
    .enum(['essencial', 'importante', 'pode esperar', 'opcional'])
    .default('importante'),
  status: z
    .enum([
      'precisamos',
      'pesquisando',
      'escolhido',
      'comprado',
      'recebido de presente',
      'já possuímos',
      'não comprar agora',
      'removido da lista',
    ])
    .default('precisamos'),
  estimatedUnitCents: z.number().int().nonnegative().max(100_000_000).default(0),
  minPriceCents: z.number().int().nonnegative().max(100_000_000).default(0),
  maxPriceCents: z.number().int().nonnegative().max(100_000_000).default(0),
  brand: z.string().trim().max(80).default(''),
  model: z.string().trim().max(100).default(''),
  store: z.string().trim().max(100).default(''),
  productUrl: z.string().trim().pipe(z.url()).or(z.literal('')).default(''),
  responsible: z.string().trim().min(2).max(60).default('Casal'),
  giftIntent: z
    .enum(['comprar', 'lista de presentes', 'ambos', 'a decidir'])
    .default('a decidir'),
  purchaseTiming: z
    .enum([
      'comprar agora',
      'próximos meses',
      'antes do casamento',
      'comprar próximo ao casamento',
      'depois do casamento',
    ])
    .default('antes do casamento'),
  desiredDate: z.iso.date().nullable().default(null),
  notes: z.string().trim().max(800).default(''),
});

export const householdItemToolPayloadSchema = {
  type: 'object',
  description:
    'Dados de um item do enxoval. Informe ao menos nome, quantidade, prioridade e valor unitário estimado em centavos. Os demais campos possuem valores iniciais seguros.',
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 120 },
    categoryId: {
      type: ['string', 'null'],
      format: 'uuid',
      description: 'ID de uma categoria de enxoval existente no contexto, ou null.',
    },
    desiredQuantity: { type: 'integer', minimum: 1, maximum: 999 },
    priority: {
      type: 'string',
      enum: ['essencial', 'importante', 'pode esperar', 'opcional'],
    },
    status: {
      type: 'string',
      enum: [
        'precisamos',
        'pesquisando',
        'escolhido',
        'comprado',
        'recebido de presente',
        'já possuímos',
        'não comprar agora',
        'removido da lista',
      ],
    },
    estimatedUnitCents: {
      type: 'integer',
      minimum: 0,
      description: 'Valor estimado de uma unidade, em centavos.',
    },
    minPriceCents: { type: 'integer', minimum: 0 },
    maxPriceCents: { type: 'integer', minimum: 0 },
    brand: { type: 'string' },
    model: { type: 'string' },
    store: { type: 'string' },
    productUrl: { type: 'string' },
    responsible: { type: 'string' },
    giftIntent: {
      type: 'string',
      enum: ['comprar', 'lista de presentes', 'ambos', 'a decidir'],
    },
    purchaseTiming: {
      type: 'string',
      enum: [
        'comprar agora',
        'próximos meses',
        'antes do casamento',
        'comprar próximo ao casamento',
        'depois do casamento',
      ],
    },
    desiredDate: {
      type: ['string', 'null'],
      format: 'date',
    },
    notes: { type: 'string' },
  },
  required: ['name', 'desiredQuantity', 'priority', 'estimatedUnitCents'],
  additionalProperties: false,
} as const;
