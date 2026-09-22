'use client';

import { useState } from 'react';
import { Gift, LinkSimple, PencilSimple, Plus, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import type { HouseholdItem, WeddingSnapshot } from '@/lib/wedding-types';

type GiftAction = 'add_household_item' | 'update_gift_list_item' | 'remove_gift_list_item' | 'record_household_gift';
type DialogMode = 'add' | 'edit' | 'received' | 'remove' | null;
type Filter = 'all' | 'available' | 'received';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = (cents: number) => currency.format(cents / 100);
const parseCents = (value: FormDataEntryValue | null) => {
  const text = String(value ?? '').trim();
  if (!text) return 0;
  const amount = Number(text.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(amount) ? Math.round(amount * 100) : -1;
};

export function GiftListView({ data, search, onAction }: {
  data: WeddingSnapshot;
  search: string;
  onAction: (action: GiftAction, payload: unknown) => Promise<WeddingSnapshot>;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [localSearch, setLocalSearch] = useState('');
  const [mode, setMode] = useState<DialogMode>(null);
  const [selected, setSelected] = useState<HouseholdItem | null>(null);
  const [saving, setSaving] = useState(false);
  const items = data.household.items.filter((item) =>
    item.status !== 'removido da lista' && ['lista de presentes', 'ambos'].includes(item.giftIntent));
  const received = data.household.gifts
    .filter((gift) => items.some((item) => item.id === gift.itemId))
    .reduce((sum, gift) => sum + gift.quantity, 0);
  const remaining = items.reduce((sum, item) => sum + Math.max(0, item.desiredQuantity - item.acquiredQuantity), 0);
  const query = `${search} ${localSearch}`.trim().toLocaleLowerCase('pt-BR');
  const visible = items.filter((item) => {
    const category = data.household.categories.find((entry) => entry.id === item.categoryId)?.name ?? '';
    const matches = `${item.name} ${category} ${item.brand} ${item.store}`.toLocaleLowerCase('pt-BR').includes(query);
    const missing = Math.max(0, item.desiredQuantity - item.acquiredQuantity);
    const hasGift = data.household.gifts.some((gift) => gift.itemId === item.id);
    return matches && (filter === 'all' || (filter === 'available' ? missing > 0 : hasGift));
  });
  const open = (next: DialogMode, item: HouseholdItem | null = null) => {
    setSelected(item);
    setMode(next);
  };
  const run = async (action: GiftAction, payload: unknown, success: string) => {
    setSaving(true);
    try {
      await onAction(action, payload);
      setMode(null);
      setSelected(null);
      toast.add({ title: success, type: 'success' });
    } catch (error) {
      toast.add({ title: 'Não foi possível salvar', description: error instanceof Error ? error.message : 'Tente novamente.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (mode === 'add') {
      void run('add_household_item', {
        name: form.get('name'), categoryId: form.get('categoryId') || null,
        desiredQuantity: Number(form.get('quantity')), priority: 'importante', status: 'precisamos',
        estimatedUnitCents: parseCents(form.get('price')), minPriceCents: 0, maxPriceCents: parseCents(form.get('price')),
        brand: '', model: '', store: '', productUrl: form.get('productUrl'), responsible: 'Casal',
        giftIntent: 'lista de presentes', purchaseTiming: 'antes do casamento', desiredDate: null,
        notes: form.get('notes'),
      }, 'Presente adicionado à lista');
    }
    if (mode === 'edit' && selected) {
      void run('update_gift_list_item', {
        id: selected.id, name: form.get('name'), categoryId: form.get('categoryId') || null,
        desiredQuantity: Number(form.get('quantity')), estimatedUnitCents: parseCents(form.get('price')),
        productUrl: form.get('productUrl'), notes: form.get('notes'),
      }, 'Presente atualizado');
    }
    if (mode === 'received' && selected) {
      void run('record_household_gift', {
        id: selected.id, quantity: Number(form.get('quantity')), giver: form.get('giver'),
        giftedAt: form.get('giftedAt'), approximateValueCents: parseCents(form.get('value')),
        notes: form.get('notes'),
      }, 'Presente recebido registrado');
    }
    if (mode === 'remove' && selected) {
      void run('remove_gift_list_item', { id: selected.id }, 'Item retirado da lista');
    }
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Casamento · presentes</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Lista de presentes</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Organizem o que gostariam de ganhar e acompanhem os presentes recebidos.</p>
        </div>
        <Button size="lg" onClick={() => open('add')}><Plus size={17} weight="bold" /> Adicionar presente</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Itens na lista', items.length],
          ['Unidades recebidas', received],
          ['Unidades pendentes', remaining],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex gap-1" aria-label="Filtrar presentes">
          {([['all', 'Todos'], ['available', 'Pendentes'], ['received', 'Recebidos']] as const).map(([id, label]) => (
            <Button key={id} size="sm" variant={filter === id ? 'secondary' : 'ghost'} onClick={() => setFilter(id)} aria-pressed={filter === id}>{label}</Button>
          ))}
        </div>
        <Input aria-label="Buscar presente" value={localSearch} onChange={(event) => setLocalSearch(event.target.value)} placeholder="Buscar presente" className="h-9 w-full sm:w-56" />
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary"><Gift size={24} /></span>
          <h2 className="mt-4 text-lg font-semibold">Comecem a lista de presentes</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Adicionem um item, a quantidade desejada e, se quiserem, um link para o produto.</p>
          <Button className="mt-5" onClick={() => open('add')}><Plus size={16} /> Adicionar primeiro presente</Button>
        </div>
      ) : visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Nenhum presente encontrado para este filtro.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {visible.map((item, index) => {
            const missing = Math.max(0, item.desiredQuantity - item.acquiredQuantity);
            const category = data.household.categories.find((entry) => entry.id === item.categoryId)?.name;
            const givers = data.household.gifts.filter((gift) => gift.itemId === item.id).map((gift) => gift.giver);
            return <article key={item.id} className={`flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${index > 0 ? 'border-t border-border' : ''}`}>
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Gift size={18} /></span>
                <div className="min-w-0">
                  <h2 className="font-medium">{item.name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{category ? `${category} · ` : ''}{item.estimatedUnitCents > 0 ? `${money(item.estimatedUnitCents)} estimado · ` : ''}{missing === 0 ? 'Quantidade completa' : `${missing} de ${item.desiredQuantity} pendente${missing > 1 ? 's' : ''}`}</p>
                  {givers.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Presenteado por {givers.join(', ')}</p>}
                  {item.notes && <p className="mt-2 max-w-xl text-sm text-muted-foreground">{item.notes}</p>}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5 pl-[52px] sm:pl-0">
                {item.productUrl && <Button variant="outline" size="sm" render={<a href={item.productUrl} target="_blank" rel="noopener noreferrer" />}><LinkSimple size={15} /> Produto</Button>}
                {missing > 0 && <Button variant="outline" size="sm" onClick={() => open('received', item)}><Gift size={15} /> Recebido</Button>}
                <Button variant="ghost" size="icon-sm" aria-label={`Editar ${item.name}`} onClick={() => open('edit', item)}><PencilSimple size={16} /></Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Retirar ${item.name} da lista`} onClick={() => open('remove', item)}><X size={16} /></Button>
              </div>
            </article>;
          })}
        </div>
      )}

      <Dialog open={mode !== null} onOpenChange={(isOpen) => { if (!isOpen && !saving) setMode(null); }}>
        <DialogContent key={`${mode}-${selected?.id ?? ''}`} className="max-h-[88dvh] overflow-y-auto sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{mode === 'add' ? 'Adicionar presente' : mode === 'edit' ? 'Editar presente' : mode === 'received' ? 'Registrar presente recebido' : 'Retirar da lista'}</DialogTitle>
            <DialogDescription>{mode === 'remove' ? 'O item continuará no enxoval, se fizer parte do planejamento da casa.' : 'As alterações ficam salvas no planejamento do casal.'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4">
            {(mode === 'add' || mode === 'edit') && <>
              <label className="grid gap-1.5 text-sm font-medium">Nome do presente<Input name="name" required minLength={2} maxLength={120} defaultValue={selected?.name ?? ''} placeholder="Ex.: Jogo de jantar" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1.5 text-sm font-medium">Categoria<NativeSelect name="categoryId" defaultValue={selected?.categoryId ?? ''}><NativeSelectOption value="">Sem categoria</NativeSelectOption>{data.household.categories.map((category) => <NativeSelectOption key={category.id} value={category.id}>{category.name}</NativeSelectOption>)}</NativeSelect></label>
                <label className="grid gap-1.5 text-sm font-medium">Quantidade<Input name="quantity" type="number" min={Math.max(1, selected?.acquiredQuantity ?? 1)} max={999} required defaultValue={selected?.desiredQuantity ?? 1} /></label>
              </div>
              <label className="grid gap-1.5 text-sm font-medium">Valor estimado por unidade (R$)<Input name="price" inputMode="decimal" defaultValue={selected?.estimatedUnitCents ? (selected.estimatedUnitCents / 100).toFixed(2).replace('.', ',') : ''} placeholder="Opcional" /></label>
              <label className="grid gap-1.5 text-sm font-medium">Link do produto<Input name="productUrl" type="url" maxLength={2048} defaultValue={selected?.productUrl ?? ''} placeholder="https://" /></label>
              <label className="grid gap-1.5 text-sm font-medium">Observações<Textarea name="notes" maxLength={800} defaultValue={selected?.notes ?? ''} placeholder="Cor, tamanho ou outras preferências" /></label>
            </>}
            {mode === 'received' && selected && <>
              <p className="rounded-xl bg-secondary px-4 py-3 text-sm">{selected.name} · faltam {Math.max(0, selected.desiredQuantity - selected.acquiredQuantity)} unidade(s)</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1.5 text-sm font-medium">Quantidade<Input name="quantity" type="number" min={1} max={Math.max(1, selected.desiredQuantity - selected.acquiredQuantity)} defaultValue={1} required /></label>
                <label className="grid gap-1.5 text-sm font-medium">Quem presenteou<Input name="giver" minLength={2} maxLength={120} required placeholder="Nome ou família" /></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1.5 text-sm font-medium">Data<Input name="giftedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
                <label className="grid gap-1.5 text-sm font-medium">Valor aproximado (R$)<Input name="value" inputMode="decimal" placeholder="Opcional" /></label>
              </div>
              <label className="grid gap-1.5 text-sm font-medium">Observações<Textarea name="notes" maxLength={500} /></label>
            </>}
            {mode === 'remove' && selected && <p className="text-sm">Retirar <strong>{selected.name}</strong> da lista de presentes?</p>}
            <DialogFooter><Button type="button" variant="outline" onClick={() => setMode(null)} disabled={saving}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Salvando…' : mode === 'remove' ? 'Retirar da lista' : 'Salvar'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
