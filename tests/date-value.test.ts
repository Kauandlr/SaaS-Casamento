import assert from 'node:assert/strict';
import test from 'node:test';
import { dateOnly } from '@/lib/date-value';

void test('keeps PostgreSQL date strings unchanged', () => {
  assert.equal(dateOnly('2027-05-20'), '2027-05-20');
});

void test('serializes PostgreSQL Date values as YYYY-MM-DD', () => {
  assert.equal(dateOnly(new Date(2027, 4, 20)), '2027-05-20');
});

void test('returns an empty value for invalid dates', () => {
  assert.equal(dateOnly(new Date(Number.NaN)), '');
  assert.equal(dateOnly(null), '');
});
