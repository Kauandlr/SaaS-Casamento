import { NextResponse } from 'next/server';
import { withRequestDb } from '@/db';
import { getCurrentUser } from '@/lib/auth';
import { db, requireWeddingId } from '@/lib/wedding-data';

type Row = Record<string, unknown>;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return withRequestDb(async () => {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Sessão necessária.' }, { status: 401 });
    const weddingId = await requireWeddingId(user.userId);
    const { id } = await context.params;
    const invitation = await db().prepare('SELECT id FROM guest_invitation_groups WHERE id = ? AND wedding_id = ?')
      .bind(id, weddingId).first<Row>();
    if (!invitation) return NextResponse.json({ error: 'Convite não encontrado.' }, { status: 404 });
    const rows = await db().prepare(`SELECT h.id, h.guest_id, h.subject_name, h.previous_response, h.new_response,
        s.source, s.note, s.created_at, u.display_name
      FROM rsvp_submissions s
      LEFT JOIN rsvp_response_history h ON h.submission_id = s.id
      LEFT JOIN users u ON u.id = s.actor_user_id
      WHERE s.invitation_group_id = ? AND s.wedding_id = ?
      ORDER BY s.created_at DESC, h.subject_name`).bind(id, weddingId).all<Row>();
    return NextResponse.json({
      history: rows.results.map((row) => ({
        id: String(row.id ?? `${row.created_at}-${row.subject_name ?? 'submission'}`),
        guestId: row.guest_id ? String(row.guest_id) : null,
        subjectName: row.subject_name ? String(row.subject_name) : null,
        previousResponse: row.previous_response ? String(row.previous_response) : null,
        newResponse: row.new_response ? String(row.new_response) : null,
        source: String(row.source),
        note: String(row.note ?? ''),
        createdAt: new Date(row.created_at as string | Date).toISOString(),
        actorName: row.display_name ? String(row.display_name) : null,
      })),
    });
  });
}
