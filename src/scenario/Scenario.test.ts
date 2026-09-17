import { describe, expect, it } from 'vitest';
import { createCityState, createCityStateForScenario, type Building, type CityState } from '../simulation/CityState';
import { assignWorkers, getPopulationStats, simulateTick } from '../simulation/Simulation';
import type { BuildingType, Tile } from '../simulation/Tile';
import {
  DIFFICULTY_PROFILES,
  FOUNDING_SETTLEMENT_SCENARIO,
  SCENARIO_CATALOG,
  evaluateScenario,
  resolveScenario,
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
    resources: { money },
    simulation: { tick: 0, finance: { period: 0, lastRevenue: 0, lastUpkeep: 0, lastNet: 0 }, population: { lastChange: 0 } },
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
    expect(progress.objectives.map((objective) => [objective.id, objective.target])).toEqual([
      ['population', 80],
      ['water-coverage', 70],
      ['food-coverage', 50],
      ['worker-shortage', 20],
      ['money', 100],
    ]);
  });

  it('wins only when every objective passes in the same evaluation', () => {
    const city = createEmptyCity();
    city.resources.money = 100;
    addBuilding(city, 'well', 4, 5);
    addBuilding(city, 'market', 5, 5, { storedFood: 40 });
    for (let x = 1; x <= 10; x++) addBuilding(city, 'road', x, 4);
    const houseTiles = [
      [1, 3], [2, 3], [3, 3], [4, 3], [5, 3],
      [6, 3], [7, 3], [8, 3], [9, 3], [10, 3],
    ] as const;
    houseTiles.forEach(([x, y], index) => addHouse(city, x, y, { level: 3, population: 14, hasFood: index < 5 }));
    assignWorkers(city);

    const progress = evaluateScenario(city, FOUNDING_SETTLEMENT_SCENARIO);

    expect(progress.status).toBe('won');
    expect(progress.completedObjectives).toBe(5);
  });

  it('loses when money drops below the scenario floor', () => {
    const city = createCityState();
    city.resources.money = 49;

    const progress = evaluateScenario(city, FOUNDING_SETTLEMENT_SCENARIO);

    expect(progress.status).toBe('lost');
  });

  it('loses at the tick limit when the city has not already won', () => {
    const city = createCityState();
    city.simulation.tick = FOUNDING_SETTLEMENT_SCENARIO.maxTicks;

    const progress = evaluateScenario(city, FOUNDING_SETTLEMENT_SCENARIO);

    expect(progress.status).toBe('lost');
  });

  it('treats worker shortage as 0% when no workers are required', () => {
    const city = createEmptyCity();

    const workerShortage = getObjective(evaluateScenario(city, FOUNDING_SETTLEMENT_SCENARIO), 'worker-shortage');

    expect(workerShortage.current).toBe(0);
    expect(workerShortage.completed).toBe(true);
  });

  it('advances the population objective when residents arrive, not when empty capacity is added', () => {
    const city = createEmptyCity();
    const houseTiles = [
      [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
    ] as const;
    houseTiles.forEach(([x, y]) => addHouse(city, x, y, { level: 3, population: 0 }));

    expect(getPopulationStats(city).capacity).toBe(98);
    expect(getObjective(evaluateScenario(city, FOUNDING_SETTLEMENT_SCENARIO), 'population'))
      .toMatchObject({ current: 0, completed: false });

    const houses = city.buildings.filter((building) => building.type === 'house');
    houses.forEach((house, index) => { house.population = index < 5 ? 14 : index === 5 ? 9 : 0; });
    expect(getObjective(evaluateScenario(city, FOUNDING_SETTLEMENT_SCENARIO), 'population'))
      .toMatchObject({ current: 79, completed: false });

    addBuilding(city, 'well', 4, 5);
    addBuilding(city, 'market', 5, 5, { storedFood: 40 });
    for (let x = 1; x <= 7; x++) addBuilding(city, 'road', x, 4);
    for (let tick = 0; tick < 3; tick++) simulateTick(city);

    expect(getPopulationStats(city)).toMatchObject({ population: 81, capacity: 98, lastChange: 2 });
    expect(getObjective(evaluateScenario(city, FOUNDING_SETTLEMENT_SCENARIO), 'population'))
      .toMatchObject({ current: 81, completed: true });
  });

  it('calculates water and food coverage percentages from total houses', () => {
    const city = createEmptyCity();
    addBuilding(city, 'well', 4, 5);
    addBuilding(city, 'market', 5, 5, { active: true, storedFood: 40 });
    for (let x = 1; x <= 7; x++) addBuilding(city, 'road', x, 4);
    const houseTiles = [
      [1, 3], [2, 3], [3, 3], [4, 3], [5, 3],
      [6, 3], [7, 3], [0, 0], [10, 10], [11, 10],
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
});

describe('Phase 25 scenario catalog and difficulty profiles', () => {
  it('exports exactly three immutable scenarios with distinct ids and briefings', () => {
    expect(SCENARIO_CATALOG.map((definition) => definition.id)).toEqual([
      'founding-settlement',
      'merchant-quarter',
      'resilient-province',
    ]);
    expect(new Set(SCENARIO_CATALOG.map((definition) => definition.briefing)).size).toBe(3);
    expect(Object.isFrozen(SCENARIO_CATALOG)).toBe(true);

    for (const definition of SCENARIO_CATALOG) {
      expect(Object.isFrozen(definition)).toBe(true);
      expect(Object.isFrozen(definition.objectives)).toBe(true);
      expect(Object.isFrozen(definition.seed)).toBe(true);
      expect(Object.isFrozen(definition.seed.buildings)).toBe(true);
    }
  });

  it('creates an evaluable Normal city for every scenario from supported deterministic seeds', () => {
    for (const definition of SCENARIO_CATALOG) {
      const normal = resolveScenario(definition, 'normal');
      const city = createCityStateForScenario(normal);
      assignWorkers(city);

      expect(city.resources.money).toBe(definition.initialMoney);
      expect(city.buildings.map(({ type, x, y, population }) => ({ type, x, y, population })))
        .toEqual(createCityStateForScenario(normal).buildings.map(({ type, x, y, population }) => ({ type, x, y, population })));
      expect(evaluateScenario(city, normal)).toMatchObject({
        status: 'active',
        totalObjectives: definition.objectives.length,
        maxTicks: definition.maxTicks,
      });

      city.resources.money = normal.loseBelowMoney - 1;
      expect(evaluateScenario(city, normal).status).toBe('lost');
    }
  });

  it('makes Easy no stricter than Normal while preserving bounded percentage targets', () => {
    expect(DIFFICULTY_PROFILES.map((profile) => profile.id)).toEqual(['easy', 'normal']);
    for (const definition of SCENARIO_CATALOG) {
      const easy = resolveScenario(definition, 'easy');
      const normal = resolveScenario(definition, 'normal');

      expect(easy.initialMoney).toBeGreaterThanOrEqual(normal.initialMoney);
      expect(easy.maxTicks).toBeGreaterThanOrEqual(normal.maxTicks);
      expect(easy.loseBelowMoney).toBeLessThanOrEqual(normal.loseBelowMoney);
      for (const normalObjective of normal.objectives) {
        const easyObjective = easy.objectives.find((objective) => objective.id === normalObjective.id);
        if (easyObjective === undefined) throw new Error(`Missing Easy objective ${normalObjective.id}`);
        expect(
          normalObjective.direction === 'at-most'
            ? easyObjective.target >= normalObjective.target
            : easyObjective.target <= normalObjective.target,
        ).toBe(true);
        if (easyObjective.unit === 'percent') {
          expect(easyObjective.target).toBeGreaterThanOrEqual(0);
          expect(easyObjective.target).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it('preserves the Founding Settlement Normal Phase 24 baseline', () => {
    const normal = resolveScenario(FOUNDING_SETTLEMENT_SCENARIO, 'normal');

    expect(normal).toMatchObject({
      initialMoney: 500,
      maxTicks: 900,
      loseBelowMoney: 50,
      objectives: [
        { id: 'population', target: 80 },
        { id: 'water-coverage', target: 70 },
        { id: 'food-coverage', target: 50 },
        { id: 'worker-shortage', target: 20 },
        { id: 'money', target: 100 },
      ],
    });
    expect(createCityState()).toEqual(createCityStateForScenario(normal));
  });
});
