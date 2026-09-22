import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  confirmedAgeTotals,
  invitationRsvpStatus,
  isRsvpDeadlineOpen,
  normalizeRsvpName,
} from '@/lib/rsvp-rules';

void test('normalizes invitation names without exposing fuzzy matches', () => {
  assert.equal(normalizeRsvpName('  FamÍLIA   Silva! '), 'familia silva');
  assert.equal(normalizeRsvpName('João, Maria'), normalizeRsvpName('joao maria'));
  assert.notEqual(normalizeRsvpName('Família Silva'), normalizeRsvpName('Família Silveira'));
});

void test('derives all invitation RSVP states from individual answers', () => {
  assert.equal(invitationRsvpStatus(['aguardando', 'pendente']), 'pendente');
  assert.equal(invitationRsvpStatus(['confirmado', 'pendente']), 'parcial');
  assert.equal(invitationRsvpStatus(['confirmado', 'não irá']), 'confirmado');
  assert.equal(invitationRsvpStatus(['não irá', 'não irá']), 'recusado');
  assert.equal(invitationRsvpStatus(['não irá'], 1), 'confirmado');
});

void test('counts adolescents as adults and babies as children', () => {
  assert.deepEqual(confirmedAgeTotals([
    { ageGroup: 'adulto', rsvp: 'confirmado' },
    { ageGroup: 'adolescente', rsvp: 'confirmado' },
    { ageGroup: 'criança', rsvp: 'confirmado' },
    { ageGroup: 'bebê', rsvp: 'confirmado' },
    { ageGroup: 'adulto', rsvp: 'não irá' },
  ]), { adults: 2, children: 2 });
});

void test('keeps the RSVP deadline open through the end of the São Paulo date', () => {
  assert.equal(isRsvpDeadlineOpen(null, new Date('2026-09-22T12:00:00Z')), false);
  assert.equal(isRsvpDeadlineOpen('2026-09-22', new Date('2026-09-23T02:59:59Z')), true);
  assert.equal(isRsvpDeadlineOpen('2026-09-22', new Date('2026-09-23T03:00:00Z')), false);
});
