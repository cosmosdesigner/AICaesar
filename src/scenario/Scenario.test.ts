import { describe, expect, it } from 'vitest';
import { createCityState, type Building, type CityState } from '../simulation/CityState';
import { assignWorkers } from '../simulation/Simulation';
import type { BuildingType, Tile } from '../simulation/Tile';
import {
  FOUNDING_SETTLEMENT_SCENARIO,
  evaluateScenario,
  getScenarioContext,
  type ScenarioObjective,
  type ScenarioProgress,
} from './Scenario';

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
    resources: { money, food: 0 },
    simulation: { tick: 0, finance: { period: 0, lastRevenue: 0, lastUpkeep: 0, lastNet: 0 } },
  };
}

function addBuilding(
  city: CityState,
  type: BuildingType,
  x: number,
  y: number,
  fields: Partial<Building> = {},
): void {
  const id = `${type}-${x}-${y}`;
  const tile = city.tiles[y * city.width + x];
  if (tile === undefined) throw new Error(`Missing test tile ${x},${y}`);
  tile.buildingId = id;
  city.buildings.push({ id, type, x, y, ...fields });
}

function addHouse(
  city: CityState,
  x: number,
  y: number,
  fields: Partial<Building> = {},
): void {
  addBuilding(city, 'house', x, y, {
    level: 1,
    hasRoadAccess: false,
    hasWater: false,
    hasFood: false,
    upgradeProgress: 0,
    ...fields,
  });
}

function getObjective(progress: ScenarioProgress, id: ScenarioObjective['id']): ScenarioObjective {
  const objective = progress.objectives.find((candidate) => candidate.id === id);
  if (objective === undefined) throw new Error(`Missing objective ${id}`);
  return objective;
}

describe('Founding Settlement scenario evaluation', () => {
  it('reports active progress and the immutable objective targets for the seed city', () => {
    const city = createCityState();
    assignWorkers(city);

    const progress = evaluateScenario(city, FOUNDING_SETTLEMENT_SCENARIO);

    expect(Object.isFrozen(FOUNDING_SETTLEMENT_SCENARIO)).toBe(true);
    expect(Object.isFrozen(FOUNDING_SETTLEMENT_SCENARIO.objectives)).toBe(true);
    expect(progress.status).toBe('active');
    expect(progress.completedObjectives).toBeLessThan(progress.totalObjectives);
    expect(progress.objectives.map((objective) => [objective.id, objective.label, objective.target])).toEqual([
      ['population', 'Population', 80],
      ['water-coverage', 'Water coverage', 70],
      ['food-coverage', 'Food coverage', 50],
      ['worker-shortage', 'Worker shortage', 20],
      ['money', 'Money', 100],
    ]);
  });

  it('wins only when every objective passes in the same evaluation', () => {
    const city = createEmptyCity();
    city.resources.money = 100;
    addBuilding(city, 'well', 5, 5);
    const houseTiles = [
      [5, 2], [4, 3], [5, 3], [6, 3], [3, 5],
      [4, 5], [6, 5], [7, 5], [5, 6], [5, 7],
    ] as const;
    houseTiles.forEach(([x, y], index) => addHouse(city, x, y, { level: 3, hasFood: index < 5 }));
    assignWorkers(city);

    const progress = evaluateScenario(city, FOUNDING_SETTLEMENT_SCENARIO);

    expect(progress.status).toBe('won');
    expect(progress.completedObjectives).toBe(5);
    expect(progress.resultMessage).toBe('Victory: the settlement is stable and self-supporting.');
  });

  it('loses when money drops below the scenario floor', () => {
    const city = createCityState();
    city.resources.money = 49;

    const progress = evaluateScenario(city, FOUNDING_SETTLEMENT_SCENARIO);

    expect(progress.status).toBe('lost');
    expect(progress.resultMessage).toBe('Defeat: the settlement treasury fell below 50.');
  });

  it('loses at the tick limit when the city has not already won', () => {
    const city = createCityState();
    city.simulation.tick = FOUNDING_SETTLEMENT_SCENARIO.maxTicks;

    const progress = evaluateScenario(city, FOUNDING_SETTLEMENT_SCENARIO);

    expect(progress.status).toBe('lost');
    expect(progress.resultMessage).toBe('Defeat: the settlement failed to meet its goals before tick 900.');
  });

  it('treats worker shortage as 0% when no workers are required', () => {
    const city = createEmptyCity();

    const workerShortage = getObjective(evaluateScenario(city, FOUNDING_SETTLEMENT_SCENARIO), 'worker-shortage');

    expect(workerShortage.current).toBe(0);
    expect(workerShortage.completed).toBe(true);
  });

  it('calculates water and food coverage percentages from total houses', () => {
    const city = createEmptyCity();
    addBuilding(city, 'well', 5, 5);
    const houseTiles = [
      [5, 2], [4, 3], [5, 3], [6, 3], [3, 5],
      [4, 5], [6, 5], [0, 0], [10, 10], [11, 10],
    ] as const;
    houseTiles.forEach(([x, y], index) => addHouse(city, x, y, { hasFood: index < 5 }));

    const progress = evaluateScenario(city, FOUNDING_SETTLEMENT_SCENARIO);

    expect(getObjective(progress, 'water-coverage')).toMatchObject({ current: 70, target: 70, completed: true });
    expect(getObjective(progress, 'food-coverage')).toMatchObject({ current: 50, target: 50, completed: true });
  });

  it('returns to active progress when a fresh city is evaluated after a loss', () => {
    const lostCity = createCityState();
    lostCity.resources.money = 49;
    expect(evaluateScenario(lostCity, FOUNDING_SETTLEMENT_SCENARIO).status).toBe('lost');

    const resetCity = createCityState();

    expect(evaluateScenario(resetCity, FOUNDING_SETTLEMENT_SCENARIO).status).toBe('active');
  });

  it('formats concise advisor context from current progress', () => {
    const city = createCityState();
    assignWorkers(city);

    const context = getScenarioContext(evaluateScenario(city, FOUNDING_SETTLEMENT_SCENARIO));

    expect(context).toMatch(/^Scenario progress: \d\/5 objectives complete\. Primary remaining objective: /);
    expect(context).toContain('/80');
  });
});
