import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { householdItemInputSchema } from '@/lib/household-item-input';
import { lunaProposalFromToolCall } from '@/lib/luna-proposal';

void test('fills safe defaults for an AI-created household item', () => {
  const item = householdItemInputSchema.parse({
    name: 'Jogo de panelas',
    desiredQuantity: 1,
    priority: 'essencial',
    estimatedUnitCents: 75_000,
  });

  assert.deepEqual(item, {
    name: 'Jogo de panelas',
    categoryId: null,
    desiredQuantity: 1,
    priority: 'essencial',
    status: 'precisamos',
    estimatedUnitCents: 75_000,
    minPriceCents: 0,
    maxPriceCents: 0,
    brand: '',
    model: '',
    store: '',
    productUrl: '',
    responsible: 'Casal',
    giftIntent: 'a decidir',
    purchaseTiming: 'antes do casamento',
    desiredDate: null,
    notes: '',
  });
});

void test('turns the dedicated item tool call into a confirmable proposal', () => {
  const proposal = lunaProposalFromToolCall(
    'propose_household_item',
    JSON.stringify({
      title: 'Adicionar jogo de panelas',
      summary: '1 jogo de panelas essencial por R$ 750,00.',
      payload: {
        name: 'Jogo de panelas',
        desiredQuantity: 1,
        priority: 'essencial',
        estimatedUnitCents: 75_000,
      },
    }),
  );

  assert.equal(proposal?.action, 'add_household_item');
  assert.equal(proposal?.payload.name, 'Jogo de panelas');
});

void test('still rejects invalid values instead of silently changing them', () => {
  const result = householdItemInputSchema.safeParse({
    name: 'TV',
    desiredQuantity: 0,
    priority: 'urgente',
    estimatedUnitCents: -1,
  });

  assert.equal(result.success, false);
});
