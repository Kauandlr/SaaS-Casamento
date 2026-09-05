import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasWorkspace } from '@/lib/wedding-data';
import { OnboardingForm } from './onboarding-form';
import { closeDb } from '@/db';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  try {
    const user = await getCurrentUser();
    if (!user) redirect('/login');
    if (await hasWorkspace(user.userId)) redirect('/');
    return (
      <main className="min-h-screen bg-background px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Vínculo</p>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">Vamos começar pelo que é de vocês.</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">Cadastre os dados reais do casamento. Nada será preenchido automaticamente.</p>
          <div className="mt-8"><OnboardingForm /></div>
        </div>
      </main>
    );
  } finally {
    await closeDb();
  }
}
