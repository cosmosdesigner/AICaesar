import { getBuildingAt, getTile, type Building, type CityState } from './CityState';
import type { BuildingType } from './Tile';
import {
  HOUSE_DEGRADE_TICKS,
  getHouseSpecification,
  getHouseStatus,
  normalizeHouseLevel,
  type HouseLevel,
  type HouseServices,
} from './HouseSpecification';

type WorkplaceType = 'farm' | 'granary' | 'market';
type WorkplaceBuilding = Building & { readonly type: WorkplaceType };

export const WATER_RADIUS = 3;
export const MARKET_FOOD_RADIUS = 4;
export const MARKET_SUPPLY_RADIUS = 8;
export const FARM_FOOD_PER_TICK = 2;
export const GRANARY_FOOD_CAPACITY = 100;
export const MARKET_FOOD_CAPACITY = 40;
export const MARKET_RESTOCK_PER_TICK = 4;
export const HOUSE_FOOD_CONSUMPTION_INTERVAL = 2;
export const FINANCE_INTERVAL_TICKS = 10;
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
  readonly blockedByRoad: number;
  readonly blockedByWater: number;
  readonly blockedByFood: number;
  readonly degradingHouses: number;
}

export interface FoodStats {
  readonly farms: number;
  readonly granaries: number;
  readonly markets: number;
  readonly granaryFood: number;
  readonly granaryCapacity: number;
  readonly marketFood: number;
  readonly marketCapacity: number;
  readonly marketDemand: number;
  readonly foodStored: number;
  readonly foodCapacity: number;
  readonly suppliedMarkets: number;
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
  restockMarkets(city);

  const waterCoverage = getWaterCoveredTiles(city);
  const shouldConsumeFood = city.simulation.tick % HOUSE_FOOD_CONSUMPTION_INTERVAL === 0;

  const houses = city.buildings
    .filter((building) => building.type === 'house')
    .sort(compareBuildingsByPosition);

  for (const building of houses) {
    building.hasRoadAccess = hasAdjacentRoad(city, building);
    building.hasWater = waterCoverage.has(getTileKey(building.x, building.y));

    const market = getHouseFoodMarket(city, building);
    if (market) {
      building.hasFood = true;
      if (shouldConsumeFood) market.storedFood = Math.max(0, getStoredFood(market) - 1);
    } else {
      building.hasFood = false;
    }

    updateHouseLevel(building, {
      road: building.hasRoadAccess,
      water: building.hasWater,
      food: building.hasFood,
    });
  }

  assignWorkers(city);
  if (city.simulation.tick % FINANCE_INTERVAL_TICKS === 0) applyFinancePeriod(city);
}

export function getHouseTax(city: CityState): number {
  return city.buildings.reduce((total, building) => {
    if (building.type !== 'house') return total;
    return total + getHouseSpecification(building.level).taxPerPeriod;
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

export function getHouseServices(city: CityState, building: Building): HouseServices {
  return {
    road: hasAdjacentRoad(city, building),
    water: hasWaterAccess(city, building),
    food: building.hasFood === true,
  };
}

export function getWaterCoveredTiles(city: CityState): Set<string> {
  return getWaterCoverage(city);
}

export function getFoodCoveredTiles(city: CityState): Set<string> {
  const coverage = new Set<string>();

  for (const market of getActiveBuildings(city, 'market')) {
    if (getStoredFood(market) <= 0) continue;
    addRadiusCoverage(city, coverage, market, MARKET_FOOD_RADIUS);
  }

  return coverage;
}

export function getGranaryFoodCapacity(city: CityState): number {
  return countActiveBuildings(city, 'granary') * GRANARY_FOOD_CAPACITY;
}

export function getMarketFoodCapacity(city: CityState): number {
  return countActiveBuildings(city, 'market') * MARKET_FOOD_CAPACITY;
}

export function getFoodCapacity(city: CityState): number {
  return getGranaryFoodCapacity(city) + getMarketFoodCapacity(city);
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
    return population + getHouseSpecification(building.level).populationCapacity;
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
  let blockedByRoad = 0;
  let blockedByWater = 0;
  let blockedByFood = 0;
  let degradingHouses = 0;
  for (const building of city.buildings) {
    if (building.type !== 'house') continue;

    totalHouses += 1;
    const services: HouseServices = {
      road: hasAdjacentRoad(city, building),
      water: waterCoverage.has(getTileKey(building.x, building.y)),
      food: building.hasFood === true,
    };
    const status = getHouseStatus(building.level, services);
    if (services.road) housesWithRoadAccess += 1;
    if (services.water) housesWithWater += 1;
    if (services.food) housesWithFood += 1;
    if (status.currentLevel >= 2) levelTwoHouses += 1;
    if (status.currentLevel >= 3) levelThreeHouses += 1;
    if (status.missingForNextLevel === 'road') blockedByRoad += 1;
    if (status.missingForNextLevel === 'water') blockedByWater += 1;
    if (status.missingForNextLevel === 'food') blockedByFood += 1;
    if (status.shouldDegrade) degradingHouses += 1;
  }

  return {
    totalHouses,
    housesWithRoadAccess,
    housesWithWater,
    housesWithFood,
    levelTwoHouses,
    levelThreeHouses,
    waterCoveredTiles: waterCoverage.size,
    blockedByRoad,
    blockedByWater,
    blockedByFood,
    degradingHouses,
  };
}

export function getGranaryStoredFood(city: CityState): number {
  return city.buildings.reduce((total, building) => (
    building.type === 'granary' ? total + getStoredFood(building) : total
  ), 0);
}

export function getMarketStoredFood(city: CityState): number {
  return city.buildings.reduce((total, building) => (
    building.type === 'market' ? total + getStoredFood(building) : total
  ), 0);
}

export function getMarketFoodDemand(market: Building): number {
  return Math.max(0, MARKET_FOOD_CAPACITY - getStoredFood(market));
}

export function getMarketSupplyCandidates(city: CityState, market: Building): Building[] {
  return getActiveBuildings(city, 'granary')
    .filter((granary) => getStoredFood(granary) > 0
      && getManhattanDistance(granary, market) <= MARKET_SUPPLY_RADIUS)
    .sort((a, b) => (
      getManhattanDistance(a, market) - getManhattanDistance(b, market)
      || compareBuildingsByPosition(a, b)
    ));
}

export function getFoodStats(city: CityState): FoodStats {
  const housingStats = getHousingStats(city);
  const foodCoverage = getFoodCoveredTiles(city);
  const granaryFood = getGranaryStoredFood(city);
  const marketFood = getMarketStoredFood(city);
  const granaryCapacity = getGranaryFoodCapacity(city);
  const marketCapacity = getMarketFoodCapacity(city);

  return {
    farms: countBuildings(city, 'farm'),
    granaries: countBuildings(city, 'granary'),
    markets: countBuildings(city, 'market'),
    granaryFood,
    granaryCapacity,
    marketFood,
    marketCapacity,
    marketDemand: getActiveBuildings(city, 'market')
      .reduce((total, market) => total + getMarketFoodDemand(market), 0),
    foodStored: granaryFood + marketFood,
    foodCapacity: granaryCapacity + marketCapacity,
    suppliedMarkets: getActiveBuildings(city, 'market')
      .filter((market) => getStoredFood(market) > 0).length,
    housesWithFood: housingStats.housesWithFood,
    foodCoveredTiles: foodCoverage.size,
  };
}

export function getTileKey(x: number, y: number): string {
  return `${x},${y}`;
}

function produceFood(city: CityState): void {
  const granaries = getActiveBuildings(city, 'granary')
    .sort(compareBuildingsByPosition);
  if (granaries.length === 0) return;

  const farms = getActiveBuildings(city, 'farm')
    .sort(compareBuildingsByPosition);
  for (let farmIndex = 0; farmIndex < farms.length; farmIndex++) {
    let remainingFood = FARM_FOOD_PER_TICK;
    for (const granary of granaries) {
      const space = GRANARY_FOOD_CAPACITY - getStoredFood(granary);
      if (space <= 0) continue;
      const stored = Math.min(space, remainingFood);
      granary.storedFood = getStoredFood(granary) + stored;
      remainingFood -= stored;
      if (remainingFood === 0) break;
    }
  }
}

function restockMarkets(city: CityState): void {
  const markets = getActiveBuildings(city, 'market')
    .sort(compareBuildingsByPosition);

  for (const market of markets) {
    let remainingDemand = Math.min(MARKET_RESTOCK_PER_TICK, getMarketFoodDemand(market));
    if (remainingDemand === 0) continue;

    for (const granary of getMarketSupplyCandidates(city, market)) {
      const transferred = Math.min(remainingDemand, getStoredFood(granary));
      if (transferred <= 0) continue;
      granary.storedFood = getStoredFood(granary) - transferred;
      market.storedFood = getStoredFood(market) + transferred;
      remainingDemand -= transferred;
      if (remainingDemand === 0) break;
    }
  }
}

function getHouseFoodMarket(city: CityState, house: Building): Building | undefined {
  return getActiveBuildings(city, 'market')
    .filter((market) => getStoredFood(market) > 0
      && getManhattanDistance(market, house) <= MARKET_FOOD_RADIUS)
    .sort((a, b) => (
      getManhattanDistance(a, house) - getManhattanDistance(b, house)
      || compareBuildingsByPosition(a, b)
    ))[0];
}

function getStoredFood(building: Building): number {
  return Math.max(0, building.storedFood ?? 0);
}

function getManhattanDistance(a: Building, b: Building): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function getHouseLevel(building: Building): HouseLevel {
  return normalizeHouseLevel(building.level);
}

function getTicksUntilNextFinancePeriod(tick: number): number {
  const elapsedInPeriod = tick % FINANCE_INTERVAL_TICKS;
  return elapsedInPeriod === 0 ? FINANCE_INTERVAL_TICKS : FINANCE_INTERVAL_TICKS - elapsedInPeriod;
}

function updateHouseLevel(building: Building, services: HouseServices): void {
  const currentLevel = getHouseLevel(building);
  const status = getHouseStatus(currentLevel, services);

  if (status.shouldDegrade) {
    building.upgradeProgress = 0;
    building.degradeProgress = (building.degradeProgress ?? 0) + 1;
    if (building.degradeProgress >= HOUSE_DEGRADE_TICKS) {
      building.level = Math.max(1, currentLevel - 1) as HouseLevel;
      building.upgradeProgress = 0;
      building.degradeProgress = 0;
    }
    return;
  }

  building.degradeProgress = 0;
  if (!status.canUpgrade) {
    building.upgradeProgress = 0;
    return;
  }

  const nextLevel = (currentLevel + 1) as HouseLevel;
  building.upgradeProgress = (building.upgradeProgress ?? 0) + 1;
  if (building.upgradeProgress >= getHouseSpecification(nextLevel).upgradeTicks) {
    building.level = nextLevel;
    building.upgradeProgress = 0;
    building.degradeProgress = 0;
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

    addRadiusCoverage(city, coverage, building, radius);
  }

  return coverage;
}

function addRadiusCoverage(city: CityState, coverage: Set<string>, building: Building, radius: number): void {
  for (let dy = -radius; dy <= radius; dy++) {
    const remainingRadius = radius - Math.abs(dy);
    for (let dx = -remainingRadius; dx <= remainingRadius; dx++) {
      const x = building.x + dx;
      const y = building.y + dy;
      if (getTile(city, x, y)) coverage.add(getTileKey(x, y));
    }
  }
}

function getActiveBuildings(city: CityState, type: Building['type']): Building[] {
  return city.buildings.filter((building) => building.type === type && building.active === true);
}

function compareBuildingsByPosition(a: Building, b: Building): number {
  return a.y - b.y || a.x - b.x || a.id.localeCompare(b.id);
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
