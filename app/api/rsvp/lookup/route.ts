import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withRequestDb } from '@/db';
import { clientAddress, isSameOrigin } from '@/lib/auth';
import { consumeRateLimit } from '@/lib/rate-limit';
import { createLookupChallenge, logLookupRateLimit, RSVP_GENERIC_LOOKUP_ERROR } from '@/lib/rsvp';

const schema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,80}$/),
  name: z.string().trim().min(2).max(160),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  return withRequestDb(async () => {
    try {
      const payload = schema.parse(await request.json());
      if (!(await consumeRateLimit('rsvp:lookup:ip', clientAddress(request), 20, 15 * 60_000))) {
        await logLookupRateLimit(payload.slug, clientAddress(request));
        return NextResponse.json({ error: RSVP_GENERIC_LOOKUP_ERROR }, { status: 429 });
      }
      const challenge = await createLookupChallenge(payload.slug, payload.name);
      if (!challenge) return NextResponse.json({ error: RSVP_GENERIC_LOOKUP_ERROR }, { status: 404 });
      return NextResponse.json({ challenge });
    } catch (error) {
      if (error instanceof z.ZodError) return NextResponse.json({ error: RSVP_GENERIC_LOOKUP_ERROR }, { status: 422 });
      console.error('RSVP lookup failed', error instanceof Error ? error.message : 'unknown_error');
      return NextResponse.json({ error: 'Não foi possível consultar o convite agora.' }, { status: 500 });
    }
  });
}
