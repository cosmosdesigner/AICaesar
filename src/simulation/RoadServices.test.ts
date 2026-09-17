import { describe, expect, it } from 'vitest';
import type { Building, CityState } from './CityState';
import type { BuildingType, Tile } from './Tile';
import {
  assignWorkers,
  getFoodCoveredTiles,
  getFoodStats,
  getHouseServices,
  getHousingStats,
  getMarketSupplyCandidates,
  getWaterCoveredTiles,
  getWorkforceStats,
  hasAdjacentRoad,
  simulateTick,
} from './Simulation';

function createEmptyCity(): CityState {
  const tiles: Tile[] = [];
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 24; x++) tiles.push({ x, y, terrain: 'grass' });
  }
  return {
    width: 24,
    height: 24,
    tiles,
    buildings: [],
    resources: { money: 500 },
    simulation: { tick: 0, finance: { period: 0, lastRevenue: 0, lastUpkeep: 0, lastNet: 0 }, population: { lastChange: 0 } },
  };
}

function add(city: CityState, type: BuildingType, x: number, y: number, patch: Partial<Building> = {}): Building {
  const building: Building = {
    id: `${type}-${x}-${y}`, type, x, y,
    ...(type === 'house' ? { level: 1, population: 0 } : {}),
    ...(type === 'granary' || type === 'market' ? { storedFood: 0 } : {}),
    ...patch,
  };
  city.buildings.push(building);
  city.tiles[y * city.width + x]!.buildingId = building.id;
  return building;
}

function road(city: CityState, x1: number, x2: number, y: number): void {
  for (let x = x1; x <= x2; x++) add(city, 'road', x, y);
}

function workers(city: CityState): void {
  for (let x = 18; x <= 21; x++) add(city, 'house', x, 20, { level: 3, population: 14 });
}

function detour(city: CityState): void {
  for (let y = 2; y < 6; y++) {
    add(city, 'road', 2, y);
    add(city, 'road', 4, y);
  }
  road(city, 2, 4, 6);
}

describe('road-reached services', () => {
  it('covers roads and existing buildings through the inclusive water BFS boundary, not empty terrain', () => {
    const city = createEmptyCity();
    road(city, 0, 6, 1);
    add(city, 'well', 0, 0);
    const boundary = add(city, 'house', 3, 0);
    const outside = add(city, 'house', 4, 0);

    expect(getWaterCoveredTiles(city)).toEqual(new Set(['0,1', '1,1', '2,1', '3,1', '0,0', '3,0']));
    expect(getHouseServices(city, boundary).water).toBe(true);
    expect(getHouseServices(city, outside).water).toBe(false);
  });

  it('does not serve water across a road detour or from a nearby isolated well', () => {
    const city = createEmptyCity();
    detour(city);
    add(city, 'well', 2, 1);
    const house = add(city, 'house', 4, 1);
    expect(getHouseServices(city, house)).toMatchObject({ road: true, water: false });

    const isolatedCity = createEmptyCity();
    road(isolatedCity, 0, 6, 1);
    add(isolatedCity, 'road', 3, 4);
    add(isolatedCity, 'well', 3, 3);
    const nearbyHouse = add(isolatedCity, 'house', 3, 0);
    expect(getHouseServices(isolatedCity, nearbyHouse).water).toBe(false);
    expect(getWaterCoveredTiles(isolatedCity)).toEqual(new Set());
  });

  it('delivers and consumes food at road distance four but not five', () => {
    const city = createEmptyCity();
    workers(city);
    road(city, 0, 6, 1);
    const market = add(city, 'market', 0, 0, { storedFood: 10 });
    const boundary = add(city, 'house', 4, 0);
    const outside = add(city, 'house', 5, 0);
    city.simulation.tick = 1;

    simulateTick(city);

    expect(boundary.hasFood).toBe(true);
    expect(outside.hasFood).toBe(false);
    expect(market.storedFood).toBe(9);
    expect(getFoodCoveredTiles(city)).toEqual(new Set(['0,1', '1,1', '2,1', '3,1', '4,1', '0,0', '4,0']));
  });

  it('does not deliver food to a Manhattan-near house beyond the road radius', () => {
    const city = createEmptyCity();
    workers(city);
    detour(city);
    const market = add(city, 'market', 2, 1, { storedFood: 10 });
    const house = add(city, 'house', 4, 1);
    city.simulation.tick = 1;

    simulateTick(city);

    expect(market.active).toBe(true);
    expect(house.hasFood).toBe(false);
    expect(market.storedFood).toBe(10);
    expect(getFoodCoveredTiles(city).has('4,1')).toBe(false);
  });

  it('does not report food service from inactive or empty reachable markets', () => {
    const city = createEmptyCity();
    road(city, 0, 4, 1);
    const inactiveMarket = add(city, 'market', 0, 0, { active: false, storedFood: 10 });
    const house = add(city, 'house', 2, 0, { hasFood: true });

    expect(getHouseServices(city, house).food).toBe(false);
    expect(getHousingStats(city).housesWithFood).toBe(0);
    expect(getFoodCoveredTiles(city)).toEqual(new Set());

    inactiveMarket.active = true;
    inactiveMarket.storedFood = 0;
    expect(getHouseServices(city, house).food).toBe(false);
    expect(getHousingStats(city).housesWithFood).toBe(0);
  });

  it('supplies markets at road distance eight but not nine', () => {
    const city = createEmptyCity();
    workers(city);
    road(city, 0, 10, 1);
    const granary = add(city, 'granary', 0, 0, { storedFood: 20 });
    const boundary = add(city, 'market', 8, 0);
    const outside = add(city, 'market', 9, 0);

    simulateTick(city);

    expect(boundary.storedFood).toBe(4);
    expect(outside.storedFood).toBe(0);
    expect(granary.storedFood).toBe(16);
  });

  it('does not supply a Manhattan-near market across a road detour', () => {
    const city = createEmptyCity();
    workers(city);
    detour(city);
    const granary = add(city, 'granary', 2, 1, { storedFood: 20 });
    const market = add(city, 'market', 4, 1);

    simulateTick(city);

    expect(granary.active).toBe(true);
    expect(market.active).toBe(true);
    expect(market.storedFood).toBe(0);
    expect(granary.storedFood).toBe(20);
  });

  it('skips isolated workplaces without spending workers and still reports their requirements', () => {
    const city = createEmptyCity();
    road(city, 0, 3, 1);
    add(city, 'house', 0, 0, { level: 3, population: 12 });
    const isolatedGranary = add(city, 'granary', 8, 0);
    add(city, 'road', 8, 1);
    const farm = add(city, 'farm', 1, 0);
    const market = add(city, 'market', 2, 0);

    assignWorkers(city);

    expect(isolatedGranary.active).toBe(false);
    expect(farm.active).toBe(true);
    expect(market.active).toBe(false);
    expect(getWorkforceStats(city)).toMatchObject({
      workersAvailable: 6, workersRequired: 15, workersAssigned: 6,
      workerShortage: 9, unemployedWorkers: 0, activeWorkplaces: 1, inactiveWorkplaces: 2,
    });
  });

  it('retains isolated stocks but excludes them from production, supply, delivery and capacity', () => {
    const city = createEmptyCity();
    workers(city);
    road(city, 0, 6, 1);
    road(city, 0, 2, 4);
    const granary = add(city, 'granary', 0, 0, { storedFood: 10 });
    const market = add(city, 'market', 1, 0);
    const isolatedFarm = add(city, 'farm', 0, 3, { active: true });
    const isolatedGranary = add(city, 'granary', 1, 3, { active: true, storedFood: 20 });
    const isolatedMarket = add(city, 'market', 2, 3, { active: true, storedFood: 7 });
    const isolatedHouse = add(city, 'house', 3, 4);

    simulateTick(city);

    expect([isolatedFarm.active, isolatedGranary.active, isolatedMarket.active]).toEqual([false, false, false]);
    expect(granary.storedFood).toBe(6);
    expect(market.storedFood).toBe(4);
    expect(isolatedGranary.storedFood).toBe(20);
    expect(isolatedMarket.storedFood).toBe(7);
    expect(isolatedHouse.hasFood).toBe(false);
    expect(getMarketSupplyCandidates(city, isolatedMarket)).toEqual([]);
    expect(getFoodStats(city)).toMatchObject({ foodStored: 37, granaryCapacity: 100, marketCapacity: 40, suppliedMarkets: 1 });
  });

  it('does not put connected farm production into an isolated granary', () => {
    const city = createEmptyCity();
    workers(city);
    road(city, 0, 3, 1);
    add(city, 'farm', 0, 0);
    add(city, 'road', 6, 1);
    const granary = add(city, 'granary', 6, 0, { storedFood: 12 });

    simulateTick(city);

    expect(granary.active).toBe(false);
    expect(granary.storedFood).toBe(12);
    expect(getFoodStats(city).foodCapacity).toBe(0);
  });

  it('selects granaries by road distance then position regardless of insertion order', () => {
    const city = createEmptyCity();
    workers(city);
    road(city, 0, 8, 2);
    const market = add(city, 'market', 4, 1);
    const farther = add(city, 'granary', 0, 1, { storedFood: 10 });
    const later = add(city, 'granary', 6, 3, { storedFood: 10 });
    const earlier = add(city, 'granary', 2, 1, { storedFood: 10 });
    city.buildings.reverse();

    simulateTick(city);

    expect(getMarketSupplyCandidates(city, market)).toEqual([earlier, later, farther]);
    expect(earlier.storedFood).toBe(6);
    expect(later.storedFood).toBe(10);
    expect(farther.storedFood).toBe(10);
  });

  it('consumes from the nearest market with position breaking road-distance ties', () => {
    const city = createEmptyCity();
    workers(city);
    road(city, 0, 8, 2);
    const house = add(city, 'house', 4, 1);
    const farther = add(city, 'market', 0, 1, { storedFood: 10 });
    const later = add(city, 'market', 6, 3, { storedFood: 10 });
    const earlier = add(city, 'market', 2, 1, { storedFood: 10 });
    city.buildings.reverse();
    city.simulation.tick = 1;

    simulateTick(city);

    expect(house.hasFood).toBe(true);
    expect(earlier.storedFood).toBe(9);
    expect(later.storedFood).toBe(10);
    expect(farther.storedFood).toBe(10);
  });

  it('uses main-network truth consistently for house services, housing stats and migration', () => {
    const city = createEmptyCity();
    workers(city);
    road(city, 0, 6, 1);
    road(city, 0, 2, 4);
    add(city, 'well', 0, 0);
    add(city, 'market', 1, 0, { storedFood: 20 });
    const connected = add(city, 'house', 2, 0, { population: 2 });
    const isolated = add(city, 'house', 2, 3, { population: 2, hasFood: true });
    city.simulation.tick = 14;

    simulateTick(city);

    expect(hasAdjacentRoad(city, isolated)).toBe(false);
    expect(getHouseServices(city, connected)).toEqual({
      road: true, water: true, food: true, desirability: 'medium',
    });
    expect(getHouseServices(city, isolated)).toEqual({
      road: false, water: false, food: false, desirability: 'medium',
    });
    expect(getHousingStats(city)).toMatchObject({ housesWithRoadAccess: 1, housesWithWater: 1, housesWithFood: 1 });
    expect(connected.population).toBe(3);
    expect(isolated.population).toBe(1);
  });
});
