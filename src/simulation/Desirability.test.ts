import { describe, expect, it } from 'vitest';
import type { Building, CityState } from './CityState';
import {
  DESIRABILITY_BASE_SCORE,
  getDesirabilityOverlayTiles,
  getDesirabilityStats,
  getTileDesirability,
} from './Desirability';
import type { BuildingType, Tile } from './Tile';

function createEmptyCity(width = 10, height = 10): CityState {
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
    simulation: { tick: 0, finance: { period: 0, lastRevenue: 0, lastUpkeep: 0, lastNet: 0 }, population: { lastChange: 0 } },
  };
}

function addBuilding(city: CityState, type: BuildingType, x: number, y: number): Building {
  const building: Building = { id: `${type}-${x}-${y}`, type, x, y };
  city.buildings.push(building);
  city.tiles[y * city.width + x]!.buildingId = building.id;
  return building;
}

describe('desirability', () => {
  it('uses the base score where no modifier reaches the tile', () => {
    const city = createEmptyCity();

    expect(getTileDesirability(city, 5, 5)).toEqual({
      score: DESIRABILITY_BASE_SCORE,
      positive: 0,
      negative: 0,
    });
  });

  it('adds garden, plaza and fountain effects at their inclusive Manhattan radii', () => {
    const city = createEmptyCity();
    addBuilding(city, 'garden', 3, 5);
    addBuilding(city, 'plaza', 5, 2);
    addBuilding(city, 'fountain', 8, 5);

    expect(getTileDesirability(city, 5, 5)).toEqual({ score: 85, positive: 35, negative: 0 });
    expect(getTileDesirability(city, 0, 5).score).toBe(DESIRABILITY_BASE_SCORE);
  });

  it('subtracts nearby farms, granaries and markets without affecting distant tiles', () => {
    const city = createEmptyCity();
    addBuilding(city, 'farm', 2, 5);
    addBuilding(city, 'granary', 5, 2);
    addBuilding(city, 'market', 7, 5);

    expect(getTileDesirability(city, 5, 5)).toEqual({ score: 22, positive: 0, negative: -28 });
    expect(getTileDesirability(city, 9, 9).score).toBe(DESIRABILITY_BASE_SCORE);
  });

  it('stacks modifiers and clamps the score between zero and one hundred', () => {
    const city = createEmptyCity();
    for (let index = 0; index < 5; index += 1) addBuilding(city, 'fountain', 5, 5);
    expect(getTileDesirability(city, 5, 5)).toEqual({ score: 100, positive: 75, negative: 0 });

    for (let index = 0; index < 10; index += 1) addBuilding(city, 'granary', 5, 5);
    expect(getTileDesirability(city, 5, 5)).toEqual({ score: 5, positive: 75, negative: -120 });
  });

  it('derives deterministic tiers for every overlay tile', () => {
    const city = createEmptyCity(3, 1);
    addBuilding(city, 'granary', 0, 0);
    addBuilding(city, 'garden', 2, 0);

    const overlay = getDesirabilityOverlayTiles(city);
    expect([...overlay.entries()]).toEqual([
      ['0,0', { score: 46, positive: 8, negative: -12 }],
      ['1,0', { score: 46, positive: 8, negative: -12 }],
      ['2,0', { score: 46, positive: 8, negative: -12 }],
    ]);
  });

  it('calculates house-only averages and low/good counts', () => {
    const city = createEmptyCity();
    addBuilding(city, 'house', 1, 1);
    addBuilding(city, 'house', 8, 8);
    addBuilding(city, 'granary', 1, 2);
    addBuilding(city, 'fountain', 8, 7);

    expect(getDesirabilityStats(city)).toEqual({
      average: 52,
      housesWithLowDesirability: 1,
      housesWithGoodDesirability: 1,
    });
  });
});
