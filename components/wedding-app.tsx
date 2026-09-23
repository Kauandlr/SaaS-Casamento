'use client';
/* oxlint-disable typescript/no-deprecated, jsx-a11y/label-has-associated-control */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CalendarDots,
  CaretRight,
  Check,
  CheckCircle,
  ClipboardText,
  CurrencyCircleDollar,
  EnvelopeSimple,
  Gauge,
  Gift,
  GearSix,
  HeartStraight,
  HouseLine,
  LinkSimple,
  MagnifyingGlass,
  Moon,
  Palette,
  PencilSimple,
  Phone,
  Plus,
  Receipt,
  SpinnerGap,
  Sparkle,
  Star,
  Storefront,
  Sun,
  TrendUp,
  UserPlus,
  UsersFour,
  UsersThree,
  Wallet,
  WarningCircle,
  WhatsappLogo,
} from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { CoupleAccess } from '@/components/couple-access';
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
import { Switch } from '@/components/ui/switch';
import { Toaster, toast } from '@/components/ui/toast';
import {
  HouseholdView,
  householdMetrics,
  type HouseholdAction,
} from '@/components/household-view';
import { GiftListView } from '@/components/gift-list-view';
import type { Guest, GuestInvitation, WeddingSnapshot } from '@/lib/wedding-types';
import { LunaPanel } from '@/components/luna-panel';
import { PaletteView } from '@/components/palette-view';
import { WhatsAppShareDialog } from '@/components/whatsapp-share-dialog';
import { confirmedAgeTotals, invitationRsvpStatus, rsvpResponseCounts, type InvitationRsvpStatus } from '@/lib/rsvp-rules';

type View =
  | 'overview'
  | 'finance'
  | 'household'
  | 'gifts'
  | 'palette'
  | 'vendors'
  | 'guests'
  | 'checklist'
  | 'settings';
type GuestRoleFilter = 'all' | 'convidado' | 'padrinho' | 'madrinha';
type ActionName =
  | 'add_payment'
  | 'mark_payment_paid'
  | 'add_vendor'
  | 'add_guest'
  | 'update_guest'
  | 'set_guest_rsvp'
  | 'add_task'
  | 'toggle_task'
  | 'update_wedding_date'
  | 'save_rsvp_settings'
  | 'save_wedding_palettes'
  | 'update_gift_list_item'
  | 'remove_gift_list_item'
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
    mobile: 'Finanças',
    icon: CurrencyCircleDollar,
  },
  {
    id: 'household' as const,
    label: 'Enxoval',
    mobile: 'Casa',
    icon: HouseLine,
  },
  {
    id: 'gifts' as const,
    label: 'Lista de presentes',
    mobile: 'Presentes',
    icon: Gift,
  },
  {
    id: 'palette' as const,
    label: 'Paleta',
    mobile: 'Paleta',
    icon: Palette,
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
  {
    id: 'settings' as const,
    label: 'Configurações',
    mobile: 'Ajustes',
    icon: GearSix,
  },
];
const mobileNavItems = navItems.filter((item) => !['vendors', 'palette'].includes(item.id));

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
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [saving, setSaving] = useState(false);
  const [dark, setDark] = useState(false);
  const [lunaOpen, setLunaOpen] = useState(false);
  const [weddingDateDialogOpen, setWeddingDateDialogOpen] = useState(false);
  const [sharingInvitation, setSharingInvitation] = useState<GuestInvitation | null>(null);
  const [generalShareOpen, setGeneralShareOpen] = useState(false);

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
    onSuccess?: () => void,
  ) => {
    setSaving(true);
    try {
      await performAction(action, payload);
      setDialogOpen(false);
      if (action === 'update_guest' || action === 'add_guest') setEditingGuest(null);
      onSuccess?.();
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
        <aside className="hidden border-r border-sidebar-border bg-sidebar md:sticky md:top-0 md:flex md:h-dvh md:self-start md:flex-col md:overflow-y-auto md:px-3 md:py-4">
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
              <CoupleAccess />
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
              {view !== 'household' && view !== 'gifts' && view !== 'palette' && view !== 'settings' && (
                <Button
                  onClick={() => { if (view === 'guests') setEditingGuest(null); setDialogOpen(true); }}
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
              <Overview
                data={data}
                metrics={metrics}
                onNavigate={setView}
                onEditWeddingDate={() => setWeddingDateDialogOpen(true)}
              />
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
            {view === 'gifts' && (
              <GiftListView data={data} search={search} onAction={performAction} />
            )}
            {view === 'palette' && (
              <PaletteView data={data} onAction={performAction} />
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
                onAdd={() => { setEditingGuest(null); setDialogOpen(true); }}
                onEdit={(guest) => { setEditingGuest(guest); setDialogOpen(true); }}
                onRsvp={(id, rsvp) =>
                  submit('set_guest_rsvp', { id, rsvp }, 'Confirmação de presença atualizada')
                }
                onShare={setSharingInvitation}
                onShareSite={() => setGeneralShareOpen(true)}
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
            {view === 'settings' && (
              <Settings
                data={data}
                saving={saving}
                onShare={() => setGeneralShareOpen(true)}
                onSave={(payload) => submit('save_rsvp_settings', payload, 'Configurações de confirmação atualizadas')}
              />
            )}
          </div>

          <nav
            aria-label="Navegação mobile"
            className="fixed inset-x-0 bottom-0 z-30 grid h-[72px] grid-cols-7 border-t border-border bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
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
      {!lunaOpen && (
        <Button
          type="button"
          onClick={() => setLunaOpen(true)}
          aria-label="Abrir Luna"
          className="fixed bottom-[88px] right-4 z-40 h-12 gap-2 rounded-full px-5 shadow-xl shadow-primary/20 motion-safe:hover:-translate-y-1 md:bottom-6 md:right-6"
        >
          <Sparkle size={20} weight="fill" />
          <span>Luna 5.6</span>
        </Button>
      )}
      <LunaPanel open={lunaOpen} onClose={() => setLunaOpen(false)} onSnapshot={setData} />
      {weddingDateDialogOpen && (
        <WeddingDateDialog
          open={weddingDateDialogOpen}
          currentDate={data.wedding.weddingDate}
          saving={saving}
          onOpenChange={setWeddingDateDialogOpen}
          onSubmit={(weddingDate) =>
            submit(
              'update_wedding_date',
              { weddingDate },
              'Data do casamento atualizada',
              () => setWeddingDateDialogOpen(false),
            )
          }
        />
      )}
      {dialogOpen && view !== 'household' && view !== 'gifts' && view !== 'palette' && view !== 'settings' && (
        <AddDialog
          key={view === 'guests' ? (editingGuest?.id ?? 'new-guest') : view}
          view={view}
          open={dialogOpen}
          saving={saving}
          data={data}
          editingGuest={editingGuest}
          onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingGuest(null); }}
          onSubmit={submit}
        />
      )}
      <WhatsAppShareDialog
        open={Boolean(sharingInvitation)}
        onOpenChange={(open) => { if (!open) setSharingInvitation(null); }}
        data={data}
        invitation={sharingInvitation ?? undefined}
        onSnapshot={setData}
        onShared={(invitationId, openedAt) => {
          if (!invitationId) return;
          setData((current) => ({
            ...current,
            guestInvitations: current.guestInvitations.map((item) => item.id === invitationId ? { ...item, lastSharedAt: openedAt } : item),
          }));
        }}
      />
      <WhatsAppShareDialog
        open={generalShareOpen}
        onOpenChange={setGeneralShareOpen}
        data={data}
        onSnapshot={setData}
        onShared={() => undefined}
      />
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
  onEditWeddingDate,
}: {
  data: WeddingSnapshot;
  metrics: Metrics;
  onNavigate: (view: View) => void;
  onEditWeddingDate: () => void;
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
  const contractedVendors = data.vendors.filter(
    (item) => item.status === 'contratado',
  ).length;
  const giftListItems = data.household.items.filter(
    (item) =>
      item.status !== 'removido da lista' &&
      ['lista de presentes', 'ambos'].includes(item.giftIntent),
  );
  const receivedGifts = data.household.gifts
    .filter((gift) => giftListItems.some((item) => item.id === gift.itemId))
    .reduce((sum, gift) => sum + gift.quantity, 0);
  const quickTotals = [
    {
      label: 'Convidados',
      value: data.guests.length,
      detail: `${metrics.confirmed} confirmados`,
      view: 'guests' as const,
      icon: UsersThree,
    },
    {
      label: 'Fornecedores',
      value: data.vendors.length,
      detail: `${contractedVendors} contratados`,
      view: 'vendors' as const,
      icon: Storefront,
    },
    {
      label: 'Tarefas pendentes',
      value: metrics.openTasks,
      detail: `de ${data.checklist.length} tarefas`,
      view: 'checklist' as const,
      icon: ClipboardText,
    },
    {
      label: 'Presentes na lista',
      value: giftListItems.length,
      detail: `${receivedGifts} unidades recebidas`,
      view: 'gifts' as const,
      icon: Gift,
    },
  ];
  const savingsProgress =
    metrics.safeTarget > 0
      ? Math.min(100, (metrics.weddingSavings / metrics.safeTarget) * 100)
      : 0;
  return (
    <>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <button
              type="button"
              onClick={onEditWeddingDate}
              title="Alterar dia do casamento"
              className="group inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CalendarDots size={15} aria-hidden="true" />
              {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(
                new Date(`${data.wedding.weddingDate}T12:00:00Z`),
              )}
              <PencilSimple
                size={13}
                aria-hidden="true"
                className="opacity-50 transition-opacity group-hover:opacity-100"
              />
              <span className="sr-only">Alterar dia do casamento</span>
            </button>
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
      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {quickTotals.map(({ label, value, detail, view, icon: Icon }) => (
          <button
            key={view}
            type="button"
            onClick={() => onNavigate(view)}
            className="group flex min-w-0 flex-col rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
          >
            <div className="flex w-full items-center justify-between gap-2 text-muted-foreground">
              <Icon size={18} aria-hidden="true" />
              <CaretRight
                size={15}
                aria-hidden="true"
                className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              />
            </div>
            <p className="mt-4 font-mono text-3xl font-medium tabular-nums">{value}</p>
            <p className="mt-1 text-sm font-medium">{label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          </button>
        ))}
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
                {Math.round(savingsProgress)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-[#dce8d9]"
                style={{
                  width: `${savingsProgress}%`,
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
  const negotiating = data.vendors.filter(
    (item) => item.status === 'negociando',
  ).length;
  const contracted = data.vendors.filter(
    (item) => item.status === 'contratado',
  ).length;
  return (
    <>
      <PageHeading
        title="Fornecedores"
        subtitle="Propostas, contatos e escolhas em um único lugar."
        icon={Storefront}
        action="Novo fornecedor"
        onAction={onAdd}
      />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <SmallMetric label="Total cadastrados" value={data.vendors.length} />
        <SmallMetric label="Em negociação" value={negotiating} />
        <SmallMetric label="Contratados" value={contracted} />
      </div>
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
  onEdit,
  onRsvp,
  onShare,
  onShareSite,
}: {
  data: WeddingSnapshot;
  search: string;
  onAdd: () => void;
  onEdit: (guest: Guest) => void;
  onRsvp: (id: string, rsvp: string) => void;
  onShare: (invitation: GuestInvitation) => void;
  onShareSite: () => void;
}) {
  const [roleFilter, setRoleFilter] = useState<GuestRoleFilter>('all');
  const [rsvpFilter, setRsvpFilter] = useState<'all' | Exclude<InvitationRsvpStatus, 'parcial'>>('all');
  const normalizedSearch = search.toLocaleLowerCase('pt-BR');
  const allItems = data.guestInvitations.map((invitation) => {
    const members = data.guests.filter((guest) => invitation.guestIds.includes(guest.id));
    return { invitation, members, status: invitationRsvpStatus(members.map((member) => member.rsvp), invitation.companions.length) };
  });
  const items = allItems.map(({ invitation, members, status }) => {
    const groupMatchesSearch = `${invitation.name} ${invitation.responsiblePhone} ${members[0]?.groupName ?? ''}`
      .toLocaleLowerCase('pt-BR')
      .includes(normalizedSearch);
    const visibleMembers = members.filter((member) => {
      const matchesRole = roleFilter === 'all' || member.role === roleFilter;
      const matchesSearch = groupMatchesSearch
        || member.fullName.toLocaleLowerCase('pt-BR').includes(normalizedSearch);
      return matchesRole && matchesSearch;
    });
    return { invitation, members, visibleMembers, status };
  }).filter(({ visibleMembers, status }) =>
    visibleMembers.length > 0 && (
      rsvpFilter === 'all'
      || status === rsvpFilter
      || (rsvpFilter === 'pendente' && status === 'parcial')
    ),
  );
  const { confirmed, declined, pending: pendingResponses } = rsvpResponseCounts(
    data.guests.map((guest) => guest.rsvp),
    data.guestInvitations.reduce((sum, invitation) => sum + invitation.companions.length, 0),
  );
  const ages = confirmedAgeTotals([
    ...data.guests.map((guest) => ({ ageGroup: guest.ageGroup, rsvp: guest.rsvp })),
    ...data.guestInvitations.flatMap((invitation) => invitation.companions.map((companion) => ({ ageGroup: companion.ageGroup, rsvp: 'confirmado' }))),
  ]);
  const publicPath = `/casamento/${data.wedding.publicSlug}`;
  const roleMetrics: Array<{
    value: GuestRoleFilter;
    label: string;
    count: number;
  }> = [
    { value: 'all', label: 'Todos', count: data.guests.length },
    {
      value: 'convidado',
      label: 'Convidados',
      count: data.guests.filter((guest) => guest.role === 'convidado').length,
    },
    {
      value: 'padrinho',
      label: 'Padrinhos',
      count: data.guests.filter((guest) => guest.role === 'padrinho').length,
    },
    {
      value: 'madrinha',
      label: 'Madrinhas',
      count: data.guests.filter((guest) => guest.role === 'madrinha').length,
    },
  ];
  return (
    <>
      <PageHeading
        title="Convidados"
        subtitle={`${confirmed} confirmados · ${declined} não irão · ${pendingResponses} pendentes.`}
        icon={UsersThree}
        action="Novo convidado"
        onAction={onAdd}
      />
      <section className="mb-4 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
              <LinkSimple size={19} />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">Link do casamento</h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Envie o site geral ou use os convites direcionados na lista abaixo.
              </p>
              <a
                className="mt-2 block truncate font-mono text-xs text-primary hover:underline"
                href={publicPath}
                target="_blank"
                rel="noreferrer"
              >
                {publicPath}
              </a>
            </div>
          </div>
          <Button type="button" className="h-9 shrink-0" onClick={onShareSite}>
            <WhatsappLogo weight="fill" /> Enviar link
          </Button>
        </div>
      </section>
      <div
        className="mb-4 grid grid-cols-2 gap-3 md:shrink-0 lg:grid-cols-4"
        role="group"
        aria-label="Filtrar convidados por papel"
      >
        {roleMetrics.map((metric) => (
          <RoleMetric
            key={metric.value}
            label={metric.label}
            value={metric.count}
            active={roleFilter === metric.value}
            onClick={() => setRoleFilter(metric.value)}
          />
        ))}
      </div>
      <div className="mb-4 grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-4 lg:divide-y-0">
        {[['Confirmados', confirmed], ['Não irão', declined], ['Adultos confirmados', ages.adults], ['Crianças confirmadas', ages.children]].map(([label, value]) => <div key={String(label)} className="p-4"><p className="font-mono text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>)}
      </div>
      <label className="mb-4 grid max-w-xs gap-2 text-sm font-medium">Situação do convite
        <NativeSelect value={rsvpFilter} onValueChange={(value) => setRsvpFilter((value ?? 'all') as typeof rsvpFilter)}>
          <NativeSelectOption value="all">Todas</NativeSelectOption>
          <NativeSelectOption value="pendente">Pendente</NativeSelectOption>
          <NativeSelectOption value="confirmado">Confirmado</NativeSelectOption>
          <NativeSelectOption value="recusado">Não irá</NativeSelectOption>
        </NativeSelect>
      </label>
      <section aria-label="Lista de convidados" className="space-y-3">
        {items.length ? (
          items.map(({ invitation, members, visibleMembers, status }) => {
              const counts = rsvpResponseCounts(members.map((member) => member.rsvp), invitation.companions.length);
              const statusLabel = { pendente: 'Pendente', parcial: 'Pendente', confirmado: 'Confirmado', recusado: 'Não irá' }[status];
              const statusTone = status === 'confirmado'
                ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                : status === 'recusado'
                  ? 'bg-muted text-foreground'
                  : status === 'parcial'
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                    : 'bg-muted text-muted-foreground';
              const familyName = members.find((member) => member.groupType !== 'individual')?.groupName.trim();
              const groupName = familyName || (members.length > 1 ? invitation.name : 'Sem família');
              return (
                <article key={invitation.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <header className="flex flex-col gap-3 border-b border-border bg-muted/35 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                        <UsersFour size={18} />
                      </span>
                      <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold">{groupName}</h3>
                        <Badge className={statusTone}>{statusLabel}</Badge>
                      </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>{members.length} {members.length === 1 ? 'pessoa' : 'pessoas'}</span>
                        <span>{counts.confirmed} confirmados · {counts.declined} não irá · {counts.pending} pendentes</span>
                        <span>{invitation.responsiblePhone || 'WhatsApp não informado'}</span>
                      </div>
                    </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => onShare(invitation)}>
                        <WhatsappLogo weight="fill" />
                        {familyName ? 'Enviar para a família' : 'Enviar convite'}
                      </Button>
                    </div>
                  </header>
                  <div role="table" aria-label={`Convidados em ${groupName}`}>
                    <div role="row" className="hidden grid-cols-[minmax(0,1fr)_9rem_10rem_3rem] gap-3 border-b border-border px-5 py-2 text-[11px] font-medium text-muted-foreground lg:grid">
                      <span role="columnheader">Pessoa</span>
                      <span role="columnheader">Papel</span>
                      <span role="columnheader">Confirmação</span>
                      <span role="columnheader" className="text-right">Ação</span>
                    </div>
                    <div className="divide-y divide-border">
                      {visibleMembers.map((member) => {
                        const roleLabel = member.role === 'padrinho'
                          ? 'Padrinho'
                          : member.role === 'madrinha'
                            ? 'Madrinha'
                            : 'Convidado';
                        const ageLabel = member.ageGroup.charAt(0).toLocaleUpperCase('pt-BR') + member.ageGroup.slice(1);
                        return (
                        <div key={member.id} role="row" className="grid gap-3 px-4 py-3.5 transition-colors hover:bg-muted/25 sm:px-5 lg:grid-cols-[minmax(0,1fr)_9rem_10rem_3rem] lg:items-center">
                          <div role="cell" className="min-w-0">
                            <p className="truncate text-sm font-medium">{member.fullName}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground lg:hidden">{roleLabel} · {ageLabel}</p>
                            <p className="mt-0.5 hidden text-xs text-muted-foreground lg:block">{ageLabel}</p>
                          </div>
                          <span role="cell" className="hidden text-sm lg:block">{roleLabel}</span>
                          <div role="cell">
                            <NativeSelect className="w-full lg:w-[148px]" size="sm" value={member.rsvp} onValueChange={(value) => onRsvp(member.id, value ?? member.rsvp)} aria-label={`Confirmação de ${member.fullName}`}>
                            {!['pendente', 'confirmado', 'não irá'].includes(member.rsvp) && <NativeSelectOption value={member.rsvp}>Pendente</NativeSelectOption>}
                            <NativeSelectOption value="pendente">Pendente</NativeSelectOption>
                            <NativeSelectOption value="confirmado">Confirmado</NativeSelectOption>
                            <NativeSelectOption value="não irá">Não irá</NativeSelectOption>
                          </NativeSelect>
                          </div>
                          <div role="cell" className="flex justify-end">
                            <Button type="button" variant="ghost" size="icon" aria-label={`Editar ${member.fullName}`} onClick={() => onEdit(member)}>
                              <PencilSimple />
                            </Button>
                          </div>
                        </div>
                        );
                      })}
                      {invitation.companions.map((companion) => (
                        <div key={companion.id} role="row" className="grid gap-3 px-4 py-3.5 sm:px-5 lg:grid-cols-[minmax(0,1fr)_9rem_10rem_3rem] lg:items-center">
                          <div role="cell" className="min-w-0">
                            <p className="truncate text-sm font-medium">{companion.name}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{companion.ageGroup}</p>
                          </div>
                          <span role="cell" className="hidden text-sm text-muted-foreground lg:block">Acompanhante</span>
                          <div role="cell"><Badge variant="secondary">Confirmado</Badge></div>
                          <span role="cell" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <footer className="border-t border-border px-4 pb-4 sm:px-5">
                    {invitation.lastResponseAt && <p className="mt-3 text-xs text-muted-foreground">Respondido em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(invitation.lastResponseAt))}</p>}
                    {invitation.rsvpNote && <p className="mt-3 rounded-xl bg-secondary/60 p-3 text-sm"><span className="font-medium">Observação:</span> {invitation.rsvpNote}</p>}
                    <InvitationHistory invitationId={invitation.id} />
                  </footer>
                </article>
              );
            })
        ) : (
          <div className="rounded-2xl border border-border bg-card p-5"><EmptyState icon={UserPlus} title="Nenhum convidado encontrado" description="Adicione pessoas à lista do casal e, quando fizer sentido, informe a família." action="Adicionar convidado" onAction={onAdd} /></div>
        )}
      </section>
    </>
  );
}

function Settings({ data, saving, onShare, onSave }: {
  data: WeddingSnapshot;
  saving: boolean;
  onShare: () => void;
  onSave: (payload: unknown) => void;
}) {
  const publicPath = `/casamento/${data.wedding.publicSlug}`;
  const [showVenue, setShowVenue] = useState(data.wedding.showVenueAfterRsvp);
  useEffect(() => setShowVenue(data.wedding.showVenueAfterRsvp), [data.wedding.showVenueAfterRsvp]);
  function submitSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave({
      rsvpDeadline: form.get('rsvpDeadline') || null,
      showVenueAfterRsvp: showVenue,
      venueName: form.get('venueName'),
      venueAddress: form.get('venueAddress'),
      venueMapsUrl: form.get('venueMapsUrl'),
    });
  }
  return (
    <>
      <PageHeading
        title="Configurações"
        subtitle="Links públicos e formas de compartilhar o casamento."
        icon={GearSix}
      />
      <section className="max-w-3xl rounded-2xl border border-border bg-card p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xl">
            <div className="flex items-center gap-2">
              <WhatsappLogo className="text-[#128c7e]" size={22} weight="fill" />
              <h2 className="font-semibold">Compartilhar site pelo WhatsApp</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Abra o WhatsApp com uma mensagem geral e deixe que vocês escolham o contato. Nenhum convite individual ou confirmação é associado a este link.</p>
            <a className="mt-3 inline-flex max-w-full items-center gap-2 truncate font-mono text-xs text-primary hover:underline" href={publicPath} target="_blank" rel="noreferrer">
              <LinkSimple size={15} />{publicPath}
            </a>
          </div>
          <Button type="button" className="h-10 shrink-0" onClick={onShare}>
            <WhatsappLogo weight="fill" />Compartilhar site
          </Button>
        </div>
        <div className="mt-6 border-t border-border pt-5">
          <p className="text-sm font-medium">Sobre o registro</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">O Vínculo registra apenas que o WhatsApp foi aberto. A plataforma nunca marca uma mensagem como enviada.</p>
        </div>
      </section>
      <form onSubmit={submitSettings} className="mt-5 max-w-3xl rounded-2xl border border-border bg-card p-5 sm:p-7">
        <div>
          <h2 className="font-semibold">Confirmação de presença</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Defina até quando convidados podem responder e quais dados de local aparecem após a confirmação.</p>
        </div>
        <div className="mt-6 grid gap-5">
          <label className="grid gap-2 text-sm font-medium">Data-limite<Input className="h-11" name="rsvpDeadline" type="date" defaultValue={data.wedding.rsvpDeadline ?? ''} /><span className="font-normal leading-5 text-muted-foreground">Sem uma data, o fluxo público permanece bloqueado.</span></label>
          <label className="flex min-h-11 items-center justify-between gap-4 rounded-xl border border-border px-4 py-3 text-sm font-medium"><span><span className="block">Exibir local após a confirmação</span><span className="mt-1 block font-normal text-muted-foreground">O local não aparece durante a identificação.</span></span><Switch checked={showVenue} onCheckedChange={setShowVenue} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">Nome do local<Input className="h-11" name="venueName" defaultValue={data.wedding.venueName} placeholder="Ex.: Casa do Bosque" /></label>
            <label className="grid gap-2 text-sm font-medium sm:col-span-2">Endereço<Input className="h-11" name="venueAddress" defaultValue={data.wedding.venueAddress} placeholder="Rua, número, bairro e cidade" /></label>
            <label className="grid gap-2 text-sm font-medium sm:col-span-2">Link do Google Maps<Input className="h-11" name="venueMapsUrl" type="url" defaultValue={data.wedding.venueMapsUrl} placeholder="https://maps.google.com/…" /></label>
          </div>
          <Button className="h-11 justify-self-start" disabled={saving}>{saving ? 'Salvando…' : 'Salvar configurações'}</Button>
        </div>
      </form>
    </>
  );
}

type HistoryItem = { id: string; subjectName: string | null; previousResponse: string | null; newResponse: string | null; source: string; note: string; createdAt: string; actorName: string | null };

function InvitationHistory({ invitationId }: { invitationId: string }) {
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  async function load() {
    if (history || loading) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/guest-invitations/${invitationId}/history`);
      const body = await response.json() as { history?: HistoryItem[] };
      setHistory(body.history ?? []);
    } finally { setLoading(false); }
  }
  return <details className="mt-4 border-t border-border pt-3" onToggle={(event) => { if (event.currentTarget.open) void load(); }}><summary className="cursor-pointer text-xs font-medium text-muted-foreground">Histórico de alterações</summary><div className="mt-3 space-y-3">{loading && <p className="text-xs text-muted-foreground">Carregando histórico…</p>}{history?.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma alteração registrada.</p>}{history?.map((item) => <div key={item.id} className="border-l-2 border-border pl-3 text-xs"><p className="font-medium">{item.subjectName ? `${item.subjectName}: ${item.previousResponse} → ${item.newResponse}` : 'Resposta enviada'}</p><p className="mt-1 text-muted-foreground">{item.source === 'admin' ? `Administração${item.actorName ? ` · ${item.actorName}` : ''}` : 'Convidado'} · {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.createdAt))}</p>{item.note && <p className="mt-1 text-muted-foreground">Observação: {item.note}</p>}</div>)}</div></details>;
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

function WeddingDateDialog({
  open,
  currentDate,
  saving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  currentDate: string;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (weddingDate: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState(currentDate);

  useEffect(() => {
    if (open) setValue(currentDate);
  }, [currentDate, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar dia do casamento</DialogTitle>
          <DialogDescription>
            A nova data atualiza os dias restantes e as metas mensais do planejamento.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (value) void onSubmit(value);
          }}
        >
          <label htmlFor="wedding-date" className="grid gap-2 text-sm font-medium">
            Data do casamento
            <Input
              id="wedding-date"
              name="weddingDate"
              type="date"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              required
              autoFocus
            />
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !value}>
              {saving ? 'Salvando...' : 'Salvar data'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddDialog({
  view,
  open,
  saving,
  data,
  editingGuest,
  onOpenChange,
  onSubmit,
}: {
  view: View;
  open: boolean;
  saving: boolean;
  data: WeddingSnapshot;
  editingGuest: Guest | null;
  onOpenChange: (value: boolean) => void;
  onSubmit: (action: ActionName, payload: unknown, success: string) => void;
}) {
  const [groupType, setGroupType] = useState(editingGuest?.groupType ?? 'individual');
  const kind = view === 'overview' || view === 'household' || view === 'gifts' || view === 'palette' || view === 'settings' ? 'checklist' : view;
  const titles = {
    finance: ['Novo pagamento', 'Registre um vencimento real.'],
    vendors: ['Novo fornecedor', 'Adicione uma proposta para comparar.'],
    guests: ['Novo convidado', 'Inclua uma pessoa na lista do casal.'],
    checklist: ['Nova tarefa', 'Defina responsabilidade, prioridade e prazo.'],
  } as const;
  const [title, description] = editingGuest && kind === 'guests'
    ? ['Editar convidado', 'Atualize os dados da pessoa e sua família.']
    : titles[kind as keyof typeof titles];
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
        editingGuest ? 'update_guest' : 'add_guest',
        {
          ...(editingGuest ? { id: editingGuest.id } : {}),
          fullName: form.get('fullName'),
          groupName: form.get('groupName'),
          groupType: form.get('groupType'),
          role: form.get('role'),
          ageGroup: form.get('ageGroup'),
          rsvp: form.get('rsvp'),
          linkUrl: form.get('linkUrl'),
        },
        editingGuest ? 'Convidado atualizado' : 'Convidado adicionado',
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
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[480px]">
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
                  defaultValue={editingGuest?.fullName}
                  placeholder="Nome e sobrenome"
                  className={baseInput}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  Papel no casamento
                  <NativeSelect name="role" className="w-full" defaultValue={editingGuest?.role ?? 'convidado'}>
                    <NativeSelectOption value="convidado">Convidado</NativeSelectOption>
                    <NativeSelectOption value="padrinho">Padrinho</NativeSelectOption>
                    <NativeSelectOption value="madrinha">Madrinha</NativeSelectOption>
                  </NativeSelect>
                </label>
                <label className={label}>
                  Tipo de convite
                  <NativeSelect name="groupType" className="w-full" value={groupType} onValueChange={(value) => setGroupType(value ?? 'individual')}>
                    <NativeSelectOption value="individual">Individual</NativeSelectOption>
                    <NativeSelectOption value="casal">Casal</NativeSelectOption>
                    <NativeSelectOption value="família">Família</NativeSelectOption>
                    <NativeSelectOption value="outro">Outro grupo</NativeSelectOption>
                  </NativeSelect>
                </label>
              </div>
              <label className={label}>
                Família ou grupo
                <Input
                  name="groupName"
                  required={groupType !== 'individual'}
                  defaultValue={editingGuest?.groupName}
                  placeholder={groupType === 'individual' ? 'Opcional' : 'Ex.: Família Ribeiro'}
                  className={baseInput}
                />
                <span className="text-xs font-normal text-muted-foreground">
                  Pessoas com o mesmo nome ficam juntas na lista e recebem o mesmo convite.
                </span>
              </label>
              <label className={label}>
                Faixa etária
                <NativeSelect name="ageGroup" className="w-full" defaultValue={editingGuest?.ageGroup ?? 'adulto'}>
                  <NativeSelectOption value="adulto">Adulto</NativeSelectOption>
                  <NativeSelectOption value="adolescente">Adolescente</NativeSelectOption>
                  <NativeSelectOption value="criança">Criança</NativeSelectOption>
                  <NativeSelectOption value="bebê">Bebê</NativeSelectOption>
                </NativeSelect>
              </label>
              <label className={label}>
                Confirmação de presença
                <NativeSelect name="rsvp" className="w-full" defaultValue={editingGuest?.rsvp ?? 'ainda não convidado'}>
                  <NativeSelectOption value="ainda não convidado">
                    Ainda não convidado
                  </NativeSelectOption>
                  <NativeSelectOption value="aguardando">
                    Aguardando
                  </NativeSelectOption>
                  <NativeSelectOption value="confirmado">
                    Confirmado
                  </NativeSelectOption>
                  <NativeSelectOption value="não irá">Não irá</NativeSelectOption>
                  <NativeSelectOption value="talvez">Talvez</NativeSelectOption>
                </NativeSelect>
              </label>
              <label className={label}>
                Convite, perfil ou outro link
                <Input name="linkUrl" type="url" defaultValue={editingGuest?.linkUrl} placeholder="https://" className={baseInput} />
              </label>
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
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="flex items-start gap-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-secondary text-primary">
          <Icon size={20} />
        </span>
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.035em]">
            {title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {action && onAction && (
        <Button onClick={onAction} className="self-start rounded-xl">
          <Plus size={16} />
          {action}
        </Button>
      )}
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
function RoleMetric({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card hover:border-primary/45 hover:bg-muted/60'
      }`}
    >
      <span className={`block text-xs ${active ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>
        {label}
      </span>
      <span className="mt-1 block font-mono text-2xl">{value}</span>
    </button>
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
