import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { LoginForm } from './login-form';
import { withRequestDb } from '@/db';
import { getWeddingInvite } from '@/lib/wedding-invites';
import { turnstileSiteKey } from '@/lib/turnstile';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ convite?: string }> }) {
  return withRequestDb(async () => {
    const inviteToken = (await searchParams).convite ?? '';
    if (await getCurrentUser()) redirect(inviteToken ? `/convite?token=${encodeURIComponent(inviteToken)}` : '/');
    const invite = inviteToken ? await getWeddingInvite(inviteToken) : null;
    if (inviteToken && !invite) redirect('/convite?token=' + encodeURIComponent(inviteToken));
    return (
      <main className="grid min-h-dvh bg-[#f8f8f5] text-[#263b31] lg:grid-cols-[52%_48%]">
        <section
          aria-label="Celebração de casamento ao ar livre"
          className="relative isolate flex min-h-64 flex-col justify-between overflow-hidden bg-[#354439] bg-[url('/login-wedding-garden.png')] bg-cover bg-center px-7 py-7 text-white sm:min-h-80 sm:px-10 sm:py-9 lg:min-h-dvh lg:px-14 lg:py-12"
        >
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#15261d]/55 via-transparent to-[#14251c]/75" />
          <div className="flex items-center gap-3 text-lg font-medium tracking-[0.02em]">
            <span className="flex size-9 items-center justify-center rounded-full border border-white/65 font-serif text-xl italic leading-none" aria-hidden="true">v</span>
            Vínculo
          </div>

          <div className="max-w-[36rem]">
            <p className="mb-3 text-[0.65rem] font-medium uppercase tracking-[0.3em] text-white/80 sm:mb-5">Planejar também é celebrar</p>
            <h1 className="font-serif text-[2.35rem] leading-[1.06] tracking-[-0.035em] sm:text-5xl lg:text-[clamp(3.5rem,5vw,5.8rem)]">
              Cada detalhe conta uma parte da sua história.
            </h1>
            <div className="mt-6 hidden items-center gap-4 text-sm text-white/85 lg:flex">
              <span className="h-px w-10 bg-white/70" aria-hidden="true" />
              Um lugar para sonhar, organizar e viver tudo juntos.
            </div>
          </div>
        </section>

        <section className="flex flex-col px-7 py-10 sm:px-12 lg:min-h-dvh lg:px-14 lg:py-12">
          <div className="hidden items-center justify-end gap-2 text-xs font-medium uppercase tracking-[0.2em] text-[#687c6d] lg:flex">
            Seu espaço de planejamento
            <span className="size-1.5 rounded-full bg-[#9aaf9c]" aria-hidden="true" />
          </div>

          <div className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center py-3 lg:py-10">
            <p className="mb-4 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#6d8a72]">
              {inviteToken ? 'Um convite para vocês' : 'Bem-vindos de volta'}
            </p>
            <h2 className="text-[2.25rem] font-medium leading-[1.1] tracking-[-0.055em] text-[#243a2e] sm:text-[2.75rem]">
              {inviteToken ? 'Seu convite está esperando.' : 'Que bom ter você aqui.'}
            </h2>
            <p className="mt-4 max-w-sm text-[0.95rem] leading-7 text-[#718075]">
              {inviteToken
                ? 'Entre na sua conta para aceitar o convite e começar a planejar em conjunto.'
                : 'Entre para continuar cuidando dos planos para o grande dia.'}
            </p>
            <LoginForm inviteToken={inviteToken} invitedEmail={invite?.invitedEmail} turnstileSiteKey={turnstileSiteKey()} />
          </div>

          <p className="mx-auto mt-10 w-full max-w-[26rem] text-center text-xs text-[#98a39a] lg:mt-0">
            Feito para viver cada etapa a dois.
          </p>
        </section>
      </main>
    );
  });
}
