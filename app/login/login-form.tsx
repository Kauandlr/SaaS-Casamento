'use client';

import { useState } from 'react';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function LoginForm() {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  async function submit(form: FormData) {
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), password: form.get('password'), rememberLogin: form.has('rememberLogin') }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? 'Não foi possível entrar agora.');
        return;
      }
      window.location.assign('/');
    } catch {
      setError('Não foi possível conectar ao servidor.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Entrar</CardTitle></CardHeader>
      <CardContent>
        <form action={submit} className="space-y-5">
          <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" name="email" type="email" autoComplete="username" required /></div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
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
                className="pr-10"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeSlash aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </Button>
            </div>
            {capsLock && <p className="text-sm text-muted-foreground" role="status">Caps Lock está ativado.</p>}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" name="rememberLogin" className="size-4 accent-primary" />
            Lembrar login por 30 dias
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" type="submit" disabled={pending}>{pending ? 'Entrando…' : 'Entrar'}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
