import { db } from './wedding-data';
import { base64url } from './password';

/** Atomically reserves a request slot across concurrent Workers. */
export async function consumeRateLimit(
  scope: string,
  identity: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${scope}:${identity}`),
  );
  const key = base64url(new Uint8Array(digest));
  const cutoff = new Date(Date.now() - windowMs).toISOString();
  const result = await db().prepare(`
    INSERT INTO security_rate_limits (key, window_start, count)
    VALUES (?, NOW(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN security_rate_limits.window_start <= ?::timestamptz THEN 1
        ELSE security_rate_limits.count + 1
      END,
      window_start = CASE
        WHEN security_rate_limits.window_start <= ?::timestamptz THEN NOW()
        ELSE security_rate_limits.window_start
      END
    WHERE security_rate_limits.window_start <= ?::timestamptz
       OR security_rate_limits.count < ?
    RETURNING count
  `).bind(key, cutoff, cutoff, cutoff, limit).first();
  const sample = crypto.getRandomValues(new Uint8Array(1))[0];
  if (sample === 0)
    await db().prepare("DELETE FROM security_rate_limits WHERE window_start < NOW() - INTERVAL '2 days'").run();
  return Boolean(result);
}

export async function clearRateLimit(scope: string, identity: string): Promise<void> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${scope}:${identity}`),
  );
  await db().prepare('DELETE FROM security_rate_limits WHERE key = ?')
    .bind(base64url(new Uint8Array(digest))).run();
}
