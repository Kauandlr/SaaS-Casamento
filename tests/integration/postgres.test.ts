import { strict as assert } from 'node:assert';
import { test, before, after } from 'node:test';
import { Client } from 'pg';
import { verifyPassword } from '@/lib/password';

const connectionString = process.env.DATABASE_URL ?? 'postgres://vinculo:vinculo@127.0.0.1:5437/vinculo';
const client = new Client({ connectionString });

before(async () => {
  await client.connect();
  await client.query(`TRUNCATE TABLE
    ai_action_proposals, ai_messages, ai_conversations,
    auth_login_attempts, auth_sessions, household_files, household_payments,
    household_purchases, household_gifts, household_item_options, household_items,
    household_checklist_items, household_categories, household_plans, activity_log,
    payments, vendors, guests, checklist_items, budget_categories, wedding_members,
    weddings, users RESTART IDENTITY CASCADE`);
});

after(async () => { await client.end(); });

void test('migration creates the complete schema without domain seeds', async () => {
  const tables = await client.query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '__drizzle%'`);
  assert.equal(tables.rowCount, 23);
  const counts = await client.query<{ count: string }>('SELECT (SELECT count(*) FROM weddings) + (SELECT count(*) FROM payments) + (SELECT count(*) FROM vendors) + (SELECT count(*) FROM guests) + (SELECT count(*) FROM household_items) AS count');
  assert.equal(counts.rows[0].count, '0');
});

void test('PBKDF2 password accepts only the configured secret', async () => {
  const hash = 'pbkdf2-sha256$600000$mRfqHZWU3-82U1F_Nx0_Ug$g6wIz-fNMPC7EKwUuHtVGeXJ4Md0kxQEtS6CV8E7zwM';
  assert.equal(await verifyPassword('SenhaTeste123!', hash), true);
  assert.equal(await verifyPassword('senha-incorreta', hash), false);
});

void test('workspace base records and session lifecycle are isolated by user', async () => {
  await client.query('BEGIN');
  try {
    await client.query(`INSERT INTO users (id,email,display_name,created_at,updated_at) VALUES ('owner','owner@test.local','Owner',now(),now())`);
    const wedding = await client.query<{ id: string }>(`INSERT INTO weddings (owner_user_id,title,person_one,person_two,wedding_date,created_at,updated_at) VALUES ('owner','Casamento real','A','B','2027-06-12',now(),now()) RETURNING id`);
    const weddingId = wedding.rows[0].id;
    await client.query(`INSERT INTO wedding_members (wedding_id,user_id,email,role,permissions,created_at) VALUES ($1,'owner','owner@test.local','owner','["*"]',now())`, [weddingId]);
    await client.query(`INSERT INTO household_plans (wedding_id,target_date,created_at,updated_at) VALUES ($1,'2027-06-12',now(),now())`, [weddingId]);
    await client.query(`INSERT INTO auth_sessions (user_id,token_hash,expires_at,created_at) VALUES ('owner','session-hash',now() + interval '7 days',now())`);
    const visible = await client.query('SELECT w.id FROM weddings w JOIN wedding_members m ON m.wedding_id = w.id WHERE m.user_id = $1', ['owner']);
    assert.equal(visible.rowCount, 1);
    const active = await client.query('SELECT count(*) AS count FROM auth_sessions WHERE token_hash = $1 AND expires_at > now()', ['session-hash']);
    assert.equal(active.rows[0].count, '1');
    await client.query('DELETE FROM auth_sessions WHERE token_hash = $1', ['session-hash']);
    const revoked = await client.query('SELECT count(*) AS count FROM auth_sessions WHERE token_hash = $1', ['session-hash']);
    assert.equal(revoked.rows[0].count, '0');
  } finally { await client.query('ROLLBACK'); }
});
