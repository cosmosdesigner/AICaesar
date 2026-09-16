import { describe, expect, it } from 'vitest';
import { validatePlan } from '../../actions/ActionExecutor';
import { analyzeCity, summarizeCity, type CityIssue, type CityStateSummary } from '../../analysis/CityAnalyzer';
import type { AdvisorPlan } from '../MockAdvisor';
import { validateAdvisorPlanShape, type AdvisorProvider } from '../AdvisorProvider';
import { LLMAdvisorProvider, buildAdvisorPrompt, type LLMPlanClient } from './LLMAdvisorProvider';
import { createMockAdvisorProvider } from './MockAdvisorProvider';
import { createSafeAdvisorProvider } from './SafeAdvisorProvider';
import { BUILD_COSTS, placeBuilding, type Building, type CityState } from '../../simulation/CityState';
import type { BuildingType, Tile } from '../../simulation/Tile';

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

function createProviderInput(city: CityState): { readonly summary: CityStateSummary; readonly issues: readonly CityIssue[] } {
  return { summary: summarizeCity(city), issues: analyzeCity(city) };
}

function createValidPlan(overrides: Partial<AdvisorPlan> = {}): AdvisorPlan {
  const actions = overrides.actions ?? [{
    type: 'wait',
    label: 'Wait and observe',
    reason: 'No safe immediate build action.',
    estimatedCost: 0,
  }];

  return {
    summary: 'Valid plan',
    reasoning: ['Uses only structured city summary and issues.'],
    actions,
    estimatedCost: actions.reduce((total, action) => total + action.estimatedCost, 0),
    expectedImpact: ['No unsafe direct execution.'],
    risks: ['Validator still decides execution safety.'],
    ...overrides,
  };
}

describe('Advisor providers', () => {
  it('mock provider returns a valid plan from summary and issues', async () => {
    const city = createEmptyCity();
    addBuilding(city, 'road', 1, 2);
    addBuilding(city, 'house', 2, 2, { level: 1, hasFood: false });
    const provider = createMockAdvisorProvider();

    const result = await provider.createPlan(createProviderInput(city));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.provider).toBe('mock');
    expect(validateAdvisorPlanShape(result.plan).ok).toBe(true);
    expect(result.plan.actions[0]?.type).toBe('build_well');
  });

  it('LLM provider accepts valid JSON and prompts only with summary, issues, action types, and schema', async () => {
    let capturedPrompt = '';
    const client: LLMPlanClient = {
      complete: async (prompt) => {
        capturedPrompt = prompt;
        return JSON.stringify(createValidPlan());
      },
    };
    const provider = new LLMAdvisorProvider(client);
    const city = createEmptyCity();
    const input = createProviderInput(city);

    const result = await provider.createPlan(input);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.provider).toBe('llm');
    expect(result.plan.summary).toBe('Valid plan');
    expect(capturedPrompt).toBe(buildAdvisorPrompt(input));
    expect(capturedPrompt).toContain('CityStateSummary');
    expect(capturedPrompt).toContain('CityIssue[]');
    expect(capturedPrompt).toContain('build_well');
    expect(capturedPrompt).not.toContain('buildings');
    expect(capturedPrompt).not.toContain('resources');
  });

  it('LLM provider rejects invalid JSON', async () => {
    const provider = new LLMAdvisorProvider({ complete: async () => 'not-json' });

    const result = await provider.createPlan(createProviderInput(createEmptyCity()));

    expect(result).toMatchObject({ ok: false, provider: 'llm' });
  });

  it('safe provider uses fallback when primary throws', async () => {
    const primary: AdvisorProvider = {
      name: 'broken-primary',
      createPlan: async () => { throw new Error('client offline'); },
    };
    const provider = createSafeAdvisorProvider(primary, createMockAdvisorProvider());

    const result = await provider.createPlan(createProviderInput(createEmptyCity()));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.provider).toBe('broken-primary-fallback-mock');
  });

  it('safe provider uses fallback when primary returns an invalid plan shape', async () => {
    const primary: AdvisorProvider = {
      name: 'bad-primary',
      createPlan: async () => ({
        ok: true,
        provider: 'bad-primary',
        plan: { summary: 'missing required fields' } as unknown as AdvisorPlan,
      }),
    };
    const provider = createSafeAdvisorProvider(primary, createMockAdvisorProvider());

    const result = await provider.createPlan(createProviderInput(createEmptyCity()));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.provider).toBe('bad-primary-fallback-mock');
    expect(validateAdvisorPlanShape(result.plan).ok).toBe(true);
  });

  it('provider plan still fails ActionValidator when targeting an occupied tile', async () => {
    const city = createEmptyCity();
    expect(placeBuilding(city, 2, 3, 'road')).toBe('built');
    const unsafePlan = createValidPlan({
      actions: [{
        type: 'build_well',
        label: 'Build occupied well',
        reason: 'Provider proposed an unsafe occupied target.',
        estimatedCost: BUILD_COSTS.well,
        target: { x: 2, y: 3 },
      }],
      estimatedCost: BUILD_COSTS.well,
    });
    const provider = new LLMAdvisorProvider({ complete: async () => JSON.stringify(unsafePlan) });

    const result = await provider.createPlan(createProviderInput(city));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const validation = validatePlan(city, result.plan, result.plan.estimatedCost);
    expect(validation.ok).toBe(false);
    if (validation.ok) throw new Error('Expected occupied tile rejection.');
    expect(validation.errors.join(' ')).toContain('occupied');
  });
});
