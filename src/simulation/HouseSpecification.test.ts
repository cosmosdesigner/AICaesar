import { describe, expect, it } from 'vitest';
import type { Building, CityState } from './CityState';
import { createCityState } from './CityState';
import {
  HOUSE_DEGRADE_TICKS,
  HOUSE_SPECIFICATIONS,
  getHouseStatus,
} from './HouseSpecification';
import {
  getHouseTax,
  getPopulation,
  simulateTick,
} from './Simulation';
import type { BuildingType, Tile } from './Tile';

function createEmptyCity(width = 8, height = 8): CityState {
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) tiles.push({ x, y, terrain: 'grass' });
  }

  return {
    width,
    height,
    tiles,
    buildings: [],
    resources: { money: 500 },
    simulation: { tick: 0, finance: { period: 0, lastRevenue: 0, lastUpkeep: 0, lastNet: 0 } },
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

function tick(city: CityState, count: number): void {
  for (let i = 0; i < count; i++) simulateTick(city);
}

describe('HouseSpecification', () => {
  it('defines declarative levels, capacities, taxes and requirements', () => {
    expect(HOUSE_SPECIFICATIONS).toEqual({
      1: { level: 1, populationCapacity: 4, taxPerPeriod: 2, requirements: [], upgradeTicks: 0 },
      2: { level: 2, populationCapacity: 8, taxPerPeriod: 4, requirements: ['road', 'water'], upgradeTicks: 3 },
      3: { level: 3, populationCapacity: 14, taxPerPeriod: 7, requirements: ['road', 'water', 'food'], upgradeTicks: 5 },
    });
    expect(HOUSE_DEGRADE_TICKS).toBe(4);
  });

  it('exposes missing road, water and food in requirement order', () => {
    expect(getHouseStatus(1, { road: false, water: false, food: false })).toMatchObject({
      currentLevel: 1,
      targetLevel: 1,
      missingForNextLevel: 'road',
      canUpgrade: false,
      shouldDegrade: false,
    });
    expect(getHouseStatus(1, { road: true, water: false, food: false }).missingForNextLevel).toBe('water');
    expect(getHouseStatus(2, { road: true, water: true, food: false })).toMatchObject({
      currentLevel: 2,
      targetLevel: 2,
      missingForNextLevel: 'food',
      canUpgrade: false,
      shouldDegrade: false,
    });
    expect(getHouseStatus(3, { road: false, water: true, food: true })).toMatchObject({
      currentLevel: 3,
      targetLevel: 1,
      missingForCurrentLevel: 'road',
      shouldDegrade: true,
    });
  });

  it('derives population and taxes from the specification', () => {
    const city = createEmptyCity();
    addBuilding(city, 'house', 1, 1, { level: 1 });
    addBuilding(city, 'house', 2, 1, { level: 2 });
    addBuilding(city, 'house', 3, 1, { level: 3 });

    expect(getPopulation(city)).toBe(
      HOUSE_SPECIFICATIONS[1].populationCapacity
      + HOUSE_SPECIFICATIONS[2].populationCapacity
      + HOUSE_SPECIFICATIONS[3].populationCapacity,
    );
    expect(getHouseTax(city)).toBe(
      HOUSE_SPECIFICATIONS[1].taxPerPeriod
      + HOUSE_SPECIFICATIONS[2].taxPerPeriod
      + HOUSE_SPECIFICATIONS[3].taxPerPeriod,
    );
  });
});

describe('house evolution and degradation', () => {
  it('evolves a road and water served house from level 1 to level 2 after 3 ticks', () => {
    const city = createEmptyCity();
    const house = addBuilding(city, 'house', 2, 2, { level: 1, upgradeProgress: 0, degradeProgress: 0 });
    addBuilding(city, 'road', 1, 2);
    addBuilding(city, 'well', 2, 4);

    tick(city, HOUSE_SPECIFICATIONS[2].upgradeTicks - 1);
    expect(house.level).toBe(1);
    expect(house.upgradeProgress).toBe(2);

    simulateTick(city);
    expect(house.level).toBe(2);
    expect(house.upgradeProgress).toBe(0);
    expect(house.degradeProgress).toBe(0);
  });

  it('evolves a road, water and food served house from level 2 to level 3 after 5 ticks', () => {
    const city = createEmptyCity();
    const house = addBuilding(city, 'house', 2, 2, { level: 2, upgradeProgress: 0, degradeProgress: 0 });
    addBuilding(city, 'house', 6, 4, { level: 3 });
    addBuilding(city, 'house', 6, 5, { level: 3 });
    addBuilding(city, 'road', 1, 2);
    addBuilding(city, 'well', 2, 4);
    addBuilding(city, 'granary', 6, 6, { active: false });
    addBuilding(city, 'market', 4, 2, { active: false, storedFood: 20 });

    tick(city, HOUSE_SPECIFICATIONS[3].upgradeTicks - 1);
    expect(house.level).toBe(2);
    expect(house.upgradeProgress).toBe(4);

    simulateTick(city);
    expect(house.level).toBe(3);
    expect(house.upgradeProgress).toBe(0);
    expect(house.degradeProgress).toBe(0);
  });

  it('degrades a level 3 house without food to level 2 after 4 ticks', () => {
    const city = createEmptyCity();
    const house = addBuilding(city, 'house', 2, 2, { level: 3, upgradeProgress: 0, degradeProgress: 0 });
    addBuilding(city, 'road', 1, 2);
    addBuilding(city, 'well', 2, 4);

    tick(city, HOUSE_DEGRADE_TICKS - 1);
    expect(house.level).toBe(3);
    expect(house.degradeProgress).toBe(3);

    simulateTick(city);
    expect(house.level).toBe(2);
    expect(house.upgradeProgress).toBe(0);
    expect(house.degradeProgress).toBe(0);
  });

  it('degrades a level 2 house without water to level 1 after 4 ticks', () => {
    const city = createEmptyCity();
    const house = addBuilding(city, 'house', 2, 2, { level: 2, upgradeProgress: 0, degradeProgress: 0 });
    addBuilding(city, 'road', 1, 2);

    tick(city, HOUSE_DEGRADE_TICKS);

    expect(house.level).toBe(1);
    expect(house.upgradeProgress).toBe(0);
    expect(house.degradeProgress).toBe(0);
  });

  it('cancels pending degradation when services recover before the limit', () => {
    const city = createEmptyCity();
    const house = addBuilding(city, 'house', 2, 2, { level: 3, upgradeProgress: 0, degradeProgress: 0 });
    addBuilding(city, 'road', 1, 2);
    addBuilding(city, 'well', 2, 4);
    addBuilding(city, 'house', 6, 4, { level: 3 });
    addBuilding(city, 'house', 6, 5, { level: 3 });

    tick(city, HOUSE_DEGRADE_TICKS - 1);
    expect(house.degradeProgress).toBe(3);

    addBuilding(city, 'granary', 6, 6, { active: false });
    addBuilding(city, 'market', 4, 2, { active: false, storedFood: 20 });
    simulateTick(city);

    expect(house.level).toBe(3);
    expect(house.degradeProgress).toBe(0);
  });

  it('initializes seeded house progress for reset-ready city state', () => {
    const city = createCityState();
    const houses = city.buildings.filter((building) => building.type === 'house');

    expect(houses.length).toBeGreaterThan(0);
    expect(houses.every((house) => house.upgradeProgress === 0)).toBe(true);
    expect(houses.every((house) => house.degradeProgress === 0)).toBe(true);
  });
});
