'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Category = { name: string; planned: string };

function cents(value: string): number { return Math.round(Number(value.replace(/\./g, '').replace(',', '.')) * 100) || 0; }
function field(form: FormData, name: string): string { const value = form.get(name); return typeof value === 'string' ? value : ''; }

export function OnboardingForm() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(form: FormData) {
    setPending(true); setError('');
    const categoryNames = form.getAll('categoryName').map(String);
    const categoryValues = form.getAll('categoryPlanned').map(String);
    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          personOne: form.get('personOne'), personTwo: form.get('personTwo'), weddingDate: form.get('weddingDate'), city: form.get('city'),
          budgetCents: cents(field(form, 'budget')), savedCents: cents(field(form, 'saved')),
          monthlyCapacityCents: cents(field(form, 'monthlyCapacity')), reservePercent: Number(field(form, 'reservePercent') || 10),
          guestEstimate: Number(field(form, 'guestEstimate') || 0),
          categories: categoryNames.map((name, index) => ({ name, plannedCents: cents(categoryValues[index] ?? '') })).filter((item) => item.name.trim()),
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) { setError(body.error ?? 'Revise os dados informados.'); return; }
      window.location.assign('/');
    } catch { setError('Não foi possível salvar o casamento.'); } finally { setPending(false); }
  }

  return (
    <form action={submit} className="space-y-6">
      <Card><CardHeader><CardTitle>Dados do casamento</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="personOne">Pessoa 1</Label><Input id="personOne" name="personOne" required /></div>
        <div className="space-y-2"><Label htmlFor="personTwo">Pessoa 2</Label><Input id="personTwo" name="personTwo" required /></div>
        <div className="space-y-2"><Label htmlFor="weddingDate">Data</Label><Input id="weddingDate" name="weddingDate" type="date" required /></div>
        <div className="space-y-2"><Label htmlFor="city">Cidade</Label><Input id="city" name="city" /></div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Planejamento inicial</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="budget">Orçamento total</Label><Input id="budget" name="budget" inputMode="decimal" placeholder="0,00" /></div>
        <div className="space-y-2"><Label htmlFor="saved">Valor já guardado</Label><Input id="saved" name="saved" inputMode="decimal" placeholder="0,00" /></div>
        <div className="space-y-2"><Label htmlFor="monthlyCapacity">Capacidade mensal</Label><Input id="monthlyCapacity" name="monthlyCapacity" inputMode="decimal" placeholder="0,00" /></div>
        <div className="space-y-2"><Label htmlFor="reservePercent">Reserva (%)</Label><Input id="reservePercent" name="reservePercent" type="number" min="0" max="100" defaultValue="10" /></div>
        <div className="space-y-2"><Label htmlFor="guestEstimate">Estimativa de convidados</Label><Input id="guestEstimate" name="guestEstimate" type="number" min="0" max="10000" defaultValue="0" /></div>
      </CardContent></Card>
      <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>Categorias de orçamento (opcional)</CardTitle><Button type="button" variant="outline" onClick={() => setCategories((items) => [...items, { name: '', planned: '' }])}>Adicionar categoria</Button></CardHeader><CardContent className="space-y-3">
        {categories.length === 0 && <p className="text-sm text-muted-foreground">Você pode começar sem categorias e adicioná-las quando precisar.</p>}
        {categories.map((category, index) => <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]" key={index}><Input name="categoryName" placeholder="Nome da categoria" defaultValue={category.name} required /><Input name="categoryPlanned" inputMode="decimal" placeholder="Planejado" defaultValue={category.planned} /><Button type="button" variant="ghost" onClick={() => setCategories((items) => items.filter((_, itemIndex) => itemIndex !== index))}>Remover</Button></div>)}
      </CardContent></Card>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>{pending ? 'Salvando…' : 'Criar meu espaço'}</Button>
    </form>
  );
}
