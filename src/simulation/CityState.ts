import { getHouseSpecification } from './HouseSpecification';
import type { BuildingType, Tile } from './Tile';

export const MAP_WIDTH = 30;
export const MAP_HEIGHT = 30;
export const INITIAL_MONEY = 500;
export const BUILD_COSTS: Readonly<Record<BuildingType, number>> = {
  road: 4,
  house: 20,
  well: 35,
  farm: 45,
  granary: 60,
  market: 50,
};

export interface Building {
  readonly id: string;
  readonly type: BuildingType;
  readonly x: number;
  readonly y: number;
  level?: number;
  hasRoadAccess?: boolean;
  hasWater?: boolean;
  hasFood?: boolean;
  upgradeProgress?: number;
  degradeProgress?: number;
  storedFood?: number;
  active?: boolean;
  population?: number;
}

export interface ResourceState {
  money: number;
}

export interface FinanceState {
  period: number;
  lastRevenue: number;
  lastUpkeep: number;
  lastNet: number;
}

export interface PopulationState {
  lastChange: number;
}

export interface SimulationState {
  tick: number;
  finance: FinanceState;
  population: PopulationState;
}

export interface CityState {
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly Tile[];
  readonly buildings: Building[];
  readonly resources: ResourceState;
  readonly simulation: SimulationState;
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
    simulation: { tick: 0, finance: { period: 0, lastRevenue: 0, lastUpkeep: 0, lastNet: 0 }, population: { lastChange: 0 } },
  };

  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const buildingType = getSeedBuildingType(x, y);
      if (buildingType) {
        const population = buildingType === 'house' ? getHouseSpecification(1).populationCapacity : undefined;
        addBuilding(city, x, y, buildingType, population);
      }
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
  if (y === 15 && x >= 5 && x <= 24) return 'road';
  if ((y === 14 || y === 16) && (x === 8 || x === 10 || x === 12 || x === 14)) return 'house';
  if (x === 16 && y === 14) return 'well';
  if (x === 18 && y === 16) return 'farm';
  if (x === 20 && y === 14) return 'granary';
  if (x === 22 && y === 16) return 'market';
  return undefined;
}

function addBuilding(city: CityState, x: number, y: number, type: BuildingType, initialPopulation?: number): void {
  const tile = getTile(city, x, y);
  if (!tile) return;

  const building: Building = type === 'house'
    ? {
        id: `${type}-${x}-${y}`,
        type,
        x,
        y,
        level: 1,
        hasRoadAccess: false,
        hasWater: false,
        hasFood: false,
        upgradeProgress: 0,
        degradeProgress: 0,
        population: initialPopulation ?? 0,
      }
    : {
        id: `${type}-${x}-${y}`,
        type,
        x,
        y,
        ...(type === 'farm' || type === 'granary' || type === 'market' ? { active: false } : {}),
        ...(type === 'granary' || type === 'market' ? { storedFood: 0 } : {}),
      };
  tile.buildingId = building.id;
  city.buildings.push(building);
}
