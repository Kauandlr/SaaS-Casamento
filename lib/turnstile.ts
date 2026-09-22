import { env } from 'cloudflare:workers';

function config(): { enabled: boolean; siteKey: string; secretKey: string } {
  const values = env as unknown as Record<string, string | undefined>;
  return {
    enabled: values.TURNSTILE_ENABLED?.trim().toLowerCase() === 'true',
    siteKey: values.TURNSTILE_SITE_KEY?.trim() ?? '',
    secretKey: values.TURNSTILE_SECRET_KEY?.trim() ?? '',
  };
}

export function turnstileSiteKey(): string {
  const { enabled, siteKey } = config();
  return enabled ? siteKey : '';
}

export async function verifyTurnstile(
  token: string | undefined,
  action: 'login' | 'register',
  request: Request,
): Promise<'ok' | 'invalid' | 'unavailable'> {
  const { enabled, siteKey, secretKey } = config();
  if (!enabled) return 'ok';

  const hostname = new URL(request.url).hostname;
  const local = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  const values = env as unknown as Record<string, string | undefined>;
  const production = values.NODE_ENV === 'production' || process.env.NODE_ENV === 'production';
  if (!siteKey && !secretKey) return !production && local ? 'ok' : 'unavailable';
  if (!siteKey || !secretKey) return 'unavailable';
  if (!token || token.length > 2048) return 'invalid';

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: secretKey, response: token }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return 'unavailable';
    const result = (await response.json()) as { success?: boolean; action?: string; hostname?: string };
    return result.success && result.action === action && (!result.hostname || result.hostname === hostname)
      ? 'ok'
      : 'invalid';
  } catch {
    return 'unavailable';
  }
}
