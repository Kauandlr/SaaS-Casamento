import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSameOrigin, register, setSessionCookie } from '@/lib/auth';
import { withRequestDb } from '@/db';
import { verifyTurnstile } from '@/lib/turnstile';

const schema = z.object({
  displayName: z.string().trim().min(2).max(80),
  email: z.email().max(254),
  password: z.string().min(10).max(128),
  turnstileToken: z.string().max(2048).optional(),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  return withRequestDb(async () => {
    try {
      const input = schema.parse(await request.json());
      const challenge = await verifyTurnstile(input.turnstileToken, 'register', request);
      if (challenge !== 'ok')
        return NextResponse.json(
          { error: challenge === 'invalid' ? 'Confirme o desafio anti-bot.' : 'Verificacao anti-bot indisponivel.' },
          { status: challenge === 'invalid' ? 403 : 503 },
        );
      const result = await register(input.displayName, input.email, input.password, request);
      if (!result.ok) return NextResponse.json({ error: result.status === 409
        ? 'Este e-mail já tem uma conta. Entre para continuar.'
        : 'Muitas tentativas. Aguarde alguns minutos.' }, {
          status: result.status,
          ...(result.status === 429 ? { headers: { 'Retry-After': '900' } } : {}),
        });
      await setSessionCookie(result.token);
      return NextResponse.json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) return NextResponse.json({ error: 'Informe nome, e-mail e uma senha com ao menos 10 caracteres.' }, { status: 422 });
      console.error('Registration failed', error instanceof Error ? error.message : 'unknown_error');
      return NextResponse.json({ error: 'Não foi possível criar a conta agora.' }, { status: 503 });
    }
  });
}
