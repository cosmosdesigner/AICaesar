import type { BuildingType, Tile } from './Tile';

export const MAP_WIDTH = 30;
export const MAP_HEIGHT = 30;
export const INITIAL_MONEY = 500;
export const BUILD_COSTS: Readonly<Record<BuildingType, number>> = {
  road: 4,
  house: 20,
  well: 35,
};

export interface Building {
  readonly id: string;
  readonly type: BuildingType;
  readonly x: number;
  readonly y: number;
}

export interface ResourceState {
  money: number;
}

export interface CityState {
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly Tile[];
  readonly buildings: Building[];
  readonly resources: ResourceState;
}

export function createCityState(): CityState {
  const tiles: Tile[] = [];

  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      tiles.push({ x, y, terrain: 'grass' });
    }
  }

  const city: CityState = {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    tiles,
    buildings: [],
    resources: { money: INITIAL_MONEY },
  };

  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const buildingType = getSeedBuildingType(x, y);
      if (buildingType) addBuilding(city, x, y, buildingType);
    }
  }

  return city;
}

export type BuildResult = 'built' | 'outside-map' | 'occupied' | 'insufficient-funds';

export function getTile(city: CityState, x: number, y: number): Tile | undefined {
  if (!Number.isInteger(x) || !Number.isInteger(y)
    || x < 0 || y < 0 || x >= city.width || y >= city.height) {
    return undefined;
  }

  return city.tiles[y * city.width + x];
}

export function getBuildingAt(city: CityState, x: number, y: number): Building | undefined {
  const buildingId = getTile(city, x, y)?.buildingId;
  if (buildingId === undefined) return undefined;
  return city.buildings.find((building) => building.id === buildingId);
}

export function placeBuilding(city: CityState, x: number, y: number, type: BuildingType): BuildResult {
  const tile = getTile(city, x, y);
  if (!tile) return 'outside-map';
  if (tile.buildingId !== undefined) return 'occupied';

  const cost = BUILD_COSTS[type];
  if (city.resources.money < cost) return 'insufficient-funds';

  addBuilding(city, x, y, type);
  city.resources.money -= cost;
  return 'built';
}

function getSeedBuildingType(x: number, y: number): BuildingType | undefined {
  if (y === 15 && x >= 7 && x <= 22) return 'road';
  if ((y === 14 || y === 16) && (x === 10 || x === 13 || x === 19)) return 'house';
  if (x === 16 && y === 14) return 'well';
  return undefined;
}

function addBuilding(city: CityState, x: number, y: number, type: BuildingType): void {
  const tile = getTile(city, x, y);
  if (!tile) return;

  const building: Building = { id: `${type}-${x}-${y}`, type, x, y };
  tile.buildingId = building.id;
  city.buildings.push(building);
}
