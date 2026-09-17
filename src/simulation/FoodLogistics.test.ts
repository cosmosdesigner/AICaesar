import { describe, expect, it } from 'vitest';
import type { Building, CityState } from './CityState';
import {
  createCityState,
} from './CityState';
import {
  FARM_FOOD_PER_TICK,
  GRANARY_FOOD_CAPACITY,
  MARKET_FOOD_CAPACITY,
  MARKET_RESTOCK_PER_TICK,
  getFoodCoveredTiles,
  getFoodStats,
  getMarketFoodDemand,
  simulateTick,
} from './Simulation';
import type { BuildingType, Tile } from './Tile';

function createEmptyCity(width = 20, height = 20): CityState {
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) tiles.push({ x, y, terrain: 'grass' });
  }

  const city: CityState = {
    width,
    height,
    tiles,
    buildings: [],
    resources: { money: 500 },
    simulation: { tick: 0, finance: { period: 0, lastRevenue: 0, lastUpkeep: 0, lastNet: 0 }, population: { lastChange: 0 } },
  };
  for (let x = 0; x <= 18; x++) addBuilding(city, 'road', x, 0);
  for (let y = 1; y <= 3; y++) addBuilding(city, 'road', 0, y);
  for (let x = 1; x <= 5; x++) addBuilding(city, 'road', x, 3);
  for (let y = 4; y <= 7; y++) addBuilding(city, 'road', 5, y);
  return city;
}

function addBuilding(city: CityState, type: BuildingType, x: number, y: number, patch: Partial<Building> = {}): Building {
  const building: Building = {
    id: `${type}-${x}-${y}`,
    type,
    x,
    y,
    ...(type === 'house' ? { level: 1, hasRoadAccess: false, hasWater: false, hasFood: false, upgradeProgress: 0, degradeProgress: 0 } : {}),
    ...(type === 'farm' || type === 'granary' || type === 'market' ? { active: false } : {}),
    ...(type === 'granary' || type === 'market' ? { storedFood: 0 } : {}),
    ...patch,
  };
  city.buildings.push(building);
  const tile = city.tiles[y * city.width + x];
  if (!tile) throw new Error(`Missing tile ${x},${y}`);
  tile.buildingId = building.id;
  return building;
}

function addWorkerHouse(city: CityState, x: number, y: number): Building {
  return addBuilding(city, 'house', x, y, { level: 3, population: 14, hasFood: true, hasWater: true, hasRoadAccess: true });
}

describe('Phase 17 food logistics', () => {
  it('stores farm production in active granaries instead of global resources', () => {
    const city = createEmptyCity();
    addWorkerHouse(city, 15, 15);
    addWorkerHouse(city, 16, 15);
    addBuilding(city, 'farm', 1, 1);
    const granary = addBuilding(city, 'granary', 2, 1);

    simulateTick(city);

    expect(granary.storedFood).toBe(FARM_FOOD_PER_TICK);
    expect(getFoodStats(city)).toMatchObject({
      granaryFood: FARM_FOOD_PER_TICK,
      marketFood: 0,
      foodStored: FARM_FOOD_PER_TICK,
      foodCapacity: GRANARY_FOOD_CAPACITY,
    });
    expect('food' in city.resources).toBe(false);
  });

  it('does not store farm production when granaries are inactive or full', () => {
    const inactiveCity = createEmptyCity();
    addBuilding(inactiveCity, 'farm', 1, 1, { active: true });
    const inactiveGranary = addBuilding(inactiveCity, 'granary', 2, 1, { active: true });

    simulateTick(inactiveCity);

    expect(inactiveGranary.storedFood).toBe(0);

    const fullCity = createEmptyCity();
    addWorkerHouse(fullCity, 15, 15);
    addWorkerHouse(fullCity, 16, 15);
    addBuilding(fullCity, 'farm', 1, 1);
    const fullGranary = addBuilding(fullCity, 'granary', 2, 1, { storedFood: GRANARY_FOOD_CAPACITY });

    simulateTick(fullCity);

    expect(fullGranary.storedFood).toBe(GRANARY_FOOD_CAPACITY);
  });

  it('reports market demand as capacity minus stored food', () => {
    const market = { type: 'market', storedFood: 13 } as Building;

    expect(getMarketFoodDemand(market)).toBe(MARKET_FOOD_CAPACITY - 13);
    expect(getMarketFoodDemand({ ...market, storedFood: MARKET_FOOD_CAPACITY + 5 })).toBe(0);
  });

  it('restocks active markets from nearest active granaries within supply radius', () => {
    const city = createEmptyCity();
    addWorkerHouse(city, 15, 15);
    addWorkerHouse(city, 16, 15);
    const nearGranary = addBuilding(city, 'granary', 1, 1, { storedFood: 10 });
    const farGranary = addBuilding(city, 'granary', 4, 7, { storedFood: 10 });
    const market = addBuilding(city, 'market', 4, 1);

    simulateTick(city);

    expect(market.storedFood).toBe(MARKET_RESTOCK_PER_TICK);
    expect(nearGranary.storedFood).toBe(10 - MARKET_RESTOCK_PER_TICK);
    expect(farGranary.storedFood).toBe(10);
  });

  it('does not restock markets outside granary supply radius', () => {
    const city = createEmptyCity();
    addWorkerHouse(city, 15, 15);
    const granary = addBuilding(city, 'granary', 1, 1, { storedFood: 10 });
    const market = addBuilding(city, 'market', 15, 1);

    simulateTick(city);

    expect(market.storedFood).toBe(0);
    expect(granary.storedFood).toBe(10);
  });

  it('houses consume market stock and never consume granary stock directly', () => {
    const city = createEmptyCity();
    const house = addBuilding(city, 'house', 2, 2);
    addWorkerHouse(city, 15, 15);
    addWorkerHouse(city, 16, 15);
    const granary = addBuilding(city, 'granary', 15, 1, { storedFood: 10 });
    const market = addBuilding(city, 'market', 4, 2, { storedFood: 1 });

    simulateTick(city);
    simulateTick(city);

    expect(house.hasFood).toBe(true);
    expect(market.storedFood).toBe(0);
    expect(granary.storedFood).toBe(10);
  });

  it('does not provide food coverage from an empty market', () => {
    const city = createEmptyCity();
    const house = addBuilding(city, 'house', 2, 2);
    addWorkerHouse(city, 15, 15);
    addBuilding(city, 'market', 4, 2, { storedFood: 0 });

    simulateTick(city);

    expect(getFoodCoveredTiles(city).has('2,2')).toBe(false);
    expect(house.hasFood).toBe(false);
  });

  it('sums granary and market stock in food stats', () => {
    const city = createEmptyCity();
    addBuilding(city, 'granary', 1, 1, { active: true, storedFood: 12 });
    addBuilding(city, 'market', 2, 1, { active: true, storedFood: 7 });

    expect(getFoodStats(city)).toMatchObject({
      granaryFood: 12,
      granaryCapacity: GRANARY_FOOD_CAPACITY,
      marketFood: 7,
      marketCapacity: MARKET_FOOD_CAPACITY,
      marketDemand: MARKET_FOOD_CAPACITY - 7,
      foodStored: 19,
      foodCapacity: GRANARY_FOOD_CAPACITY + MARKET_FOOD_CAPACITY,
      suppliedMarkets: 1,
    });
  });

  it('resets granary and market stock to zero without resources food', () => {
    const city = createCityState();
    const granary = city.buildings.find((building) => building.type === 'granary');
    const market = city.buildings.find((building) => building.type === 'market');

    expect('food' in city.resources).toBe(false);
    expect(granary?.storedFood).toBe(0);
    expect(market?.storedFood).toBe(0);
  });
});
