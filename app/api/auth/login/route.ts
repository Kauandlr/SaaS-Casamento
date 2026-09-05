import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSameOrigin, login, setSessionCookie } from '@/lib/auth';
import { closeDb } from '@/db';

const schema = z.object({ email: z.email().transform((value) => value.trim()), password: z.string().min(1).max(500) });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  try {
    const payload = schema.parse(await request.json());
    const result = await login(payload.email, payload.password, request);
    if (!result.ok) return NextResponse.json({ error: result.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos.' : 'E-mail ou senha inválidos.' }, { status: result.status });
    await setSessionCookie(result.token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Informe um e-mail e uma senha válidos.' }, { status: 422 });
    console.error('Login failed', error instanceof Error ? error.message : 'unknown_error');
    return NextResponse.json({ error: 'Autenticação indisponível no momento.' }, { status: 503 });
  } finally {
    await closeDb();
  }
}
