'use client';

import { useState } from 'react';
import { CheckCircle, UsersThree } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import type { PublicInvitation } from '@/lib/guest-invitations';

export function RsvpForm({ invitation, slug, token }: { invitation: PublicInvitation; slug: string; token: string }) {
  const [responses, setResponses] = useState<Record<string, string>>(() => Object.fromEntries(
    invitation.guests.map((guest) => [guest.id, ['confirmado', 'não irá'].includes(guest.rsvp) ? guest.rsvp : '']),
  ));
  const [companions, setCompanions] = useState(() => invitation.companions.map((item) => ({ name: item.name, ageGroup: item.ageGroup })));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);

  const companionCount = companions.length;
  function resizeCompanions(count: number) {
    setCompanions((current) => Array.from({ length: count }, (_, index) => current[index] ?? { name: '', ageGroup: 'adulto' }));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (Object.values(responses).some((value) => !value)) {
      setError('Informe se cada pessoa irá ou não.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const response = await fetch(`/api/rsvp/${encodeURIComponent(token)}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug,
          guests: invitation.guests.map((guest) => ({ id: guest.id, rsvp: responses[guest.id] })),
          companions,
        }),
      });
      const body = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error ?? 'Não foi possível salvar sua confirmação.');
      setComplete(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar sua confirmação.');
    } finally {
      setPending(false);
    }
  }

  if (complete) return (
    <div className="py-8 text-center" role="status">
      <CheckCircle className="mx-auto text-primary" size={44} weight="fill" />
      <h2 className="mt-4 text-xl font-semibold">Presenças registradas</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Obrigado por responder. Você pode voltar a este link se precisar atualizar as respostas.</p>
      <Button className="mt-6" variant="outline" onClick={() => setComplete(false)}>Revisar respostas</Button>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-7">
      <section>
        <h2 className="text-base font-semibold">Confirme a presença de cada pessoa</h2>
        <div className="mt-3 divide-y divide-border rounded-2xl border border-border">
          {invitation.guests.map((guest) => (
            <fieldset key={guest.id} className="p-4">
              <legend className="w-full pb-3 font-medium">{guest.fullName}</legend>
              <div className="grid grid-cols-2 gap-2">
                {([['confirmado', 'Vou'], ['não irá', 'Não vou']] as const).map(([value, label]) => (
                  <label key={value} className={`flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm font-medium transition-colors ${responses[guest.id] === value ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background hover:bg-secondary'}`}>
                    <input className="sr-only" type="radio" name={`guest-${guest.id}`} value={value} checked={responses[guest.id] === value} onChange={() => setResponses((current) => ({ ...current, [guest.id]: value }))} />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      {invitation.additionalGuestLimit > 0 && (
        <section className="space-y-4 border-t border-border pt-6">
          <div className="flex items-center gap-2"><UsersThree size={20} /><h2 className="font-semibold">Acompanhantes</h2></div>
          <label className="grid gap-2 text-sm font-medium">Quantas pessoas adicionais irão?
            <NativeSelect value={String(companionCount)} onValueChange={(value) => resizeCompanions(Number(value ?? 0))}>
              {Array.from({ length: invitation.additionalGuestLimit + 1 }, (_, value) => <NativeSelectOption key={value} value={String(value)}>{value}</NativeSelectOption>)}
            </NativeSelect>
          </label>
          {companions.map((companion, index) => (
            <div key={index} className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
              <label className="grid gap-2 text-sm font-medium">Nome
                <Input required value={companion.name} onChange={(event) => setCompanions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} />
              </label>
              <label className="grid gap-2 text-sm font-medium">Faixa
                <NativeSelect value={companion.ageGroup} onValueChange={(value) => setCompanions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ageGroup: value ?? 'adulto' } : item))}>
                  <NativeSelectOption value="adulto">Adulto</NativeSelectOption>
                  <NativeSelectOption value="criança">Criança</NativeSelectOption>
                </NativeSelect>
              </label>
            </div>
          ))}
        </section>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button className="h-12 w-full" disabled={pending}>{pending ? 'Salvando…' : 'Confirmar respostas'}</Button>
    </form>
  );
}
