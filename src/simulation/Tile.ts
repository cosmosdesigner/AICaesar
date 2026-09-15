export type BuildingType = 'road' | 'house' | 'well';

export interface Tile {
  readonly x: number;
  readonly y: number;
  readonly terrain: 'grass';
  building?: BuildingType;
}
