import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { z } from 'zod';
import { lunaProposalFromToolCall } from '@/lib/luna-proposal';
import { lunaTools } from '@/lib/luna-tools';
import { explainActionValidationError, guestSchema, updateGuestSchema, weddingActionNames } from '@/lib/wedding-action-input';

const supportedFormats = new Set([
  'date-time',
  'time',
  'date',
  'duration',
  'email',
  'hostname',
  'ipv4',
  'ipv6',
  'uuid',
]);

function assertStrictObjects(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertStrictObjects);
    return;
  }
  if (!value || typeof value !== 'object') return;
  const schema = value as Record<string, unknown>;
  if (typeof schema.format === 'string') assert.ok(supportedFormats.has(schema.format));
  if (typeof schema.pattern === 'string') {
    assert.doesNotMatch(schema.pattern, /\(\?(?:[=!]|<[=!])/);
  }
  assert.equal('minLength' in schema, false);
  assert.equal('maxLength' in schema, false);
  assert.equal('const' in schema, false);
  if (schema.type === 'object') {
    assert.equal(schema.additionalProperties, false);
    const properties = schema.properties as Record<string, unknown> | undefined;
    if (properties) {
      assert.deepEqual(
        [...((schema.required as string[] | undefined) ?? [])].sort(),
        Object.keys(properties).sort(),
      );
    }
  }
  Object.values(schema).forEach(assertStrictObjects);
}

void test('publishes one strict tool with a closed payload schema for every action', () => {
  assert.equal(lunaTools.length, weddingActionNames.length);
  assert.deepEqual(
    lunaTools.map((tool) => tool.name),
    weddingActionNames.map((action) => `propose_${action}`),
  );
  for (const tool of lunaTools) {
    assert.equal(tool.strict, true);
    assert.equal(tool.parameters.additionalProperties, false);
    const payload = tool.parameters.properties.payload as {
      additionalProperties?: boolean;
      required?: string[];
    };
    assert.equal(payload.additionalProperties, false);
    assert.ok(payload.required?.length);
    assert.doesNotMatch(JSON.stringify(payload), /"default":/);
    assertStrictObjects(tool.parameters);
  }
});

void test('guest tool exposes the required choices instead of an open payload', () => {
  const tool = lunaTools.find((candidate) => candidate.name === 'propose_add_guest');
  assert.ok(tool);
  const payload = tool.parameters.properties.payload as {
    properties: Record<string, { enum?: string[] }>;
    required: string[];
  };
  assert.ok(payload.required.includes('fullName'));
  assert.ok(payload.required.includes('ageGroup'));
  assert.equal(payload.properties.side, undefined);
  assert.deepEqual(payload.properties.ageGroup.enum, ['adulto', 'adolescente', 'criança', 'bebê']);
});

void test('email schema uses the supported format without regex lookaround', () => {
  const tool = lunaTools.find((candidate) => candidate.name === 'propose_add_vendor');
  assert.ok(tool);
  const payload = tool.parameters.properties.payload as {
    properties: Record<string, { anyOf?: Array<Record<string, unknown>> }>;
  };
  const emailSchema = payload.properties.email.anyOf?.[0];
  assert.equal(emailSchema?.format, 'email');
  assert.equal('pattern' in (emailSchema ?? {}), false);
});

void test('rejects an incomplete guest proposal and explains what must be confirmed', () => {
  try {
    lunaProposalFromToolCall(
      'propose_add_guest',
      JSON.stringify({
        title: 'Adicionar convidado',
        summary: 'Cadastrar Vinicius Luiz da Silva.',
        payload: { fullName: 'Vinicius Luiz da Silva' },
      }),
    );
    assert.fail('Expected incomplete proposal to be rejected.');
  } catch (error) {
    assert.ok(error instanceof z.ZodError);
    const message = explainActionValidationError(error);
    assert.match(message, /faixa etária/);
  }
});

void test('fills only safe defaults after essential guest data is provided', () => {
  const proposal = lunaProposalFromToolCall(
    'propose_add_guest',
    JSON.stringify({
      title: 'Adicionar convidado',
      summary: 'Cadastrar Vinicius Luiz da Silva como adulto.',
      payload: {
        fullName: 'Vinicius Luiz da Silva',
        ageGroup: 'adulto',
      },
    }),
  );

  assert.deepEqual(proposal?.payload, {
    fullName: 'Vinicius Luiz da Silva',
    groupName: '',
    groupType: 'individual',
    role: 'convidado',
    ageGroup: 'adulto',
    rsvp: 'ainda não convidado',
    linkUrl: '',
  });
});

void test('guest relationships require a shared group name and can be edited', () => {
  const guest = {
    fullName: 'Ana Ribeiro',
    ageGroup: 'criança',
    groupType: 'família',
    groupName: 'Família Ribeiro',
    role: 'convidado',
  };
  assert.equal(guestSchema.safeParse(guest).success, true);
  assert.equal(guestSchema.safeParse({ ...guest, groupName: '' }).success, false);
  assert.equal(updateGuestSchema.safeParse({ ...guest, id: crypto.randomUUID(), role: 'madrinha' }).success, true);
});
