import { describe, expect, it } from 'vitest';
import { createCityStateForScenario, placeBuilding } from '../simulation/CityState';
import { simulateTick } from '../simulation/Simulation';
import { evaluateScenario, PLANNING_CROSSROADS_SCENARIO, resolveScenario, type ScenarioProgress } from './Scenario';

function getObjective(progress: ScenarioProgress, id: 'food-coverage' | 'worker-shortage') {
  const objective = progress.objectives.find((candidate) => candidate.id === id);
  if (objective === undefined) throw new Error(`Missing ${id} objective.`);
  return objective;
}

describe('Planning Crossroads scenario', () => {
  it('rewards the one market location that links the granary and every house', () => {
    const scenario = resolveScenario(PLANNING_CROSSROADS_SCENARIO, 'normal');
    const city = createCityStateForScenario(scenario);

    expect(placeBuilding(city, 12, 14, 'market')).toBe('built');
    simulateTick(city);
    const progress = evaluateScenario(city, scenario);

    expect(city.resources.money).toBe(150);
    expect(getObjective(progress, 'food-coverage')).toMatchObject({ current: 100, completed: true });
    expect(getObjective(progress, 'worker-shortage')).toMatchObject({ current: 0, completed: true });
    expect(progress.status).toBe('won');
  });

  it('makes a closer market incomplete until the player pays for the corrective layout', () => {
    const scenario = resolveScenario(PLANNING_CROSSROADS_SCENARIO, 'normal');
    const city = createCityStateForScenario(scenario);

    expect(placeBuilding(city, 17, 14, 'market')).toBe('built');
    simulateTick(city);
    const firstLayout = evaluateScenario(city, scenario);

    expect(city.buildings.filter((building) => building.type === 'market')).toHaveLength(1);
    expect(getObjective(firstLayout, 'food-coverage')).toMatchObject({ current: 50, completed: false });
    expect(firstLayout.status).toBe('active');

    expect(placeBuilding(city, 12, 14, 'market')).toBe('built');
    simulateTick(city);
    simulateTick(city);
    const recoveredLayout = evaluateScenario(city, scenario);

    expect(city.resources.money).toBe(100);
    expect(getObjective(recoveredLayout, 'food-coverage')).toMatchObject({ current: 100, completed: true });
    const workerShortage = getObjective(recoveredLayout, 'worker-shortage');
    expect(workerShortage).toMatchObject({ completed: true });
    expect(workerShortage.current).toBeGreaterThan(0);
    expect(recoveredLayout.status).toBe('won');
  });
});
