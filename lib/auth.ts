import { cookies, headers } from 'next/headers';
import { env } from 'cloudflare:workers';
import { db } from './wedding-data';
import { id, now } from './wedding-data';
import { base64url, verifyPassword, verifyPlainPassword } from './password';

const SESSION_COOKIE = 'vinculo_session';
const SESSION_DAYS = 7;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export type AuthUser = { userId: string; email: string; displayName: string };

type AuthConfig = {
  userId: string;
  email: string;
  displayName: string;
  passwordHash?: string;
  password?: string;
};

type Row = Record<string, unknown>;

function config(): AuthConfig {
  const values = env as unknown as Record<string, string | undefined>;
  const userId = values.AUTH_USER_ID?.trim();
  const email = values.AUTH_EMAIL?.trim().toLowerCase();
  const displayName = values.AUTH_DISPLAY_NAME?.trim();
  const passwordHash = values.AUTH_PASSWORD_HASH?.trim();
  const password = values.AUTH_PASSWORD;
  if (!userId || !email || !displayName || (!passwordHash && !password)) {
    throw new Error('AUTH_USER_ID, AUTH_EMAIL, AUTH_DISPLAY_NAME e AUTH_PASSWORD ou AUTH_PASSWORD_HASH são obrigatórios.');
  }
  return { userId, email, displayName, passwordHash, password };
}

async function sha256(value: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
}

function clientAddress(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const receivedOrigin = new URL(origin).origin;
    const requestUrl = new URL(request.url);
    const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const host = request.headers.get('host')?.trim();
    const requestOrigin = host
      ? `${forwardedProto || requestUrl.protocol.replace(':', '')}://${host}`
      : requestUrl.origin;

    // Vinext may expose an internal request URL (for example 0.0.0.0:3000)
    // while the browser uses the public Host header. Compare against that
    // externally visible host so local and proxied production requests work.
    return receivedOrigin === requestOrigin;
  } catch {
    return false;
  }
}

export async function login(email: string, password: string, request: Request): Promise<{ ok: true; user: AuthUser; token: string } | { ok: false; status: 401 | 429 }> {
  const account = config();
  const normalizedEmail = email.trim().toLowerCase();
  const fingerprint = await sha256(`${clientAddress(request)}:${normalizedEmail}`);
  const cutoff = new Date(Date.now() - ATTEMPT_WINDOW_MS).toISOString();
  const attempts = await db().prepare('SELECT COUNT(*)::int AS count FROM auth_login_attempts WHERE fingerprint = ? AND attempted_at > ?').bind(fingerprint, cutoff).first<Row>();
  if (Number(attempts?.count ?? 0) >= MAX_ATTEMPTS) return { ok: false, status: 429 };
  const valid = normalizedEmail === account.email && (account.passwordHash
    ? await verifyPassword(password, account.passwordHash)
    : await verifyPlainPassword(password, account.password!));
  if (!valid) {
    await db().prepare('INSERT INTO auth_login_attempts (id, fingerprint, attempted_at) VALUES (?, ?, ?)').bind(id(), fingerprint, now()).run();
    return { ok: false, status: 401 };
  }

  const token = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await db().batch([
    db().prepare(`INSERT INTO users (id, email, display_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name, updated_at = EXCLUDED.updated_at`).bind(account.userId, account.email, account.displayName, now(), now()),
    db().prepare('DELETE FROM auth_login_attempts WHERE fingerprint = ? OR attempted_at < ?').bind(fingerprint, cutoff),
    db().prepare('DELETE FROM auth_sessions WHERE user_id = ? OR expires_at < ?').bind(account.userId, now()),
    db().prepare('INSERT INTO auth_sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)').bind(id(), account.userId, tokenHash, expiresAt, now()),
  ]);
  return { ok: true, user: { userId: account.userId, email: account.email, displayName: account.displayName }, token };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = readSessionToken((await headers()).get('cookie'));
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await db().prepare(`SELECT u.id AS user_id, u.email, u.display_name
    FROM auth_sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > NOW() LIMIT 1`).bind(tokenHash).first<Row>();
  if (!row) return null;
  return { userId: String(row.user_id), email: String(row.email), displayName: String(row.display_name) };
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error('AUTH_REQUIRED');
  return user;
}

export async function revokeCurrentSession(): Promise<void> {
  const token = readSessionToken((await headers()).get('cookie'));
  if (token) await db().prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(await sha256(token)).run();
}

function readSessionToken(header: string | null): string | null {
  const match = header?.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: (await headers()).get('x-forwarded-proto') === 'https',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const secure = (await headers()).get('x-forwarded-proto') === 'https';
  (await cookies()).set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 0 });
}

export { SESSION_COOKIE };
