import { describe, expect, it } from 'vitest';
import { FOUNDING_SETTLEMENT_SCENARIO, evaluateScenario } from '../scenario/Scenario';
import { createCityState } from '../simulation/CityState';
import { createSessionMetrics, recordSessionMetric, refreshSessionMetrics } from './SessionMetrics';

describe('SessionMetrics', () => {
  it('initializes from city state without mutating the city or counting seeded buildings', () => {
    const city = createCityState();
    const before = structuredClone(city);
    const progress = evaluateScenario(city, FOUNDING_SETTLEMENT_SCENARIO);

    expect(createSessionMetrics(city, 'founding-settlement', 'normal', progress)).toMatchObject({
      scenarioId: 'founding-settlement',
      difficulty: 'normal',
      status: 'active',
      currentTick: 0,
      peakPopulation: 32,
      lowestMoney: 500,
      currentMoney: 500,
      buildingsConstructed: 0,
      buildingsDemolished: 0,
      advisorPlansApproved: 0,
      advisorPlansRejected: 0,
      imperialRequestsFulfilled: 0,
      imperialRequestsFailed: 0,
    });
    expect(city).toEqual(before);
  });

  it('keeps interaction counters while tracking peak population, lowest money, and terminal state', () => {
    const city = createCityState();
    const initial = createSessionMetrics(city, 'founding-settlement', 'normal', evaluateScenario(city));
    const counted = recordSessionMetric(
      recordSessionMetric(initial, 'buildingsConstructed'),
      'advisorPlansApproved',
    );
    const houses = city.buildings.filter((building) => building.type === 'house');
    houses[0]!.population = 0;
    city.resources.money = 49;
    city.simulation.tick = 17;

    expect(refreshSessionMetrics(counted, city, evaluateScenario(city))).toMatchObject({
      status: 'lost',
      currentTick: 17,
      peakPopulation: 32,
      lowestMoney: 49,
      currentMoney: 49,
      buildingsConstructed: 1,
      advisorPlansApproved: 1,
    });
  });

  it('increments only the explicitly recorded successful interaction', () => {
    const city = createCityState();
    const initial = createSessionMetrics(city, 'founding-settlement', 'normal', evaluateScenario(city));

    const updated = recordSessionMetric(initial, 'buildingsDemolished');

    expect(updated).toMatchObject({ buildingsDemolished: 1, buildingsConstructed: 0 });
    expect(initial).toMatchObject({ buildingsDemolished: 0, buildingsConstructed: 0 });
  });
});
