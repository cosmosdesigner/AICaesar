import { getBuildingAt, getTile, type Building, type CityState } from './CityState';

export const WATER_RADIUS = 3;
export const HOUSE_UPGRADE_TICKS = 3;

export interface HousingStats {
  readonly totalHouses: number;
  readonly housesWithRoadAccess: number;
  readonly housesWithWater: number;
  readonly levelTwoHouses: number;
  readonly waterCoveredTiles: number;
}

export function simulateTick(city: CityState): void {
  city.simulation.tick += 1;
  const waterCoverage = getWaterCoveredTiles(city);

  for (const building of city.buildings) {
    if (building.type !== 'house') continue;

    building.hasRoadAccess = hasAdjacentRoad(city, building);
    building.hasWater = waterCoverage.has(getTileKey(building.x, building.y));

    if (building.hasRoadAccess && building.hasWater) {
      if ((building.level ?? 1) < 2) {
        building.upgradeProgress = (building.upgradeProgress ?? 0) + 1;
        if (building.upgradeProgress >= HOUSE_UPGRADE_TICKS) building.level = 2;
      }
    } else if ((building.level ?? 1) < 2) {
      building.upgradeProgress = 0;
    }
  }
}

export function hasAdjacentRoad(city: CityState, building: Building): boolean {
  return getBuildingAt(city, building.x, building.y - 1)?.type === 'road'
    || getBuildingAt(city, building.x + 1, building.y)?.type === 'road'
    || getBuildingAt(city, building.x, building.y + 1)?.type === 'road'
    || getBuildingAt(city, building.x - 1, building.y)?.type === 'road';
}

export function hasWaterAccess(city: CityState, building: Building): boolean {
  return getWaterCoveredTiles(city).has(getTileKey(building.x, building.y));
}

export function getWaterCoveredTiles(city: CityState): Set<string> {
  const coverage = new Set<string>();

  for (const building of city.buildings) {
    if (building.type !== 'well') continue;

    for (let dy = -WATER_RADIUS; dy <= WATER_RADIUS; dy++) {
      const remainingRadius = WATER_RADIUS - Math.abs(dy);
      for (let dx = -remainingRadius; dx <= remainingRadius; dx++) {
        const x = building.x + dx;
        const y = building.y + dy;
        if (getTile(city, x, y)) coverage.add(getTileKey(x, y));
      }
    }
  }

  return coverage;
}

export function getHousingStats(city: CityState): HousingStats {
  const waterCoverage = getWaterCoveredTiles(city);
  let totalHouses = 0;
  let housesWithRoadAccess = 0;
  let housesWithWater = 0;
  let levelTwoHouses = 0;

  for (const building of city.buildings) {
    if (building.type !== 'house') continue;

    totalHouses += 1;
    if (hasAdjacentRoad(city, building)) housesWithRoadAccess += 1;
    if (waterCoverage.has(getTileKey(building.x, building.y))) housesWithWater += 1;
    if ((building.level ?? 1) >= 2) levelTwoHouses += 1;
  }

  return {
    totalHouses,
    housesWithRoadAccess,
    housesWithWater,
    levelTwoHouses,
    waterCoveredTiles: waterCoverage.size,
  };
}

export function getTileKey(x: number, y: number): string {
  return `${x},${y}`;
}
