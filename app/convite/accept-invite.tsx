'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function AcceptInvite({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function accept() {
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) { setError(body.error ?? 'Não foi possível aceitar o convite.'); return; }
      window.location.assign('/');
    } catch {
      setError('Não foi possível conectar ao servidor.');
    } finally {
      setPending(false);
    }
  }

  return <div className="space-y-3"><Button onClick={accept} disabled={pending}>{pending ? 'Aceitando…' : 'Aceitar convite'}</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}
