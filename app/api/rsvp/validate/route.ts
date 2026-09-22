import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withRequestDb } from '@/db';
import { clientAddress, isSameOrigin } from '@/lib/auth';
import {
  RSVP_GENERIC_PHONE_ERROR,
  RSVP_NO_PHONE_ERROR,
  RSVP_SESSION_COOKIE,
  RSVP_UNAVAILABLE_ERROR,
  validateInvitation,
} from '@/lib/rsvp';

const schema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,80}$/),
  lastFour: z.string().regex(/^\d{4}$/),
  challenge: z.string().min(20).max(200).optional(),
  invitationToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
}).refine((value) => Boolean(value.challenge) !== Boolean(value.invitationToken));

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  return withRequestDb(async () => {
    try {
      const payload = schema.parse(await request.json());
      const result = await validateInvitation({ ...payload, clientId: clientAddress(request) });
      if (!result.ok) {
        const error = result.reason === 'no-phone' ? RSVP_NO_PHONE_ERROR
          : result.reason === 'unavailable' ? RSVP_UNAVAILABLE_ERROR
            : RSVP_GENERIC_PHONE_ERROR;
        return NextResponse.json({ error }, { status: result.reason === 'limited' ? 429 : 422 });
      }
      (await cookies()).set(RSVP_SESSION_COOKIE, result.sessionToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 30 * 60,
      });
      return NextResponse.json({ invitation: result.data });
    } catch (error) {
      if (error instanceof z.ZodError) return NextResponse.json({ error: RSVP_GENERIC_PHONE_ERROR }, { status: 422 });
      console.error('RSVP validation failed', error instanceof Error ? error.message : 'unknown_error');
      return NextResponse.json({ error: 'Não foi possível validar o convite agora.' }, { status: 500 });
    }
  });
}
