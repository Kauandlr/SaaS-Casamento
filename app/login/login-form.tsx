'use client';

import { useCallback, useState } from 'react';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { TurnstileChallenge } from '@/components/turnstile-challenge';

export function LoginForm({ inviteToken = '', invitedEmail, turnstileSiteKey = '' }: { inviteToken?: string; invitedEmail?: string; turnstileSiteKey?: string }) {
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
        body: JSON.stringify({ email: form.get('email'), password: form.get('password'), rememberLogin: form.has('rememberLogin'), turnstileToken }),
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

  return (
    <div className="mt-9">
      <form action={submit} className="space-y-5">
        <div className="space-y-2.5">
          <Label htmlFor="email" className="text-sm font-medium text-[#344a3b]">Seu e-mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="voce@exemplo.com"
            defaultValue={invitedEmail}
            readOnly={Boolean(invitedEmail)}
            className="h-12 rounded-xl border-[#dbe2da] bg-white px-4 shadow-[0_1px_2px_rgba(36,58,46,0.03)] placeholder:text-[#a5afa5] focus-visible:border-[#688771] focus-visible:ring-[#688771]/20"
            required
          />
          {invitedEmail && <p className="text-xs text-[#718075]">Use o e-mail que recebeu o convite.</p>}
        </div>
        <div className="space-y-2.5">
          <Label htmlFor="password" className="text-sm font-medium text-[#344a3b]">Sua senha</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onKeyDown={(event) => setCapsLock(event.getModifierState('CapsLock'))}
              onKeyUp={(event) => setCapsLock(event.getModifierState('CapsLock'))}
              onBlur={() => setCapsLock(false)}
              placeholder="Digite sua senha"
              className="h-12 rounded-xl border-[#dbe2da] bg-white px-4 pr-12 shadow-[0_1px_2px_rgba(36,58,46,0.03)] placeholder:text-[#a5afa5] focus-visible:border-[#688771] focus-visible:ring-[#688771]/20"
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1/2 right-2 -translate-y-1/2 text-[#7f9182] hover:bg-[#edf2ed] hover:text-[#36533d]"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeSlash aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </Button>
          </div>
          {capsLock && <p className="text-sm text-[#6b786d]" role="status">Caps Lock está ativado.</p>}
        </div>
        <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm text-[#637466]">
          <input type="checkbox" name="rememberLogin" className="size-4 rounded border-[#aab8ac] accent-[#335b42]" />
          Lembrar de mim por 30 dias
        </label>
        <TurnstileChallenge siteKey={turnstileSiteKey} action="login" onTokenChange={handleTurnstileToken} />
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-destructive">{error}</p>}
        <Button
          className="mt-1 h-12 w-full rounded-xl bg-[#315d42] text-base font-medium text-white shadow-[0_6px_16px_rgba(42,82,55,0.13)] hover:bg-[#254b35] focus-visible:ring-[#315d42]/30"
          type="submit"
          disabled={pending || Boolean(turnstileSiteKey && !turnstileToken)}
        >
          {pending ? 'Entrando…' : 'Entrar na minha conta'}
        </Button>
      </form>
      <div className="mt-8 border-t border-[#dfe5dd] pt-7 text-center text-sm text-[#728175]">
        Ainda não tem conta?{' '}
        <Link
          className="font-semibold text-[#315d42] underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315d42]"
          href={inviteToken ? `/cadastro?convite=${encodeURIComponent(inviteToken)}` : '/cadastro'}
        >
          Criar conta
        </Link>
      </div>
    </div>
  );
}
