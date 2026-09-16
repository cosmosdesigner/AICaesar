import { getBuildingAt, getTile, type Building, type CityState } from './CityState';
import type { BuildingType } from './Tile';

export const WATER_RADIUS = 3;
export const MARKET_FOOD_RADIUS = 4;
export const FARM_FOOD_PER_TICK = 2;
export const GRANARY_CAPACITY = 100;
export const HOUSE_LEVEL_2_TICKS = 3;
export const HOUSE_LEVEL_3_TICKS = 5;
export const HOUSE_FOOD_CONSUMPTION_INTERVAL = 2;

type WorkplaceType = 'farm' | 'granary' | 'market';
type WorkplaceBuilding = Building & { readonly type: WorkplaceType };

export const HOUSE_POPULATION_BY_LEVEL: Readonly<Record<1 | 2 | 3, number>> = {
  1: 4,
  2: 8,
  3: 14,
};
export const FINANCE_INTERVAL_TICKS = 10;
export const HOUSE_TAX_BY_LEVEL: Readonly<Record<1 | 2 | 3, number>> = {
  1: 2,
  2: 4,
  3: 7,
};
export const BUILDING_UPKEEP: Readonly<Partial<Record<BuildingType, number>>> = {
  well: 1,
  farm: 3,
  granary: 3,
  market: 3,
};
export const WORKFORCE_RATIO = 0.5;
export const WORKERS_REQUIRED: Readonly<Record<WorkplaceType, number>> = {
  farm: 6,
  granary: 4,
  market: 5,
};
const WORKPLACE_PRIORITY: Readonly<Record<WorkplaceType, number>> = {
  granary: 0,
  farm: 1,
  market: 2,
};

export interface HousingStats {
  readonly totalHouses: number;
  readonly housesWithRoadAccess: number;
  readonly housesWithWater: number;
  readonly housesWithFood: number;
  readonly levelTwoHouses: number;
  readonly levelThreeHouses: number;
  readonly waterCoveredTiles: number;
}

export interface FoodStats {
  readonly farms: number;
  readonly granaries: number;
  readonly markets: number;
  readonly foodStored: number;
  readonly foodCapacity: number;
  readonly housesWithFood: number;
  readonly foodCoveredTiles: number;
}

export interface WorkforceStats {
  readonly population: number;
  readonly workersAvailable: number;
  readonly workersRequired: number;
  readonly workersAssigned: number;
  readonly unemployedWorkers: number;
  readonly workerShortage: number;
  readonly activeWorkplaces: number;
  readonly inactiveWorkplaces: number;
}
export interface FinanceStats {
  readonly period: number;
  readonly revenue: number;
  readonly upkeep: number;
  readonly net: number;
  readonly money: number;
  readonly ticksUntilNextPeriod: number;
}


export function simulateTick(city: CityState): void {
  city.simulation.tick += 1;
  assignWorkers(city);
  produceFood(city);

  const waterCoverage = getWaterCoveredTiles(city);
  const foodCoverage = getFoodCoveredTiles(city);
  const shouldConsumeFood = city.simulation.tick % HOUSE_FOOD_CONSUMPTION_INTERVAL === 0;
  let availableFood = city.resources.food;

  const houses = city.buildings
    .filter((building) => building.type === 'house')
    .sort((a, b) => a.y - b.y || a.x - b.x);

  for (const building of houses) {
    building.hasRoadAccess = hasAdjacentRoad(city, building);
    building.hasWater = waterCoverage.has(getTileKey(building.x, building.y));

    const isFoodCovered = foodCoverage.has(getTileKey(building.x, building.y));
    if (isFoodCovered && availableFood > 0) {
      building.hasFood = true;
      if (shouldConsumeFood) availableFood -= 1;
    } else {
      building.hasFood = false;
    }

    updateHouseLevel(building);
  }

  if (shouldConsumeFood) city.resources.food = availableFood;
  assignWorkers(city);
  if (city.simulation.tick % FINANCE_INTERVAL_TICKS === 0) applyFinancePeriod(city);
}

export function getHouseTax(city: CityState): number {
  return city.buildings.reduce((total, building) => {
    if (building.type !== 'house') return total;
    return total + HOUSE_TAX_BY_LEVEL[getHouseLevel(building)];
  }, 0);
}

export function getBuildingUpkeep(city: CityState): number {
  return city.buildings.reduce((total, building) => total + (BUILDING_UPKEEP[building.type] ?? 0), 0);
}

export function getFinanceStats(city: CityState): FinanceStats {
  const finance = city.simulation.finance;
  return {
    period: finance.period,
    revenue: finance.lastRevenue,
    upkeep: finance.lastUpkeep,
    net: finance.lastNet,
    money: city.resources.money,
    ticksUntilNextPeriod: getTicksUntilNextFinancePeriod(city.simulation.tick),
  };
}

export function applyFinancePeriod(city: CityState): FinanceStats {
  const revenue = getHouseTax(city);
  const upkeep = getBuildingUpkeep(city);
  const net = revenue - upkeep;
  city.resources.money += net;
  city.simulation.finance.period += 1;
  city.simulation.finance.lastRevenue = revenue;
  city.simulation.finance.lastUpkeep = upkeep;
  city.simulation.finance.lastNet = net;
  return getFinanceStats(city);
}

export function hasAdjacentRoad(city: CityState, building: Building): boolean {
  return getBuildingAt(city, building.x, building.y - 1)?.type === 'road'
    || getBuildingAt(city, building.x + 1, building.y)?.type === 'road'
    || getBuildingAt(city, building.x, building.y + 1)?.type === 'road'
    || getBuildingAt(city, building.x - 1, building.y)?.type === 'road';
}

export function hasWaterAccess(city: CityState, building: Building): boolean {
  return getWaterCoverage(city).has(getTileKey(building.x, building.y));
}

export function getWaterCoveredTiles(city: CityState): Set<string> {
  return getWaterCoverage(city);
}

export function getFoodCoveredTiles(city: CityState): Set<string> {
  return getRadiusCoverage(city, 'market', MARKET_FOOD_RADIUS, true);
}

export function getFoodCapacity(city: CityState): number {
  return countActiveBuildings(city, 'granary') * GRANARY_CAPACITY;
}

export function assignWorkers(city: CityState): void {
  let remainingWorkers = Math.floor(getPopulation(city) * WORKFORCE_RATIO);
  const workplaces = getSortedWorkplaces(city);

  for (const workplace of workplaces) {
    const workersRequired = getWorkersRequired(workplace.type);
    if (remainingWorkers >= workersRequired) {
      workplace.active = true;
      remainingWorkers -= workersRequired;
    } else {
      workplace.active = false;
    }
  }
}

export function getPopulation(city: CityState): number {
  return city.buildings.reduce((population, building) => {
    if (building.type !== 'house') return population;
    const level = Math.min(Math.max(building.level ?? 1, 1), 3) as 1 | 2 | 3;
    return population + HOUSE_POPULATION_BY_LEVEL[level];
  }, 0);
}

export function getWorkforceStats(city: CityState): WorkforceStats {
  const population = getPopulation(city);
  const workersAvailable = Math.floor(population * WORKFORCE_RATIO);
  let remainingWorkers = workersAvailable;
  let workersRequired = 0;
  let workersAssigned = 0;
  let activeWorkplaces = 0;
  let inactiveWorkplaces = 0;

  for (const workplace of getSortedWorkplaces(city)) {
    const required = getWorkersRequired(workplace.type);
    workersRequired += required;
    if (remainingWorkers >= required) {
      remainingWorkers -= required;
      workersAssigned += required;
      activeWorkplaces += 1;
    } else {
      inactiveWorkplaces += 1;
    }
  }

  return {
    population,
    workersAvailable,
    workersRequired,
    workersAssigned,
    unemployedWorkers: Math.max(0, workersAvailable - workersAssigned),
    workerShortage: Math.max(0, workersRequired - workersAvailable),
    activeWorkplaces,
    inactiveWorkplaces,
  };
}

export function isWorkplace(type: BuildingType): type is WorkplaceType {
  return type === 'farm' || type === 'granary' || type === 'market';
}

export function getWorkersRequired(type: BuildingType): number {
  return isWorkplace(type) ? WORKERS_REQUIRED[type] : 0;
}

export function getHousingStats(city: CityState): HousingStats {
  const waterCoverage = getWaterCoverage(city);
  let totalHouses = 0;
  let housesWithRoadAccess = 0;
  let housesWithWater = 0;
  let housesWithFood = 0;
  let levelTwoHouses = 0;
  let levelThreeHouses = 0;

  for (const building of city.buildings) {
    if (building.type !== 'house') continue;

    totalHouses += 1;
    if (hasAdjacentRoad(city, building)) housesWithRoadAccess += 1;
    if (waterCoverage.has(getTileKey(building.x, building.y))) housesWithWater += 1;
    if (building.hasFood === true) housesWithFood += 1;
    if ((building.level ?? 1) >= 2) levelTwoHouses += 1;
    if ((building.level ?? 1) >= 3) levelThreeHouses += 1;
  }

  return {
    totalHouses,
    housesWithRoadAccess,
    housesWithWater,
    housesWithFood,
    levelTwoHouses,
    levelThreeHouses,
    waterCoveredTiles: waterCoverage.size,
  };
}

export function getFoodStats(city: CityState): FoodStats {
  const housingStats = getHousingStats(city);
  const foodCoverage = getFoodCoveredTiles(city);

  return {
    farms: countBuildings(city, 'farm'),
    granaries: countBuildings(city, 'granary'),
    markets: countBuildings(city, 'market'),
    foodStored: city.resources.food,
    foodCapacity: getFoodCapacity(city),
    housesWithFood: housingStats.housesWithFood,
    foodCoveredTiles: foodCoverage.size,
  };
}

export function getTileKey(x: number, y: number): string {
  return `${x},${y}`;
}

function produceFood(city: CityState): void {
  const capacity = getFoodCapacity(city);
  if (capacity === 0) {
    city.resources.food = 0;
    return;
  }

  city.resources.food = Math.min(
    capacity,
    city.resources.food + countActiveBuildings(city, 'farm') * FARM_FOOD_PER_TICK,
  );
}

function getHouseLevel(building: Building): 1 | 2 | 3 {
  return Math.min(Math.max(building.level ?? 1, 1), 3) as 1 | 2 | 3;
}

function getTicksUntilNextFinancePeriod(tick: number): number {
  const elapsedInPeriod = tick % FINANCE_INTERVAL_TICKS;
  return elapsedInPeriod === 0 ? FINANCE_INTERVAL_TICKS : FINANCE_INTERVAL_TICKS - elapsedInPeriod;
}

function updateHouseLevel(building: Building): void {
  const level = building.level ?? 1;

  if (level < 2) {
    if (building.hasRoadAccess === true && building.hasWater === true) {
      building.upgradeProgress = (building.upgradeProgress ?? 0) + 1;
      if (building.upgradeProgress >= HOUSE_LEVEL_2_TICKS) {
        building.level = 2;
        building.upgradeProgress = 0;
      }
    } else {
      building.upgradeProgress = 0;
    }
    return;
  }

  if (level < 3) {
    if (building.hasRoadAccess === true && building.hasWater === true && building.hasFood === true) {
      building.upgradeProgress = (building.upgradeProgress ?? 0) + 1;
      if (building.upgradeProgress >= HOUSE_LEVEL_3_TICKS) {
        building.level = 3;
        building.upgradeProgress = 0;
      }
    } else {
      building.upgradeProgress = 0;
    }
  }
}

function getWaterCoverage(city: CityState): Set<string> {
  return getRadiusCoverage(city, 'well', WATER_RADIUS);
}

function getRadiusCoverage(
  city: CityState,
  sourceType: Building['type'],
  radius: number,
  activeOnly = false,
): Set<string> {
  const coverage = new Set<string>();

  for (const building of city.buildings) {
    if (building.type !== sourceType) continue;
    if (activeOnly && building.active !== true) continue;

    for (let dy = -radius; dy <= radius; dy++) {
      const remainingRadius = radius - Math.abs(dy);
      for (let dx = -remainingRadius; dx <= remainingRadius; dx++) {
        const x = building.x + dx;
        const y = building.y + dy;
        if (getTile(city, x, y)) coverage.add(getTileKey(x, y));
      }
    }
  }

  return coverage;
}

function countBuildings(city: CityState, type: Building['type']): number {
  return city.buildings.reduce((total, building) => total + (building.type === type ? 1 : 0), 0);
}

function countActiveBuildings(city: CityState, type: Building['type']): number {
  return city.buildings.reduce((total, building) => (
    total + (building.type === type && building.active === true ? 1 : 0)
  ), 0);
}


function getSortedWorkplaces(city: CityState): WorkplaceBuilding[] {
  return city.buildings
    .filter((building): building is WorkplaceBuilding => isWorkplace(building.type))
    .sort((a, b) => (
      WORKPLACE_PRIORITY[a.type] - WORKPLACE_PRIORITY[b.type]
      || a.y - b.y
      || a.x - b.x
      || a.id.localeCompare(b.id)
    ));
}
