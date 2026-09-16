import { describe, expect, it } from 'vitest';
import { HOUSE_DEGRADE_TICKS, HOUSE_SPECIFICATIONS, getHouseSpecification } from './HouseSpecification';
import {
  POPULATION_DECLINE_INTERVAL_TICKS,
  POPULATION_GROWTH_INTERVAL_TICKS,
  FINANCE_INTERVAL_TICKS,
  assignWorkers,
  getHouseTax,
  getPopulation,
  getPopulationStats,
  getWorkforceStats,
  simulateTick,
} from './Simulation';
import { BUILD_COSTS, createCityState, placeBuilding, type Building, type CityState } from './CityState';
import type { BuildingType, Tile } from './Tile';

function createEmptyCity(width = 16, height = 16, money = 500): CityState {
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) tiles.push({ x, y, terrain: 'grass' });
  }

  return {
    width,
    height,
    tiles,
    buildings: [],
    resources: { money },
    simulation: {
      tick: 0,
      finance: { period: 0, lastRevenue: 0, lastUpkeep: 0, lastNet: 0 },
      population: { lastChange: 0 },
    },
  };
}

function addBuilding(city: CityState, type: BuildingType, x: number, y: number, patch: Partial<Building> = {}): Building {
  const building: Building = {
    id: `${type}-${x}-${y}`,
    type,
    x,
    y,
    ...patch,
  };
  city.buildings.push(building);
  const tile = city.tiles[y * city.width + x];
  if (!tile) throw new Error(`Missing tile ${x},${y}`);
  tile.buildingId = building.id;
  return building;
}

function addHouse(city: CityState, x: number, y: number, patch: Partial<Building> = {}): Building {
  return addBuilding(city, 'house', x, y, {
    level: 1,
    hasRoadAccess: false,
    hasWater: false,
    hasFood: false,
    upgradeProgress: 0,
    degradeProgress: 0,
    population: 0,
    ...patch,
  });
}

function addRoadWaterFoodServices(city: CityState, house: Building, missing?: 'road' | 'water' | 'food'): void {
  if (missing !== 'road') addBuilding(city, 'road', house.x - 1, house.y);
  if (missing !== 'water') addBuilding(city, 'well', house.x, house.y + 2);
  if (missing !== 'food') addBuilding(city, 'market', house.x + 2, house.y, { storedFood: 40 });
}

function addWorkerPopulationForMarket(city: CityState): void {
  addHouse(city, 6, 2, { level: 3, population: HOUSE_SPECIFICATIONS[3].populationCapacity });
  addHouse(city, 6, 1, { level: 3, population: HOUSE_SPECIFICATIONS[3].populationCapacity });
  addBuilding(city, 'road', 6, 0);
  addBuilding(city, 'granary', 7, 2, { storedFood: 100 });
  addBuilding(city, 'road', 6, 3);
  addBuilding(city, 'well', 6, 4);
}

function tick(city: CityState, count: number): void {
  for (let i = 0; i < count; i++) simulateTick(city);
}

describe('population state', () => {
  it('seeds houses occupied to their level-1 capacity and tracks reset lastChange', () => {
    const city = createCityState();
    const houses = city.buildings.filter((building) => building.type === 'house');

    expect(houses.length).toBeGreaterThan(0);
    expect(houses.every((house) => house.population === HOUSE_SPECIFICATIONS[1].populationCapacity)).toBe(true);
    expect(city.simulation.population.lastChange).toBe(0);
    expect(getPopulationStats(city)).toMatchObject({
      population: houses.length * HOUSE_SPECIFICATIONS[1].populationCapacity,
      capacity: houses.length * HOUSE_SPECIFICATIONS[1].populationCapacity,
      availableHousing: 0,
      lastChange: 0,
    });
    expect(city.buildings.filter((building) => building.type !== 'house')
      .every((building) => building.population === undefined)).toBe(true);

    city.simulation.population.lastChange = 3;
    houses[0]!.population = 0;

    const resetCity = createCityState();
    const resetHouses = resetCity.buildings.filter((building) => building.type === 'house');
    expect(resetCity.simulation.population.lastChange).toBe(0);
    expect(resetHouses.every((house) => house.population === HOUSE_SPECIFICATIONS[1].populationCapacity)).toBe(true);
  });

  it('starts player-built houses empty', () => {
    const city = createEmptyCity();

    expect(placeBuilding(city, 2, 2, 'house')).toBe('built');

    expect(city.resources.money).toBe(500 - BUILD_COSTS.house);
    expect(city.buildings).toContainEqual(expect.objectContaining({ type: 'house', x: 2, y: 2, population: 0 }));
    expect(getPopulationStats(city)).toEqual({
      population: 0,
      capacity: HOUSE_SPECIFICATIONS[1].populationCapacity,
      availableHousing: 4,
      lastChange: 0,
    });
    expect(getWorkforceStats(city).workersAvailable).toBe(0);
  });

  it('grows a road, water and food served house by one resident every 3 ticks up to capacity', () => {
    const city = createEmptyCity();
    const house = addHouse(city, 2, 2, { level: 3, population: 0 });
    addRoadWaterFoodServices(city, house);
    addWorkerPopulationForMarket(city);

    tick(city, POPULATION_GROWTH_INTERVAL_TICKS - 1);
    expect(house.population).toBe(0);
    expect(city.simulation.population.lastChange).toBe(0);

    simulateTick(city);
    expect(house.population).toBe(1);
    expect(city.simulation.population.lastChange).toBe(1);

    simulateTick(city);
    expect(house.population).toBe(1);
    expect(city.simulation.population.lastChange).toBe(0);

    tick(city, POPULATION_GROWTH_INTERVAL_TICKS * 13 - 1);
    expect(house.population).toBe(HOUSE_SPECIFICATIONS[3].populationCapacity);
    simulateTick(city);
    expect(city.simulation.population.lastChange).toBe(0);
  });

  it('declines a house missing services by one resident every 5 ticks down to zero', () => {
    const city = createEmptyCity();
    const house = addHouse(city, 2, 2, { population: 2 });

    tick(city, POPULATION_DECLINE_INTERVAL_TICKS - 1);
    expect(house.population).toBe(2);
    expect(city.simulation.population.lastChange).toBe(0);

    simulateTick(city);
    expect(house.population).toBe(1);
    expect(city.simulation.population.lastChange).toBe(-1);

    tick(city, POPULATION_DECLINE_INTERVAL_TICKS);
    expect(house.population).toBe(0);
    expect(city.simulation.population.lastChange).toBe(-1);

    tick(city, POPULATION_DECLINE_INTERVAL_TICKS);
    expect(house.population).toBe(0);
    expect(city.simulation.population.lastChange).toBe(0);
  });

  it('does not grow above capacity', () => {
    const city = createEmptyCity();
    const house = addHouse(city, 2, 2, { level: 3, population: HOUSE_SPECIFICATIONS[3].populationCapacity - 1 });
    addRoadWaterFoodServices(city, house);
    addWorkerPopulationForMarket(city);

    tick(city, POPULATION_GROWTH_INTERVAL_TICKS);
    expect(house.population).toBe(HOUSE_SPECIFICATIONS[3].populationCapacity);

    tick(city, POPULATION_GROWTH_INTERVAL_TICKS);
    expect(house.population).toBe(HOUSE_SPECIFICATIONS[3].populationCapacity);
  });

  it('clamps population to the new capacity immediately when a house degrades', () => {
    const city = createEmptyCity();
    const house = addHouse(city, 2, 2, {
      level: 3,
      population: HOUSE_SPECIFICATIONS[3].populationCapacity,
      hasRoadAccess: true,
      hasWater: true,
      hasFood: false,
    });
    addBuilding(city, 'road', 1, 2);
    addBuilding(city, 'well', 2, 4);

    tick(city, HOUSE_DEGRADE_TICKS);

    expect(house.level).toBe(2);
    expect(house.population).toBe(HOUSE_SPECIFICATIONS[2].populationCapacity);
    expect(city.simulation.population.lastChange).toBe(
      HOUSE_SPECIFICATIONS[2].populationCapacity - HOUSE_SPECIFICATIONS[3].populationCapacity,
    );
  });

  it.each(['road', 'water', 'food'] as const)('declines instead of growing when only %s is missing on a shared interval', (missing) => {
    const city = createEmptyCity();
    const house = addHouse(city, 2, 2, { population: 2 });
    addRoadWaterFoodServices(city, house, missing);
    addWorkerPopulationForMarket(city);
    city.simulation.tick = 14;

    simulateTick(city);

    expect(house.hasRoadAccess).toBe(missing !== 'road');
    expect(house.hasWater).toBe(missing !== 'water');
    expect(house.hasFood).toBe(missing !== 'food');
    expect(house.population).toBe(1);
  });

  it('grows newly built housing on the global interval rather than its age', () => {
    const city = createEmptyCity();
    city.simulation.tick = 2;
    expect(placeBuilding(city, 2, 2, 'house')).toBe('built');
    const house = city.buildings[0]!;
    addRoadWaterFoodServices(city, house);
    addWorkerPopulationForMarket(city);

    simulateTick(city);

    expect(house.population).toBe(1);
    expect(city.simulation.population.lastChange).toBe(1);
  });

  it('opens upgrade capacity without instantly filling it', () => {
    const city = createEmptyCity();
    const house = addHouse(city, 2, 2, { population: 4, upgradeProgress: 2 });
    addRoadWaterFoodServices(city, house);
    addWorkerPopulationForMarket(city);

    simulateTick(city);
    expect(house.level).toBe(2);
    expect(house.population).toBe(4);
    expect(city.simulation.population.lastChange).toBe(0);

    tick(city, 2);
    expect(house.population).toBe(5);
    expect(city.simulation.population.lastChange).toBe(1);
  });

  it('clamps before scheduled decline and reassigns workers before finance', () => {
    const city = createEmptyCity();
    const house = addHouse(city, 2, 2, { level: 3, population: 14, degradeProgress: HOUSE_DEGRADE_TICKS - 1 });
    const granary = addBuilding(city, 'granary', 7, 2);
    city.simulation.tick = FINANCE_INTERVAL_TICKS - 1;

    simulateTick(city);

    expect(house.level).toBe(2);
    expect(house.population).toBe(7);
    expect(city.simulation.population.lastChange).toBe(-7);
    expect(granary.active).toBe(false);
    expect(getWorkforceStats(city).workerShortage).toBe(1);
    expect(city.simulation.finance.lastRevenue).toBe(4);
  });

  it('reassigns workers immediately after growth using food supplied earlier in the tick', () => {
    const city = createEmptyCity();
    const house = addHouse(city, 2, 2, { level: 3, population: 9 });
    addRoadWaterFoodServices(city, house);
    const support = addHouse(city, 6, 2, { level: 3, population: 14 });
    addBuilding(city, 'road', 6, 3);
    addBuilding(city, 'well', 6, 4);
    const farm = addBuilding(city, 'farm', 10, 10);
    const secondFarm = addBuilding(city, 'farm', 11, 10);
    city.simulation.tick = 2;

    simulateTick(city);

    expect(house.population).toBe(10);
    expect(support.population).toBe(14);
    expect(farm.active).toBe(true);
    expect(secondFarm.active).toBe(true);
    expect(getWorkforceStats(city).workersAvailable).toBe(12);
    expect(house.hasFood).toBe(true);
    expect(city.buildings.find((building) => building.type === 'market')?.active).toBe(false);
  });

  it('reports the net change when immigration and emigration coincide', () => {
    const city = createEmptyCity();
    const growing = addHouse(city, 2, 2, { population: 0 });
    const declining = addHouse(city, 12, 12, { population: 1 });
    addRoadWaterFoodServices(city, growing);
    addWorkerPopulationForMarket(city);
    city.simulation.tick = 14;

    simulateTick(city);

    expect(growing.population).toBe(1);
    expect(declining.population).toBe(0);
    expect(city.simulation.population.lastChange).toBe(0);
  });

  it('derives workforce from current population instead of housing capacity', () => {
    const city = createEmptyCity();
    addHouse(city, 2, 2, { level: 3, population: 1 });
    addBuilding(city, 'farm', 4, 4, { active: false });
    assignWorkers(city);

    expect(getPopulation(city)).toBe(1);
    expect(getWorkforceStats(city)).toMatchObject({
      population: 1,
      workersAvailable: 0,
      workersRequired: 6,
      workerShortage: 6,
      activeWorkplaces: 0,
      inactiveWorkplaces: 1,
    });
  });

  it('taxes empty houses at zero and rounds each occupied house up separately', () => {
    const city = createEmptyCity();
    const house = addHouse(city, 1, 1, { level: 3, population: 0 });
    expect(getHouseTax(city)).toBe(0);

    house.population = 1;
    expect(getHouseTax(city)).toBe(1);
    house.population = 7;
    expect(getHouseTax(city)).toBe(4);
    house.population = getHouseSpecification(house.level).populationCapacity;
    expect(getHouseTax(city)).toBe(HOUSE_SPECIFICATIONS[3].taxPerPeriod);

    house.population = 1;
    addHouse(city, 2, 1, { population: 1 });
    expect(getHouseTax(city)).toBe(2);
  });
});
