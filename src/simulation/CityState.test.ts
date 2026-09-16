import { describe, expect, it } from 'vitest';
import { assignWorkers, getFoodStats, getWorkforceStats, simulateTick } from './Simulation';
import { createCityState, INITIAL_MONEY } from './CityState';
import type { BuildingType } from './Tile';

function countByType(buildings: readonly { readonly type: BuildingType }[]): Record<BuildingType, number> {
  return buildings.reduce<Record<BuildingType, number>>((counts, building) => {
    counts[building.type] += 1;
    return counts;
  }, { road: 0, house: 0, well: 0, farm: 0, granary: 0, market: 0 });
}

describe('createCityState', () => {
  it('seeds the MVP demo buildings without spending starting resources', () => {
    const city = createCityState();
    const counts = countByType(city.buildings);

    expect(counts.road).toBeGreaterThan(0);
    expect(counts.house).toBeGreaterThan(0);
    expect(counts.well).toBeGreaterThanOrEqual(1);
    expect(counts.farm).toBeGreaterThanOrEqual(1);
    expect(counts.granary).toBeGreaterThanOrEqual(1);
    expect(counts.market).toBeGreaterThanOrEqual(1);
    expect(city.resources.money).toBe(INITIAL_MONEY);
    expect('food' in city.resources).toBe(false);
    expect(city.simulation.tick).toBe(0);
  });

  it('has enough seeded housing to activate the initial food workplaces', () => {
    const city = createCityState();

    assignWorkers(city);

    expect(getWorkforceStats(city)).toMatchObject({
      workerShortage: 0,
      activeWorkplaces: 3,
      inactiveWorkplaces: 0,
    });
  });

  it('starts food production on the first simulated tick', () => {
    const city = createCityState();

    simulateTick(city);

    expect(city.simulation.tick).toBe(1);
    expect(getFoodStats(city)).toMatchObject({
      farms: 1,
      granaries: 1,
      markets: 1,
      foodCapacity: 140,
      foodStored: 2,
    });
  });
});
