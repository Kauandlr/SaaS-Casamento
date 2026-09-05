import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { LoginForm } from './login-form';
import { closeDb } from '@/db';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  try {
    if (await getCurrentUser()) redirect('/');
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Vínculo</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">Seu casamento, no lugar certo.</h1>
            <p className="mt-3 text-sm text-muted-foreground">Entre para continuar seu planejamento.</p>
          </div>
          <LoginForm />
        </div>
      </main>
    );
  } finally {
    await closeDb();
  }
}
