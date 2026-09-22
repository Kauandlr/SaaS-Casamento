import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { withRequestDb } from '@/db';
import { RegisterForm } from './register-form';
import { getWeddingInvite } from '@/lib/wedding-invites';
import { turnstileSiteKey } from '@/lib/turnstile';

export const dynamic = 'force-dynamic';

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ convite?: string }> }) {
  return withRequestDb(async () => {
    const inviteToken = (await searchParams).convite ?? '';
    if (await getCurrentUser()) redirect(inviteToken ? `/convite?token=${encodeURIComponent(inviteToken)}` : '/');
    const invite = inviteToken ? await getWeddingInvite(inviteToken) : null;
    if (inviteToken && !invite) redirect('/convite?token=' + encodeURIComponent(inviteToken));
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Vínculo</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">Comecem a planejar juntos.</h1>
            <p className="mt-3 text-sm text-muted-foreground">Cada pessoa usa sua própria conta e compartilha o mesmo casamento.</p>
          </div>
          <RegisterForm inviteToken={inviteToken} invitedEmail={invite?.invitedEmail} turnstileSiteKey={turnstileSiteKey()} />
        </div>
      </main>
    );
  });
}
