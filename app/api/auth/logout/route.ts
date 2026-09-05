import { NextResponse } from 'next/server';
import { clearSessionCookie, isSameOrigin, revokeCurrentSession } from '@/lib/auth';
import { closeDb } from '@/db';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  try { await revokeCurrentSession(); } finally { await clearSessionCookie(); await closeDb(); }
  return NextResponse.json({ ok: true });
}
