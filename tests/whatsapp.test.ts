import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildInvitationMessage,
  buildWhatsAppUrl,
  deriveInvitationVariables,
  normalizeWhatsAppPhone,
} from '@/lib/whatsapp';

const base = {
  invitationName: 'João',
  invitationType: 'individual' as const,
  guestNames: ['João Silva'],
  coupleName: 'Ana & Bia',
  weddingDate: '2027-05-20',
  weddingUrl: 'https://exemplo.com/casamento/ana-bia',
  confirmationUrl: 'https://exemplo.com/casamento/ana-bia/confirmar/token',
};

void test('normalizes valid Brazilian mobile and landline numbers', () => {
  assert.deepEqual(normalizeWhatsAppPhone('(11) 99999-9999'), { ok: true, value: '5511999999999' });
  assert.deepEqual(normalizeWhatsAppPhone('55 21 2345-6789'), { ok: true, value: '552123456789' });
});

void test('rejects invalid Brazilian area codes and subscriber lengths', () => {
  assert.equal(normalizeWhatsAppPhone('(10) 99999-9999').ok, false);
  assert.equal(normalizeWhatsAppPhone('(11) 8999-9999').ok, false);
});

void test('uses singular copy for individual invitations', () => {
  const variables = deriveInvitationVariables(base);
  assert.equal(variables.nome_do_convite, 'João');
  assert.equal(variables.tratamento, 'você');
  assert.equal(variables.acao_confirmacao, 'confirme sua presença');
  assert.match(buildInvitationMessage(base), /Acesse nosso convite e confirme sua presença/);
});

void test('uses both names and plural copy for couples', () => {
  const context = { ...base, invitationType: 'casal' as const, guestNames: ['João Silva', 'Maria Souza'] };
  const variables = deriveInvitationVariables(context);
  assert.equal(variables.nome_do_convite, 'João e Maria');
  assert.equal(variables.tratamento, 'vocês');
  assert.match(buildInvitationMessage(context), /confirmem suas presenças/);
});

void test('prioritizes a custom salutation and applies family wording', () => {
  const context = {
    ...base,
    invitationType: 'familia' as const,
    invitationName: 'Silva',
    guestNames: ['Carlos Silva', 'Ana Silva', 'Pedro Silva'],
    familyName: 'Silva',
    customSalutation: 'Tia Ana e família',
  };
  const variables = deriveInvitationVariables(context);
  assert.equal(variables.nome_do_convite, 'Tia Ana e família');
  assert.equal(variables.acao_confirmacao, 'confirmem quem estará presente');
});

void test('encodes line breaks, emoji and accents in the WhatsApp URL', () => {
  const url = buildWhatsAppUrl('Olá! 💍\nConfirme sua presença.', '5511999999999');
  assert.equal(url, `https://wa.me/5511999999999?text=${encodeURIComponent('Olá! 💍\nConfirme sua presença.')}`);
});
