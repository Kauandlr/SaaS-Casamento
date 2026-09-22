'use client';

import { useCallback, useState } from 'react';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TurnstileChallenge } from '@/components/turnstile-challenge';

export function LoginForm({
  inviteToken = '',
  invitedEmail,
  turnstileSiteKey = '',
}: {
  inviteToken?: string;
  invitedEmail?: string;
  turnstileSiteKey?: string;
}) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const handleTurnstileToken = useCallback((token: string) => setTurnstileToken(token), []);

  async function submit(form: FormData) {
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password'),
          rememberLogin: form.has('rememberLogin'),
          turnstileToken,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? 'Não foi possível entrar agora.');
        return;
      }
      window.location.assign(inviteToken ? `/convite?token=${encodeURIComponent(inviteToken)}` : '/');
    } catch {
      setError('Não foi possível conectar ao servidor.');
    } finally {
      setPending(false);
    }
  }

  const registerHref = inviteToken ? `/cadastro?convite=${encodeURIComponent(inviteToken)}` : '/cadastro';

  return (
    <div className="mt-8">
      <form action={submit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-[0.82rem] font-medium text-[#334138]">
            E-mail
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="seu@email.com"
            defaultValue={invitedEmail}
            readOnly={Boolean(invitedEmail)}
            aria-invalid={Boolean(error)}
            className="h-12 rounded-lg border-[#cdd3ce] bg-white px-3.5 text-[0.95rem] shadow-none placeholder:text-[#747d76] hover:border-[#aeb8b0] focus-visible:border-[#315d42] focus-visible:ring-2 focus-visible:ring-[#315d42]/18"
            required
          />
          {invitedEmail && <p className="text-xs leading-5 text-[#68736a]">Use o e-mail que recebeu o convite.</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-[0.82rem] font-medium text-[#334138]">
            Senha
          </Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={Boolean(error)}
              onKeyDown={(event) => setCapsLock(event.getModifierState('CapsLock'))}
              onKeyUp={(event) => setCapsLock(event.getModifierState('CapsLock'))}
              onBlur={() => setCapsLock(false)}
              placeholder="Sua senha"
              className="h-12 rounded-lg border-[#cdd3ce] bg-white px-3.5 pr-12 text-[0.95rem] shadow-none placeholder:text-[#747d76] hover:border-[#aeb8b0] focus-visible:border-[#315d42] focus-visible:ring-2 focus-visible:ring-[#315d42]/18"
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1/2 right-2 -translate-y-1/2 text-[#667169] transition-colors hover:bg-[#edf0ed] hover:text-[#294c35] focus-visible:ring-2 focus-visible:ring-[#315d42]/25"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeSlash aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </Button>
          </div>
          {capsLock && (
            <p className="text-xs text-[#59655c]" role="status">
              Caps Lock está ativado.
            </p>
          )}
        </div>

        <label className="flex w-fit cursor-pointer items-center gap-2.5 text-[0.82rem] text-[#59655c]">
          <input
            type="checkbox"
            name="rememberLogin"
            className="size-4 rounded border-[#9da89f] accent-[#315d42] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315d42]"
          />
          Continuar conectado por 30 dias
        </label>

        <TurnstileChallenge siteKey={turnstileSiteKey} action="login" onTokenChange={handleTurnstileToken} />

        {error && (
          <p role="alert" className="rounded-lg bg-[#f8e9e7] px-3.5 py-3 text-sm leading-5 text-[#8b332d]">
            {error}
          </p>
        )}

        <Button
          className="h-12 w-full rounded-lg bg-[#294f36] text-[0.95rem] font-semibold text-white shadow-none transition-[background-color,transform] duration-200 hover:bg-[#203f2b] focus-visible:ring-2 focus-visible:ring-[#315d42]/30 active:translate-y-px"
          type="submit"
          disabled={pending || Boolean(turnstileSiteKey && !turnstileToken)}
        >
          {pending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>

      <p className="mt-7 text-center text-sm text-[#667168] sm:hidden">
        Ainda não usa o Vínculo?{' '}
        <Link
          className="font-medium text-[#294c35] underline decoration-[#aabaae] underline-offset-4"
          href={registerHref}
        >
          Criar conta
        </Link>
      </p>
    </div>
  );
}
