import { FOUNDING_SETTLEMENT_SCENARIO, type ScenarioDefinition } from '../scenario/Scenario';
import type { BuildingType, Tile } from './Tile';
import { clearBuildingEventTarget, createEventState, type EventState } from '../events/Events';

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
  garden: 12,
  plaza: 25,
  fountain: 40,
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
  events?: EventState;
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
  return createCityStateForScenario(FOUNDING_SETTLEMENT_SCENARIO);
}

export function createCityStateForScenario(definition: ScenarioDefinition): CityState {
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
    resources: { money: definition.initialMoney },
    simulation: {
      tick: 0,
      finance: { period: 0, lastRevenue: 0, lastUpkeep: 0, lastNet: 0 },
      population: { lastChange: 0 },
      events: createEventState(),
    },
  };

  for (const seedBuilding of definition.seed.buildings) {
    addBuilding(city, seedBuilding.x, seedBuilding.y, seedBuilding.type, seedBuilding.initialPopulation);
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

export type DemolishResult = 'demolished' | 'outside-map' | 'empty' | 'inconsistent-state';

export function demolishBuilding(city: CityState, x: number, y: number): DemolishResult {
  const tile = getTile(city, x, y);
  if (!tile) return 'outside-map';
  if (tile.buildingId === undefined) return 'empty';

  let buildingIndex = -1;
  for (let index = 0; index < city.buildings.length; index += 1) {
    if (city.buildings[index]?.id !== tile.buildingId) continue;
    if (buildingIndex !== -1) return 'inconsistent-state';
    buildingIndex = index;
  }
  const building = city.buildings[buildingIndex];
  if (
    building === undefined
    || building.x !== tile.x
    || building.y !== tile.y
  ) {
    return 'inconsistent-state';
  }

  delete tile.buildingId;
  city.buildings.splice(buildingIndex, 1);
  clearBuildingEventTarget(city, building.id);
  return 'demolished';
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
