'use client';

import { useState } from 'react';
import { UsersThree } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Access = { role: string; members: Array<{ displayName: string; email: string }> };

export function CoupleAccess() {
  const [open, setOpen] = useState(false);
  const [access, setAccess] = useState<Access | null>(null);
  const [invitedEmail, setInvitedEmail] = useState('');
  const [sentEmail, setSentEmail] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function show() {
    setOpen(true);
    setError('');
    try {
      const response = await fetch('/api/invites');
      const body = (await response.json()) as Access & { error?: string };
      if (!response.ok) { setError(body.error ?? 'Não foi possível carregar os acessos.'); return; }
      setAccess(body);
    } catch { setError('Não foi possível conectar ao servidor.'); }
  }

  async function generate() {
    if (!invitedEmail.trim()) { setError('Informe o e-mail do seu par.'); return; }
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/invites', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ invitedEmail }) });
      const body = (await response.json()) as { ok?: boolean; invitedEmail?: string; error?: string };
      if (!response.ok || !body.ok) { setError(body.error ?? 'Não foi possível enviar o convite.'); return; }
      setSentEmail(body.invitedEmail ?? invitedEmail.trim().toLowerCase());
    } catch { setError('Não foi possível conectar ao servidor.'); }
    finally { setPending(false); }
  }

  return <>
    <Button variant="outline" size="sm" onClick={show}><UsersThree size={17} aria-hidden="true" /><span className="hidden sm:inline">Acesso do casal</span></Button>
    {open && <Dialog open onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>Acesso do casal</DialogTitle><DialogDescription>As duas contas veem e atualizam o mesmo planejamento.</DialogDescription></DialogHeader>
        {access && <div className="space-y-3">
          <div className="space-y-2">{access.members.map((member) => <div key={member.email} className="rounded-lg border px-3 py-2 text-sm"><strong>{member.displayName}</strong><span className="block text-muted-foreground">{member.email}</span></div>)}</div>
          {access.role === 'owner' && access.members.length < 2 && <>
            <p className="text-sm text-muted-foreground">Informe o e-mail da pessoa com quem você vai compartilhar este casamento. O convite chega pelo Resend, vale por 7 dias e só pode ser aceito por essa conta.</p>
            <div className="space-y-2"><Label htmlFor="partner-email">E-mail do parceiro ou parceira</Label><Input id="partner-email" type="email" value={invitedEmail} onChange={(event) => setInvitedEmail(event.target.value)} placeholder="parceiro@exemplo.com" autoComplete="email" /></div>
            <Button onClick={generate} disabled={pending}>{pending ? 'Enviando…' : sentEmail ? 'Reenviar convite' : 'Enviar convite'}</Button>
            {sentEmail && <p role="status" className="text-sm text-primary">Convite enviado para {sentEmail}. Um novo envio substitui o convite anterior.</p>}
          </>}
        </div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>}
  </>;
}
