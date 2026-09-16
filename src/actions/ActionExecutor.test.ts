import { describe, expect, it } from 'vitest';
import type { AdvisorAction, AdvisorPlan } from '../advisor/MockAdvisor';
import { BUILD_COSTS, getBuildingAt, placeBuilding, type CityState } from '../simulation/CityState';
import type { Tile } from '../simulation/Tile';
import { executePlan, validatePlan } from './ActionExecutor';

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
    resources: { money },
    simulation: { tick: 0, finance: { period: 0, lastRevenue: 0, lastUpkeep: 0, lastNet: 0 } },
  };
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

describe('ActionExecutor', () => {
  it('executes a valid well plan and spends money', () => {
    const city = createEmptyCity();
    const plan = createPlan([buildAction('build_well', BUILD_COSTS.well, { x: 2, y: 3 })]);

    const validation = validatePlan(city, plan, BUILD_COSTS.well);
    const result = executePlan(city, plan, BUILD_COSTS.well);

    expect(validation).toEqual({ ok: true, estimatedCost: BUILD_COSTS.well });
    expect(result).toMatchObject({ ok: true, executedActions: 1, spent: BUILD_COSTS.well });
    expect(city.resources.money).toBe(500 - BUILD_COSTS.well);
    expect(getBuildingAt(city, 2, 3)?.type).toBe('well');
  });

  it('rejects an occupied target without mutating money or buildings', () => {
    const city = createEmptyCity();
    expect(placeBuilding(city, 2, 3, 'road')).toBe('built');
    const moneyAfterSeed = city.resources.money;
    const buildingCount = city.buildings.length;
    const plan = createPlan([buildAction('build_well', BUILD_COSTS.well, { x: 2, y: 3 })]);

    const result = executePlan(city, plan, BUILD_COSTS.well);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('rejected');
    expect(city.resources.money).toBe(moneyAfterSeed);
    expect(city.buildings).toHaveLength(buildingCount);
    expect(getBuildingAt(city, 2, 3)?.type).toBe('road');
  });

  it('rejects a plan above the approved budget', () => {
    const city = createEmptyCity();
    const plan = createPlan([buildAction('build_market', BUILD_COSTS.market, { x: 1, y: 1 })]);

    const result = executePlan(city, plan, BUILD_COSTS.market - 1);

    expect(result.ok).toBe(false);
    expect(city.resources.money).toBe(500);
    expect(getBuildingAt(city, 1, 1)).toBeUndefined();
  });

  it('rejects a plan above available money', () => {
    const city = createEmptyCity(8, 8, BUILD_COSTS.granary - 1);
    const plan = createPlan([buildAction('build_granary', BUILD_COSTS.granary, { x: 1, y: 1 })]);

    const result = executePlan(city, plan, BUILD_COSTS.granary);

    expect(result.ok).toBe(false);
    expect(city.resources.money).toBe(BUILD_COSTS.granary - 1);
    expect(getBuildingAt(city, 1, 1)).toBeUndefined();
  });

  it('accepts wait as a no-op without spending money', () => {
    const city = createEmptyCity();
    const plan = createPlan([buildAction('wait', 0)]);

    const validation = validatePlan(city, plan, 0);
    const result = executePlan(city, plan, 0);

    expect(validation).toEqual({ ok: true, estimatedCost: 0 });
    expect(result).toMatchObject({ ok: true, executedActions: 0, spent: 0 });
    expect(city.resources.money).toBe(500);
    expect(city.buildings).toHaveLength(0);
  });

  it('rejects manipulated costs before mutating the city', () => {
    const city = createEmptyCity();
    const action = buildAction('build_farm', BUILD_COSTS.farm - 1, { x: 4, y: 4 });
    const plan = createPlan([action], BUILD_COSTS.farm - 1);

    const result = executePlan(city, plan, BUILD_COSTS.farm);

    expect(result.ok).toBe(false);
    expect(city.resources.money).toBe(500);
    expect(getBuildingAt(city, 4, 4)).toBeUndefined();
  });
});
