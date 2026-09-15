import { getBuildingAt, getTile, type Building, type CityState } from './CityState';

export const WATER_RADIUS = 3;
export const MARKET_FOOD_RADIUS = 4;
export const FARM_FOOD_PER_TICK = 2;
export const GRANARY_CAPACITY = 100;
export const HOUSE_LEVEL_2_TICKS = 3;
export const HOUSE_LEVEL_3_TICKS = 5;
export const HOUSE_FOOD_CONSUMPTION_INTERVAL = 2;

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

export function simulateTick(city: CityState): void {
  city.simulation.tick += 1;
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
  return getRadiusCoverage(city, 'market', MARKET_FOOD_RADIUS);
}

export function getFoodCapacity(city: CityState): number {
  return countBuildings(city, 'granary') * GRANARY_CAPACITY;
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
    city.resources.food + countBuildings(city, 'farm') * FARM_FOOD_PER_TICK,
  );
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

function getRadiusCoverage(city: CityState, sourceType: Building['type'], radius: number): Set<string> {
  const coverage = new Set<string>();

  for (const building of city.buildings) {
    if (building.type !== sourceType) continue;

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
