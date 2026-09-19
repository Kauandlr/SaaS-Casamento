import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { verifyPassword, verifyPlainPassword } from '@/lib/password';

const passwordHash =
  'pbkdf2-sha256$600000$mRfqHZWU3-82U1F_Nx0_Ug$g6wIz-fNMPC7EKwUuHtVGeXJ4Md0kxQEtS6CV8E7zwM';

void test('PBKDF2 accepts only the configured password', async () => {
  assert.equal(await verifyPassword('SenhaTeste123!', passwordHash), true);
  assert.equal(await verifyPassword('senha-incorreta', passwordHash), false);
});

void test('rejects malformed or intentionally expensive PBKDF2 hashes', async () => {
  assert.equal(await verifyPassword('secret', 'not-a-password-hash'), false);
  assert.equal(await verifyPassword('secret', 'pbkdf2-sha256$999999999$c2FsdA$ZGlnZXN0'), false);
});

void test('legacy password comparison remains exact during migration', async () => {
  assert.equal(await verifyPlainPassword('SenhaTeste123!', 'SenhaTeste123!'), true);
  assert.equal(await verifyPlainPassword('senhateste123!', 'SenhaTeste123!'), false);
});
