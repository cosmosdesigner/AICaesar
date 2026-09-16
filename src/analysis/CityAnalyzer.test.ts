import { describe, expect, it } from 'vitest';
import { analyzeCity, summarizeCity } from './CityAnalyzer';
import type { Building, CityState } from '../simulation/CityState';
import type { BuildingType, Tile } from '../simulation/Tile';

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
    simulation: { tick: 0, finance: { period: 0, lastRevenue: 0, lastUpkeep: 0, lastNet: 0 }, population: { lastChange: 0 } },
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

describe('CityAnalyzer', () => {
  it('detects a road-connected house without water', () => {
    const city = createEmptyCity();
    addBuilding(city, 'road', 1, 2);
    addBuilding(city, 'house', 2, 2, { level: 1, hasFood: false });

    expect(analyzeCity(city).map((issue) => issue.type)).toContain('water_shortage');
    expect(summarizeCity(city).housesWithoutWater).toBe(1);
  });

  it('detects houses without expected food and missing production', () => {
    const city = createEmptyCity();
    addBuilding(city, 'road', 1, 2);
    addBuilding(city, 'house', 2, 2, { level: 2, hasFood: false });
    addBuilding(city, 'well', 2, 4);
    addBuilding(city, 'market', 4, 2, { active: true });

    const issueTypes = analyzeCity(city).map((issue) => issue.type);

    expect(issueTypes).toContain('food_shortage');
    expect(issueTypes).toContain('food_production_shortage');
    expect(summarizeCity(city).housesWithoutFood).toBe(1);
  });

  it('explains missing food storage before production can feed houses', () => {
    const city = createEmptyCity();
    addBuilding(city, 'road', 1, 2);
    addBuilding(city, 'house', 2, 2, { level: 2, hasFood: false });
    addBuilding(city, 'well', 2, 4);
    addBuilding(city, 'farm', 4, 2, { active: true });

    const issue = analyzeCity(city).find((candidate) => candidate.type === 'food_production_shortage');

    expect(issue?.cause).toContain('granary');
  });

  it('detects distribution failure when granary food cannot reach houses through markets', () => {
    const city = createEmptyCity();
    addBuilding(city, 'road', 1, 2);
    addBuilding(city, 'house', 2, 2, { level: 2, hasFood: false });
    addBuilding(city, 'well', 2, 4);
    addBuilding(city, 'granary', 4, 2, { active: true, storedFood: 12 });
    addBuilding(city, 'market', 7, 7, { active: true, storedFood: 0 });

    const issue = analyzeCity(city).find((candidate) => candidate.type === 'food_distribution_shortage');

    expect(issue?.cause).toContain('market');
  });

  it('detects worker shortage deterministically', () => {
    const city = createEmptyCity();
    addBuilding(city, 'road', 1, 2);
    addBuilding(city, 'house', 2, 2, { level: 1, hasFood: false });
    addBuilding(city, 'farm', 4, 2, { active: false });
    addBuilding(city, 'granary', 5, 2, { active: false });
    addBuilding(city, 'market', 6, 2, { active: false });

    const issues = analyzeCity(city);

    expect(issues.map((issue) => issue.type)).toContain('worker_shortage');
    expect(issues).toEqual([...issues].sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 } as const;
      const typeOrder = {
        water_shortage: 0,
        food_shortage: 1,
        food_production_shortage: 2,
        food_distribution_shortage: 3,
        worker_shortage: 4,
        road_access_missing: 5,
        low_money: 6,
      } as const;
      return severityOrder[a.severity] - severityOrder[b.severity]
        || typeOrder[a.type] - typeOrder[b.type]
        || b.affectedTiles.length - a.affectedTiles.length;
    }));
  });
});
