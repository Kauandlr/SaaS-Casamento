import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser, isSameOrigin } from '@/lib/auth';
import { withRequestDb } from '@/db';
import { acceptWeddingInvite } from '@/lib/wedding-invites';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  return withRequestDb(async () => {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Entre na sua conta para aceitar o convite.' }, { status: 401 });
    try {
      const { token } = z.object({ token: z.string().min(40).max(60) }).parse(await request.json());
      const result = await acceptWeddingInvite(token, user.userId, user.email);
      if (result === 'workspace') return NextResponse.json({ error: 'Sua conta já pertence a um casamento.' }, { status: 409 });
      if (result === 'email') return NextResponse.json({ error: 'Este convite foi criado para outro e-mail. Entre com a conta indicada no convite.' }, { status: 403 });
      if (result === 'invalid') return NextResponse.json({ error: 'Convite inválido, expirado ou já utilizado.' }, { status: 410 });
      return NextResponse.json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) return NextResponse.json({ error: 'Convite inválido.' }, { status: 422 });
      console.error('Invite acceptance failed', error instanceof Error ? error.message : 'unknown_error');
      return NextResponse.json({ error: 'Não foi possível aceitar o convite.' }, { status: 500 });
    }
  });
}
