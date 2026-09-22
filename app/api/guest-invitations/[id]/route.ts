import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withRequestDb } from '@/db';
import { getCurrentUser, isSameOrigin } from '@/lib/auth';
import { db, getSnapshot, now, requireWeddingId } from '@/lib/wedding-data';
import { normalizeWhatsAppPhone } from '@/lib/whatsapp';

const invitationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  responsibleName: z.string().trim().min(2).max(120),
  responsiblePhone: z.string().trim().max(30),
  familyName: z.string().trim().max(120),
  customSalutation: z.string().trim().max(120),
  additionalGuestLimit: z.number().int().min(0).max(20),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  return withRequestDb(async () => {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Sessão necessária.' }, { status: 401 });
    try {
      const payload = invitationSchema.parse(await request.json());
      const { id } = await context.params;
      const weddingId = await requireWeddingId(user.userId);
      let phone = '';
      if (payload.responsiblePhone) {
        const normalized = normalizeWhatsAppPhone(payload.responsiblePhone);
        if (!normalized.ok) return NextResponse.json({ error: normalized.error }, { status: 422 });
        phone = normalized.value;
      }
      const result = await db().prepare(`UPDATE guest_invitation_groups SET
        name = ?, responsible_name = ?, responsible_phone = ?, family_name = ?,
        custom_salutation = ?, additional_guest_limit = ?, updated_at = ?
        WHERE id = ? AND wedding_id = ?`)
        .bind(payload.name, payload.responsibleName, phone, payload.familyName,
          payload.customSalutation, payload.additionalGuestLimit, now(), id, weddingId).run();
      if (!result.meta.changes) return NextResponse.json({ error: 'Convite não encontrado.' }, { status: 404 });
      return NextResponse.json({ snapshot: await getSnapshot(user) });
    } catch (error) {
      if (error instanceof z.ZodError) return NextResponse.json({ error: 'Revise os dados do convite.' }, { status: 422 });
      console.error('Guest invitation update failed', error instanceof Error ? error.message : 'unknown_error');
      return NextResponse.json({ error: 'Não foi possível atualizar o convite.' }, { status: 500 });
    }
  });
}
