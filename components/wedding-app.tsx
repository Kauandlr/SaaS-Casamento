'use client';
/* oxlint-disable typescript/no-deprecated, jsx-a11y/label-has-associated-control */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CaretRight,
  Check,
  CheckCircle,
  ClipboardText,
  CurrencyCircleDollar,
  EnvelopeSimple,
  Gauge,
  HeartStraight,
  HouseLine,
  LinkSimple,
  MagnifyingGlass,
  Moon,
  Phone,
  Plus,
  Receipt,
  SpinnerGap,
  Star,
  Storefront,
  Sun,
  TrendUp,
  UserPlus,
  UsersThree,
  Wallet,
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Toaster, toast } from '@/components/ui/toast';
import {
  HouseholdView,
  householdMetrics,
  type HouseholdAction,
} from '@/components/household-view';
import type { WeddingSnapshot } from '@/lib/wedding-types';

type View =
  | 'overview'
  | 'finance'
  | 'household'
  | 'vendors'
  | 'guests'
  | 'checklist';
type ActionName =
  | 'add_payment'
  | 'mark_payment_paid'
  | 'add_vendor'
  | 'add_guest'
  | 'set_guest_rsvp'
  | 'add_task'
  | 'toggle_task'
  | HouseholdAction;

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
const compactCurrency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});
const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
});

const navItems = [
  {
    id: 'overview' as const,
    label: 'Visão geral',
    mobile: 'Início',
    icon: Gauge,
  },
  {
    id: 'finance' as const,
    label: 'Financeiro',
    mobile: 'Financeiro',
    icon: CurrencyCircleDollar,
  },
  {
    id: 'household' as const,
    label: 'Enxoval',
    mobile: 'Casa',
    icon: HouseLine,
  },
  {
    id: 'vendors' as const,
    label: 'Fornecedores',
    mobile: 'Fornecedores',
    icon: Storefront,
  },
  {
    id: 'guests' as const,
    label: 'Convidados',
    mobile: 'Convidados',
    icon: UsersThree,
  },
  {
    id: 'checklist' as const,
    label: 'Checklist',
    mobile: 'Tarefas',
    icon: ClipboardText,
  },
];
const mobileNavItems = navItems.filter((item) => item.id !== 'vendors');

function money(value: number) {
  return compactCurrency.format(value / 100);
}
function fullMoney(value: number) {
  return currency.format(value / 100);
}
function date(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00Z`));
}
function cents(value: FormDataEntryValue | null) {
  const normalized = (typeof value === 'string' ? value : '')
    .replace(/\./g, '')
    .replace(',', '.');
  return Math.round(Number(normalized) * 100);
}

export function WeddingApp({
  initialData,
  displayName,
}: {
  initialData: WeddingSnapshot;
  displayName: string;
}) {
  const [data, setData] = useState(initialData);
  const dataRef = useRef(data);
  const [view, setView] = useState<View>('overview');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/login');
  };

  const performAction = useCallback(
    async (action: ActionName, payload: unknown) => {
      const response = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, payload }),
      });
      const result = (await response.json()) as {
        snapshot?: WeddingSnapshot;
        error?: string;
      };
      if (!response.ok || !result.snapshot)
        throw new Error(result.error ?? 'Não foi possível salvar.');
      setData(result.snapshot);
      return result.snapshot;
    },
    [],
  );

  useEffect(() => {
    type ModelContext = {
      registerTool: (
        tool: Record<string, unknown>,
        options?: { signal?: AbortSignal },
      ) => void | Promise<void>;
    };
    const modelContext = (
      document as Document & { modelContext?: ModelContext }
    ).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    const register = async () => {
      await modelContext.registerTool(
        {
          name: 'read_wedding_overview',
          title: 'Ler resumo do casamento',
          description:
            'Retorna o resumo financeiro e operacional visível do casamento atual.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute() {
            const current = dataRef.current;
            return {
              wedding: current.wedding.title,
              weddingDate: current.wedding.weddingDate,
              budgetCents: current.wedding.budgetCents,
              savedCents: current.wedding.savedCents,
              pendingPayments: current.payments.filter(
                (item) => item.status !== 'pago',
              ).length,
              confirmedGuests: current.guests.filter(
                (item) => item.rsvp === 'confirmado',
              ).length,
              openTasks: current.checklist.filter(
                (item) => item.status !== 'concluído',
              ).length,
            };
          },
        },
        { signal: lifecycle.signal },
      );
      await modelContext.registerTool(
        {
          name: 'read_household_overview',
          title: 'Ler resumo do enxoval',
          description:
            'Retorna orçamento, progresso, itens pendentes e meta mensal do enxoval.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute() {
            const current = dataRef.current;
            const metrics = householdMetrics(current);
            return {
              budgetCents: current.household.plan.budgetCents,
              spentCents: metrics.spent,
              pendingCents: metrics.pending,
              completionPercent: metrics.completion,
              essentialMissing: metrics.essentialMissing,
              monthlyGoalCents: metrics.monthlyGoal,
            };
          },
        },
        { signal: lifecycle.signal },
      );
      await modelContext.registerTool(
        {
          name: 'create_household_item',
          title: 'Criar item do enxoval',
          description: 'Adiciona um item real ao planejamento da casa nova.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', minLength: 2 },
              desiredQuantity: { type: 'integer', minimum: 1 },
              priority: {
                type: 'string',
                enum: ['essencial', 'importante', 'pode esperar', 'opcional'],
              },
              estimatedUnitCents: { type: 'integer', minimum: 0 },
            },
            required: [
              'name',
              'desiredQuantity',
              'priority',
              'estimatedUnitCents',
            ],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          async execute(input: unknown) {
            if (!input || typeof input !== 'object')
              throw new Error('Entrada inválida.');
            const values = input as Record<string, unknown>;
            const created = await performAction('add_household_item', {
              ...values,
              categoryId: null,
              status: 'precisamos',
              minPriceCents: 0,
              maxPriceCents: values.estimatedUnitCents,
              brand: '',
              model: '',
              store: '',
              productUrl: '',
              responsible: 'Casal',
              giftIntent: 'a decidir',
              purchaseTiming: 'antes do casamento',
              desiredDate: null,
              notes: '',
            });
            return {
              created: true,
              totalItems: created.household.items.length,
            };
          },
        },
        { signal: lifecycle.signal },
      );
      await modelContext.registerTool(
        {
          name: 'create_checklist_item',
          title: 'Criar tarefa do casamento',
          description:
            'Cria uma tarefa real no checklist do casamento e atualiza a tela.',
          inputSchema: {
            type: 'object',
            properties: {
              title: { type: 'string', minLength: 2 },
              category: { type: 'string', minLength: 2 },
              responsible: { type: 'string', minLength: 2 },
              priority: {
                type: 'string',
                enum: ['essencial', 'importante', 'opcional', 'dispensável'],
              },
              dueDate: { type: 'string', format: 'date' },
            },
            required: [
              'title',
              'category',
              'responsible',
              'priority',
              'dueDate',
            ],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          async execute(input: unknown) {
            if (!input || typeof input !== 'object')
              throw new Error('Entrada inválida.');
            const created = await performAction('add_task', input);
            return {
              created: true,
              openTasks: created.checklist.filter(
                (item) => item.status !== 'concluído',
              ).length,
            };
          },
        },
        { signal: lifecycle.signal },
      );
    };
    void register().catch(() => undefined);
    return () => lifecycle.abort();
  }, [performAction]);

  const submit = async (
    action: ActionName,
    payload: unknown,
    success: string,
  ) => {
    setSaving(true);
    try {
      await performAction(action, payload);
      setDialogOpen(false);
      toast.add({
        title: success,
        description: 'Os dados já estão atualizados.',
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

  const metrics = useMemo(() => calculateMetrics(data), [data]);
  const pageTitle =
    navItems.find((item) => item.id === view)?.label ?? 'Visão geral';

  return (
    <Toaster>
      <main className="min-h-[100dvh] bg-background text-foreground md:grid md:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="hidden border-r border-sidebar-border bg-sidebar md:flex md:min-h-[100dvh] md:flex-col md:px-3 md:py-4">
          <Brand />
          <nav aria-label="Navegação principal" className="mt-8 space-y-1">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm transition-[transform,background-color,color] duration-200 active:scale-[.98] ${view === id ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground' : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'}`}
              >
                <Icon size={18} weight={view === id ? 'fill' : 'regular'} />
                {label}
              </button>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl border border-sidebar-border bg-background/70 p-3">
            <p className="text-xs font-medium">Planejamento de {displayName}</p>
            <div className="mt-3 flex items-center gap-3">
              <Progress value={householdMetrics(data).completion} className="flex-1" />
              <span className="font-mono text-xs text-muted-foreground">
                {householdMetrics(data).completion}%
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Concluam as tarefas prioritárias para fortalecer o plano.
            </p>
          </div>
        </aside>

        <section className="min-w-0 pb-24 md:pb-8">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border/70 bg-background/92 px-4 backdrop-blur-xl md:px-7">
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">
                {data.wedding.title}
              </p>
              <p className="text-sm font-medium">{pageTitle}</p>
            </div>
            <div className="hidden max-w-sm flex-1 md:block">
              <div className="relative">
                <MagnifyingGlass
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={16}
                />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-9 bg-card pl-8"
                  placeholder="Buscar nesta área"
                />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDark((value) => !value)}
                aria-label={dark ? 'Ativar tema claro' : 'Ativar tema escuro'}
              >
                {dark ? <Sun size={19} /> : <Moon size={19} />}
              </Button>
              <Button variant="ghost" size="icon" aria-label="Notificações">
                <Bell size={19} />
              </Button>
              <Button variant="outline" size="sm" onClick={logout}>
                Sair
              </Button>
              {view !== 'household' && (
                <Button
                  onClick={() => setDialogOpen(true)}
                  className="h-9 rounded-xl px-3"
                >
                  <Plus size={17} weight="bold" />
                  <span className="hidden sm:inline">Adicionar</span>
                </Button>
              )}
            </div>
          </header>

          <div className="mx-auto max-w-[1380px] px-4 py-6 md:px-7 md:py-8">
            {view === 'overview' && (
              <Overview data={data} metrics={metrics} onNavigate={setView} />
            )}
            {view === 'finance' && (
              <Finance
                data={data}
                metrics={metrics}
                search={search}
                onPaid={(id) =>
                  submit('mark_payment_paid', { id }, 'Pagamento atualizado')
                }
                onAdd={() => setDialogOpen(true)}
              />
            )}
            {view === 'household' && (
              <HouseholdView
                data={data}
                search={search}
                onAction={performAction}
              />
            )}
            {view === 'vendors' && (
              <Vendors
                data={data}
                search={search}
                onAdd={() => setDialogOpen(true)}
              />
            )}
            {view === 'guests' && (
              <Guests
                data={data}
                search={search}
                onAdd={() => setDialogOpen(true)}
                onRsvp={(id, rsvp) =>
                  submit('set_guest_rsvp', { id, rsvp }, 'RSVP atualizado')
                }
              />
            )}
            {view === 'checklist' && (
              <Checklist
                data={data}
                search={search}
                onAdd={() => setDialogOpen(true)}
                onToggle={(id) =>
                  submit('toggle_task', { id }, 'Checklist atualizado')
                }
              />
            )}
          </div>

          <nav
            aria-label="Navegação mobile"
            className="fixed inset-x-0 bottom-0 z-30 grid h-[72px] grid-cols-5 border-t border-border bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
          >
            {mobileNavItems.map(({ id, mobile, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`flex flex-col items-center justify-center gap-1 text-[10px] ${view === id ? 'font-medium text-primary' : 'text-muted-foreground'}`}
              >
                <Icon size={20} weight={view === id ? 'fill' : 'regular'} />
                {mobile}
              </button>
            ))}
          </nav>
        </section>
      </main>
      {view !== 'household' && (
        <AddDialog
          view={view}
          open={dialogOpen}
          saving={saving}
          data={data}
          onOpenChange={setDialogOpen}
          onSubmit={submit}
        />
      )}
    </Toaster>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <span className="grid size-9 place-items-center rounded-[14px] bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,.18)]">
        <HeartStraight size={18} weight="fill" />
      </span>
      <div>
        <p className="text-[15px] font-semibold tracking-[-0.02em]">Vínculo</p>
        <p className="text-xs text-muted-foreground">Wedding OS</p>
      </div>
    </div>
  );
}

type Metrics = ReturnType<typeof calculateMetrics>;
function calculateMetrics(data: WeddingSnapshot) {
  const today = new Date();
  const weddingDate = new Date(`${data.wedding.weddingDate}T12:00:00Z`);
  const days = Math.max(
    0,
    Math.ceil((weddingDate.getTime() - today.getTime()) / 86_400_000),
  );
  const months = Math.max(1, Math.ceil(days / 30.44));
  const contracted = data.categories.reduce(
    (sum, item) => sum + item.contractedCents,
    0,
  );
  const paid = data.categories.reduce((sum, item) => sum + item.paidCents, 0);
  const safeTarget = Math.round(
    data.wedding.budgetCents * (1 + data.wedding.reservePercent / 100),
  );
  const weddingSavings = Math.max(
    0,
    data.wedding.savedCents - data.household.plan.allocatedSavingsCents,
  );
  const needed = Math.max(0, safeTarget - weddingSavings);
  const monthlyGoal = Math.ceil(needed / months);
  const householdMonthlyGoal = householdMetrics(data).monthlyGoal;
  const generalMonthlyGoal =
    monthlyGoal +
    (data.household.plan.includeInGeneral ? householdMonthlyGoal : 0);
  const confirmed = data.guests.filter(
    (item) => item.rsvp === 'confirmado',
  ).length;
  const openTasks = data.checklist.filter(
    (item) => item.status !== 'concluído',
  ).length;
  return {
    days,
    months,
    contracted,
    paid,
    safeTarget,
    needed,
    monthlyGoal,
    householdMonthlyGoal,
    generalMonthlyGoal,
    weddingSavings,
    confirmed,
    openTasks,
  };
}

function Overview({
  data,
  metrics,
  onNavigate,
}: {
  data: WeddingSnapshot;
  metrics: Metrics;
  onNavigate: (view: View) => void;
}) {
  const onTrack =
    data.wedding.monthlyCapacityCents >= metrics.generalMonthlyGoal;
  const nextPayments = data.payments
    .filter((item) => item.status !== 'pago')
    .slice(0, 2);
  const nextTasks = data.checklist
    .filter((item) => item.status !== 'concluído')
    .slice(0, 2);
  const home = householdMetrics(data);
  return (
    <>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(
                new Date(`${data.wedding.weddingDate}T12:00:00Z`),
              )}
            </span>
            <span className="size-1 rounded-full bg-border" />
            <span>{metrics.days} dias restantes</span>
          </div>
          <h1 className="text-[clamp(1.75rem,4vw,2.55rem)] font-semibold leading-none tracking-[-0.045em]">
            {onTrack
              ? 'O plano está no caminho certo.'
              : 'O plano pede um pequeno ajuste.'}
          </h1>
        </div>
        <Badge
          className={`h-7 px-3 ${onTrack ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'}`}
        >
          <span
            className={`size-1.5 rounded-full ${onTrack ? 'bg-emerald-600' : 'bg-amber-600'}`}
          />
          Saúde financeira: {onTrack ? 'boa' : 'atenção'}
        </Badge>
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
        <section className="overflow-hidden rounded-[28px] bg-primary p-5 text-primary-foreground shadow-[0_24px_60px_-36px_rgba(39,67,56,.72)] sm:p-7">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-primary-foreground/70">
                Meta financeira segura
              </p>
              <p className="mt-2 font-mono text-[clamp(2rem,5vw,3.4rem)] font-medium leading-none tracking-[-0.055em]">
                {money(metrics.safeTarget)}
              </p>
              <p className="mt-3 text-sm text-primary-foreground/72">
                Inclui {data.wedding.reservePercent}% reservados para
                imprevistos.
              </p>
            </div>
            <Wallet size={24} className="opacity-75" />
          </div>
          <div className="mt-8">
            <div className="mb-2 flex justify-between font-mono text-xs text-primary-foreground/70">
              <span>
                {money(metrics.weddingSavings)} destinados ao casamento
              </span>
              <span>
                {Math.min(
                  100,
                  Math.round(
                    (metrics.weddingSavings / metrics.safeTarget) * 100,
                  ),
                )}
                %
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-[#dce8d9]"
                style={{
                  width: `${Math.min(100, (metrics.weddingSavings / metrics.safeTarget) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="mt-7 grid grid-cols-2 divide-x divide-white/15 border-t border-white/15 pt-5">
            <div className="pr-4">
              <p className="text-xs text-primary-foreground/65">Contratado</p>
              <p className="mt-1 font-mono text-xl">
                {money(metrics.contracted)}
              </p>
            </div>
            <div className="pl-4">
              <p className="text-xs text-primary-foreground/65">Já pago</p>
              <p className="mt-1 font-mono text-xl">{money(metrics.paid)}</p>
            </div>
          </div>
        </section>
        <section className="flex flex-col justify-between rounded-[28px] border border-border bg-card p-5 sm:p-7">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {data.household.plan.includeInGeneral
                  ? 'Meta mensal do casal'
                  : 'Meta mensal do casamento'}
              </p>
              <p className="mt-2 font-mono text-3xl font-medium tracking-[-0.045em]">
                {money(metrics.generalMonthlyGoal)}
                <span className="text-base text-muted-foreground">/mês</span>
              </p>
            </div>
            {onTrack ? (
              <CheckCircle className="text-primary" size={24} weight="fill" />
            ) : (
              <WarningCircle
                className="text-amber-700"
                size={24}
                weight="fill"
              />
            )}
          </div>
          <div className="mt-8 rounded-2xl bg-secondary p-4">
            <div className="flex justify-between text-sm">
              <span>Capacidade atual</span>
              <span className="font-mono">
                {money(data.wedding.monthlyCapacityCents)}
              </span>
            </div>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">
              {onTrack ? (
                <>
                  Vocês estão{' '}
                  <strong className="font-medium text-foreground">
                    {money(
                      data.wedding.monthlyCapacityCents -
                        metrics.generalMonthlyGoal,
                    )}{' '}
                    acima
                  </strong>{' '}
                  da meta mensal.
                </>
              ) : (
                <>
                  Faltam{' '}
                  <strong className="font-medium text-foreground">
                    {money(
                      metrics.generalMonthlyGoal -
                        data.wedding.monthlyCapacityCents,
                    )}{' '}
                    por mês
                  </strong>{' '}
                  para o plano seguro.
                </>
              )}
            </p>
          </div>
          <button
            onClick={() =>
              onNavigate(
                data.household.plan.includeInGeneral ? 'household' : 'finance',
              )
            }
            className="mt-5 flex items-center gap-1 self-start text-sm font-medium text-primary"
          >
            Ver projeção <CaretRight size={15} weight="bold" />
          </button>
        </section>
      </div>
      <button
        onClick={() => onNavigate('household')}
        className="group mt-4 grid w-full gap-5 rounded-[28px] border border-border bg-card p-5 text-left transition-transform duration-200 hover:-translate-y-0.5 active:scale-[.995] sm:p-7 lg:grid-cols-[1fr_auto_auto_auto_auto] lg:items-center"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-secondary text-primary">
            <HouseLine size={21} />
          </span>
          <div>
            <p className="font-semibold tracking-[-0.02em]">Casa nova</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Enxoval {home.completion}% concluído
            </p>
          </div>
        </div>
        <Metric label="Gasto" value={money(home.spent)} />
        <Metric label="Ainda falta" value={money(home.pending)} />
        <Metric
          label="Essenciais pendentes"
          value={String(home.essentialMissing)}
        />
        <div className="flex items-center gap-2 font-mono text-sm text-primary">
          <span>{money(home.monthlyGoal)}/mês</span>
          <CaretRight
            className="transition-transform group-hover:translate-x-0.5"
            size={16}
          />
        </div>
      </button>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <section className="rounded-[28px] border border-border bg-card p-5 sm:p-7">
          <SectionTitle
            title="Orçamento por categoria"
            subtitle="Onde o dinheiro está concentrado agora."
            action="Ver financeiro"
            onAction={() => onNavigate('finance')}
          />
          <div className="mt-6 divide-y divide-border">
            {data.categories.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="grid gap-3 py-4 first:pt-0 sm:grid-cols-[150px_1fr_auto] sm:items-center"
              >
                <p className="text-sm font-medium">{item.name}</p>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${Math.min(100, (item.contractedCents / Math.max(1, item.plannedCents)) * 100)}%`,
                    }}
                  />
                </div>
                <p className="font-mono text-xs text-muted-foreground">
                  {money(item.contractedCents)} de {money(item.plannedCents)}
                </p>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-[28px] border border-border bg-card p-5 sm:p-7">
          <SectionTitle
            title="Próximos passos"
            subtitle="O que merece atenção agora."
          />
          <div className="mt-5 divide-y divide-border">
            {nextPayments.map((item) => (
              <ActionRow
                key={item.id}
                title={item.title}
                subtitle={`Vence ${date(item.dueDate)}`}
                value={money(item.amountCents)}
                onClick={() => onNavigate('finance')}
              />
            ))}
            {nextTasks.map((item) => (
              <ActionRow
                key={item.id}
                title={item.title}
                subtitle={item.category}
                value={date(item.dueDate)}
                onClick={() => onNavigate('checklist')}
              />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function Finance({
  data,
  metrics,
  search,
  onPaid,
  onAdd,
}: {
  data: WeddingSnapshot;
  metrics: Metrics;
  search: string;
  onPaid: (id: string) => void;
  onAdd: () => void;
}) {
  const items = data.payments.filter((item) =>
    `${item.title} ${item.vendorName} ${item.linkUrl}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title="Financeiro"
        subtitle="Planejado, contratado e pago sem esconder a conta."
        icon={TrendUp}
        action="Novo pagamento"
        onAction={onAdd}
      />
      <div className="grid gap-4 md:grid-cols-[1.3fr_.7fr]">
        <section className="rounded-[28px] bg-primary p-6 text-primary-foreground">
          <p className="text-sm text-primary-foreground/70">
            Ainda necessário para a meta segura
          </p>
          <p className="mt-2 font-mono text-4xl tracking-[-0.05em]">
            {money(metrics.needed)}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-5 border-t border-white/15 pt-5">
            <Metric
              label="A pagar"
              value={money(Math.max(0, metrics.contracted - metrics.paid))}
              light
            />
            <Metric
              label="Meta mensal"
              value={money(metrics.monthlyGoal)}
              light
            />
          </div>
        </section>
        <section className="rounded-[28px] border border-border bg-card p-6">
          <Metric
            label="Custo por convidado estimado"
            value={money(
              Math.round(
                data.wedding.budgetCents /
                  Math.max(1, data.wedding.guestEstimate),
              ),
            )}
          />
          <p className="mt-3 text-sm leading-5 text-muted-foreground">
            Com {data.wedding.guestEstimate} convidados planejados e reserva
            separada.
          </p>
        </section>
      </div>
      <section className="mt-4 rounded-[28px] border border-border bg-card p-5 sm:p-7">
        <SectionTitle
          title="Pagamentos"
          subtitle={`${items.filter((item) => item.status !== 'pago').length} compromissos ainda abertos.`}
        />
        {items.length ? (
          <div className="mt-5 divide-y divide-border">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center"
              >
                <div className="grid size-10 place-items-center rounded-xl bg-secondary">
                  <Receipt size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <RelatedLink href={item.linkUrl} label={`Abrir link de ${item.title}`} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.vendorName || 'Sem fornecedor'} · {item.payer}
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="font-mono text-sm">
                    {fullMoney(item.amountCents)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {date(item.dueDate)}
                  </p>
                </div>
                <Status value={item.status} />
                {item.status !== 'pago' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPaid(item.id)}
                  >
                    <Check size={14} />
                    Marcar pago
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Receipt}
            title="Nenhum pagamento encontrado"
            description="Cadastre um compromisso financeiro para acompanhar vencimentos."
            action="Adicionar pagamento"
            onAction={onAdd}
          />
        )}
      </section>
    </>
  );
}

function Vendors({
  data,
  search,
  onAdd,
}: {
  data: WeddingSnapshot;
  search: string;
  onAdd: () => void;
}) {
  const items = data.vendors.filter((item) =>
    `${item.name} ${item.company} ${item.category}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title="Fornecedores"
        subtitle="Propostas, contatos e escolhas em um único lugar."
        icon={Storefront}
        action="Novo fornecedor"
        onAction={onAdd}
      />
      {items.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-[26px] border border-border bg-card p-5 transition-transform duration-200 hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <span className="grid size-11 place-items-center rounded-2xl bg-secondary text-primary">
                    <Storefront size={20} />
                  </span>
                  <div>
                    <p className="font-medium">{item.company || item.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {item.category} · {item.name}
                    </p>
                  </div>
                </div>
                {item.favorite && (
                  <Star size={18} weight="fill" className="text-amber-600" />
                )}
              </div>
              <div className="mt-5 flex items-end justify-between gap-4 border-t border-border pt-4">
                <div>
                  <p className="text-xs text-muted-foreground">Proposta</p>
                  <p className="mt-1 font-mono text-lg">
                    {fullMoney(item.quotedCents)}
                  </p>
                </div>
                <Status value={item.status} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {item.phone && (
                  <a
                    href={`tel:${item.phone}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs"
                  >
                    <Phone size={14} />
                    {item.phone}
                  </a>
                )}
                {item.email && (
                  <a
                    href={`mailto:${item.email}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs"
                  >
                    <EnvelopeSimple size={14} />
                    E-mail
                  </a>
                )}
                {item.linkUrl && (
                  <a
                    href={item.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs"
                  >
                    <LinkSimple size={14} />
                    Abrir link
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Storefront}
          title="Nenhum fornecedor encontrado"
          description="Cadastre propostas para comparar valores e condições."
          action="Adicionar fornecedor"
          onAction={onAdd}
        />
      )}
    </>
  );
}

function Guests({
  data,
  search,
  onAdd,
  onRsvp,
}: {
  data: WeddingSnapshot;
  search: string;
  onAdd: () => void;
  onRsvp: (id: string, rsvp: string) => void;
}) {
  const items = data.guests.filter((item) =>
    `${item.fullName} ${item.groupName}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const confirmed = data.guests.filter(
    (item) => item.rsvp === 'confirmado',
  ).length;
  return (
    <>
      <PageHeading
        title="Convidados"
        subtitle={`${confirmed} confirmados de ${data.guests.length} cadastrados.`}
        icon={UsersThree}
        action="Novo convidado"
        onAction={onAdd}
      />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <SmallMetric label="Confirmados" value={confirmed} />
        <SmallMetric
          label="Aguardando"
          value={
            data.guests.filter((item) => item.rsvp === 'aguardando').length
          }
        />
        <SmallMetric label="Estimativa" value={data.wedding.guestEstimate} />
      </div>
      <section className="rounded-[28px] border border-border bg-card p-3 sm:p-5">
        {items.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Lado</TableHead>
                <TableHead>Faixa</TableHead>
                <TableHead className="text-right">RSVP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      {item.fullName}
                      <RelatedLink href={item.linkUrl} label={`Abrir link de ${item.fullName}`} />
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.groupName || '—'}
                  </TableCell>
                  <TableCell>{item.side}</TableCell>
                  <TableCell className="capitalize">{item.ageGroup}</TableCell>
                  <TableCell>
                    <NativeSelect
                      className="ml-auto w-[154px]"
                      size="sm"
                      value={item.rsvp}
                      onChange={(event) => onRsvp(item.id, event.target.value)}
                    >
                      <NativeSelectOption value="ainda não convidado">
                        Não convidado
                      </NativeSelectOption>
                      <NativeSelectOption value="aguardando">
                        Aguardando
                      </NativeSelectOption>
                      <NativeSelectOption value="confirmado">
                        Confirmado
                      </NativeSelectOption>
                      <NativeSelectOption value="não irá">
                        Não irá
                      </NativeSelectOption>
                      <NativeSelectOption value="talvez">
                        Talvez
                      </NativeSelectOption>
                    </NativeSelect>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={UserPlus}
            title="Nenhum convidado encontrado"
            description="Adicione pessoas e acompanhe as confirmações."
            action="Adicionar convidado"
            onAction={onAdd}
          />
        )}
      </section>
    </>
  );
}

function Checklist({
  data,
  search,
  onAdd,
  onToggle,
}: {
  data: WeddingSnapshot;
  search: string;
  onAdd: () => void;
  onToggle: (id: string) => void;
}) {
  const items = data.checklist.filter((item) =>
    `${item.title} ${item.category}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const completed = data.checklist.filter(
    (item) => item.status === 'concluído',
  ).length;
  return (
    <>
      <PageHeading
        title="Checklist"
        subtitle={`${completed} de ${data.checklist.length} tarefas concluídas.`}
        icon={ClipboardText}
        action="Nova tarefa"
        onAction={onAdd}
      />
      <section className="rounded-[28px] border border-border bg-card p-5 sm:p-7">
        <div className="mb-6">
          <div className="mb-2 flex justify-between text-sm">
            <span>Progresso geral</span>
            <span className="font-mono text-muted-foreground">
              {Math.round(
                (completed / Math.max(1, data.checklist.length)) * 100,
              )}
              %
            </span>
          </div>
          <Progress
            value={(completed / Math.max(1, data.checklist.length)) * 100}
          />
        </div>
        {items.length ? (
          <div className="divide-y divide-border">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 py-4 first:pt-0"
              >
                <button
                  onClick={() => onToggle(item.id)}
                  aria-label={
                    item.status === 'concluído'
                      ? `Reabrir ${item.title}`
                      : `Concluir ${item.title}`
                  }
                  className={`mt-0.5 grid size-5 place-items-center rounded-md border ${item.status === 'concluído' ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background'}`}
                >
                  {item.status === 'concluído' && (
                    <Check size={13} weight="bold" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-sm font-medium ${item.status === 'concluído' ? 'text-muted-foreground line-through' : ''}`}
                    >
                      {item.title}
                    </p>
                    <RelatedLink href={item.linkUrl} label={`Abrir link de ${item.title}`} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.category} · {item.responsible} · {date(item.dueDate)}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {item.priority}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ClipboardText}
            title="Nenhuma tarefa encontrada"
            description="Adicione uma tarefa com prazo e responsável."
            action="Adicionar tarefa"
            onAction={onAdd}
          />
        )}
      </section>
    </>
  );
}

function AddDialog({
  view,
  open,
  saving,
  data,
  onOpenChange,
  onSubmit,
}: {
  view: View;
  open: boolean;
  saving: boolean;
  data: WeddingSnapshot;
  onOpenChange: (value: boolean) => void;
  onSubmit: (action: ActionName, payload: unknown, success: string) => void;
}) {
  const kind = view === 'overview' || view === 'household' ? 'checklist' : view;
  const titles = {
    finance: ['Novo pagamento', 'Registre um vencimento real.'],
    vendors: ['Novo fornecedor', 'Adicione uma proposta para comparar.'],
    guests: ['Novo convidado', 'Inclua a pessoa e o status do convite.'],
    checklist: ['Nova tarefa', 'Defina responsabilidade, prioridade e prazo.'],
  } as const;
  const [title, description] = titles[kind as keyof typeof titles];
  const baseInput = 'h-10';
  const label = 'grid gap-2 text-sm font-medium';
  const submitForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (kind === 'finance')
      onSubmit(
        'add_payment',
        {
          title: form.get('title'),
          vendorName: form.get('vendorName'),
          categoryId: form.get('categoryId') || null,
          amountCents: cents(form.get('amount')),
          dueDate: form.get('dueDate'),
          payer: form.get('payer'),
          linkUrl: form.get('linkUrl'),
        },
        'Pagamento adicionado',
      );
    if (kind === 'vendors')
      onSubmit(
        'add_vendor',
        {
          name: form.get('name'),
          company: form.get('company'),
          category: form.get('category'),
          phone: form.get('phone'),
          email: form.get('email'),
          linkUrl: form.get('linkUrl'),
          quotedCents: cents(form.get('amount')),
          status: form.get('status'),
        },
        'Fornecedor adicionado',
      );
    if (kind === 'guests')
      onSubmit(
        'add_guest',
        {
          fullName: form.get('fullName'),
          side: form.get('side'),
          groupName: form.get('groupName'),
          ageGroup: form.get('ageGroup'),
          rsvp: form.get('rsvp'),
          linkUrl: form.get('linkUrl'),
        },
        'Convidado adicionado',
      );
    if (kind === 'checklist')
      onSubmit(
        'add_task',
        {
          title: form.get('title'),
          category: form.get('category'),
          responsible: form.get('responsible'),
          priority: form.get('priority'),
          dueDate: form.get('dueDate'),
          linkUrl: form.get('linkUrl'),
        },
        'Tarefa adicionada',
      );
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submitForm} className="grid gap-4">
          {kind === 'finance' && (
            <>
              <label className={label}>
                Descrição
                <Input
                  name="title"
                  required
                  placeholder="Ex.: Parcela do buffet"
                  className={baseInput}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  Valor
                  <Input
                    name="amount"
                    inputMode="decimal"
                    required
                    placeholder="1.250,00"
                    className={baseInput}
                  />
                </label>
                <label className={label}>
                  Vencimento
                  <Input
                    name="dueDate"
                    type="date"
                    required
                    className={baseInput}
                  />
                </label>
              </div>
              <label className={label}>
                Fornecedor
                <Input
                  name="vendorName"
                  placeholder="Opcional"
                  className={baseInput}
                />
              </label>
              <LinkInput label="Link do pagamento, boleto ou contrato" />
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  Categoria
                  <NativeSelect name="categoryId" className="w-full">
                    <NativeSelectOption value="">
                      Sem categoria
                    </NativeSelectOption>
                    {data.categories.map((item) => (
                      <NativeSelectOption key={item.id} value={item.id}>
                        {item.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
                <label className={label}>
                  Responsável
                  <NativeSelect name="payer" className="w-full">
                    <NativeSelectOption>Casal</NativeSelectOption>
                    <NativeSelectOption>
                      {data.wedding.personOne}
                    </NativeSelectOption>
                    <NativeSelectOption>
                      {data.wedding.personTwo}
                    </NativeSelectOption>
                  </NativeSelect>
                </label>
              </div>
            </>
          )}
          {kind === 'vendors' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  Contato
                  <Input
                    name="name"
                    required
                    placeholder="Nome"
                    className={baseInput}
                  />
                </label>
                <label className={label}>
                  Empresa
                  <Input
                    name="company"
                    placeholder="Marca ou estúdio"
                    className={baseInput}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  Categoria
                  <Input
                    name="category"
                    required
                    placeholder="Fotografia"
                    className={baseInput}
                  />
                </label>
                <label className={label}>
                  Proposta
                  <Input
                    name="amount"
                    required
                    inputMode="decimal"
                    placeholder="3.500,00"
                    className={baseInput}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  Telefone
                  <Input
                    name="phone"
                    placeholder="(11) 90000-0000"
                    className={baseInput}
                  />
                </label>
                <label className={label}>
                  E-mail
                  <Input
                    name="email"
                    type="email"
                    placeholder="contato@empresa.com"
                    className={baseInput}
                  />
                </label>
              </div>
              <LinkInput label="Site, mapa, proposta ou rede social" />
              <label className={label}>
                Status
                <NativeSelect name="status" className="w-full">
                  <NativeSelectOption value="pesquisando">
                    Pesquisando
                  </NativeSelectOption>
                  <NativeSelectOption value="favorito">
                    Favorito
                  </NativeSelectOption>
                  <NativeSelectOption value="negociando">
                    Negociando
                  </NativeSelectOption>
                  <NativeSelectOption value="contratado">
                    Contratado
                  </NativeSelectOption>
                </NativeSelect>
              </label>
            </>
          )}
          {kind === 'guests' && (
            <>
              <label className={label}>
                Nome completo
                <Input
                  name="fullName"
                  required
                  placeholder="Nome e sobrenome"
                  className={baseInput}
                />
              </label>
              <label className={label}>
                Família ou grupo
                <Input
                  name="groupName"
                  placeholder="Ex.: Família Ribeiro"
                  className={baseInput}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  Lado
                  <NativeSelect name="side" className="w-full">
                    <NativeSelectOption>Pessoa 1</NativeSelectOption>
                    <NativeSelectOption>Pessoa 2</NativeSelectOption>
                    <NativeSelectOption>Ambos</NativeSelectOption>
                  </NativeSelect>
                </label>
                <label className={label}>
                  Faixa
                  <NativeSelect name="ageGroup" className="w-full">
                    <NativeSelectOption value="adulto">
                      Adulto
                    </NativeSelectOption>
                    <NativeSelectOption value="adolescente">
                      Adolescente
                    </NativeSelectOption>
                    <NativeSelectOption value="criança">
                      Criança
                    </NativeSelectOption>
                    <NativeSelectOption value="bebê">Bebê</NativeSelectOption>
                  </NativeSelect>
                </label>
              </div>
              <label className={label}>
                RSVP
                <NativeSelect name="rsvp" className="w-full">
                  <NativeSelectOption value="ainda não convidado">
                    Ainda não convidado
                  </NativeSelectOption>
                  <NativeSelectOption value="aguardando">
                    Aguardando
                  </NativeSelectOption>
                  <NativeSelectOption value="confirmado">
                    Confirmado
                  </NativeSelectOption>
                  <NativeSelectOption value="talvez">Talvez</NativeSelectOption>
                </NativeSelect>
              </label>
              <LinkInput label="Convite, perfil ou outro link" />
            </>
          )}
          {kind === 'checklist' && (
            <>
              <label className={label}>
                Tarefa
                <Input
                  name="title"
                  required
                  placeholder="O que precisa ser feito?"
                  className={baseInput}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  Categoria
                  <Input
                    name="category"
                    required
                    placeholder="Fornecedores"
                    className={baseInput}
                  />
                </label>
                <label className={label}>
                  Responsável
                  <Input
                    name="responsible"
                    required
                    defaultValue="Casal"
                    className={baseInput}
                  />
                </label>
              </div>
              <LinkInput label="Link de referência" />
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  Prioridade
                  <NativeSelect name="priority" className="w-full">
                    <NativeSelectOption value="essencial">
                      Essencial
                    </NativeSelectOption>
                    <NativeSelectOption value="importante">
                      Importante
                    </NativeSelectOption>
                    <NativeSelectOption value="opcional">
                      Opcional
                    </NativeSelectOption>
                    <NativeSelectOption value="dispensável">
                      Dispensável
                    </NativeSelectOption>
                  </NativeSelect>
                </label>
                <label className={label}>
                  Prazo
                  <Input
                    name="dueDate"
                    type="date"
                    required
                    className={baseInput}
                  />
                </label>
              </div>
            </>
          )}
          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <SpinnerGap className="animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PageHeading({
  title,
  subtitle,
  icon: Icon,
  action,
  onAction,
}: {
  title: string;
  subtitle: string;
  icon: typeof Gauge;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="flex items-start gap-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-secondary text-primary">
          <Icon size={20} />
        </span>
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.045em]">
            {title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <Button onClick={onAction} className="self-start rounded-xl">
        <Plus size={16} />
        {action}
      </Button>
    </div>
  );
}
function SectionTitle({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.025em]">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {action && (
        <Button variant="outline" size="sm" onClick={onAction}>
          {action}
        </Button>
      )}
    </div>
  );
}
function ActionRow({
  title,
  subtitle,
  value,
  onClick,
}: {
  title: string;
  subtitle: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 py-4 text-left first:pt-0"
    >
      <span className="size-2 rounded-full bg-primary/70" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {subtitle}
        </span>
      </span>
      <span className="font-mono text-xs text-muted-foreground">{value}</span>
      <CaretRight
        className="text-muted-foreground transition-transform group-hover:translate-x-0.5"
        size={15}
      />
    </button>
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
function SmallMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl">{value}</p>
    </div>
  );
}
function Status({ value }: { value: string }) {
  const tone =
    value === 'pago' || value === 'contratado'
      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
      : value === 'próximo' || value === 'negociando'
        ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
        : 'bg-muted text-muted-foreground';
  return <Badge className={`capitalize ${tone}`}>{value}</Badge>;
}

function RelatedLink({ href, label }: { href: string; label: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title="Abrir link"
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-primary hover:bg-secondary"
      onClick={(event) => event.stopPropagation()}
    >
      <LinkSimple size={14} />
    </a>
  );
}

function LinkInput({ label }: { label: string }) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <Input name="linkUrl" type="url" placeholder="https://" />
    </label>
  );
}
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  onAction,
}: {
  icon: typeof Gauge;
  title: string;
  description: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <Empty className="mt-5 border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <Button size="sm" onClick={onAction}>
        <Plus size={14} />
        {action}
      </Button>
    </Empty>
  );
}
