export type BuildingType = 'road' | 'house' | 'well' | 'farm' | 'granary' | 'market' | 'garden' | 'plaza' | 'fountain';

export interface Tile {
  readonly x: number;
  readonly y: number;
  readonly terrain: 'grass';
  buildingId?: string;
}
