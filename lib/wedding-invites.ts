import { base64url } from './password';
import { sha256 } from './auth';
import { db, id, now, requireWeddingId } from './wedding-data';

type Row = Record<string, unknown>;

export async function getCoupleAccess(userId: string): Promise<{ role: string; members: Array<{ displayName: string; email: string }> }> {
  const weddingId = await requireWeddingId(userId);
  const result = await db().prepare(`SELECT m.role, u.display_name, u.email
    FROM wedding_members m JOIN users u ON u.id = m.user_id
    WHERE m.wedding_id = ? ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END`)
    .bind(weddingId).all<Row>();
  const mine = await db().prepare('SELECT role FROM wedding_members WHERE wedding_id = ? AND user_id = ?')
    .bind(weddingId, userId).first<Row>();
  return {
    role: String(mine?.role ?? ''),
    members: result.results.map((row) => ({ displayName: String(row.display_name), email: String(row.email) })),
  };
}

export async function createWeddingInvite(userId: string, invitedEmail: string): Promise<string | null> {
  const weddingId = await requireWeddingId(userId);
  const access = await getCoupleAccess(userId);
  const normalizedEmail = invitedEmail.trim().toLowerCase();
  if (access.role !== 'owner' || access.members.length >= 2 || access.members.some((member) => member.email.toLowerCase() === normalizedEmail)) return null;
  const token = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  await db().prepare(`INSERT INTO wedding_invites (id, wedding_id, invited_by, invited_email, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(id(), weddingId, userId, normalizedEmail, tokenHash, new Date(Date.now() + 7 * 86400000).toISOString(), now()).run();
  return token;
}

export async function finalizeWeddingInvite(userId: string, token: string): Promise<void> {
  const weddingId = await requireWeddingId(userId);
  await db().prepare(`DELETE FROM wedding_invites
    WHERE wedding_id = ? AND token_hash <> ? AND accepted_at IS NULL`)
    .bind(weddingId, await sha256(token)).run();
}

export async function discardWeddingInvite(userId: string, token: string): Promise<void> {
  const weddingId = await requireWeddingId(userId);
  await db().prepare('DELETE FROM wedding_invites WHERE wedding_id = ? AND token_hash = ? AND accepted_at IS NULL')
    .bind(weddingId, await sha256(token)).run();
}

export async function getWeddingInvite(token: string): Promise<{ title: string; invitedEmail: string } | null> {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const row = await db().prepare(`SELECT w.title, i.invited_email FROM wedding_invites i JOIN weddings w ON w.id = i.wedding_id
    WHERE i.token_hash = ? AND i.accepted_at IS NULL AND i.expires_at > NOW()
    AND (SELECT COUNT(*) FROM wedding_members m WHERE m.wedding_id = i.wedding_id) < 2 LIMIT 1`)
    .bind(await sha256(token)).first<Row>();
  return row ? { title: String(row.title), invitedEmail: String(row.invited_email) } : null;
}

export async function acceptWeddingInvite(token: string, userId: string, email: string): Promise<'ok' | 'invalid' | 'workspace' | 'email'> {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return 'invalid';
  const existing = await db().prepare('SELECT 1 FROM wedding_members WHERE user_id = ? LIMIT 1')
    .bind(userId).first<Row>();
  if (existing) return 'workspace';
  const tokenHash = await sha256(token);
  const invited = await getWeddingInvite(token);
  if (!invited) return 'invalid';
  if (invited.invitedEmail !== email.trim().toLowerCase()) return 'email';
  const memberId = id();
  try {
    const row = await db().prepare(`WITH claimed AS (
      UPDATE wedding_invites SET accepted_at = NOW()
      WHERE token_hash = ? AND invited_email = ? AND accepted_at IS NULL AND expires_at > NOW()
      AND (SELECT COUNT(*) FROM wedding_members WHERE wedding_id = wedding_invites.wedding_id) < 2
      RETURNING wedding_id
    )
    INSERT INTO wedding_members (id, wedding_id, user_id, email, role, permissions, created_at)
    SELECT ?, wedding_id, ?, ?, 'partner', '["*"]', NOW() FROM claimed
    RETURNING wedding_id`)
      .bind(tokenHash, email.trim().toLowerCase(), memberId, userId, email).first<Row>();
    return row ? 'ok' : 'invalid';
  } catch (error) {
    if ((error as { code?: string }).code === '23505') return 'invalid';
    throw error;
  }
}
