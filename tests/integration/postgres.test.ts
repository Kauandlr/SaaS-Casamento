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
    auth_login_attempts, auth_sessions, security_rate_limits, wedding_invites, household_files, household_payments,
    household_purchases, household_gifts, household_item_options, household_items,
    household_checklist_items, household_categories, household_plans, activity_log,
    payments, vendors, guests, checklist_items, budget_categories, wedding_members,
    weddings, users RESTART IDENTITY CASCADE`);
});

after(async () => { await client.end(); });

void test('migration creates the complete schema without domain seeds', async () => {
  const tables = await client.query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '__drizzle%'`);
  assert.equal(tables.rowCount, 33);
  const paletteColumn = await client.query<{ data_type: string }>(`SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'weddings' AND column_name = 'palette'`);
  assert.equal(paletteColumn.rows[0]?.data_type, 'jsonb');
  const rsvpColumns = await client.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'weddings'
      AND column_name IN ('rsvp_deadline', 'show_venue_after_rsvp', 'venue_name', 'venue_address', 'venue_maps_url')`);
  assert.equal(rsvpColumns.rowCount, 5);
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
    const palette = { name: 'Jardim', colors: [{ name: 'Oliva', hex: '#6B7558' }, { name: 'Areia', hex: '#D8C8AE' }] };
    const savedPalette = await client.query<{ palette: typeof palette }>('UPDATE weddings SET palette = $1::jsonb WHERE id = $2 RETURNING palette', [JSON.stringify(palette), weddingId]);
    assert.deepEqual(savedPalette.rows[0]?.palette, palette);
    const visible = await client.query('SELECT w.id FROM weddings w JOIN wedding_members m ON m.wedding_id = w.id WHERE m.user_id = $1', ['owner']);
    assert.equal(visible.rowCount, 1);
    const active = await client.query('SELECT count(*) AS count FROM auth_sessions WHERE token_hash = $1 AND expires_at > now()', ['session-hash']);
    assert.equal(active.rows[0].count, '1');
    await client.query('DELETE FROM auth_sessions WHERE token_hash = $1', ['session-hash']);
    const revoked = await client.query('SELECT count(*) AS count FROM auth_sessions WHERE token_hash = $1', ['session-hash']);
    assert.equal(revoked.rows[0].count, '0');
  } finally { await client.query('ROLLBACK'); }
});

void test('a wedding has one owner and one partner with separate accounts', async () => {
  await client.query('BEGIN');
  try {
    await client.query(`INSERT INTO users (id,email,display_name,password_hash,created_at,updated_at) VALUES
      ('couple-owner','owner@couple.local','Owner','hash',now(),now()),
      ('couple-partner','partner@couple.local','Partner','hash',now(),now()),
      ('couple-third','third@couple.local','Third','hash',now(),now())`);
    const wedding = await client.query<{ id: string }>(`INSERT INTO weddings (owner_user_id,title,person_one,person_two,wedding_date,created_at,updated_at)
      VALUES ('couple-owner','Casamento do casal','A','B','2027-06-12',now(),now()) RETURNING id`);
    const weddingId = wedding.rows[0].id;
    await client.query(`INSERT INTO wedding_members (wedding_id,user_id,email,role,permissions,created_at) VALUES
      ($1,'couple-owner','owner@couple.local','owner','["*"]',now()),
      ($1,'couple-partner','partner@couple.local','partner','["*"]',now())`, [weddingId]);
    const visible = await client.query<{ id: string }>(`SELECT w.id FROM weddings w JOIN wedding_members m ON m.wedding_id = w.id
      WHERE m.user_id = 'couple-partner'`);
    assert.equal(visible.rows[0]?.id, weddingId);
    await client.query('SAVEPOINT third_member');
    await assert.rejects(client.query(`INSERT INTO wedding_members (wedding_id,user_id,email,role,permissions,created_at)
      VALUES ($1,'couple-third','third@couple.local','partner','["*"]',now())`, [weddingId]), { code: '23505' });
    await client.query('ROLLBACK TO SAVEPOINT third_member');
  } finally { await client.query('ROLLBACK'); }
});
