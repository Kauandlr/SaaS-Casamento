import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSameOrigin, login, setSessionCookie } from '@/lib/auth';
import { withRequestDb } from '@/db';
import { verifyTurnstile } from '@/lib/turnstile';

const schema = z.object({
  email: z.email().transform((value) => value.trim()),
  password: z.string().min(1).max(500),
  rememberLogin: z.boolean().optional().default(false),
  turnstileToken: z.string().max(2048).optional(),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  return withRequestDb(async () => {
    try {
      const payload = schema.parse(await request.json());
      const challenge = await verifyTurnstile(payload.turnstileToken, 'login', request);
      if (challenge !== 'ok')
        return NextResponse.json(
          { error: challenge === 'invalid' ? 'Confirme o desafio anti-bot.' : 'Verificacao anti-bot indisponivel.' },
          { status: challenge === 'invalid' ? 403 : 503 },
        );
      const result = await login(payload.email, payload.password, request, payload.rememberLogin);
      if (!result.ok)
        return NextResponse.json(
          {
            error:
              result.status === 429
                ? 'Muitas tentativas. Aguarde alguns minutos.'
                : 'E-mail ou senha inválidos.',
          },
          { status: result.status, ...(result.status === 429 ? { headers: { 'Retry-After': '900' } } : {}) },
        );
      await setSessionCookie(result.token, payload.rememberLogin);
      return NextResponse.json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError)
        return NextResponse.json(
          { error: 'Informe um e-mail e uma senha válidos.' },
          { status: 422 },
        );
      console.error('Login failed', error instanceof Error ? error.message : 'unknown_error');
      return NextResponse.json({ error: 'Autenticação indisponível no momento.' }, { status: 503 });
    }
  });
}
