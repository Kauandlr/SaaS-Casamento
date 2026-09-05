import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser, isSameOrigin } from '@/lib/auth';
import { createWorkspace } from '@/lib/wedding-data';
import { closeDb } from '@/db';

const schema = z.object({
  personOne: z.string().trim().min(2).max(80), personTwo: z.string().trim().min(2).max(80),
  weddingDate: z.iso.date(), city: z.string().trim().max(120).default(''),
  budgetCents: z.number().int().nonnegative().max(2_000_000_000), savedCents: z.number().int().nonnegative().max(2_000_000_000),
  monthlyCapacityCents: z.number().int().nonnegative().max(2_000_000_000), reservePercent: z.number().int().min(0).max(100), guestEstimate: z.number().int().nonnegative().max(10000),
  categories: z.array(z.object({ name: z.string().trim().min(2).max(80), plannedCents: z.number().int().nonnegative().max(2_000_000_000) })).max(50),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sessão necessária.' }, { status: 401 });
  try { const input = schema.parse(await request.json()); await createWorkspace(user, input); return NextResponse.json({ ok: true }); }
  catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ error: 'Revise os campos informados.' }, { status: 422 }); console.error('Onboarding failed', error); return NextResponse.json({ error: 'Não foi possível criar o espaço.' }, { status: 500 }); }
  finally { await closeDb(); }
}
