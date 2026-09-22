import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { withRequestDb } from '@/db';
import { getInvitationForSession, RSVP_SESSION_COOKIE } from '@/lib/rsvp';

export async function GET(request: Request) {
  return withRequestDb(async () => {
    const slug = new URL(request.url).searchParams.get('slug') ?? '';
    const invitationToken = new URL(request.url).searchParams.get('invitationToken') ?? undefined;
    if (!/^[a-z0-9-]{3,80}$/.test(slug)) return NextResponse.json({ invitation: null });
    const token = (await cookies()).get(RSVP_SESSION_COOKIE)?.value ?? '';
    const invitation = await getInvitationForSession(token, slug, invitationToken);
    return NextResponse.json({ invitation });
  });
}
