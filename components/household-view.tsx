'use client';
/* oxlint-disable typescript/no-deprecated, jsx-a11y/label-has-associated-control */

import { useMemo, useState } from 'react';
import {
  ArrowDown,
  CalendarDots,
  Check,
  CheckCircle,
  DownloadSimple,
  Gift,
  Heart,
  HouseLine,
  LinkSimple,
  MagnifyingGlass,
  Package,
  Plus,
  Receipt,
  ShoppingCart,
  SlidersHorizontal,
  Storefront,
  WarningCircle,
} from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import type { HouseholdItem, WeddingSnapshot } from '@/lib/wedding-types';

export type HouseholdAction =
  | 'add_household_item'
  | 'record_household_purchase'
  | 'record_household_gift'
  | 'update_household_plan'
  | 'add_household_task'
  | 'toggle_household_task'
  | 'add_household_category';

type HouseholdDialog =
  | 'item'
  | 'purchase'
  | 'gift'
  | 'plan'
  | 'task'
  | 'category'
  | null;
type Filter =
  | 'todos'
  | 'essenciais'
  | 'presentes'
  | 'pode esperar'
  | 'comprados';

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
const compactCurrency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});
const money = (value: number) => compactCurrency.format(value / 100);
const fullMoney = (value: number) => currency.format(value / 100);
const cents = (value: FormDataEntryValue | null) =>
  Math.round(
    Number(
      (typeof value === 'string' ? value : '')
        .replace(/\./g, '')
        .replace(',', '.'),
    ) * 100,
  ) || 0;
const today = () => new Date().toISOString().slice(0, 10);

function monthsUntil(value: string) {
  const days = Math.ceil(
    (new Date(`${value}T12:00:00Z`).getTime() - Date.now()) / 86_400_000,
  );
  return Math.max(1, Math.ceil(days / 30.44));
}

function categoryName(data: WeddingSnapshot, item: HouseholdItem) {
  return (
    data.household.categories.find(
      (category) => category.id === item.categoryId,
    )?.name ?? 'Sem categoria'
  );
}

export function householdMetrics(data: WeddingSnapshot) {
  const active = data.household.items.filter(
    (item) => item.status !== 'removido da lista',
  );
  const desired = active.reduce((sum, item) => sum + item.desiredQuantity, 0);
  const acquired = active.reduce(
    (sum, item) => sum + Math.min(item.desiredQuantity, item.acquiredQuantity),
    0,
  );
  const estimated = active.reduce(
    (sum, item) => sum + item.estimatedUnitCents * item.desiredQuantity,
    0,
  );
  const spent = active.reduce((sum, item) => sum + item.actualPaidCents, 0);
  const pending = active.reduce((sum, item) => {
    const missing = Math.max(0, item.desiredQuantity - item.acquiredQuantity);
    if (item.status === 'não comprar agora') return sum;
    return sum + missing * item.estimatedUnitCents;
  }, 0);
  const essential = active.filter((item) => item.priority === 'essencial');
  const essentialMissing = essential.filter(
    (item) => item.acquiredQuantity < item.desiredQuantity,
  ).length;
  const essentialValue = essential.reduce(
    (sum, item) => sum + item.estimatedUnitCents * item.desiredQuantity,
    0,
  );
  const months = monthsUntil(data.household.plan.targetDate);
  const monthlyGoal = Math.ceil(
    Math.max(0, pending - data.household.plan.allocatedSavingsCents) / months,
  );
  const saving = active.reduce(
    (sum, item) =>
      item.actualPaidCents > 0
        ? sum +
          Math.max(
            0,
            item.estimatedUnitCents *
              Math.min(item.acquiredQuantity, item.desiredQuantity) -
              item.actualPaidCents,
          )
        : sum,
    0,
  );
  const completion = Math.round((acquired / Math.max(1, desired)) * 100);
  const giftQuantity = data.household.gifts.reduce(
    (sum, gift) => sum + gift.quantity,
    0,
  );
  return {
    active,
    desired,
    acquired,
    estimated,
    spent,
    pending,
    essentialMissing,
    essentialValue,
    months,
    monthlyGoal,
    saving,
    completion,
    giftQuantity,
  };
}

export function HouseholdView({
  data,
  search,
  onAction,
}: {
  data: WeddingSnapshot;
  search: string;
  onAction: (
    action: HouseholdAction,
    payload: unknown,
  ) => Promise<WeddingSnapshot>;
}) {
  const [filter, setFilter] = useState<Filter>('todos');
  const [category, setCategory] = useState('todas');
  const [status, setStatus] = useState('todos');
  const [timing, setTiming] = useState('todos');
  const [localSearch, setLocalSearch] = useState(search);
  const [shopMode, setShopMode] = useState(false);
  const [dialog, setDialog] = useState<HouseholdDialog>(null);
  const [selected, setSelected] = useState<HouseholdItem | null>(null);
  const [saving, setSaving] = useState(false);
  const metrics = useMemo(() => householdMetrics(data), [data]);
  const weddingMonths = monthsUntil(data.wedding.weddingDate);
  const weddingSavings = Math.max(
    0,
    data.wedding.savedCents - data.household.plan.allocatedSavingsCents,
  );
  const weddingGoal = Math.ceil(
    Math.max(
      0,
      data.wedding.budgetCents * (1 + data.wedding.reservePercent / 100) -
        weddingSavings,
    ) / weddingMonths,
  );
  const combinedGoal = weddingGoal + metrics.monthlyGoal;
  const capacityGap = data.wedding.monthlyCapacityCents - combinedGoal;

  const items = metrics.active.filter((item) => {
    const haystack =
      `${item.name} ${item.brand} ${item.store} ${categoryName(data, item)}`.toLowerCase();
    if (!haystack.includes(localSearch.toLowerCase())) return false;
    if (category !== 'todas' && item.categoryId !== category) return false;
    if (status !== 'todos' && item.status !== status) return false;
    if (timing !== 'todos' && item.purchaseTiming !== timing) return false;
    if (
      shopMode &&
      (item.acquiredQuantity >= item.desiredQuantity ||
        item.status === 'não comprar agora')
    )
      return false;
    if (filter === 'essenciais' && item.priority !== 'essencial') return false;
    if (
      filter === 'presentes' &&
      !['lista de presentes', 'ambos'].includes(item.giftIntent)
    )
      return false;
    if (
      filter === 'pode esperar' &&
      !['pode esperar', 'opcional'].includes(item.priority)
    )
      return false;
    if (
      filter === 'comprados' &&
      !['comprado', 'já possuímos', 'recebido de presente'].includes(
        item.status,
      )
    )
      return false;
    return true;
  });

  const run = async (
    action: HouseholdAction,
    payload: unknown,
    message: string,
  ) => {
    setSaving(true);
    try {
      await onAction(action, payload);
      setDialog(null);
      setSelected(null);
      toast.add({
        title: message,
        description: 'O planejamento da casa foi atualizado.',
        type: 'success',
      });
    } catch (error) {
      toast.add({
        title: 'Não foi possível salvar',
        description:
          error instanceof Error ? error.message : 'Tente novamente.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const exportList = (kind: 'csv' | 'xls') => {
    const rows = [
      [
        'Item',
        'Categoria',
        'Quantidade faltante',
        'Prioridade',
        'Preço desejado',
        'Preço máximo',
      ],
      ...items.map((item) => [
        item.name,
        categoryName(data, item),
        String(Math.max(0, item.desiredQuantity - item.acquiredQuantity)),
        item.priority,
        (item.estimatedUnitCents / 100).toFixed(2),
        (item.maxPriceCents / 100).toFixed(2),
      ]),
    ];
    const separator = kind === 'csv' ? ';' : '\t';
    const content = rows
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(separator),
      )
      .join('\n');
    const blob = new Blob([`\uFEFF${content}`], {
      type:
        kind === 'csv'
          ? 'text/csv;charset=utf-8'
          : 'application/vnd.ms-excel;charset=utf-8',
    });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `lista-enxoval.${kind}`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };

  return (
    <>
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex items-start gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-secondary text-primary">
            <HouseLine size={20} />
          </span>
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.045em]">
              Enxoval
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Primeiro o essencial. O restante pode chegar com o tempo.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={shopMode ? 'default' : 'outline'}
            onClick={() => setShopMode((value) => !value)}
          >
            <Storefront size={16} />
            Modo loja
          </Button>
          <Button variant="outline" onClick={() => setDialog('plan')}>
            <SlidersHorizontal size={16} />
            Planejamento
          </Button>
          <Button onClick={() => setDialog('item')}>
            <Plus size={16} />
            Novo item
          </Button>
        </div>
      </div>

      <section className="grid overflow-hidden rounded-[30px] bg-primary text-primary-foreground shadow-[0_24px_60px_-36px_rgba(39,67,56,.72)] lg:grid-cols-[1.25fr_.75fr]">
        <div className="p-6 sm:p-8">
          <p className="text-sm text-primary-foreground/70">
            Enxoval {metrics.completion}% concluído
          </p>
          <p className="mt-2 font-mono text-[clamp(2.2rem,6vw,4rem)] leading-none tracking-[-0.06em]">
            {money(metrics.pending)}
          </p>
          <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/72">
            Ainda necessários nos itens planejados. Presentes e itens que vocês
            já possuem não aumentam esta meta.
          </p>
          <div className="mt-7">
            <div className="mb-2 flex justify-between font-mono text-xs text-primary-foreground/70">
              <span>
                {metrics.acquired} de {metrics.desired} unidades resolvidas
              </span>
              <span>{metrics.completion}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-[#dce8d9] transition-[width] duration-500"
                style={{ width: `${metrics.completion}%` }}
              />
            </div>
            <div className="mt-7 grid grid-cols-2 gap-5 border-t border-white/15 pt-5 sm:grid-cols-4">
              <Metric
                label="Orçamento"
                value={money(data.household.plan.budgetCents)}
                light
              />
              <Metric label="Gasto real" value={money(metrics.spent)} light />
              <Metric
                label="Presentes"
                value={String(metrics.giftQuantity)}
                light
              />
              <Metric
                label="Essenciais faltando"
                value={String(metrics.essentialMissing)}
                light
              />
            </div>
          </div>
        </div>
        <div className="border-t border-white/15 bg-white/6 p-6 sm:p-8 lg:border-l lg:border-t-0">
          <p className="text-sm text-primary-foreground/70">
            Meta mensal do casal
          </p>
          <p className="mt-2 font-mono text-3xl tracking-[-0.05em]">
            {money(combinedGoal)}
            <span className="text-base text-primary-foreground/60">/mês</span>
          </p>
          <div className="mt-6 space-y-3 border-t border-white/15 pt-5 text-sm">
            <FinanceLine label="Casamento" value={weddingGoal} />
            <FinanceLine label="Enxoval" value={metrics.monthlyGoal} />
            <FinanceLine
              label="Capacidade"
              value={data.wedding.monthlyCapacityCents}
            />
          </div>
          <div
            className={`mt-5 rounded-2xl p-4 text-sm leading-5 ${capacityGap >= 0 ? 'bg-white/10' : 'bg-amber-100 text-amber-950'}`}
          >
            {capacityGap >= 0
              ? `A meta cabe na capacidade com ${money(capacityGap)} de margem mensal.`
              : `A meta atual está ${money(Math.abs(capacityGap))}/mês acima da capacidade configurada.`}
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <section className="rounded-[28px] border border-border bg-card p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.025em]">
                Inicial x completo
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                O necessário para começar sem transformar desejos em urgências.
              </p>
            </div>
            <div className="flex gap-6">
              <Metric label="Essencial" value={money(metrics.essentialValue)} />
              <Metric label="Lista completa" value={money(metrics.estimated)} />
            </div>
          </div>
          <div className="mt-6 rounded-2xl bg-secondary p-4 text-sm leading-6">
            <span className="font-medium">
              Vocês não precisam terminar a casa antes de começar a vida juntos.
            </span>{' '}
            Itens marcados como “pode esperar” somam{' '}
            {money(
              metrics.active
                .filter((item) =>
                  ['pode esperar', 'opcional'].includes(item.priority),
                )
                .reduce(
                  (sum, item) =>
                    sum +
                    Math.max(0, item.desiredQuantity - item.acquiredQuantity) *
                      item.estimatedUnitCents,
                  0,
                ),
            )}{' '}
            e podem ser adiados sem mexer no essencial.
          </div>
        </section>
        <section className="rounded-[28px] border border-border bg-card p-5 sm:p-7">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Economia sobre estimativas
              </p>
              <p className="mt-2 font-mono text-3xl tracking-[-0.045em]">
                {money(metrics.saving)}
              </p>
            </div>
            <ArrowDown size={22} className="text-primary" />
          </div>
          <div className="mt-6 divide-y divide-border border-t border-border">
            <FinanceLine
              label="Destinado ao enxoval"
              value={data.household.plan.allocatedSavingsCents}
            />
            <FinanceLine
              label="Disponível para casamento"
              value={weddingSavings}
            />
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-[28px] border border-border bg-card p-4 sm:p-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.025em]">
              Itens da casa
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {items.length} itens visíveis com quantidade, prazo e limite de
              preço.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportList('csv')}
            >
              <DownloadSimple size={14} />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportList('xls')}
            >
              <DownloadSimple size={14} />
              XLS
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Receipt size={14} />
              Imprimir / PDF
            </Button>
          </div>
        </div>
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {(
            [
              ['todos', 'Todos'],
              ['essenciais', 'Essenciais'],
              ['presentes', 'Lista de presentes'],
              ['pode esperar', 'Pode esperar'],
              ['comprados', 'Resolvidos'],
            ] as [Filter, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`shrink-0 rounded-full px-3 py-2 text-xs font-medium transition-colors active:scale-[.98] ${filter === id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_180px_180px_180px]">
          <div className="relative">
            <MagnifyingGlass
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={15}
            />
            <Input
              value={localSearch}
              onChange={(event) => setLocalSearch(event.target.value)}
              className="pl-9"
              placeholder="Buscar item, marca, categoria ou loja"
            />
          </div>
          <NativeSelect
            value={category}
            onValueChange={(value) => setCategory(value ?? 'todas')}
          >
            <NativeSelectOption value="todas">
              Todas as categorias
            </NativeSelectOption>
            {data.household.categories.map((item) => (
              <NativeSelectOption key={item.id} value={item.id}>
                {item.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect
            value={status}
            onValueChange={(value) => setStatus(value ?? 'todos')}
          >
            <NativeSelectOption value="todos">
              Todos os status
            </NativeSelectOption>
            {[
              'precisamos',
              'pesquisando',
              'escolhido',
              'comprado',
              'recebido de presente',
              'já possuímos',
              'não comprar agora',
            ].map((item) => (
              <NativeSelectOption key={item} value={item}>
                {item}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect
            value={timing}
            onValueChange={(value) => setTiming(value ?? 'todos')}
          >
            <NativeSelectOption value="todos">
              Qualquer período
            </NativeSelectOption>
            {[
              'comprar agora',
              'próximos meses',
              'antes do casamento',
              'comprar próximo ao casamento',
              'depois do casamento',
            ].map((item) => (
              <NativeSelectOption key={item} value={item}>
                {item}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        {items.length ? (
          <div className="mt-6 divide-y divide-border">
            {items.map((item) => (
              <HouseholdItemRow
                key={item.id}
                data={data}
                item={item}
                shopMode={shopMode}
                onPurchase={() => {
                  setSelected(item);
                  setDialog('purchase');
                }}
                onGift={() => {
                  setSelected(item);
                  setDialog('gift');
                }}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed p-10 text-center">
            <Package size={28} className="mx-auto text-muted-foreground" />
            <p className="mt-3 font-medium">Nenhum item neste recorte</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajuste os filtros ou adicione um item ao planejamento.
            </p>
          </div>
        )}
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-[28px] border border-border bg-card p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.025em]">
                Progresso por categoria
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                A casa por ambiente, sem esconder o que falta.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialog('category')}
            >
              <Plus size={14} />
              Categoria
            </Button>
          </div>
          <div className="mt-6 divide-y divide-border">
            {data.household.categories.map((category) => {
              const grouped = metrics.active.filter(
                (item) => item.categoryId === category.id,
              );
              if (!grouped.length) return null;
              const desired = grouped.reduce(
                (sum, item) => sum + item.desiredQuantity,
                0,
              );
              const acquired = grouped.reduce(
                (sum, item) =>
                  sum + Math.min(item.desiredQuantity, item.acquiredQuantity),
                0,
              );
              const progress = Math.round(
                (acquired / Math.max(1, desired)) * 100,
              );
              return (
                <div
                  key={category.id}
                  className="grid gap-2 py-3 first:pt-0 sm:grid-cols-[130px_1fr_44px] sm:items-center"
                >
                  <p className="text-sm font-medium">{category.name}</p>
                  <Progress value={progress} />
                  <p className="font-mono text-xs text-muted-foreground sm:text-right">
                    {progress}%
                  </p>
                </div>
              );
            })}
          </div>
        </section>
        <section className="rounded-[28px] border border-border bg-card p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.025em]">
                Checklist da mudança
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Serviços e tarefas separados das compras.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialog('task')}
            >
              <Plus size={14} />
              Tarefa
            </Button>
          </div>
          <div className="mt-5 divide-y divide-border">
            {data.household.checklist.map((task) => (
              <div
                key={task.id}
                className="flex w-full items-start gap-3 py-3 first:pt-0"
              >
                <button
                  type="button"
                  aria-label={task.status === 'concluído' ? `Reabrir ${task.title}` : `Concluir ${task.title}`}
                  onClick={() =>
                    void run(
                      'toggle_household_task',
                      { id: task.id },
                      'Checklist atualizado',
                    )
                  }
                  className={`mt-0.5 grid size-5 place-items-center rounded-md border ${task.status === 'concluído' ? 'border-primary bg-primary text-primary-foreground' : 'border-input'}`}
                >
                  {task.status === 'concluído' && (
                    <Check size={13} weight="bold" />
                  )}
                </button>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-medium ${task.status === 'concluído' ? 'text-muted-foreground line-through' : ''}`}
                  >
                    {task.title}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {task.responsible} ·{' '}
                    {new Intl.DateTimeFormat('pt-BR').format(
                      new Date(`${task.dueDate}T12:00:00Z`),
                    )}
                  </span>
                </span>
                {task.linkUrl && (
                  <a
                    href={task.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Abrir link de ${task.title}`}
                    title="Abrir link"
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-primary hover:bg-secondary"
                  >
                    <LinkSimple size={15} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-[28px] border border-border bg-card p-5 sm:p-7">
          <h2 className="text-lg font-semibold tracking-[-0.025em]">
            Cronograma do enxoval
          </h2>
          <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4">
            {[
              'comprar agora',
              'próximos meses',
              'comprar próximo ao casamento',
              'depois do casamento',
            ].map((period) => (
              <div key={period} className="border-t border-border pt-3">
                <p className="text-xs capitalize text-muted-foreground">
                  {period}
                </p>
                <p className="mt-1 font-mono text-xl">
                  {
                    metrics.active.filter(
                      (item) =>
                        item.purchaseTiming === period &&
                        item.acquiredQuantity < item.desiredQuantity,
                    ).length
                  }
                </p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-3 rounded-2xl bg-secondary p-4">
            <CalendarDots size={20} className="mt-0.5 shrink-0 text-primary" />
            <p className="text-sm leading-5">
              Eletrodomésticos e eletrônicos próximos da mudança preservam
              melhor o período útil da garantia.
            </p>
          </div>
        </section>
        <section className="rounded-[28px] border border-border bg-card p-5 sm:p-7">
          <h2 className="text-lg font-semibold tracking-[-0.025em]">
            Compromissos futuros
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Parcelas do enxoval ficam separadas do casamento.
          </p>
          <div className="mt-5 divide-y divide-border">
            {data.household.payments
              .filter((payment) => payment.status !== 'pago')
              .slice(0, 4)
              .map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0"
                >
                  <div>
                    <p className="text-sm font-medium">{payment.itemName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Parcela {payment.installmentNumber} · {payment.dueDate}
                    </p>
                  </div>
                  <p className="font-mono text-sm">
                    {fullMoney(payment.amountCents)}
                  </p>
                </div>
              ))}
            {!data.household.payments.length && (
              <div className="mt-5 flex gap-3 rounded-2xl border border-dashed p-4">
                <CheckCircle size={20} className="text-primary" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma parcela do enxoval registrada.
                </p>
              </div>
            )}
          </div>
          {data.household.payments.some(
            (payment) =>
              payment.dueDate > data.wedding.weddingDate &&
              payment.status !== 'pago',
          ) && (
            <div className="mt-4 flex gap-3 rounded-2xl bg-amber-100 p-4 text-amber-950">
              <WarningCircle size={20} className="shrink-0" />
              <p className="text-sm">
                Há compras que continuarão comprometendo a renda depois do
                casamento.
              </p>
            </div>
          )}
        </section>
      </div>

      <HouseholdDialogs
        dialog={dialog}
        selected={selected}
        data={data}
        saving={saving}
        onClose={() => {
          setDialog(null);
          setSelected(null);
        }}
        onRun={run}
      />
    </>
  );
}

function HouseholdItemRow({
  data,
  item,
  shopMode,
  onPurchase,
  onGift,
}: {
  data: WeddingSnapshot;
  item: HouseholdItem;
  shopMode: boolean;
  onPurchase: () => void;
  onGift: () => void;
}) {
  const missing = Math.max(0, item.desiredQuantity - item.acquiredQuantity);
  const excess = Math.max(0, item.acquiredQuantity - item.desiredQuantity);
  const priceAlert =
    item.maxPriceCents > 0 && item.estimatedUnitCents > item.maxPriceCents;
  return (
    <article className="grid gap-4 py-5 first:pt-0 lg:grid-cols-[minmax(0,1.2fr)_120px_150px_auto] lg:items-center">
      <div className="flex min-w-0 gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
          {item.status === 'recebido de presente' ? (
            <Gift size={18} />
          ) : item.favorite ? (
            <Heart size={18} weight="fill" />
          ) : (
            <Package size={18} />
          )}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{item.name}</p>
            <Priority value={item.priority} />
            <Status value={item.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {categoryName(data, item)} · {item.responsible} ·{' '}
            {item.purchaseTiming}
          </p>
          {!shopMode && item.notes && (
            <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
              {item.notes}
            </p>
          )}
          {excess > 0 && (
            <p className="mt-2 text-xs font-medium text-amber-700">
              Receberam {excess} unidade(s) além do planejado.
            </p>
          )}
          {priceAlert && (
            <p className="mt-2 text-xs font-medium text-amber-700">
              Estimativa acima do limite configurado.
            </p>
          )}
        </div>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Quantidade</p>
        <p className="mt-1 font-mono text-sm">
          {item.acquiredQuantity}/{item.desiredQuantity}{' '}
          <span className="text-muted-foreground">· faltam {missing}</span>
        </p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Desejado / máximo</p>
        <p className="mt-1 font-mono text-sm">
          {money(item.estimatedUnitCents)}{' '}
          <span className="text-muted-foreground">
            / {money(item.maxPriceCents)}
          </span>
        </p>
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        {missing > 0 && (
          <>
            <Button variant="outline" size="sm" onClick={onGift}>
              <Gift size={14} />
              <span className={shopMode ? 'hidden sm:inline' : ''}>
                Presente
              </span>
            </Button>
            <Button size="sm" onClick={onPurchase}>
              <ShoppingCart size={14} />
              Comprar
            </Button>
          </>
        )}
        {item.productUrl && (
          <a
            href={item.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium hover:bg-muted"
          >
            <LinkSimple size={14} />
            Ver produto
          </a>
        )}
      </div>
    </article>
  );
}

function HouseholdDialogs({
  dialog,
  selected,
  data,
  saving,
  onClose,
  onRun,
}: {
  dialog: HouseholdDialog;
  selected: HouseholdItem | null;
  data: WeddingSnapshot;
  saving: boolean;
  onClose: () => void;
  onRun: (
    action: HouseholdAction,
    payload: unknown,
    message: string,
  ) => Promise<void>;
}) {
  const label = 'grid gap-2 text-sm font-medium';
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (dialog === 'item')
      void onRun(
        'add_household_item',
        {
          name: form.get('name'),
          categoryId: form.get('categoryId') || null,
          desiredQuantity: Number(form.get('desiredQuantity')),
          priority: form.get('priority'),
          status: form.get('status'),
          estimatedUnitCents: cents(form.get('estimated')),
          minPriceCents: cents(form.get('minPrice')),
          maxPriceCents: cents(form.get('maxPrice')),
          brand: form.get('brand'),
          model: form.get('model'),
          store: form.get('store'),
          productUrl: form.get('productUrl'),
          responsible: form.get('responsible'),
          giftIntent: form.get('giftIntent'),
          purchaseTiming: form.get('purchaseTiming'),
          desiredDate: form.get('desiredDate') || null,
          notes: form.get('notes'),
        },
        'Item adicionado',
      );
    if (dialog === 'purchase' && selected)
      void onRun(
        'record_household_purchase',
        {
          id: selected.id,
          quantity: Number(form.get('quantity')),
          amountCents: cents(form.get('amount')),
          paymentMethod: form.get('paymentMethod'),
          installments: Number(form.get('installments')),
          purchasedAt: form.get('purchasedAt'),
        },
        'Compra registrada',
      );
    if (dialog === 'gift' && selected)
      void onRun(
        'record_household_gift',
        {
          id: selected.id,
          quantity: Number(form.get('quantity')),
          giver: form.get('giver'),
          giftedAt: form.get('giftedAt'),
          approximateValueCents: cents(form.get('value')),
          notes: form.get('notes'),
        },
        'Presente registrado',
      );
    if (dialog === 'plan')
      void onRun(
        'update_household_plan',
        {
          budgetCents: cents(form.get('budget')),
          allocatedSavingsCents: cents(form.get('allocated')),
          includeInGeneral: form.get('includeInGeneral') === 'on',
          targetDate: form.get('targetDate'),
          housingType: form.get('housingType'),
        },
        'Planejamento atualizado',
      );
    if (dialog === 'task')
      void onRun(
        'add_household_task',
        {
          title: form.get('title'),
          responsible: form.get('responsible'),
          dueDate: form.get('dueDate'),
          linkUrl: form.get('linkUrl'),
        },
        'Tarefa adicionada',
      );
    if (dialog === 'category')
      void onRun(
        'add_household_category',
        { name: form.get('name') },
        'Categoria adicionada',
      );
  };
  const title =
    dialog === 'item'
      ? 'Novo item do enxoval'
      : dialog === 'purchase'
        ? `Registrar compra · ${selected?.name ?? ''}`
        : dialog === 'gift'
          ? `Presente recebido · ${selected?.name ?? ''}`
          : dialog === 'plan'
            ? 'Planejamento da casa'
            : dialog === 'task'
              ? 'Nova tarefa da mudança'
              : 'Nova categoria';
  return (
    <Dialog
      open={dialog !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Valores do enxoval permanecem identificados e separados do
            casamento.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          {dialog === 'item' && (
            <>
              <label className={label}>
                Nome
                <Input name="name" required placeholder="Ex.: Geladeira" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  Categoria
                  <NativeSelect name="categoryId">
                    <NativeSelectOption value="">
                      Sem categoria
                    </NativeSelectOption>
                    {data.household.categories.map((item) => (
                      <NativeSelectOption key={item.id} value={item.id}>
                        {item.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
                <label className={label}>
                  Quantidade
                  <Input
                    name="desiredQuantity"
                    type="number"
                    min="1"
                    defaultValue="1"
                    required
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  Prioridade
                  <NativeSelect name="priority">
                    <NativeSelectOption value="essencial">
                      Essencial
                    </NativeSelectOption>
                    <NativeSelectOption value="importante">
                      Importante
                    </NativeSelectOption>
                    <NativeSelectOption value="pode esperar">
                      Pode esperar
                    </NativeSelectOption>
                    <NativeSelectOption value="opcional">
                      Opcional
                    </NativeSelectOption>
                  </NativeSelect>
                </label>
                <label className={label}>
                  Status
                  <NativeSelect name="status">
                    <NativeSelectOption value="precisamos">
                      Precisamos
                    </NativeSelectOption>
                    <NativeSelectOption value="pesquisando">
                      Pesquisando
                    </NativeSelectOption>
                    <NativeSelectOption value="escolhido">
                      Escolhido
                    </NativeSelectOption>
                    <NativeSelectOption value="já possuímos">
                      Já possuímos
                    </NativeSelectOption>
                  </NativeSelect>
                </label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className={label}>
                  Preço desejado
                  <Input
                    name="estimated"
                    inputMode="decimal"
                    placeholder="500,00"
                  />
                </label>
                <label className={label}>
                  Mínimo
                  <Input
                    name="minPrice"
                    inputMode="decimal"
                    placeholder="450,00"
                  />
                </label>
                <label className={label}>
                  Máximo
                  <Input
                    name="maxPrice"
                    inputMode="decimal"
                    placeholder="600,00"
                  />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className={label}>
                  Marca
                  <Input name="brand" />
                </label>
                <label className={label}>
                  Modelo
                  <Input name="model" />
                </label>
                <label className={label}>
                  Loja
                  <Input name="store" />
                </label>
              </div>
              <label className={label}>
                Link do produto
                <Input name="productUrl" type="url" placeholder="https://" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  Responsável
                  <NativeSelect name="responsible">
                    <NativeSelectOption>Casal</NativeSelectOption>
                    <NativeSelectOption>
                      {data.wedding.personOne}
                    </NativeSelectOption>
                    <NativeSelectOption>
                      {data.wedding.personTwo}
                    </NativeSelectOption>
                    <NativeSelectOption>Família</NativeSelectOption>
                    <NativeSelectOption>Presente</NativeSelectOption>
                  </NativeSelect>
                </label>
                <label className={label}>
                  Destino
                  <NativeSelect name="giftIntent">
                    <NativeSelectOption value="comprar">
                      Comprar
                    </NativeSelectOption>
                    <NativeSelectOption value="lista de presentes">
                      Lista de presentes
                    </NativeSelectOption>
                    <NativeSelectOption value="ambos">Ambos</NativeSelectOption>
                    <NativeSelectOption value="a decidir">
                      A decidir
                    </NativeSelectOption>
                  </NativeSelect>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  Quando comprar
                  <NativeSelect name="purchaseTiming">
                    <NativeSelectOption value="comprar agora">
                      Comprar agora
                    </NativeSelectOption>
                    <NativeSelectOption value="próximos meses">
                      Próximos meses
                    </NativeSelectOption>
                    <NativeSelectOption value="antes do casamento">
                      Antes do casamento
                    </NativeSelectOption>
                    <NativeSelectOption value="comprar próximo ao casamento">
                      Próximo ao casamento
                    </NativeSelectOption>
                    <NativeSelectOption value="depois do casamento">
                      Depois do casamento
                    </NativeSelectOption>
                  </NativeSelect>
                </label>
                <label className={label}>
                  Data desejada
                  <Input name="desiredDate" type="date" />
                </label>
              </div>
              <label className={label}>
                Observações
                <Textarea
                  name="notes"
                  placeholder="Medidas, critérios, garantia ou detalhes da escolha"
                />
              </label>
            </>
          )}
          {dialog === 'purchase' && selected && (
            <>
              <div className="rounded-2xl bg-secondary p-4 text-sm">
                Faltam{' '}
                {Math.max(
                  0,
                  selected.desiredQuantity - selected.acquiredQuantity,
                )}{' '}
                unidade(s). Limite por unidade:{' '}
                {fullMoney(selected.maxPriceCents)}.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  Quantidade
                  <Input
                    name="quantity"
                    type="number"
                    min="1"
                    defaultValue="1"
                    required
                  />
                </label>
                <label className={label}>
                  Valor total pago
                  <Input
                    name="amount"
                    inputMode="decimal"
                    required
                    defaultValue={(selected.estimatedUnitCents / 100)
                      .toFixed(2)
                      .replace('.', ',')}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  Pagamento
                  <NativeSelect name="paymentMethod">
                    <NativeSelectOption value="à vista">
                      À vista
                    </NativeSelectOption>
                    <NativeSelectOption value="entrada">
                      Entrada
                    </NativeSelectOption>
                    <NativeSelectOption value="parcelado">
                      Parcelado
                    </NativeSelectOption>
                  </NativeSelect>
                </label>
                <label className={label}>
                  Parcelas
                  <Input
                    name="installments"
                    type="number"
                    min="1"
                    max="48"
                    defaultValue="1"
                    required
                  />
                </label>
              </div>
              <label className={label}>
                Data da compra
                <Input
                  name="purchasedAt"
                  type="date"
                  defaultValue={today()}
                  required
                />
              </label>
            </>
          )}
          {dialog === 'gift' && selected && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  Quantidade
                  <Input
                    name="quantity"
                    type="number"
                    min="1"
                    defaultValue="1"
                    required
                  />
                </label>
                <label className={label}>
                  Quem presenteou
                  <Input name="giver" required placeholder="Nome ou família" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  Data
                  <Input
                    name="giftedAt"
                    type="date"
                    defaultValue={today()}
                    required
                  />
                </label>
                <label className={label}>
                  Valor aproximado
                  <Input
                    name="value"
                    inputMode="decimal"
                    placeholder="Opcional"
                  />
                </label>
              </div>
              <label className={label}>
                Observação
                <Textarea
                  name="notes"
                  placeholder="Mensagem, ocasião ou detalhe"
                />
              </label>
            </>
          )}
          {dialog === 'plan' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  Orçamento do enxoval
                  <Input
                    name="budget"
                    defaultValue={(data.household.plan.budgetCents / 100)
                      .toFixed(2)
                      .replace('.', ',')}
                    required
                  />
                </label>
                <label className={label}>
                  Reserva destinada
                  <Input
                    name="allocated"
                    defaultValue={(
                      data.household.plan.allocatedSavingsCents / 100
                    )
                      .toFixed(2)
                      .replace('.', ',')}
                    required
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  Data limite
                  <Input
                    name="targetDate"
                    type="date"
                    defaultValue={data.household.plan.targetDate}
                    required
                  />
                </label>
                <label className={label}>
                  Moradia
                  <NativeSelect
                    name="housingType"
                    defaultValue={data.household.plan.housingType}
                  >
                    <NativeSelectOption value="imóvel próprio">
                      Imóvel próprio
                    </NativeSelectOption>
                    <NativeSelectOption value="aluguel">
                      Aluguel
                    </NativeSelectOption>
                    <NativeSelectOption value="morar com familiares temporariamente">
                      Com familiares
                    </NativeSelectOption>
                    <NativeSelectOption value="ainda não definido">
                      Ainda não definido
                    </NativeSelectOption>
                  </NativeSelect>
                </label>
              </div>
              <label className="flex items-center justify-between gap-4 rounded-2xl border border-border p-4 text-sm">
                <span>
                  <span className="block font-medium">
                    Considerar no planejamento financeiro geral
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Os valores continuam separados e identificados.
                  </span>
                </span>
                <Switch
                  name="includeInGeneral"
                  defaultChecked={data.household.plan.includeInGeneral}
                />
              </label>
            </>
          )}
          {dialog === 'task' && (
            <>
              <label className={label}>
                Tarefa
                <Input
                  name="title"
                  required
                  placeholder="Ex.: Contratar internet"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  Responsável
                  <Input name="responsible" defaultValue="Casal" required />
                </label>
                <label className={label}>
                  Prazo
                  <Input name="dueDate" type="date" required />
                </label>
              </div>
              <label className={label}>
                Link de referência
                <Input name="linkUrl" type="url" placeholder="https://" />
              </label>
            </>
          )}
          {dialog === 'category' && (
            <label className={label}>
              Nome da categoria
              <Input name="name" required placeholder="Ex.: Escritório" />
            </label>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Metric({
  label,
  value,
  light = false,
}: {
  label: string;
  value: string;
  light?: boolean;
}) {
  return (
    <div>
      <p
        className={`text-xs ${light ? 'text-primary-foreground/65' : 'text-muted-foreground'}`}
      >
        {label}
      </p>
      <p className="mt-1 font-mono text-xl">{value}</p>
    </div>
  );
}
function FinanceLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm opacity-72">{label}</span>
      <span className="font-mono text-sm">{money(value)}</span>
    </div>
  );
}
function Priority({ value }: { value: string }) {
  const tone =
    value === 'essencial'
      ? 'border-primary/25 bg-secondary text-primary'
      : 'border-border bg-muted text-muted-foreground';
  return (
    <Badge variant="outline" className={`capitalize ${tone}`}>
      {value}
    </Badge>
  );
}
function Status({ value }: { value: string }) {
  const done = ['comprado', 'recebido de presente', 'já possuímos'].includes(
    value,
  );
  return (
    <Badge
      className={`capitalize ${done ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-muted text-muted-foreground'}`}
    >
      {value}
    </Badge>
  );
}
