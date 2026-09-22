import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser, isSameOrigin } from '@/lib/auth';
import { withRequestDb } from '@/db';
import { createWeddingInvite, discardWeddingInvite, finalizeWeddingInvite, getCoupleAccess, getWeddingInvite } from '@/lib/wedding-invites';
import { ResendDeliveryError, sendWeddingInvitation } from '@/lib/resend';
import { consumeRateLimit } from '@/lib/rate-limit';

export async function GET() {
  return withRequestDb(async () => {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Sessão necessária.' }, { status: 401 });
    try {
      return NextResponse.json(await getCoupleAccess(user.userId));
    } catch {
      return NextResponse.json({ error: 'Casamento não encontrado.' }, { status: 404 });
    }
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  return withRequestDb(async () => {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Sessão necessária.' }, { status: 401 });
    try {
      const { invitedEmail } = z.object({ invitedEmail: z.email().max(254) }).parse(await request.json());
      if (!(await consumeRateLimit('invite:hour', user.userId, 5, 60 * 60 * 1000)) ||
          !(await consumeRateLimit('invite:day', user.userId, 10, 24 * 60 * 60 * 1000)))
        return NextResponse.json({ error: 'Muitos convites enviados. Aguarde antes de tentar novamente.' }, { status: 429 });
      const token = await createWeddingInvite(user.userId, invitedEmail);
      if (!token) return NextResponse.json({ error: 'Confirme o e-mail do parceiro. O convite só pode ser criado por quem iniciou um casamento sem parceiro vinculado.' }, { status: 403 });
      try {
        const invite = await getWeddingInvite(token);
        if (!invite) throw new Error('INVITE_NOT_FOUND');
        await sendWeddingInvitation({ to: invite.invitedEmail, invitedBy: user.displayName, weddingTitle: invite.title, token });
      } catch (error) {
        await discardWeddingInvite(user.userId, token);
        throw error;
      }
      await finalizeWeddingInvite(user.userId, token);
      return NextResponse.json({ ok: true, invitedEmail: invitedEmail.trim().toLowerCase() });
    } catch (error) {
      if (error instanceof z.ZodError) return NextResponse.json({ error: 'Informe um e-mail válido para o parceiro.' }, { status: 422 });
      if (error instanceof Error && ['RESEND_NOT_CONFIGURED', 'APP_URL_INVALID'].includes(error.message))
        return NextResponse.json({ error: 'O envio de e-mails ainda não está configurado. Configure o Resend e tente novamente.' }, { status: 503 });
      if (error instanceof ResendDeliveryError) {
        console.error('Resend invite delivery failed', error.message);
        return NextResponse.json({ error: 'O Resend não aceitou o envio. Confira o remetente e tente novamente.' }, { status: 502 });
      }
      console.error('Wedding invite failed', error instanceof Error ? error.message : 'unknown_error');
      return NextResponse.json({ error: 'Não foi possível criar o convite.' }, { status: 500 });
    }
  });
}
