import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readWeddingPalettes } from '@/lib/wedding-palettes';

void test('converts a previously saved palette into the new collection', () => {
  const colors = [
    { name: 'Oliva', hex: '#6B7558' },
    { name: 'Areia', hex: '#D8C8AE' },
  ];
  assert.deepEqual(readWeddingPalettes({ name: 'Original', colors }), [
    { id: 'legacy', name: 'Original', colors },
  ]);
});

void test('keeps multiple saved palettes and handles an empty workspace', () => {
  const palettes = [
    { id: 'first', name: 'Primavera', colors: [] },
    { id: 'second', name: 'Outono', colors: [] },
  ];
  assert.deepEqual(readWeddingPalettes(palettes), palettes);
  assert.deepEqual(readWeddingPalettes(null), []);
});
