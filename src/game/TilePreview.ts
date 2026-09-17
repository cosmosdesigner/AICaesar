import { getBuildingAt, getTile, type CityState } from '../simulation/CityState';
import type { BuildingType } from '../simulation/Tile';

export type PreviewOperation = 'build' | 'demolish';

export interface TilePreview {
  readonly x: number;
  readonly y: number;
  readonly state: 'free' | 'occupied';
  readonly buildingType?: BuildingType;
}

export function getTilePreview(
  city: CityState,
  tile: { readonly x: number; readonly y: number } | null,
): TilePreview | null {
  if (tile === null) return null;
  const cityTile = getTile(city, tile.x, tile.y);
  if (cityTile === undefined) return null;
  if (cityTile.buildingId === undefined) return { x: tile.x, y: tile.y, state: 'free' };

  const buildingType = getBuildingAt(city, tile.x, tile.y)?.type;
  return buildingType === undefined
    ? { x: tile.x, y: tile.y, state: 'occupied' }
    : { x: tile.x, y: tile.y, state: 'occupied', buildingType };
}

export function describeTilePreview(preview: TilePreview | null, operation: PreviewOperation): string {
  if (preview === null) return 'Tile: fora do mapa.';
  const operationLabel = operation === 'build' ? 'construir' : 'demolir';
  if (preview.state === 'free') return `Tile (${preview.x}, ${preview.y}): livre — ${operationLabel}.`;
  return `Tile (${preview.x}, ${preview.y}): ocupado por ${preview.buildingType === undefined ? 'edifício' : preview.buildingType[0]!.toUpperCase() + preview.buildingType.slice(1)} — ${operationLabel}.`;
}
