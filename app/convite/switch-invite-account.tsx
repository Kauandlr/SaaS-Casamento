'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function SwitchInviteAccount({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function switchAccount() {
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('logout_failed');
      window.location.assign(`/login?convite=${encodeURIComponent(token)}`);
    } catch {
      setError('Não foi possível trocar de conta. Tente novamente.');
      setPending(false);
    }
  }

  return <div className="space-y-3"><Button onClick={switchAccount} disabled={pending}>{pending ? 'Saindo…' : 'Entrar com o e-mail convidado'}</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}
