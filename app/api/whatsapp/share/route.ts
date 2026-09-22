import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withRequestDb } from '@/db';
import { getCurrentUser, isSameOrigin } from '@/lib/auth';
import { db, id, now, requireWeddingId } from '@/lib/wedding-data';
import { buildWhatsAppUrl, normalizeWhatsAppPhone, WHATSAPP_COPY_PT_BR } from '@/lib/whatsapp';

const shareSchema = z.object({
  invitationId: z.uuid().nullable(),
  message: z.string().trim().min(1).max(4000),
  kind: z.enum(['convite inicial', 'lembrete', 'site geral']),
  withoutRecipient: z.boolean().default(false),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  return withRequestDb(async () => {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Sessão necessária.' }, { status: 401 });
    try {
      const payload = shareSchema.parse(await request.json());
      const weddingId = await requireWeddingId(user.userId);
      let phone: string | undefined;
      if (payload.invitationId) {
        const invitation = await db().prepare(`SELECT responsible_phone FROM guest_invitation_groups
          WHERE id = ? AND wedding_id = ?`).bind(payload.invitationId, weddingId).first<Record<string, unknown>>();
        if (!invitation) return NextResponse.json({ error: 'Convite não encontrado.' }, { status: 404 });
        if (!payload.withoutRecipient) {
          const normalized = normalizeWhatsAppPhone(String(invitation.responsible_phone ?? ''));
          if (!normalized.ok) return NextResponse.json({ error: normalized.error }, { status: 422 });
          phone = normalized.value;
        }
      }

      const createdAt = now();
      const statements = [
        db().prepare(`INSERT INTO invitation_share_attempts (
          id, wedding_id, invitation_group_id, user_id, kind, channel, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .bind(id(), weddingId, payload.invitationId, user.userId, payload.kind, WHATSAPP_COPY_PT_BR.channel, createdAt),
      ];
      if (payload.invitationId) {
        statements.push(db().prepare(`UPDATE guest_invitation_groups SET last_shared_at = ?, updated_at = ?
          WHERE id = ? AND wedding_id = ?`).bind(createdAt, createdAt, payload.invitationId, weddingId));
      }
      await db().batch(statements);
      return NextResponse.json({
        url: buildWhatsAppUrl(payload.message, phone),
        openedAt: createdAt,
        message: WHATSAPP_COPY_PT_BR.openedDescription,
      });
    } catch (error) {
      if (error instanceof z.ZodError) return NextResponse.json({ error: 'Revise a mensagem antes de continuar.' }, { status: 422 });
      console.error('WhatsApp share failed', error instanceof Error ? error.message : 'unknown_error');
      return NextResponse.json({ error: 'Não foi possível preparar o WhatsApp.' }, { status: 500 });
    }
  });
}
