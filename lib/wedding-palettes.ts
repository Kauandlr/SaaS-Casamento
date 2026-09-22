import type { WeddingPalette } from './wedding-types';

// Earlier workspaces stored one palette object in this JSONB column.
export function readWeddingPalettes(value: unknown): WeddingPalette[] {
  if (Array.isArray(value)) return value as WeddingPalette[];
  if (value && typeof value === 'object' && 'name' in value && 'colors' in value) {
    const palette = value as Omit<WeddingPalette, 'id'>;
    return [{ id: 'legacy', name: palette.name, colors: palette.colors }];
  }
  return [];
}
