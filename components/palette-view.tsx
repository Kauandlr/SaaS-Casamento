'use client';

import { useEffect, useState } from 'react';
import { Check, Palette, Plus, Trash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import type { WeddingPalette, WeddingSnapshot } from '@/lib/wedding-types';

const starterColors: WeddingPalette['colors'] = [
  { name: 'Verde oliva', hex: '#6B7558' },
  { name: 'Areia', hex: '#D8C8AE' },
  { name: 'Rosa antigo', hex: '#C7958D' },
  { name: 'Marfim', hex: '#F5F0E6' },
];

const validHex = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);

export function PaletteView({
  data,
  onAction,
}: {
  data: WeddingSnapshot;
  onAction: (action: 'save_wedding_palette', payload: WeddingPalette) => Promise<WeddingSnapshot>;
}) {
  const [name, setName] = useState(data.wedding.palette?.name ?? 'Nossa paleta');
  const [colors, setColors] = useState<WeddingPalette['colors']>(
    data.wedding.palette?.colors ?? starterColors,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(data.wedding.palette?.name ?? 'Nossa paleta');
    setColors(data.wedding.palette?.colors ?? starterColors);
  }, [data.wedding.palette]);

  const updateColor = (index: number, field: 'name' | 'hex', value: string) => {
    setColors((current) => current.map((color, position) =>
      position === index ? { ...color, [field]: value } : color,
    ));
  };

  const valid = name.trim().length >= 2 && colors.length >= 2 &&
    colors.every((color) => color.name.trim().length >= 2 && validHex(color.hex));
  const changed = JSON.stringify({ name, colors }) !== JSON.stringify(data.wedding.palette);

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onAction('save_wedding_palette', {
        name: name.trim(),
        colors: colors.map((color) => ({ name: color.name.trim(), hex: color.hex.toUpperCase() })),
      });
      toast.add({ title: 'Paleta salva', description: 'As cores do casamento foram atualizadas.', type: 'success' });
    } catch (error) {
      toast.add({
        title: 'Não foi possível salvar a paleta',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex items-start gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-secondary text-primary">
            <Palette size={20} />
          </span>
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.035em]">Paleta do casamento</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Reúna as cores que vão orientar os detalhes da celebração.
            </p>
          </div>
        </div>
        <Button onClick={save} disabled={!valid || !changed || saving} className="self-start sm:self-auto">
          <Check size={17} />
          {saving ? 'Salvando...' : data.wedding.palette ? 'Salvar alterações' : 'Criar paleta'}
        </Button>
      </div>

      <section className="overflow-hidden rounded-[28px] border border-border bg-card">
        <div className="grid min-h-52 grid-cols-2 sm:grid-cols-4">
          {colors.map((color, index) => (
            <div
              key={index}
              className="min-h-28 transition-colors duration-200"
              style={{ backgroundColor: validHex(color.hex) ? color.hex : 'var(--muted)' }}
              aria-label={`${color.name || 'Cor sem nome'}: ${color.hex}`}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 sm:px-7">
          <div>
            <p className="text-lg font-semibold">{name || 'Nossa paleta'}</p>
            <p className="text-sm text-muted-foreground">
              {colors.length} cores · Prévia da combinação
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {data.wedding.palette ? 'Paleta criada' : 'Rascunho ainda não salvo'}
          </span>
        </div>
      </section>

      <section className="space-y-5">
        <div className="max-w-md">
          <label htmlFor="palette-name" className="mb-2 block text-sm font-medium">Nome da paleta</label>
          <Input
            id="palette-name"
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Jardim ao entardecer"
            className="h-10 bg-card"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Cores</h2>
            <p className="text-sm text-muted-foreground">Escolha de 2 a 8 cores para a sua paleta.</p>
          </div>
          <Button
            variant="outline"
            disabled={colors.length >= 8}
            onClick={() => setColors((current) => [...current, { name: `Cor ${current.length + 1}`, hex: '#C8B8A4' }])}
          >
            <Plus size={16} /> Adicionar cor
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {colors.map((color, index) => (
            <div key={index} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 sm:p-4">
              <input
                type="color"
                value={validHex(color.hex) ? color.hex : '#C8B8A4'}
                onChange={(event) => updateColor(index, 'hex', event.target.value)}
                aria-label={`Selecionar cor ${index + 1}`}
                className="h-12 w-12 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent p-1"
              />
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_6.5rem]">
                <label className="min-w-0 text-xs font-medium text-muted-foreground">
                  Nome
                  <Input
                    value={color.name}
                    maxLength={40}
                    onChange={(event) => updateColor(index, 'name', event.target.value)}
                    aria-label={`Nome da cor ${index + 1}`}
                    className="mt-1 bg-background text-foreground"
                  />
                </label>
                <label className="min-w-0 text-xs font-medium text-muted-foreground">
                  Hexadecimal
                  <Input
                    value={color.hex}
                    maxLength={7}
                    onChange={(event) => updateColor(index, 'hex', event.target.value)}
                    aria-label={`Código hexadecimal da cor ${index + 1}`}
                    aria-invalid={!validHex(color.hex)}
                    className="mt-1 bg-background font-mono text-foreground uppercase"
                  />
                </label>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remover ${color.name || `cor ${index + 1}`}`}
                disabled={colors.length <= 2}
                onClick={() => setColors((current) => current.filter((_, position) => position !== index))}
                className="shrink-0 self-start text-muted-foreground hover:text-destructive"
              >
                <Trash size={17} />
              </Button>
            </div>
          ))}
        </div>
        {!valid && (
          <p className="text-sm text-destructive" role="status">
            Informe um nome e códigos hexadecimais válidos para todas as cores.
          </p>
        )}
      </section>
    </div>
  );
}
