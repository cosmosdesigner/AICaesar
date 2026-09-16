import { describe, expect, it } from 'vitest';
import type { Building, CityState } from './CityState';
import { createCityState } from './CityState';
import {
  applyFinancePeriod,
  FINANCE_INTERVAL_TICKS,
  getBuildingUpkeep,
  getFinanceStats,
  getHouseTax,
  simulateTick,
} from './Simulation';
import type { BuildingType, Tile } from './Tile';

function createEmptyCity(width = 8, height = 8, money = 500): CityState {
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) tiles.push({ x, y, terrain: 'grass' });
  }

  return {
    width,
    height,
    tiles,
    buildings: [],
    resources: { money, food: 0 },
    simulation: {
      tick: 0,
      finance: { period: 0, lastRevenue: 0, lastUpkeep: 0, lastNet: 0 },
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

describe('minimal finance economy', () => {
  it('calculates house taxes by level', () => {
    const city = createEmptyCity();
    addBuilding(city, 'house', 1, 1, { level: 1 });
    addBuilding(city, 'house', 2, 1, { level: 2 });
    addBuilding(city, 'house', 3, 1, { level: 3 });

    expect(getHouseTax(city)).toBe(13);
  });

  it('calculates upkeep for service and economic buildings, including inactive workplaces', () => {
    const city = createEmptyCity();
    addBuilding(city, 'road', 0, 0);
    addBuilding(city, 'house', 1, 0, { level: 3 });
    addBuilding(city, 'well', 2, 0);
    addBuilding(city, 'farm', 3, 0, { active: false });
    addBuilding(city, 'granary', 4, 0, { active: false });
    addBuilding(city, 'market', 5, 0, { active: false });

    expect(getBuildingUpkeep(city)).toBe(10);
  });

  it('applies one finance period to money and last-period state', () => {
    const city = createEmptyCity(8, 8, 100);
    addBuilding(city, 'house', 1, 1, { level: 3 });
    addBuilding(city, 'well', 2, 1);

    expect(applyFinancePeriod(city)).toEqual({
      period: 1,
      revenue: 7,
      upkeep: 1,
      net: 6,
      money: 106,
      ticksUntilNextPeriod: FINANCE_INTERVAL_TICKS,
    });
    expect(city.simulation.finance).toEqual({
      period: 1,
      lastRevenue: 7,
      lastUpkeep: 1,
      lastNet: 6,
    });
  });

  it('applies finance only on the configured simulation tick interval', () => {
    const city = createEmptyCity(8, 8, 100);
    addBuilding(city, 'house', 1, 1, { level: 1 });
    addBuilding(city, 'well', 2, 1);

    for (let i = 0; i < FINANCE_INTERVAL_TICKS - 1; i++) simulateTick(city);
    expect(city.resources.money).toBe(100);
    expect(getFinanceStats(city)).toMatchObject({
      period: 0,
      revenue: 0,
      upkeep: 0,
      net: 0,
      ticksUntilNextPeriod: 1,
    });

    simulateTick(city);
    expect(getFinanceStats(city)).toEqual({
      period: 1,
      revenue: 2,
      upkeep: 1,
      net: 1,
      money: 101,
      ticksUntilNextPeriod: FINANCE_INTERVAL_TICKS,
    });
  });

  it('allows finance upkeep to move treasury below zero', () => {
    const city = createEmptyCity(8, 8, 2);
    addBuilding(city, 'well', 1, 1);
    addBuilding(city, 'farm', 2, 1, { active: false });
    addBuilding(city, 'granary', 3, 1, { active: false });
    addBuilding(city, 'market', 4, 1, { active: false });

    applyFinancePeriod(city);

    expect(city.resources.money).toBe(-8);
    expect(city.simulation.finance.lastNet).toBe(-10);
  });

  it('starts a reset city with empty finance state', () => {
    const city = createCityState();
    city.simulation.finance.period = 3;
    city.simulation.finance.lastRevenue = 16;
    city.simulation.finance.lastUpkeep = 10;
    city.simulation.finance.lastNet = 6;

    const resetCity = createCityState();

    expect(resetCity.simulation.finance).toEqual({
      period: 0,
      lastRevenue: 0,
      lastUpkeep: 0,
      lastNet: 0,
    });
    expect(getFinanceStats(resetCity)).toMatchObject({
      period: 0,
      revenue: 0,
      upkeep: 0,
      net: 0,
      money: 500,
    });
  });
});
