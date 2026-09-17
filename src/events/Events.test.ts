import { describe, expect, it } from 'vitest';
import { createCityState, placeBuilding, type CityState } from '../simulation/CityState';
import { getFoodStats, simulateTick } from '../simulation/Simulation';
import {
  DEFAULT_EVENT_SCHEDULE,
  advanceEvents,
  canFulfillImperialRequest,
  fulfillImperialRequest,
  getEventSummary,
  isBuildingSuppressed,
  type EventSchedule,
} from './Events';

const TEST_SCHEDULE: EventSchedule = {
  drought: { id: 'drought-test', warningTick: 1, startTick: 2, endTick: 4, productionMultiplier: 0.5 },
  epidemic: { id: 'epidemic-test', warningTick: 5, startTick: 6, endTick: 8 },
  request: { id: 'request-test', issueTick: 9, dueTick: 11, requestedFood: 3, rewardMoney: 35, failurePenalty: 25 },
  fire: { id: 'fire-test', warningTick: 12, startTick: 13, endTick: 15 },
};

function tickTo(city: CityState, tick: number, schedule = TEST_SCHEDULE): void {
  while (city.simulation.tick < tick) {
    city.simulation.tick += 1;
    advanceEvents(city, schedule);
  }
}

describe('Phase 21 deterministic events', () => {
  it('initializes serializable empty event state with a fixed seed', () => {
    const city = createCityState();

    expect(city.simulation.events).toEqual({ seed: 21, active: [], history: [], processed: [] });
  });

  it('publishes a warning once, activates, and resolves deterministically', () => {
    const city = createCityState();

    tickTo(city, 1);
    expect(getEventSummary(city)).toEqual([expect.objectContaining({ id: 'drought-test', status: 'warning' })]);
    tickTo(city, 2);
    expect(getEventSummary(city)).toEqual([expect.objectContaining({ id: 'drought-test', status: 'active', ticksRemaining: 2 })]);
    tickTo(city, 4);

    expect(getEventSummary(city)).toEqual([]);
    expect(city.simulation.events?.history.map((message) => message.message)).toEqual([
      'Drought warning: farm production will be reduced.',
      'Drought started: farm production reduced by 50%.',
      'Drought ended: farm production restored.',
    ]);
  });

  it('reduces drought farm production only during its active duration', () => {
    const city = createCityState();
    city.simulation.tick = 29;

    simulateTick(city);
    expect(getFoodStats(city).foodStored).toBe(1);
    simulateTick(city);
    expect(getFoodStats(city).foodStored).toBe(2);

    city.simulation.tick = 44;
    simulateTick(city);
    expect(getFoodStats(city).foodStored).toBe(4);
  });

  it('limits epidemic activation loss to one resident per occupied house and blocks only growth', () => {
    const city = createCityState();
    const houses = city.buildings.filter((building) => building.type === 'house');
    const beforePopulation = houses.map((house) => house.population);
    city.simulation.tick = 60;

    advanceEvents(city);

    expect(houses.map((house) => house.population)).toEqual(beforePopulation.map((population) => (
      Math.max(0, population! - 1)
    )));

    for (const house of houses) house.population = 4;
    expect(placeBuilding(city, 21, 14, 'house')).toBe('built');
    expect(placeBuilding(city, 21, 16, 'well')).toBe('built');
    const house = city.buildings.find((building) => building.id === 'house-21-14');
    const market = city.buildings.find((building) => building.type === 'market');
    if (!house || !market) throw new Error('Expected serviced test house and market.');
    house.population = 3;
    market.storedFood = 40;
    city.simulation.tick = 59;

    market.storedFood = 40;
    city.simulation.tick = 71;
    simulateTick(city);
    expect(house.population).toBe(4);
  });

  it('suppresses one deterministic workplace without destroying its inventory, then restores it', () => {
    const city = createCityState();
    const granary = city.buildings.find((building) => building.type === 'granary');
    if (!granary) throw new Error('Expected seeded granary.');
    granary.storedFood = 9;

    tickTo(city, 13);
    const fire = city.simulation.events?.active.find((event) => event.type === 'fire');
    expect(fire?.targetBuildingId).toBe('granary-20-14');
    expect(isBuildingSuppressed(city, granary)).toBe(true);
    expect(granary.storedFood).toBe(9);

    tickTo(city, 15);
    expect(isBuildingSuppressed(city, granary)).toBe(false);
    expect(granary.storedFood).toBe(9);
  });

  it('issues, fulfills, and expires an imperial request exactly once', () => {
    const city = createCityState();
    const granary = city.buildings.find((building) => building.type === 'granary');
    const market = city.buildings.find((building) => building.type === 'market');
    if (!granary || !market) throw new Error('Expected seeded food stores.');
    granary.storedFood = 2;
    market.storedFood = 2;
    city.simulation.tick = 9;
    advanceEvents(city, TEST_SCHEDULE);
    expect(city.simulation.events?.history).toContainEqual(expect.objectContaining({ id: 'request-test' }));
    expect(city.simulation.events?.pendingRequest).toMatchObject({ status: 'pending', requestedFood: 3 });
    expect(canFulfillImperialRequest(city)).toBe(true);
    expect(fulfillImperialRequest(city)).toBe(true);
    expect(granary.storedFood).toBe(0);
    expect(market.storedFood).toBe(1);
    expect(city.resources.money).toBe(535);
    expect(fulfillImperialRequest(city)).toBe(false);

    const failed = createCityState();
    tickTo(failed, 11);
    expect(failed.resources.money).toBe(475);
    tickTo(failed, 12);
    expect(failed.resources.money).toBe(475);
  });

  it('produces the same event state for identical ticks and seed', () => {
    const first = createCityState();
    const second = createCityState();

    tickTo(first, 15);
    tickTo(second, 15);

    expect(second.simulation.events).toEqual(first.simulation.events);
  });

  it('keeps the production schedule explicit and ordered', () => {
    expect(DEFAULT_EVENT_SCHEDULE.drought.startTick).toBeLessThan(DEFAULT_EVENT_SCHEDULE.epidemic.startTick);
    expect(DEFAULT_EVENT_SCHEDULE.epidemic.startTick).toBeLessThan(DEFAULT_EVENT_SCHEDULE.request.issueTick);
    expect(DEFAULT_EVENT_SCHEDULE.request.issueTick).toBeLessThan(DEFAULT_EVENT_SCHEDULE.fire.startTick);
  });
});
