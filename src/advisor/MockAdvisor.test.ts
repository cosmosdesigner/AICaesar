import { describe, expect, it } from 'vitest';
import { BUILD_COSTS, type Building, type CityState } from '../simulation/CityState';
import type { BuildingType, Tile } from '../simulation/Tile';
import { createAdvisorPlan } from './MockAdvisor';

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

describe('MockAdvisor', () => {
  it('creates a deterministic well plan for water shortage', () => {
    const city = createEmptyCity();
    addBuilding(city, 'road', 1, 2);
    addBuilding(city, 'house', 2, 2, { level: 1, hasFood: false });

    const plan = createAdvisorPlan(city);

    expect(plan).toEqual(createAdvisorPlan(city));
    expect(plan.summary).toContain('Falta água');
    expect(plan.actions[0]).toMatchObject({
      type: 'build_well',
      estimatedCost: BUILD_COSTS.well,
    });
    expect(plan.actions[0]?.target).toEqual({ x: 2, y: 1 });
    expect(plan.estimatedCost).toBe(plan.actions.reduce((total, action) => total + action.estimatedCost, 0));
  });

  it('creates a house plan for worker shortage', () => {
    const city = createEmptyCity();
    addBuilding(city, 'road', 1, 2);
    addBuilding(city, 'house', 2, 2, { level: 1, hasFood: true });
    addBuilding(city, 'well', 2, 4);
    addBuilding(city, 'road', 4, 1);
    addBuilding(city, 'road', 5, 1);
    addBuilding(city, 'road', 6, 1);
    for (const [x, y] of [[1, 1], [2, 1], [3, 1], [1, 3], [1, 4]] as const) {
      addBuilding(city, 'road', x, y);
    }
    addBuilding(city, 'farm', 4, 2, { active: false });
    addBuilding(city, 'granary', 5, 2, { active: false });
    addBuilding(city, 'market', 6, 2, { active: false });

    const plan = createAdvisorPlan(city);

    expect(plan.summary).toContain('Faltam');
    expect(plan.actions[0]).toMatchObject({
      type: 'build_house',
      estimatedCost: BUILD_COSTS.house,
    });
  });

  it('creates a wait plan when the city has no issues', () => {
    const plan = createAdvisorPlan(createEmptyCity());

    expect(plan.summary).toBe('City is stable, but a small expansion supports the remaining scenario objective.');
    expect(plan.strategicGoal).toContain('Advance Population');
    expect(plan.actions[0]).toMatchObject({
      type: 'build_house',
      label: 'Build house',
      estimatedCost: BUILD_COSTS.house,
    });
    expect(plan.estimatedCost).toBe(BUILD_COSTS.house);
  });

  it('reacts to active events without inventing a new action type', () => {
    const city = createEmptyCity();
    city.simulation.events = {
      seed: 21,
      active: [{
        id: 'drought-test',
        type: 'drought',
        status: 'active',
        startTick: 2,
        endTick: 5,
        message: 'Drought started.',
        productionMultiplier: 0.5,
      }],
      history: [],
      processed: [],
    };

    const plan = createAdvisorPlan(city);

    expect(plan.summary).toContain('drought active');
    expect(plan.actions[0]?.type).toBe('wait');
  });
});
