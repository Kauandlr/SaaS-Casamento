'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCircle,
  PaperPlaneTilt,
  PencilSimple,
  Sparkle,
  SpinnerGap,
  Trash,
  X,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { LunaProposal } from '@/lib/luna';
import type { WeddingSnapshot } from '@/lib/wedding-types';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  proposals?: LunaProposal[];
};

export function LunaPanel({
  open,
  onClose,
  onSnapshot,
}: {
  open: boolean;
  onClose: () => void;
  onSnapshot: (snapshot: WeddingSnapshot) => void;
}) {
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<string>();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void fetch('/api/ai/chat')
      .then(async (response) => (response.ok ? response.json() as Promise<{ conversationId: string; messages: Message[]; pendingProposals: LunaProposal[] }> : null))
      .then((result: { conversationId: string; messages: Message[]; pendingProposals: LunaProposal[] } | null) => {
        if (!active || !result) return;
        setConversationId(result.conversationId);
        const restored = (result.messages ?? []) as Message[];
        const pending = (result.pendingProposals ?? []) as LunaProposal[];
        setMessages(pending.length
          ? [...restored, { id: `pending-${Date.now()}`, role: 'assistant', content: 'Estas propostas ainda aguardam confirmação:', proposals: pending }]
          : restored);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send() {
    const message = draft.trim();
    if (!message || loading) return;
    setDraft('');
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: 'user', content: message }]);
    setLoading(true);
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message, conversationId }),
      });
      const result = (await response.json()) as { conversationId?: string; message?: Message; proposals?: LunaProposal[]; error?: string };
      if (!response.ok || !result.message) throw new Error(result.error ?? 'A Luna não respondeu.');
      setConversationId(result.conversationId);
      setMessages((current) => [...current, { ...result.message!, proposals: result.proposals }]);
    } catch (error) {
      setMessages((current) => [...current, { id: `error-${Date.now()}`, role: 'assistant', content: error instanceof Error ? error.message : 'A Luna não respondeu agora.' }]);
    } finally {
      setLoading(false);
    }
  }

  async function decide(proposal: LunaProposal, decision: 'confirm' | 'cancel') {
    setProcessing(proposal.id);
    try {
      const response = await fetch('/api/ai/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ proposalId: proposal.id, decision }),
      });
      const result = (await response.json()) as { snapshot?: WeddingSnapshot; error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Não foi possível processar a proposta.');
      if (result.snapshot) onSnapshot(result.snapshot);
      setMessages((current) => current.map((message) => ({
        ...message,
        proposals: message.proposals?.map((item) => item.id === proposal.id ? { ...item, status: decision === 'confirm' ? 'confirmada' : 'cancelada' } : item),
      })));
    } catch (error) {
      setMessages((current) => [...current, { id: `error-${Date.now()}`, role: 'assistant', content: error instanceof Error ? error.message : 'Não foi possível processar a proposta.' }]);
    } finally {
      setProcessing(undefined);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col border-l border-border bg-background shadow-2xl motion-safe:animate-in motion-safe:slide-in-from-right duration-200">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground"><Sparkle size={19} weight="fill" /></span>
            <div><p className="font-semibold tracking-[-0.02em]">Luna 5.6</p><p className="text-xs text-muted-foreground">Sua copilota do casamento</p></div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar Luna"><X size={20} /></Button>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-5">
          {messages.length === 0 && (
            <div className="rounded-3xl bg-secondary p-5">
              <div className="flex items-center gap-2 text-sm font-semibold"><Sparkle size={16} weight="fill" /> Como posso ajudar?</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Peça para cadastrar convidados, fornecedores, pagamentos, tarefas ou itens do enxoval. Eu preparo tudo para sua confirmação.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {['Cadastre um fornecedor', 'Adicione uma tarefa', 'Como está o orçamento?'].map((suggestion) => <button key={suggestion} className="rounded-full border border-border bg-background px-3 py-2 text-xs transition-colors hover:bg-accent" onClick={() => { setDraft(suggestion); inputRef.current?.focus(); }}>{suggestion}</button>)}
              </div>
            </div>
          )}
          {messages.map((message) => (
            <div key={message.id} className={message.role === 'user' ? 'ml-8' : 'mr-4'}>
              <div className={message.role === 'user' ? 'rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground' : 'rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 text-sm leading-6'}>{message.content}</div>
              {message.proposals?.map((proposal) => <Proposal key={proposal.id} proposal={proposal} processing={processing === proposal.id} onDecide={decide} onEdit={() => { setDraft(`Quero editar a proposta “${proposal.title}”: `); inputRef.current?.focus(); }} />)}
            </div>
          ))}
          {loading && <div className="mr-4 flex items-center gap-2 text-sm text-muted-foreground"><SpinnerGap className="animate-spin" size={18} /> A Luna está pensando…</div>}
          <div ref={endRef} />
        </div>
        <div className="border-t border-border bg-background p-4 sm:p-5">
          <div className="relative">
            <Textarea ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Ex.: cadastre Ana Souza como convidada…" className="min-h-[78px] resize-none pr-12" maxLength={4000} />
            <Button size="icon" className="absolute bottom-2 right-2" onClick={() => void send()} disabled={!draft.trim() || loading} aria-label="Enviar mensagem"><PaperPlaneTilt size={17} weight="fill" /></Button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">A Luna sempre pede confirmação antes de salvar.</p>
        </div>
      </aside>
    </div>
  );
}

function Proposal({ proposal, processing, onDecide, onEdit }: { proposal: LunaProposal; processing: boolean; onDecide: (proposal: LunaProposal, decision: 'confirm' | 'cancel') => void; onEdit: () => void }) {
  const done = proposal.status !== 'pendente';
  return <div className="mt-3 overflow-hidden rounded-2xl border border-primary/25 bg-accent/35">
    <div className="border-b border-primary/15 px-4 py-3"><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold">{proposal.title}</p>{done && <span className="flex items-center gap-1 text-[11px] text-primary"><CheckCircle size={15} weight="fill" /> {proposal.status}</span>}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{proposal.summary}</p></div>
    {!done && <div className="flex items-center gap-2 px-4 py-3"><Button size="sm" className="flex-1" disabled={processing} onClick={() => onDecide(proposal, 'confirm')}>{processing ? <SpinnerGap className="animate-spin" /> : <Check />} Confirmar</Button><Button size="sm" variant="outline" disabled={processing} onClick={onEdit}><PencilSimple /> Editar</Button><Button size="icon" variant="ghost" disabled={processing} onClick={() => onDecide(proposal, 'cancel')} aria-label="Cancelar proposta"><Trash /></Button></div>}
  </div>;
}
