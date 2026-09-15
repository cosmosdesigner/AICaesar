export type BuildingType = 'road' | 'house' | 'well' | 'farm' | 'granary' | 'market';

export interface Tile {
  readonly x: number;
  readonly y: number;
  readonly terrain: 'grass';
  buildingId?: string;
}
