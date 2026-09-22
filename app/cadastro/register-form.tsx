'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TurnstileChallenge } from '@/components/turnstile-challenge';

export function RegisterForm({ inviteToken = '', invitedEmail, turnstileSiteKey = '' }: { inviteToken?: string; invitedEmail?: string; turnstileSiteKey?: string }) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const handleTurnstileToken = useCallback((token: string) => setTurnstileToken(token), []);

  async function submit(form: FormData) {
    const password = String(form.get('password') ?? '');
    if (password !== String(form.get('confirmPassword') ?? '')) {
      setError('As senhas não coincidem.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName: form.get('displayName'), email: form.get('email'), password, turnstileToken }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? 'Não foi possível criar sua conta.');
        return;
      }
      window.location.assign(inviteToken ? `/convite?token=${encodeURIComponent(inviteToken)}` : '/onboarding');
    } catch {
      setError('Não foi possível conectar ao servidor.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Criar conta</CardTitle></CardHeader>
      <CardContent>
        <form action={submit} className="space-y-5">
          <div className="space-y-2"><Label htmlFor="displayName">Seu nome</Label><Input id="displayName" name="displayName" autoComplete="name" maxLength={80} required /></div>
          <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" name="email" type="email" autoComplete="email" maxLength={254} defaultValue={invitedEmail} readOnly={Boolean(invitedEmail)} required />{invitedEmail && <p className="text-xs text-muted-foreground">Use o e-mail que recebeu o convite.</p>}</div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={10} maxLength={128} className="pr-10" required />
              <Button type="button" variant="ghost" size="icon-xs" className="absolute top-1/2 right-1 -translate-y-1/2" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword}>
                {showPassword ? <EyeSlash aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Use pelo menos 10 caracteres.</p>
          </div>
          <div className="space-y-2"><Label htmlFor="confirmPassword">Confirme a senha</Label><Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required /></div>
          <TurnstileChallenge siteKey={turnstileSiteKey} action="register" onTokenChange={handleTurnstileToken} />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending || Boolean(turnstileSiteKey && !turnstileToken)}>{pending ? 'Criando conta…' : 'Criar conta'}</Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">Já tem conta? <Link className="font-medium text-primary underline-offset-4 hover:underline" href={inviteToken ? `/login?convite=${encodeURIComponent(inviteToken)}` : '/login'}>Entrar</Link></p>
      </CardContent>
    </Card>
  );
}
