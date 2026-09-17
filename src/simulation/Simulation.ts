import { type Building, type CityState } from './CityState';
import {
  advanceEvents,
  getDroughtProductionMultiplier,
  isBuildingSuppressed,
  isEpidemicActive,
} from '../events/Events';
import {
  getDistanceToBuilding,
  getRoadDistances,
  getRoadNetwork,
  isBuildingOnRoadNetwork,
  type RoadNetwork,
} from './RoadNetwork';
import type { BuildingType } from './Tile';
import { getHouseDesirability, getDesirabilityTier } from './Desirability';
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
export const POPULATION_GROWTH_INTERVAL_TICKS = 3;
export const POPULATION_DECLINE_INTERVAL_TICKS = 5;
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

export interface PopulationStats {
  readonly population: number;
  readonly capacity: number;
  readonly availableHousing: number;
  readonly lastChange: number;
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
  const eventPopulationChange = advanceEvents(city);
  const network = getRoadNetwork(city);
  assignWorkers(city, network);
  produceFood(city, network);
  restockMarkets(city, network);

  const waterCoverage = getWaterCoveredTiles(city, network);
  const shouldConsumeFood = city.simulation.tick % HOUSE_FOOD_CONSUMPTION_INTERVAL === 0;
  const growthBlocked = isEpidemicActive(city);

  const houses = city.buildings
    .filter((building) => building.type === 'house')
    .sort(compareBuildingsByPosition);

  let populationLastChange = eventPopulationChange;
  for (const building of houses) {
    building.hasRoadAccess = hasAdjacentRoad(city, building, network);
    building.hasWater = waterCoverage.has(getTileKey(building.x, building.y));

    const market = getHouseFoodMarket(city, building, network);
    if (market) {
      building.hasFood = true;
      if (shouldConsumeFood) market.storedFood = Math.max(0, getStoredFood(market) - 1);
    } else {
      building.hasFood = false;
    }

    const previousPopulation = getHousePopulation(building);
    const services: HouseServices = {
      road: building.hasRoadAccess,
      water: building.hasWater,
      food: building.hasFood,
      desirability: getDesirabilityTier(getHouseDesirability(city, building).score),
    };
    updateHouseLevel(building, services);
    clampHousePopulation(building);
    updateHousePopulation(city, building, services, growthBlocked);
    populationLastChange += getHousePopulation(building) - previousPopulation;
  }
  city.simulation.population.lastChange = populationLastChange;

  assignWorkers(city, network);
  if (city.simulation.tick % FINANCE_INTERVAL_TICKS === 0) applyFinancePeriod(city);
}

export function getHouseTax(city: CityState): number {
  return city.buildings.reduce((total, building) => {
    if (building.type !== 'house') return total;
    const specification = getHouseSpecification(building.level);
    const population = getHousePopulation(building);
    if (population === 0) return total;
    return total + Math.ceil((specification.taxPerPeriod * population) / specification.populationCapacity);
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

export function hasAdjacentRoad(city: CityState, building: Building, network = getRoadNetwork(city)): boolean {
  return isBuildingOnRoadNetwork(city, building, network);
}

export function hasWaterAccess(city: CityState, building: Building, network = getRoadNetwork(city)): boolean {
  return getWaterCoverage(city, network).has(getTileKey(building.x, building.y));
}

export function getHouseServices(city: CityState, building: Building, network = getRoadNetwork(city)): HouseServices {
  return {
    road: hasAdjacentRoad(city, building, network),
    water: hasWaterAccess(city, building, network),
    food: building.hasFood === true && getHouseFoodMarket(city, building, network) !== undefined,
    desirability: getDesirabilityTier(getHouseDesirability(city, building).score),
  };
}

export function getWaterCoveredTiles(city: CityState, network = getRoadNetwork(city)): Set<string> {
  return getWaterCoverage(city, network);
}

export function getFoodCoveredTiles(city: CityState, network = getRoadNetwork(city)): Set<string> {
  return getRoadCoverage(
    city,
    getActiveBuildings(city, 'market', network).filter((market) => getStoredFood(market) > 0),
    MARKET_FOOD_RADIUS,
    network,
  );
}

export function getGranaryFoodCapacity(city: CityState, network = getRoadNetwork(city)): number {
  return countActiveBuildings(city, 'granary', network) * GRANARY_FOOD_CAPACITY;
}

export function getMarketFoodCapacity(city: CityState, network = getRoadNetwork(city)): number {
  return countActiveBuildings(city, 'market', network) * MARKET_FOOD_CAPACITY;
}

export function getFoodCapacity(city: CityState, network = getRoadNetwork(city)): number {
  return getGranaryFoodCapacity(city, network) + getMarketFoodCapacity(city, network);
}

export function assignWorkers(city: CityState, network = getRoadNetwork(city)): void {
  let remainingWorkers = Math.floor(getPopulation(city) * WORKFORCE_RATIO);
  const workplaces = getSortedWorkplaces(city);

  for (const workplace of workplaces) {
    const workersRequired = getWorkersRequired(workplace.type);
    if (!isBuildingSuppressed(city, workplace)
      && isBuildingOnRoadNetwork(city, workplace, network) && remainingWorkers >= workersRequired) {
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
    return population + getHousePopulation(building);
  }, 0);
}

export function getPopulationStats(city: CityState): PopulationStats {
  let population = 0;
  let capacity = 0;
  for (const building of city.buildings) {
    if (building.type !== 'house') continue;
    population += getHousePopulation(building);
    capacity += getHouseCapacity(building);
  }

  return {
    population,
    capacity,
    availableHousing: Math.max(0, capacity - population),
    lastChange: city.simulation.population.lastChange,
  };
}

export function getWorkforceStats(city: CityState, network = getRoadNetwork(city)): WorkforceStats {
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
    if (!isBuildingSuppressed(city, workplace)
      && isBuildingOnRoadNetwork(city, workplace, network) && remainingWorkers >= required) {
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

export function getHousingStats(city: CityState, network = getRoadNetwork(city)): HousingStats {
  const waterCoverage = getWaterCoverage(city, network);
  // Food flags record the last tick, including stock consumed or workers reassigned then.
  const foodReach = getFoodCoveredTiles(city, network);
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
      road: hasAdjacentRoad(city, building, network),
      water: waterCoverage.has(getTileKey(building.x, building.y)),
      food: building.hasFood === true && foodReach.has(getTileKey(building.x, building.y)),
      desirability: getDesirabilityTier(getHouseDesirability(city, building).score),
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

export function getMarketSupplyCandidates(city: CityState, market: Building, network = getRoadNetwork(city)): Building[] {
  if (isBuildingSuppressed(city, market)
    || !isBuildingOnRoadNetwork(city, market, network) || market.active !== true) return [];
  return getReachableBuildings(city, market, 'granary', MARKET_SUPPLY_RADIUS, network)
    .filter((granary) => !isBuildingSuppressed(city, granary)
      && granary.active === true && getStoredFood(granary) > 0);
}

export function getFoodStats(city: CityState, network = getRoadNetwork(city)): FoodStats {
  const housingStats = getHousingStats(city, network);
  const foodCoverage = getFoodCoveredTiles(city, network);
  const granaryFood = getGranaryStoredFood(city);
  const marketFood = getMarketStoredFood(city);
  const granaryCapacity = getGranaryFoodCapacity(city, network);
  const marketCapacity = getMarketFoodCapacity(city, network);

  return {
    farms: countBuildings(city, 'farm'),
    granaries: countBuildings(city, 'granary'),
    markets: countBuildings(city, 'market'),
    granaryFood,
    granaryCapacity,
    marketFood,
    marketCapacity,
    marketDemand: getActiveBuildings(city, 'market', network)
      .reduce((total, market) => total + getMarketFoodDemand(market), 0),
    foodStored: granaryFood + marketFood,
    foodCapacity: granaryCapacity + marketCapacity,
    suppliedMarkets: getActiveBuildings(city, 'market', network)
      .filter((market) => getStoredFood(market) > 0).length,
    housesWithFood: housingStats.housesWithFood,
    foodCoveredTiles: foodCoverage.size,
  };
}

export function getTileKey(x: number, y: number): string {
  return `${x},${y}`;
}

function produceFood(city: CityState, network: RoadNetwork): void {
  const granaries = getActiveBuildings(city, 'granary', network)
    .sort(compareBuildingsByPosition);
  if (granaries.length === 0) return;

  const farmProduction = Math.max(0, Math.floor(FARM_FOOD_PER_TICK * getDroughtProductionMultiplier(city)));
  const farms = getActiveBuildings(city, 'farm', network)
    .sort(compareBuildingsByPosition);
  for (let farmIndex = 0; farmIndex < farms.length; farmIndex++) {
    let remainingFood = farmProduction;
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

function restockMarkets(city: CityState, network: RoadNetwork): void {
  const markets = getActiveBuildings(city, 'market', network)
    .sort(compareBuildingsByPosition);

  for (const market of markets) {
    let remainingDemand = Math.min(MARKET_RESTOCK_PER_TICK, getMarketFoodDemand(market));
    if (remainingDemand === 0) continue;

    for (const granary of getMarketSupplyCandidates(city, market, network)) {
      const transferred = Math.min(remainingDemand, getStoredFood(granary));
      if (transferred <= 0) continue;
      granary.storedFood = getStoredFood(granary) - transferred;
      market.storedFood = getStoredFood(market) + transferred;
      remainingDemand -= transferred;
      if (remainingDemand === 0) break;
    }
  }
}

function getHouseFoodMarket(city: CityState, house: Building, network: RoadNetwork): Building | undefined {
  return getReachableBuildings(city, house, 'market', MARKET_FOOD_RADIUS, network)
    .find((market) => market.active === true && getStoredFood(market) > 0);
}

function getReachableBuildings(
  city: CityState,
  source: Building,
  type: Building['type'],
  radius: number,
  network: RoadNetwork,
): Building[] {
  const distances = getRoadDistances(network, source, radius);
  const reachable: { building: Building; distance: number }[] = [];
  for (const building of city.buildings) {
    if (building.type !== type) continue;
    const distance = getDistanceToBuilding(network, distances, building);
    if (distance !== undefined) reachable.push({ building, distance });
  }
  return reachable
    .sort((a, b) => a.distance - b.distance || compareBuildingsByPosition(a.building, b.building))
    .map(({ building }) => building);
}

function getStoredFood(building: Building): number {
  return Math.max(0, building.storedFood ?? 0);
}


function getHouseLevel(building: Building): HouseLevel {
  return normalizeHouseLevel(building.level);
}

function getHouseCapacity(building: Building): number {
  return getHouseSpecification(building.level).populationCapacity;
}

function getHousePopulation(building: Building): number {
  return building.population ?? 0;
}

function getTicksUntilNextFinancePeriod(tick: number): number {
  const elapsedInPeriod = tick % FINANCE_INTERVAL_TICKS;
  return elapsedInPeriod === 0 ? FINANCE_INTERVAL_TICKS : FINANCE_INTERVAL_TICKS - elapsedInPeriod;
}

function clampHousePopulation(building: Building): void {
  building.population = Math.min(getHouseCapacity(building), getHousePopulation(building));
}

function updateHousePopulation(
  city: CityState,
  building: Building,
  services: HouseServices,
  growthBlocked: boolean,
): void {
  const population = getHousePopulation(building);
  const capacity = getHouseCapacity(building);
  if (services.road && services.water && services.food) {
    if (growthBlocked || city.simulation.tick % POPULATION_GROWTH_INTERVAL_TICKS !== 0 || population >= capacity) return;
    building.population = population + 1;
    return;
  }

  if (city.simulation.tick % POPULATION_DECLINE_INTERVAL_TICKS !== 0 || population === 0) return;
  building.population = population - 1;
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

function getWaterCoverage(city: CityState, network: RoadNetwork): Set<string> {
  return getRoadCoverage(
    city, city.buildings.filter((building) => building.type === 'well'), WATER_RADIUS, network,
  );
}

function getRoadCoverage(
  city: CityState,
  sources: readonly Building[],
  radius: number,
  network: RoadNetwork,
): Set<string> {
  const coverage = new Set<string>();
  for (const source of sources) {
    const distances = getRoadDistances(network, source, radius);
    for (const key of distances.keys()) coverage.add(key);
    for (const building of city.buildings) {
      if (building.type === 'road') continue;
      if (getDistanceToBuilding(network, distances, building) !== undefined) {
        coverage.add(getTileKey(building.x, building.y));
      }
    }
  }
  return coverage;
}

function getActiveBuildings(city: CityState, type: Building['type'], network: RoadNetwork): Building[] {
  return city.buildings.filter((building) => (
    building.type === type && building.active === true && !isBuildingSuppressed(city, building)
      && isBuildingOnRoadNetwork(city, building, network)
  ));
}

function compareBuildingsByPosition(a: Building, b: Building): number {
  return a.y - b.y || a.x - b.x || a.id.localeCompare(b.id);
}

function countBuildings(city: CityState, type: Building['type']): number {
  return city.buildings.reduce((total, building) => total + (building.type === type ? 1 : 0), 0);
}

function countActiveBuildings(city: CityState, type: Building['type'], network: RoadNetwork): number {
  return city.buildings.reduce((total, building) => (
    total + (building.type === type && building.active === true && !isBuildingSuppressed(city, building)
      && isBuildingOnRoadNetwork(city, building, network) ? 1 : 0)
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
