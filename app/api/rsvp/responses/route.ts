import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withRequestDb } from '@/db';
import { isSameOrigin } from '@/lib/auth';
import { RSVP_SESSION_COOKIE, savePublicResponses } from '@/lib/rsvp';

const schema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,80}$/),
  guests: z.array(z.object({ id: z.uuid(), rsvp: z.enum(['confirmado', 'não irá']) })).min(1).max(50),
  companions: z.array(z.object({
    name: z.string().trim().min(2).max(120),
    ageGroup: z.enum(['adulto', 'criança']),
  })).max(20),
  note: z.string().trim().max(500).default(''),
});

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  return withRequestDb(async () => {
    try {
      const payload = schema.parse(await request.json());
      const token = (await cookies()).get(RSVP_SESSION_COOKIE)?.value ?? '';
      const invitation = await savePublicResponses(token, payload.slug, payload);
      return NextResponse.json({ invitation });
    } catch (error) {
      if (error instanceof z.ZodError) return NextResponse.json({ error: 'Revise todas as respostas antes de confirmar.' }, { status: 422 });
      const code = error instanceof Error ? error.message : '';
      if (code === 'DEADLINE_CLOSED') return NextResponse.json({ error: 'O prazo para alterar a confirmação terminou. Para solicitar uma mudança, fale diretamente com os noivos.' }, { status: 409 });
      if (code === 'COMPANION_LIMIT') return NextResponse.json({ error: 'O limite de acompanhantes deste convite foi atingido.' }, { status: 422 });
      if (code === 'INVALID_GUESTS') return NextResponse.json({ error: 'Responda somente pelas pessoas deste convite.' }, { status: 403 });
      if (code === 'SESSION_INVALID') return NextResponse.json({ error: 'Sua validação expirou. Valide o convite novamente.' }, { status: 401 });
      console.error('Public RSVP save failed', code || 'unknown_error');
      return NextResponse.json({ error: 'Não foi possível salvar sua confirmação agora.' }, { status: 500 });
    }
  });
}
