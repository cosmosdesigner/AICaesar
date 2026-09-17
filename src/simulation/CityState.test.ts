import { describe, expect, it } from 'vitest';
import { getRoadNetworkStats } from './RoadNetwork';
import { assignWorkers, getFoodStats, getPopulation, getWorkforceStats, simulateTick } from './Simulation';
import {
  BUILD_COSTS,
  createCityState,
  demolishBuilding,
  getBuildingAt,
  getTile,
  INITIAL_MONEY,
  placeBuilding,
} from './CityState';
import type { BuildingType } from './Tile';

function countByType(buildings: readonly { readonly type: BuildingType }[]): Record<BuildingType, number> {
  return buildings.reduce<Record<BuildingType, number>>((counts, building) => {
    counts[building.type] += 1;
    return counts;
  }, {
    road: 0,
    house: 0,
    well: 0,
    farm: 0,
    granary: 0,
    market: 0,
    garden: 0,
    plaza: 0,
    fountain: 0,
  });
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

  it('builds costed amenities without adding workforce requirements', () => {
    const city = createCityState();
    assignWorkers(city);
    const requiredBefore = getWorkforceStats(city).workersRequired;

    expect(placeBuilding(city, 0, 0, 'garden')).toBe('built');
    expect(placeBuilding(city, 1, 0, 'plaza')).toBe('built');
    expect(placeBuilding(city, 2, 0, 'fountain')).toBe('built');
    assignWorkers(city);

    expect(BUILD_COSTS.garden).toBe(12);
    expect(BUILD_COSTS.plaza).toBe(25);
    expect(BUILD_COSTS.fountain).toBe(40);
    expect(city.resources.money).toBe(INITIAL_MONEY - 77);
    expect(getWorkforceStats(city).workersRequired).toBe(requiredBefore);
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

describe('demolishBuilding', () => {
  it('removes every building type and clears its tile without a refund or tick', () => {
    const city = createCityState();
    const types: readonly BuildingType[] = [
      'road', 'house', 'well', 'farm', 'granary', 'market', 'garden', 'plaza', 'fountain',
    ];
    city.resources.money = 2_000;

    for (const [index, type] of types.entries()) {
      expect(placeBuilding(city, index, 0, type)).toBe('built');
    }
    const moneyBefore = city.resources.money;
    const tickBefore = city.simulation.tick;

    for (const [index, type] of types.entries()) {
      const building = getBuildingAt(city, index, 0);
      expect(building?.type).toBe(type);
      expect(demolishBuilding(city, index, 0)).toBe('demolished');
      expect(getTile(city, index, 0)?.buildingId).toBeUndefined();
      expect(city.buildings.find((candidate) => candidate.id === building?.id)).toBeUndefined();
    }

    expect(city.resources.money).toBe(moneyBefore);
    expect(city.simulation.tick).toBe(tickBefore);
  });

  it('does not mutate empty or outside-map attempts', () => {
    const city = createCityState();
    const before = JSON.stringify(city);

    expect(demolishBuilding(city, -1, 0)).toBe('outside-map');
    expect(demolishBuilding(city, 0, 0)).toBe('empty');

    expect(JSON.stringify(city)).toBe(before);
  });

  it('fails safely when the tile reference has no exact matching building', () => {
    const city = createCityState();
    expect(placeBuilding(city, 0, 0, 'road')).toBe('built');
    const tile = getTile(city, 0, 0);
    if (tile === undefined) throw new Error('Expected in-map tile.');
    tile.buildingId = 'missing-building';
    const before = JSON.stringify(city);

    expect(demolishBuilding(city, 0, 0)).toBe('inconsistent-state');

    expect(JSON.stringify(city)).toBe(before);
  });

  it('removes house population and workplace stock with their buildings only', () => {
    const city = createCityState();
    const house = city.buildings.find((building) => building.type === 'house');
    const granary = city.buildings.find((building) => building.type === 'granary');
    if (house === undefined || granary === undefined) throw new Error('Expected seeded house and granary.');
    granary.storedFood = 37;
    const populationBefore = getPopulation(city);

    expect(demolishBuilding(city, house.x, house.y)).toBe('demolished');
    expect(getPopulation(city)).toBe(populationBefore - (house.population ?? 0));
    expect(demolishBuilding(city, granary.x, granary.y)).toBe('demolished');
    expect(city.buildings).not.toContainEqual(expect.objectContaining({ id: granary.id }));
    expect(getFoodStats(city).granaryFood).toBe(0);
  });

  it('makes road access derived state reflect a demolished road immediately', () => {
    const city = createCityState();
    const road = city.buildings.find((building) => building.type === 'road' && building.x === 5);
    if (road === undefined) throw new Error('Expected endpoint of seeded road.');
    const mainRoadTilesBefore = getRoadNetworkStats(city).mainRoadTiles;

    expect(demolishBuilding(city, road.x, road.y)).toBe('demolished');

    expect(getRoadNetworkStats(city).mainRoadTiles).toBe(mainRoadTilesBefore - 1);
  });
});
