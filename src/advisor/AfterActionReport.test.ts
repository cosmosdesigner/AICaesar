import { describe, expect, it } from 'vitest';
import { BUILD_COSTS, getBuildingAt, type Building, type CityState } from '../simulation/CityState';
import type { BuildingType, Tile } from '../simulation/Tile';
import type { AdvisorAction, AdvisorPlan } from './MockAdvisor';
import { approveAdvisorPlan } from './AdvisorApproval';
import { createAfterActionReport, createCityMetricsSnapshot, type CityMetricsSnapshot } from './AfterActionReport';

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
    simulation: { tick: 0 },
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

function buildAction(type: AdvisorAction['type'], estimatedCost: number, target?: { readonly x: number; readonly y: number }): AdvisorAction {
  return {
    type,
    label: type,
    reason: 'test action',
    estimatedCost,
    ...(target ? { target } : {}),
  };
}

function createPlan(actions: readonly AdvisorAction[], estimatedCost = actions.reduce((total, action) => total + action.estimatedCost, 0)): AdvisorPlan {
  return {
    summary: 'test plan',
    reasoning: ['test'],
    actions,
    estimatedCost,
    expectedImpact: ['test'],
    risks: ['test'],
  };
}

function createSnapshot(overrides: Partial<CityMetricsSnapshot> = {}): CityMetricsSnapshot {
  return {
    money: 500,
    foodStored: 0,
    foodCapacity: 0,
    houses: 1,
    housesWithWater: 0,
    housesWithFood: 0,
    levelTwoHouses: 0,
    levelThreeHouses: 0,
    population: 4,
    workersAvailable: 2,
    workersRequired: 0,
    workerShortage: 0,
    activeWorkplaces: 0,
    inactiveWorkplaces: 0,
    issueCount: 1,
    highSeverityIssues: 1,
    ...overrides,
  };
}

describe('AfterActionReport', () => {
  it('creates a city metrics snapshot from money, food, houses, workers, workplaces, and issues', () => {
    const city = createEmptyCity(8, 8, 321);
    city.resources.food = 12;
    addBuilding(city, 'road', 1, 2);
    addBuilding(city, 'house', 2, 2, { level: 2, hasFood: false });
    addBuilding(city, 'granary', 1, 3, { active: true, storedFood: 0 });

    expect(createCityMetricsSnapshot(city)).toEqual({
      money: 321,
      foodStored: 12,
      foodCapacity: 100,
      houses: 1,
      housesWithWater: 0,
      housesWithFood: 0,
      levelTwoHouses: 1,
      levelThreeHouses: 0,
      population: 8,
      workersAvailable: 4,
      workersRequired: 4,
      workerShortage: 0,
      activeWorkplaces: 1,
      inactiveWorkplaces: 0,
      issueCount: 1,
      highSeverityIssues: 1,
    });
  });

  it('calculates deterministic deltas and concise summary text', () => {
    const report = createAfterActionReport({
      before: createSnapshot({ money: 500, housesWithWater: 2, workerShortage: 3, issueCount: 2 }),
      after: createSnapshot({ money: 465, housesWithWater: 3, workerShortage: 0, issueCount: 1 }),
      executedActions: 1,
      spent: 35,
      remainingIssues: [],
    });

    expect(report.summary).toBe('Executed 1 action, spent 35.');
    expect(report.executedActions).toBe(1);
    expect(report.spent).toBe(35);
    expect(report.deltas).toEqual([
      { label: 'Money', before: 500, after: 465, delta: -35 },
      { label: 'Houses with water', before: 2, after: 3, delta: 1 },
      { label: 'Worker shortage', before: 3, after: 0, delta: -3 },
      { label: 'Issue count', before: 2, after: 1, delta: -1 },
    ]);
    expect(report.remainingIssues).toEqual([]);
  });

  it('keeps the top three remaining issues in analyzer order', () => {
    const report = createAfterActionReport({
      before: createSnapshot(),
      after: createSnapshot({ issueCount: 4 }),
      executedActions: 0,
      spent: 0,
      remainingIssues: [
        { type: 'water_shortage', severity: 'high', affectedTiles: [], explanation: 'Falta água em 3 casas.', cause: 'test' },
        { type: 'worker_shortage', severity: 'medium', affectedTiles: [], explanation: 'Faltam 2 trabalhadores.', cause: 'test' },
        { type: 'road_access_missing', severity: 'low', affectedTiles: [], explanation: '1 edifício económico sem estrada.', cause: 'test' },
        { type: 'low_money', severity: 'low', affectedTiles: [], explanation: 'Dinheiro baixo.', cause: 'test' },
      ],
    });

    expect(report.summary).toBe('No build actions executed. City observed.');
    expect(report.remainingIssues).toEqual([
      '[high] Falta água em 3 casas.',
      '[medium] Faltam 2 trabalhadores.',
      '[low] 1 edifício económico sem estrada.',
    ]);
  });

  it('generates a report after successful approved execution', () => {
    const city = createEmptyCity();
    addBuilding(city, 'road', 1, 2);
    addBuilding(city, 'house', 2, 2, { level: 1, hasFood: false });
    const result = approveAdvisorPlan(city, createPlan([
      buildAction('build_well', BUILD_COSTS.well, { x: 3, y: 2 }),
    ]));

    expect(result.ok).toBe(true);
    expect(result.report).toMatchObject({
      executedActions: 1,
      spent: BUILD_COSTS.well,
      summary: 'Executed 1 action, spent 35.',
    });
    expect(result.report?.deltas).toContainEqual({ label: 'Money', before: 500, after: 465, delta: -35 });
    expect(result.report?.deltas).toContainEqual({ label: 'Houses with water', before: 0, after: 1, delta: 1 });
    expect(getBuildingAt(city, 3, 2)?.type).toBe('well');
  });

  it('does not generate a report when approved execution fails validation', () => {
    const city = createEmptyCity();
    addBuilding(city, 'road', 2, 3);

    const result = approveAdvisorPlan(city, createPlan([
      buildAction('build_well', BUILD_COSTS.well, { x: 2, y: 3 }),
    ]));

    expect(result.ok).toBe(false);
    expect(result.report).toBeUndefined();
    expect(result.message).toContain('rejected');
    expect(city.resources.money).toBe(500);
  });
});
