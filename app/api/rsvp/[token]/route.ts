import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withRequestDb } from '@/db';
import { isSameOrigin } from '@/lib/auth';
import { getDb } from '@/db';
import { getPublicInvitation } from '@/lib/guest-invitations';

const responseSchema = z.object({
  slug: z.string().min(3).max(80),
  guests: z.array(z.object({ id: z.uuid(), rsvp: z.enum(['confirmado', 'não irá']) })).min(1).max(50),
  companions: z.array(z.object({
    name: z.string().trim().min(2).max(120),
    ageGroup: z.enum(['adulto', 'criança']),
  })).max(20),
});

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  return withRequestDb(async () => {
    try {
      const payload = responseSchema.parse(await request.json());
      const { token } = await context.params;
      const invitation = await getPublicInvitation(payload.slug, token);
      if (!invitation) return NextResponse.json({ error: 'Este convite não está disponível.' }, { status: 404 });
      if (payload.companions.length > invitation.additionalGuestLimit) {
        return NextResponse.json({ error: `Este convite permite até ${invitation.additionalGuestLimit} acompanhante(s).` }, { status: 422 });
      }
      const allowed = new Set(invitation.guests.map((guest) => guest.id));
      if (payload.guests.length !== allowed.size || payload.guests.some((guest) => !allowed.has(guest.id))) {
        return NextResponse.json({ error: 'Responda somente pelas pessoas deste convite.' }, { status: 403 });
      }
      const timestamp = new Date().toISOString();
      const db = getDb();
      const statements = payload.guests.map((guest) =>
        db.prepare(`UPDATE guests SET rsvp = ? WHERE id = ? AND invitation_group_id = ?`)
          .bind(guest.rsvp, guest.id, invitation.id),
      );
      statements.push(db.prepare('DELETE FROM invitation_companions WHERE invitation_group_id = ?').bind(invitation.id));
      for (const companion of payload.companions) {
        statements.push(db.prepare(`INSERT INTO invitation_companions (
          id, invitation_group_id, name, age_group, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)`)
          .bind(crypto.randomUUID(), invitation.id, companion.name, companion.ageGroup, timestamp, timestamp));
      }
      await db.batch(statements);
      return NextResponse.json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) return NextResponse.json({ error: 'Revise todas as respostas antes de confirmar.' }, { status: 422 });
      console.error('Public RSVP failed', error instanceof Error ? error.message : 'unknown_error');
      return NextResponse.json({ error: 'Não foi possível salvar sua confirmação agora.' }, { status: 500 });
    }
  });
}
