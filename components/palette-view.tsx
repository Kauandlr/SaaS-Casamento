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
  onAction: (action: 'save_wedding_palettes', payload: WeddingPalette[]) => Promise<WeddingSnapshot>;
}) {
  const [palettes, setPalettes] = useState<WeddingPalette[]>(data.wedding.palettes);
  const [selectedId, setSelectedId] = useState<string | null>(data.wedding.palettes[0]?.id ?? null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPalettes(data.wedding.palettes);
    setSelectedId((current) =>
      data.wedding.palettes.some((palette) => palette.id === current)
        ? current
        : data.wedding.palettes[0]?.id ?? null,
    );
  }, [data.wedding.palettes]);

  const selected = palettes.find((palette) => palette.id === selectedId);
  const changed = JSON.stringify(palettes) !== JSON.stringify(data.wedding.palettes);
  const valid = palettes.every((palette) =>
    palette.name.trim().length >= 2 &&
    palette.colors.length >= 2 && palette.colors.length <= 8 &&
    palette.colors.every((color) => color.name.trim().length >= 2 && validHex(color.hex)),
  );

  const updateSelected = (update: (palette: WeddingPalette) => WeddingPalette) => {
    setPalettes((current) => current.map((palette) =>
      palette.id === selectedId ? update(palette) : palette,
    ));
  };

  const updateColor = (index: number, field: 'name' | 'hex', value: string) => {
    updateSelected((palette) => ({
      ...palette,
      colors: palette.colors.map((color, position) =>
        position === index ? { ...color, [field]: value } : color,
      ),
    }));
  };

  const addPalette = () => {
    if (palettes.length >= 20) return;
    const palette: WeddingPalette = {
      id: crypto.randomUUID(),
      name: 'Nova paleta',
      colors: starterColors.map((color) => ({ ...color })),
    };
    setPalettes((current) => [...current, palette]);
    setSelectedId(palette.id);
  };

  const removePalette = (id: string) => {
    const remaining = palettes.filter((palette) => palette.id !== id);
    setPalettes(remaining);
    if (selectedId === id) setSelectedId(remaining[0]?.id ?? null);
  };

  const save = async () => {
    if (!valid || !changed || saving) return;
    setSaving(true);
    try {
      await onAction('save_wedding_palettes', palettes.map((palette) => ({
        id: palette.id,
        name: palette.name.trim(),
        colors: palette.colors.map((color) => ({
          name: color.name.trim(),
          hex: color.hex.toUpperCase(),
        })),
      })));
      toast.add({ title: 'Paletas salvas', description: 'As cores do casamento foram atualizadas.', type: 'success' });
    } catch (error) {
      toast.add({
        title: 'Não foi possível salvar as paletas',
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
            <h1 className="text-3xl font-semibold tracking-[-0.035em]">Paletas do casamento</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie opções de cores para os detalhes da celebração.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={addPalette} disabled={saving || palettes.length >= 20}>
            <Plus size={17} /> Nova paleta
          </Button>
          <Button onClick={save} disabled={!valid || !changed || saving}>
            <Check size={17} /> {saving ? 'Salvando...' : 'Salvar paletas'}
          </Button>
        </div>
      </div>

      {palettes.length > 0 ? (
        <section aria-label="Paletas criadas" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {palettes.map((palette) => (
            <div
              key={palette.id}
              className={`overflow-hidden rounded-2xl border bg-card ${selectedId === palette.id ? 'border-primary ring-1 ring-primary' : 'border-border'}`}
            >
              <button
                type="button"
                onClick={() => setSelectedId(palette.id)}
                disabled={saving}
                aria-pressed={selectedId === palette.id}
                className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex h-14">
                  {palette.colors.map((color, index) => (
                    <span
                      key={index}
                      className="flex-1"
                      style={{ backgroundColor: validHex(color.hex) ? color.hex : 'var(--muted)' }}
                    />
                  ))}
                </span>
                <span className="block truncate px-4 pt-3 font-medium">{palette.name || 'Paleta sem nome'}</span>
              </button>
              <div className="flex items-center justify-between px-4 pb-3 pt-1">
                <span className="text-xs text-muted-foreground">{palette.colors.length} cores</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removePalette(palette.id)}
                  disabled={saving}
                  aria-label={`Remover paleta ${palette.name || 'sem nome'}`}
                  className="size-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash size={16} />
                </Button>
              </div>
            </div>
          ))}
        </section>
      ) : (
        <div className="rounded-[28px] border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="font-medium">Nenhuma paleta criada</p>
          <p className="mt-1 text-sm text-muted-foreground">Use “Nova paleta” para começar.</p>
        </div>
      )}

      {changed && (
        <p className="text-sm text-muted-foreground" role="status">
          Você tem alterações não salvas. Use “Salvar paletas” para confirmá-las.
        </p>
      )}

      {selected && (
        <fieldset disabled={saving} className="space-y-6 disabled:opacity-70">
          <section className="overflow-hidden rounded-[28px] border border-border bg-card">
            <div className="grid min-h-52 grid-cols-2 sm:grid-cols-4">
              {selected.colors.map((color, index) => (
                <div
                  key={index}
                  className="min-h-28 transition-colors duration-200"
                  style={{ backgroundColor: validHex(color.hex) ? color.hex : 'var(--muted)' }}
                  aria-label={`${color.name || 'Cor sem nome'}: ${color.hex}`}
                />
              ))}
            </div>
            <div className="px-5 py-4 sm:px-7">
              <p className="text-lg font-semibold">{selected.name || 'Paleta sem nome'}</p>
              <p className="text-sm text-muted-foreground">Prévia da combinação</p>
            </div>
          </section>

          <section className="space-y-5">
            <div className="max-w-md">
              <label htmlFor="palette-name" className="mb-2 block text-sm font-medium">Nome da paleta</label>
              <Input
                id="palette-name"
                value={selected.name}
                maxLength={80}
                onChange={(event) => updateSelected((palette) => ({ ...palette, name: event.target.value }))}
                placeholder="Ex.: Jardim ao entardecer"
                className="h-10 bg-card"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Cores</h2>
                <p className="text-sm text-muted-foreground">Escolha de 2 a 8 cores para esta paleta.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={selected.colors.length >= 8}
                onClick={() => updateSelected((palette) => ({
                  ...palette,
                  colors: [...palette.colors, { name: `Cor ${palette.colors.length + 1}`, hex: '#C8B8A4' }],
                }))}
              >
                <Plus size={16} /> Adicionar cor
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {selected.colors.map((color, index) => (
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
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover ${color.name || `cor ${index + 1}`}`}
                    disabled={selected.colors.length <= 2}
                    onClick={() => updateSelected((palette) => ({
                      ...palette,
                      colors: palette.colors.filter((_, position) => position !== index),
                    }))}
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
        </fieldset>
      )}
    </div>
  );
}
