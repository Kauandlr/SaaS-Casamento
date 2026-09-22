import { cookies, headers } from 'next/headers';
import { env } from 'cloudflare:workers';
import { db } from './wedding-data';
import { id, now } from './wedding-data';
import { base64url, hashPassword, verifyPassword, verifyPlainPassword } from './password';
import { clearRateLimit, consumeRateLimit } from './rate-limit';
export { isSameOrigin } from './request-origin';

const SESSION_COOKIE = 'vinculo_session';
const SESSION_DAYS = 7;
const REMEMBERED_SESSION_DAYS = 30;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

export type AuthUser = { userId: string; email: string; displayName: string };

type AuthConfig = {
  userId: string;
  email: string;
  displayName: string;
  passwordHash?: string;
  legacyPassword?: string;
};

type Row = Record<string, unknown>;

function legacyConfig(): AuthConfig | null {
  const values = env as unknown as Record<string, string | undefined>;
  const userId = values.AUTH_USER_ID?.trim();
  const email = values.AUTH_EMAIL?.trim().toLowerCase();
  const displayName = values.AUTH_DISPLAY_NAME?.trim();
  const passwordHash = values.AUTH_PASSWORD_HASH?.trim();
  const legacyPassword = values.AUTH_PASSWORD;
  if (!userId || !email || !displayName || (!passwordHash && !legacyPassword)) return null;
  return { userId, email, displayName, passwordHash, legacyPassword };
}

export async function sha256(value: string): Promise<string> {
  return base64url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
  );
}

export function clientAddress(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

export async function login(email: string, password: string, request: Request, rememberLogin = false): Promise<{ ok: true; user: AuthUser; token: string } | { ok: false; status: 401 | 429 }> {
  const normalizedEmail = email.trim().toLowerCase();
  // The e-mail bucket cannot be bypassed by spoofing a forwarded IP header.
  if (!(await consumeRateLimit('login:email', normalizedEmail, 10, ATTEMPT_WINDOW_MS)))
    return { ok: false, status: 429 };
  if (!(await consumeRateLimit('login:ip', clientAddress(request), 30, ATTEMPT_WINDOW_MS)))
    return { ok: false, status: 429 };
  const row = await db().prepare('SELECT id, email, display_name, password_hash FROM users WHERE email = ? LIMIT 1')
    .bind(normalizedEmail).first<Row>();
  const legacy = legacyConfig();
  const storedHash = typeof row?.password_hash === 'string' ? row.password_hash : null;
  const legacyMatches = legacy?.email === normalizedEmail;
  // A known hash is verified for unknown e-mails too, to reduce account enumeration.
  const fallbackHash = 'pbkdf2-sha256$600000$mRfqHZWU3-82U1F_Nx0_Ug$g6wIz-fNMPC7EKwUuHtVGeXJ4Md0kxQEtS6CV8E7zwM';
  const passwordIsValid = storedHash
    ? await verifyPassword(password, storedHash)
    : legacyMatches && legacy?.passwordHash
      ? await verifyPassword(password, legacy.passwordHash)
      : legacyMatches && legacy?.legacyPassword
        ? await verifyPlainPassword(password, legacy.legacyPassword)
        : await verifyPassword(password, fallbackHash);
  const valid = passwordIsValid && Boolean(storedHash || legacyMatches);
  if (!valid) return { ok: false, status: 401 };

  const user: AuthUser = row
    ? { userId: String(row.id), email: String(row.email), displayName: String(row.display_name) }
    : { userId: legacy!.userId, email: legacy!.email, displayName: legacy!.displayName };
  if (!row && legacy) {
    await db().prepare(`INSERT INTO users (id, email, display_name, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`)
      .bind(legacy.userId, legacy.email, legacy.displayName, legacy.passwordHash ?? await hashPassword(password), now(), now()).run();
  } else if (row && !storedHash && legacyMatches) {
    await db().prepare('UPDATE users SET password_hash = ? WHERE id = ? AND password_hash IS NULL')
      .bind(legacy?.passwordHash ?? await hashPassword(password), user.userId).run();
  }
  const token = await createSession(user.userId, rememberLogin);
  await clearRateLimit('login:email', normalizedEmail);
  return {
    ok: true,
    user,
    token,
  };
}

async function createSession(userId: string, rememberLogin: boolean): Promise<string> {
  const token = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const sessionDays = rememberLogin ? REMEMBERED_SESSION_DAYS : SESSION_DAYS;
  const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000).toISOString();
  await db().prepare('INSERT INTO auth_sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id(), userId, tokenHash, expiresAt, now()).run();
  return token;
}

export async function register(displayName: string, email: string, password: string, request: Request): Promise<{ ok: true; token: string } | { ok: false; status: 409 | 429 }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!(await consumeRateLimit('register:ip', clientAddress(request), 10, ATTEMPT_WINDOW_MS)))
    return { ok: false, status: 429 };
  if (!(await consumeRateLimit('register:email', normalizedEmail, 3, 24 * 60 * 60 * 1000)))
    return { ok: false, status: 429 };
  const passwordHash = await hashPassword(password);
  const userId = id();
  const inserted = await db().prepare(`INSERT INTO users (id, email, display_name, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (email) DO NOTHING RETURNING id`)
    .bind(userId, normalizedEmail, displayName.trim(), passwordHash, now(), now()).first<Row>();
  if (!inserted) return { ok: false, status: 409 };
  return { ok: true, token: await createSession(userId, false) };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = readSessionToken((await headers()).get('cookie'));
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await db()
    .prepare(`SELECT u.id AS user_id, u.email, u.display_name
    FROM auth_sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > NOW() LIMIT 1`)
    .bind(tokenHash)
    .first<Row>();
  if (!row) return null;
  return {
    userId: String(row.user_id),
    email: String(row.email),
    displayName: String(row.display_name),
  };
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error('AUTH_REQUIRED');
  return user;
}

export async function revokeCurrentSession(): Promise<void> {
  const token = readSessionToken((await headers()).get('cookie'));
  if (token)
    await db()
      .prepare('DELETE FROM auth_sessions WHERE token_hash = ?')
      .bind(await sha256(token))
      .run();
}

function readSessionToken(header: string | null): string | null {
  const match = header?.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]*)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string, rememberLogin = false): Promise<void> {
  const values = env as unknown as Record<string, string | undefined>;
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: values.NODE_ENV === 'production' || (await headers()).get('x-forwarded-proto') === 'https',
    path: '/',
    ...(rememberLogin ? { maxAge: REMEMBERED_SESSION_DAYS * 24 * 60 * 60 } : {}),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const values = env as unknown as Record<string, string | undefined>;
  const secure = values.NODE_ENV === 'production' || (await headers()).get('x-forwarded-proto') === 'https';
  (await cookies()).set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 0,
  });
}

export { SESSION_COOKIE };
