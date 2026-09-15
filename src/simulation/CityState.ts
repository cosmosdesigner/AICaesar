import type { BuildingType, Tile } from './Tile';

export const MAP_WIDTH = 30;
export const MAP_HEIGHT = 30;
export const INITIAL_MONEY = 500;
export const BUILD_COSTS: Readonly<Record<BuildingType, number>> = {
  road: 4,
  house: 20,
  well: 35,
};

export interface CityState {
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly Tile[];
  money: number;
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

  return { width: MAP_WIDTH, height: MAP_HEIGHT, tiles, money: INITIAL_MONEY };
}

export type BuildResult = 'built' | 'outside-map' | 'occupied' | 'insufficient-funds';

export function build(city: CityState, x: number, y: number, tool: BuildingType): BuildResult {
  if (!Number.isInteger(x) || !Number.isInteger(y)
    || x < 0 || y < 0 || x >= city.width || y >= city.height) {
    return 'outside-map';
  }

  const tile = city.tiles[y * city.width + x];
  if (!tile) return 'outside-map';
  if (tile.building !== undefined) return 'occupied';

  const cost = BUILD_COSTS[tool];
  if (city.money < cost) return 'insufficient-funds';

  tile.building = tool;
  city.money -= cost;
  return 'built';
}
