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
