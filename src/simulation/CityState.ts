import type { BuildingType, Tile } from './Tile';

export const MAP_WIDTH = 30;
export const MAP_HEIGHT = 30;

export interface CityState {
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly Tile[];
}

export function createCityState(): CityState {
  const tiles: Tile[] = [];

  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      let building: BuildingType | undefined;
      if (y === 15 && x >= 7 && x <= 22) {
        building = 'road';
      } else if ((y === 14 || y === 16) && (x === 10 || x === 13 || x === 19)) {
        building = 'house';
      } else if (x === 16 && y === 14) {
        building = 'well';
      }

      tiles.push({ x, y, terrain: 'grass', ...(building ? { building } : {}) });
    }
  }

  return { width: MAP_WIDTH, height: MAP_HEIGHT, tiles };
}
