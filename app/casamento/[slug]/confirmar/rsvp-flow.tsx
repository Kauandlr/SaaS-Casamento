'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowSquareOut, CalendarDots, CheckCircle, MapPin, UsersThree } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import type { PublicRsvpInvitation } from '@/lib/rsvp';

type Step = 'identify' | 'people' | 'complete';

function formattedDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' })
    .format(new Date(`${value}T12:00:00Z`));
}

function ProgressSteps({ step }: { step: Step }) {
  const active = step === 'identify' ? 0 : step === 'people' ? 1 : 2;
  return (
    <ol className="grid min-w-0 grid-cols-3 border-b border-border pb-5 text-[11px] sm:text-xs" aria-label="Progresso da confirmação">
      {['Identificação', 'Pessoas', 'Concluído'].map((label, index) => (
        <li key={label} className={`relative text-center ${index <= active ? 'font-medium text-primary' : 'text-muted-foreground'}`} aria-current={index === active ? 'step' : undefined}>
          <span className={`mx-auto mb-2 grid size-7 place-items-center rounded-full border ${index <= active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background'}`}>{index + 1}</span>
          {label}
          {index < 2 && <span className="absolute left-[calc(50%+18px)] top-3.5 h-px w-[calc(100%-36px)] bg-border" />}
        </li>
      ))}
    </ol>
  );
}

export function RsvpFlow({
  slug,
  invitationToken,
  deadline,
}: {
  slug: string;
  invitationToken?: string;
  deadline: string | null;
}) {
  const [step, setStep] = useState<Step>('identify');
  const [identification, setIdentification] = useState<'name' | 'phone'>(invitationToken ? 'phone' : 'name');
  const [name, setName] = useState('');
  const [lastFour, setLastFour] = useState('');
  const [challenge, setChallenge] = useState('');
  const [invitation, setInvitation] = useState<PublicRsvpInvitation | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [companions, setCompanions] = useState<Array<{ name: string; ageGroup: 'adulto' | 'criança' }>>([]);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [restoring, setRestoring] = useState(Boolean(deadline));
  const [error, setError] = useState('');

  function loadInvitation(value: PublicRsvpInvitation) {
    setInvitation(value);
    setResponses(Object.fromEntries(value.guests.map((guest) => [guest.id, ['confirmado', 'não irá'].includes(guest.rsvp) ? guest.rsvp : ''])));
    setCompanions(value.companions.map((item) => ({ name: item.name, ageGroup: item.ageGroup === 'criança' ? 'criança' : 'adulto' })));
    setNote(value.invitation.note);
    setStep(value.canEdit ? 'people' : 'complete');
  }

  useEffect(() => {
    if (!deadline) return;
    const query = new URLSearchParams({ slug });
    if (invitationToken) query.set('invitationToken', invitationToken);
    fetch(`/api/rsvp/session?${query}`).then(async (response) => {
      const body = await response.json() as { invitation?: PublicRsvpInvitation | null };
      if (body.invitation) loadInvitation(body.invitation);
    }).catch(() => undefined).finally(() => setRestoring(false));
    // The initial route identity is immutable during this component lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nobodyAttending = useMemo(() => {
    if (!invitation) return false;
    return invitation.guests.every((guest) => responses[guest.id] === 'não irá') && companions.length === 0;
  }, [companions.length, invitation, responses]);

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/rsvp/lookup', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug, name }),
      });
      const body = await response.json() as { challenge?: string; error?: string };
      if (!response.ok || !body.challenge) throw new Error(body.error ?? 'Não foi possível localizar o convite.');
      setChallenge(body.challenge);
      setIdentification('phone');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível localizar o convite.');
    } finally { setPending(false); }
  }

  async function validate(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{4}$/.test(lastFour)) { setError('Informe exatamente quatro números.'); return; }
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/rsvp/validate', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, lastFour, ...(invitationToken ? { invitationToken } : { challenge }) }),
      });
      const body = await response.json() as { invitation?: PublicRsvpInvitation; error?: string };
      if (!response.ok || !body.invitation) throw new Error(body.error ?? 'Não foi possível validar o convite.');
      loadInvitation(body.invitation);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível validar o convite.');
    } finally { setPending(false); }
  }

  function resizeCompanions(count: number) {
    setCompanions((current) => Array.from({ length: count }, (_, index) => current[index] ?? { name: '', ageGroup: 'adulto' }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!invitation || invitation.guests.some((guest) => !responses[guest.id])) {
      setError('Informe se cada pessoa irá ou não.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/rsvp/responses', {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug,
          guests: invitation.guests.map((guest) => ({ id: guest.id, rsvp: responses[guest.id] })),
          companions,
          note,
        }),
      });
      const body = await response.json() as { invitation?: PublicRsvpInvitation; error?: string };
      if (!response.ok || !body.invitation) throw new Error(body.error ?? 'Não foi possível salvar sua confirmação.');
      loadInvitation(body.invitation);
      setStep('complete');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar sua confirmação.');
    } finally { setPending(false); }
  }

  if (!deadline) return (
    <section className="py-8">
      <h1 className="text-2xl font-semibold tracking-[-0.03em]">Confirmação indisponível</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">As confirmações ainda não estão disponíveis. Fale diretamente com os noivos.</p>
    </section>
  );

  if (restoring) return <div className="space-y-4 py-8" aria-label="Carregando confirmação"><Skeleton className="h-8 w-3/4" /><Skeleton className="h-24 w-full" /><Skeleton className="h-12 w-full" /></div>;

  return (
    <div className="min-w-0">
      <ProgressSteps step={step} />
      {step === 'identify' && identification === 'name' && (
        <form onSubmit={lookup} className="space-y-6 py-7">
          <div><h1 className="text-2xl font-semibold tracking-[-0.03em]">Confirme sua presença</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Digite o nome que aparece no seu convite.</p></div>
          <label className="grid gap-2 text-sm font-medium">Nome do convite<Input className="h-12 text-base" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button className="h-12 w-full" disabled={pending}>{pending ? 'Procurando…' : 'Continuar'}</Button>
        </form>
      )}
      {step === 'identify' && identification === 'phone' && (
        <form onSubmit={validate} className="space-y-6 py-7">
          {!invitationToken && <Button type="button" variant="ghost" className="h-11 px-0" onClick={() => { setIdentification('name'); setError(''); }}><ArrowLeft />Voltar</Button>}
          <div><h1 className="text-2xl font-semibold tracking-[-0.03em]">Confirme que este convite é seu</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Informe os 4 últimos números do telefone cadastrado neste convite.</p></div>
          <label className="grid gap-2 text-sm font-medium">Últimos 4 números<Input className="h-14 text-center font-mono text-xl tracking-[0.35em]" value={lastFour} onChange={(event) => setLastFour(event.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" autoComplete="one-time-code" maxLength={4} required /></label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button className="h-12 w-full" disabled={pending}>{pending ? 'Validando…' : 'Validar convite'}</Button>
        </form>
      )}
      {step === 'people' && invitation && (
        <form onSubmit={save} className="space-y-7 py-7">
          <div><p className="text-sm font-medium text-primary">{invitation.invitation.name}</p><h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Confirme a presença de cada pessoa</h1></div>
          <div className="divide-y divide-border rounded-2xl border border-border bg-card">
            {invitation.guests.map((guest) => (
              <fieldset key={guest.id} className="p-4 sm:p-5">
                <legend className="w-full pb-3 font-medium">{guest.fullName}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([['confirmado', 'Vou ao casamento'], ['não irá', 'Não poderei ir']] as const).map(([value, label]) => (
                    <label key={value} className={`flex min-h-12 items-center justify-center rounded-xl border px-3 text-center text-sm font-medium transition-[transform,background-color,border-color,color] active:scale-[.98] ${responses[guest.id] === value ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background hover:bg-secondary'}`}>
                      <input className="sr-only" type="radio" name={`guest-${guest.id}`} value={value} checked={responses[guest.id] === value} onChange={() => setResponses((current) => ({ ...current, [guest.id]: value }))} />{label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          {invitation.invitation.additionalGuestLimit > 0 && (
            <section className="space-y-4 border-t border-border pt-6">
              <div className="flex items-center gap-2"><UsersThree size={20} /><h2 className="font-semibold">Acompanhantes autorizados</h2></div>
              <label className="grid gap-2 text-sm font-medium">Quantos acompanhantes irão?<NativeSelect value={String(companions.length)} onValueChange={(value) => resizeCompanions(Number(value ?? 0))}>{Array.from({ length: invitation.invitation.additionalGuestLimit + 1 }, (_, value) => <NativeSelectOption key={value} value={String(value)}>{value}</NativeSelectOption>)}</NativeSelect></label>
              {companions.map((companion, index) => (
                <div key={index} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
                  <label className="grid gap-2 text-sm font-medium">Nome completo<Input className="h-11" required value={companion.name} onChange={(event) => setCompanions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} /></label>
                  <label className="grid gap-2 text-sm font-medium">Faixa etária<NativeSelect value={companion.ageGroup} onValueChange={(value) => setCompanions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ageGroup: value === 'criança' ? 'criança' : 'adulto' } : item))}><NativeSelectOption value="adulto">Adulto</NativeSelectOption><NativeSelectOption value="criança">Criança</NativeSelectOption></NativeSelect></label>
                </div>
              ))}
            </section>
          )}
          <label className="grid gap-2 text-sm font-medium">Observação para os noivos <span className="font-normal text-muted-foreground">Opcional</span><Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="Ex.: Chegaremos um pouco mais tarde." /></label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button className="h-12 w-full" disabled={pending}>{pending ? 'Salvando…' : 'Confirmar respostas'}</Button>
        </form>
      )}
      {step === 'complete' && invitation && (
        <section className="py-7">
          <CheckCircle className="text-primary" size={42} weight="fill" />
          <h1 className="mt-4 text-2xl font-semibold tracking-[-0.03em]">{nobodyAttending ? 'Resposta registrada' : 'Presença confirmada!'}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{nobodyAttending ? 'Sentiremos sua falta, mas agradecemos por nos avisar.' : 'Obrigado por responder. Estas foram as informações registradas:'}</p>
          <div className="mt-6 divide-y divide-border border-y border-border">
            {invitation.guests.map((guest) => <div key={guest.id} className="flex items-center justify-between gap-4 py-3 text-sm"><span className="font-medium">{guest.fullName}</span><span className="text-muted-foreground">{responses[guest.id] === 'confirmado' ? 'Confirmado' : 'Não irá'}</span></div>)}
            {companions.map((companion, index) => <div key={`${companion.name}-${index}`} className="flex items-center justify-between gap-4 py-3 text-sm"><span className="font-medium">{companion.name}</span><span className="text-muted-foreground">Acompanhante confirmado</span></div>)}
          </div>
          <div className="mt-6 space-y-3 text-sm"><p className="flex items-center gap-2"><CalendarDots size={18} />{formattedDate(invitation.wedding.weddingDate)}</p>{invitation.wedding.venue && <div className="rounded-2xl border border-border p-4"><p className="flex items-start gap-2 font-medium"><MapPin className="mt-0.5 shrink-0" size={18} />{invitation.wedding.venue.name}</p><p className="mt-1 pl-6 text-muted-foreground">{invitation.wedding.venue.address}</p><a className="mt-3 inline-flex min-h-11 items-center gap-2 pl-6 font-medium text-primary hover:underline" href={invitation.wedding.venue.mapsUrl} target="_blank" rel="noreferrer">Ver no mapa<ArrowSquareOut /></a></div>}</div>
          {!invitation.canEdit && <p className="mt-6 rounded-xl bg-secondary p-4 text-sm leading-6">O prazo para alterar a confirmação terminou. Para solicitar uma mudança, fale diretamente com os noivos.</p>}
          <div className="mt-7 grid gap-3 sm:grid-cols-2"><Button render={<a href={`/casamento/${slug}`} />} variant="outline" className="h-12">Ver site do casamento</Button>{invitation.canEdit && <Button className="h-12" onClick={() => setStep('people')}>Alterar respostas</Button>}</div>
        </section>
      )}
    </div>
  );
}
