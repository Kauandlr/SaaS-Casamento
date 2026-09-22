import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { withRequestDb } from '@/db';
import { getWeddingInvite } from '@/lib/wedding-invites';
import { turnstileSiteKey } from '@/lib/turnstile';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ convite?: string }> }) {
  return withRequestDb(async () => {
    const inviteToken = (await searchParams).convite ?? '';
    if (await getCurrentUser()) redirect(inviteToken ? `/convite?token=${encodeURIComponent(inviteToken)}` : '/');

    const invite = inviteToken ? await getWeddingInvite(inviteToken) : null;
    if (inviteToken && !invite) redirect('/convite?token=' + encodeURIComponent(inviteToken));

    const registerHref = inviteToken ? `/cadastro?convite=${encodeURIComponent(inviteToken)}` : '/cadastro';

    return (
      <main className="min-h-dvh bg-[#f4f5f2] text-[#202721] lg:grid lg:grid-cols-[minmax(34rem,1fr)_minmax(26rem,0.72fr)]">
        <section className="flex min-h-dvh flex-col px-6 py-6 sm:px-10 sm:py-8 lg:px-[clamp(3rem,6vw,7.5rem)] lg:py-10">
          <header className="flex items-center justify-between gap-6">
            <Link
              href="/login"
              className="text-[1.05rem] font-semibold tracking-[-0.035em] text-[#1e3025] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#315d42]"
              aria-label="Vínculo — página de login"
            >
              vínculo<span className="text-[#799781]">.</span>
            </Link>

            <p className="hidden text-sm text-[#5f6a61] sm:block">
              Ainda não usa o Vínculo?{' '}
              <Link
                href={registerHref}
                className="font-medium text-[#294c35] underline decoration-[#aabaae] underline-offset-4 transition-colors hover:decoration-[#294c35] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#315d42]"
              >
                Criar conta
              </Link>
            </p>
          </header>

          <div className="flex flex-1 items-center py-14 sm:py-20">
            <div className="mx-auto w-full max-w-[24.5rem] lg:mx-0">
              <h1 className="text-[2rem] font-semibold leading-[1.15] tracking-[-0.035em] text-[#1d2920]">
                {inviteToken ? 'Entre para ver seu convite' : 'Entre na sua conta'}
              </h1>
              <p className="mt-3 text-[0.95rem] leading-6 text-[#667168]">
                {inviteToken
                  ? 'Use sua conta do Vínculo para aceitar o convite.'
                  : 'Continue de onde vocês pararam.'}
              </p>

              <LoginForm
                inviteToken={inviteToken}
                invitedEmail={invite?.invitedEmail}
                turnstileSiteKey={turnstileSiteKey()}
              />
            </div>
          </div>

          <footer className="flex items-center justify-between gap-4 text-xs text-[#7a837c]">
            <span>© {new Date().getFullYear()} Vínculo</span>
            <span className="hidden sm:inline">Planejamento de casamento, em um só lugar.</span>
          </footer>
        </section>

        <aside
          aria-label="Mesa de celebração ao ar livre"
          className="relative m-3 hidden min-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-[0.875rem] bg-[#24342a] lg:block"
        >
          <div className="absolute inset-0 bg-[url('/login-wedding-garden.png')] bg-cover bg-[position:56%_center]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,32,23,0.04)_38%,rgba(18,32,23,0.62)_100%)]" />
          <div className="absolute right-7 bottom-7 left-7 flex items-end justify-between gap-8 border-t border-white/35 pt-4 text-white">
            <p className="max-w-[18rem] text-sm leading-6 text-white/90">
              Orçamento, fornecedores, convidados e tarefas no mesmo ritmo.
            </p>
            <span className="shrink-0 text-xs tabular-nums text-white/70">01 / 01</span>
          </div>
        </aside>
      </main>
    );
  });
}
