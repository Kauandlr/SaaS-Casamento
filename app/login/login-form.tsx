'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function LoginForm() {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(form: FormData) {
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
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
          <div className="space-y-2"><Label htmlFor="password">Senha</Label><Input id="password" name="password" type="password" autoComplete="current-password" required /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" type="submit" disabled={pending}>{pending ? 'Entrando…' : 'Entrar'}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
