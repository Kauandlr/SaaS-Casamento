import { NextResponse } from 'next/server';
import { clearSessionCookie, isSameOrigin, revokeCurrentSession } from '@/lib/auth';
import { withRequestDb } from '@/db';

export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  return withRequestDb(async () => {
    try {
      await revokeCurrentSession();
    } finally {
      await clearSessionCookie();
    }
    return NextResponse.json({ ok: true });
  });
}
