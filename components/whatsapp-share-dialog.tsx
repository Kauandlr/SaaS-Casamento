'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowSquareOut, CheckCircle, Copy, WhatsappLogo } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import type { Guest, GuestInvitation, WeddingSnapshot } from '@/lib/wedding-types';
import { buildGeneralWeddingMessage, buildInvitationMessage, normalizeWhatsAppPhone } from '@/lib/whatsapp';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: WeddingSnapshot;
  invitation?: GuestInvitation;
  onSnapshot: (snapshot: WeddingSnapshot) => void;
  onShared: (invitationId: string | null, openedAt: string) => void;
};

function invitationGuests(invitation: GuestInvitation | undefined, guests: Guest[]) {
  if (!invitation) return [];
  const ids = new Set(invitation.guestIds);
  return guests.filter((guest) => ids.has(guest.id));
}

export function WhatsAppShareDialog({ open, onOpenChange, data, invitation, onSnapshot, onShared }: Props) {
  const members = useMemo(() => invitationGuests(invitation, data.guests), [invitation, data.guests]);
  const [origin, setOrigin] = useState('');
  const [message, setMessage] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [customSalutation, setCustomSalutation] = useState('');
  const [additionalGuestLimit, setAdditionalGuestLimit] = useState(0);
  const [kind, setKind] = useState<'convite inicial' | 'lembrete'>('convite inicial');
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    if (!open) return;
    if (invitation) {
      setPhone(invitation.responsiblePhone);
      setName(invitation.name);
      setResponsibleName(invitation.responsibleName);
      setFamilyName(invitation.familyName);
      setCustomSalutation(invitation.customSalutation);
      setAdditionalGuestLimit(invitation.additionalGuestLimit);
      setKind(invitation.lastSharedAt ? 'lembrete' : 'convite inicial');
    }
    setError('');
    setCopied(false);
  }, [open, invitation]);

  const weddingUrl = `${origin}/casamento/${data.wedding.publicSlug}`;
  const confirmationUrl = invitation ? `${weddingUrl}/confirmar/${invitation.token}` : weddingUrl;
  function generatedMessage() {
    if (!invitation) return buildGeneralWeddingMessage(`${data.wedding.personOne} & ${data.wedding.personTwo}`, weddingUrl);
    return buildInvitationMessage({
      invitationName: name || invitation.name,
      invitationType: invitation.type,
      guestNames: members.map((guest) => guest.fullName),
      familyName,
      customSalutation,
      coupleName: `${data.wedding.personOne} & ${data.wedding.personTwo}`,
      weddingDate: data.wedding.weddingDate,
      weddingUrl,
      confirmationUrl,
    }, data.wedding.whatsappMessageTemplate);
  }
  useEffect(() => {
    if (open && origin) setMessage(generatedMessage());
    // Only reset the temporary message when a share flow is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, origin, invitation?.id]);

  async function saveInvitation() {
    if (!invitation) return;
    const response = await fetch(`/api/guest-invitations/${invitation.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, responsibleName, responsiblePhone: phone, familyName, customSalutation, additionalGuestLimit }),
    });
    const body = await response.json() as { snapshot?: WeddingSnapshot; error?: string };
    if (!response.ok || !body.snapshot) throw new Error(body.error ?? 'Não foi possível atualizar o convite.');
    onSnapshot(body.snapshot);
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.add({ title: 'Mensagem copiada', description: 'Agora você pode colar a mensagem onde preferir.', type: 'success' });
    } catch {
      setError('Não foi possível copiar automaticamente. Selecione o texto da mensagem e copie.');
    }
  }

  async function openWhatsApp(withoutRecipient = false) {
    if (!message.trim()) { setError('Escreva uma mensagem antes de continuar.'); return; }
    if (invitation && !withoutRecipient) {
      const normalized = normalizeWhatsAppPhone(phone);
      if (!normalized.ok) { setError(normalized.error); return; }
    }
    const target = window.open('about:blank', '_blank');
    setPending(true);
    setError('');
    try {
      await saveInvitation();
      const response = await fetch('/api/whatsapp/share', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ invitationId: invitation?.id ?? null, message, kind: invitation ? kind : 'site geral', withoutRecipient }),
      });
      const body = await response.json() as { url?: string; openedAt?: string; error?: string };
      if (!response.ok || !body.url || !body.openedAt) throw new Error(body.error ?? 'Não foi possível abrir o WhatsApp.');
      onShared(invitation?.id ?? null, body.openedAt);
      if (target) target.location.href = body.url;
      else window.location.assign(body.url);
      toast.add({ title: 'WhatsApp aberto', description: 'A mensagem foi preparada. Conclua o envio pelo WhatsApp.', type: 'success' });
      onOpenChange(false);
    } catch (reason) {
      target?.close();
      setError(reason instanceof Error ? reason.message : 'Não foi possível abrir o WhatsApp.');
    } finally {
      setPending(false);
    }
  }

  const hasPhone = phone.trim().length > 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bottom-0 left-0 top-auto max-h-[92dvh] max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-b-none sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-[620px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><WhatsappLogo className="text-[#128c7e]" size={22} weight="fill" />{invitation ? 'Enviar convite pelo WhatsApp' : 'Compartilhar site pelo WhatsApp'}</DialogTitle>
          <DialogDescription>A mensagem será preparada; o envio é concluído por você no WhatsApp.</DialogDescription>
        </DialogHeader>

        {invitation && (
          <div className="grid gap-3 rounded-xl bg-secondary/60 p-4 text-sm sm:grid-cols-2">
            <div><p className="text-xs text-muted-foreground">Destinatário</p><p className="mt-1 font-medium">{customSalutation || name}</p></div>
            <div><p className="text-xs text-muted-foreground">Pessoas incluídas</p><p className="mt-1 font-medium">{members.map((guest) => guest.fullName).join(', ')}</p></div>
            <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Link individual</p><p className="mt-1 truncate font-mono text-xs" title={confirmationUrl}>{confirmationUrl}</p></div>
          </div>
        )}

        {invitation && (
          <details className="rounded-xl border border-border p-4">
            <summary className="cursor-pointer text-sm font-medium">Dados e composição do convite</summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">Nome do convite<Input value={name} onChange={(event) => setName(event.target.value)} /></label>
              <label className="grid gap-2 text-sm font-medium">Responsável<Input value={responsibleName} onChange={(event) => setResponsibleName(event.target.value)} /></label>
              <label className="grid gap-2 text-sm font-medium">WhatsApp do responsável<Input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="(11) 99999-9999" /></label>
              <label className="grid gap-2 text-sm font-medium">Limite de acompanhantes<Input type="number" min={0} max={20} value={additionalGuestLimit} onChange={(event) => setAdditionalGuestLimit(Number(event.target.value))} /></label>
              {invitation.type === 'familia' && <label className="grid gap-2 text-sm font-medium">Nome da família<Input value={familyName} onChange={(event) => setFamilyName(event.target.value)} placeholder="Silva" /></label>}
              <label className="grid gap-2 text-sm font-medium sm:col-span-2">Tratamento personalizado<Input value={customSalutation} onChange={(event) => setCustomSalutation(event.target.value)} placeholder="Ex.: Padrinhos João e Maria" /></label>
              <Button type="button" variant="outline" className="sm:col-span-2" onClick={() => setMessage(generatedMessage())}>Atualizar mensagem com estes dados</Button>
            </div>
          </details>
        )}

        <label className="grid gap-2 text-sm font-medium">Mensagem
          <Textarea className="min-h-52 resize-y leading-6" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={4000} />
        </label>
        {invitation && <label className="grid gap-2 text-sm font-medium">Tipo de tentativa
          <NativeSelect value={kind} onValueChange={(value) => setKind((value as typeof kind) ?? 'convite inicial')}>
            <NativeSelectOption value="convite inicial">Convite inicial</NativeSelectOption>
            <NativeSelectOption value="lembrete">Lembrete</NativeSelectOption>
          </NativeSelect>
        </label>}
        {invitation && !hasPhone && <div className="rounded-xl bg-amber-100 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">O número de WhatsApp não foi informado. Você ainda pode copiar a mensagem ou compartilhar sem destinatário.</div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="sticky bottom-0">
          <Button type="button" variant="outline" onClick={copyMessage}>{copied ? <CheckCircle /> : <Copy />}{copied ? 'Copiada' : 'Copiar mensagem'}</Button>
          {invitation && !hasPhone ? (
            <Button type="button" onClick={() => openWhatsApp(true)} disabled={pending}><ArrowSquareOut />{pending ? 'Preparando…' : 'Compartilhar sem destinatário'}</Button>
          ) : (
            <Button type="button" onClick={() => openWhatsApp(false)} disabled={pending}><WhatsappLogo weight="fill" />{pending ? 'Preparando…' : 'Abrir WhatsApp'}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
