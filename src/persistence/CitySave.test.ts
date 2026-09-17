import { describe, expect, it } from 'vitest';
import { fulfillImperialRequest } from '../events/Events';
import { createCityState } from '../simulation/CityState';
import { simulateTick } from '../simulation/Simulation';
import {
  deserializeCityState,
  loadCityState,
  SAVE_SCHEMA_VERSION,
  SAVE_STORAGE_KEY,
  saveCityState,
  serializeCityState,
} from './CitySave';

type StorageDouble = Partial<Pick<Storage, 'getItem' | 'setItem'>>;

function asStorage(storage: StorageDouble): Storage {
  return storage as unknown as Storage;
}

describe('CitySave', () => {
  it('round-trips persistent city, finance, food stocks, and Phase 21 events without ticking', () => {
    const city = createCityState();
    const granary = city.buildings.find((building) => building.type === 'granary');
    const market = city.buildings.find((building) => building.type === 'market');
    if (granary === undefined || market === undefined) throw new Error('Expected seeded food stores.');
    city.resources.money = 321;
    city.simulation.tick = 42;
    city.simulation.finance = { period: 4, lastRevenue: 17, lastUpkeep: 9, lastNet: 8 };
    city.simulation.population.lastChange = -2;
    granary.storedFood = 37;
    market.storedFood = 11;
    city.simulation.events = {
      seed: 21,
      active: [{
        id: 'drought-founding', type: 'drought', status: 'active', warningTick: 24,
        startTick: 30, endTick: 45, message: 'Drought started.', productionMultiplier: 0.5,
      }],
      history: [{ id: 'drought-founding', tick: 30, message: 'Drought started.' }],
      processed: ['warning:drought-founding', 'started:drought-founding'],
    };

    const result = deserializeCityState(serializeCityState(city));

    expect(result).toMatchObject({ ok: true, message: 'City loaded locally.' });
    if (!result.ok) return;
    expect(result.city).not.toBe(city);
    expect(result.city.tiles).not.toBe(city.tiles);
    expect(result.city.buildings).not.toBe(city.buildings);
    expect(result.city.resources).toEqual({ money: 321 });
    expect(result.city.simulation).toEqual(city.simulation);
    expect(result.city.simulation.tick).toBe(42);
    expect(result.city.buildings.find((building) => building.id === granary.id)?.storedFood).toBe(37);
    expect(result.city.buildings.find((building) => building.id === market.id)?.storedFood).toBe(11);
    expect(result.city.buildings.find((building) => building.type === 'farm')?.active).toBe(true);
  });

  it('loads an imperial request fulfilled before its deadline after the deadline', () => {
    const city = createCityState();
    const granary = city.buildings.find((building) => building.type === 'granary');
    if (granary === undefined) throw new Error('Expected seeded granary.');
    granary.storedFood = 10;

    while (city.simulation.tick < 78) simulateTick(city);
    expect(fulfillImperialRequest(city)).toBe(true);
    while (city.simulation.tick <= 96) simulateTick(city);

    const result = deserializeCityState(serializeCityState(city));

    expect(city.simulation.events?.pendingRequest?.status).toBe('fulfilled');
    expect(city.simulation.events?.processed).toContain('request:fulfilled:imperial-request-founding');
    expect(result).toMatchObject({ ok: true, message: 'City loaded locally.' });
    if (!result.ok) return;
    expect(result.city.simulation.tick).toBe(97);
    expect(result.city.simulation.events?.pendingRequest?.status).toBe('fulfilled');
  });

  it('serializes without mutating the current city', () => {
    const city = createCityState();
    const before = structuredClone(city);

    const serialized = serializeCityState(city);

    expect(JSON.parse(serialized)).toMatchObject({ schemaVersion: SAVE_SCHEMA_VERSION });
    expect(city).toEqual(before);
  });

  it.each([
    ['invalid JSON', '{', 'invalid_json'],
    ['non-object root', '[]', 'invalid_envelope'],
    ['missing city', JSON.stringify({ schemaVersion: SAVE_SCHEMA_VERSION }), 'invalid_envelope'],
    ['missing schema', JSON.stringify({ city: createCityState() }), 'invalid_envelope'],
    ['future schema', JSON.stringify({ schemaVersion: SAVE_SCHEMA_VERSION + 1, city: createCityState() }), 'incompatible_schema'],
    ['inconsistent tiles', JSON.stringify({ schemaVersion: SAVE_SCHEMA_VERSION, city: { ...createCityState(), tiles: [] } }), 'invalid_city'],
  ])('rejects %s without hydrating', (_label, payload, code) => {
    const result = deserializeCityState(payload);

    expect(result).toMatchObject({ ok: false, code });
  });

  it('rejects invalid building references, house population, and event state', () => {
    const city = JSON.parse(serializeCityState(createCityState())) as { city: Record<string, unknown> };
    const buildings = city.city.buildings as Array<Record<string, unknown>>;
    const house = buildings.find((building) => building.type === 'house');
    if (house === undefined) throw new Error('Expected seeded house.');

    (city.city.tiles as Array<Record<string, unknown>>)[0]!.buildingId = 'missing-building';
    expect(deserializeCityState(JSON.stringify(city))).toMatchObject({ ok: false, code: 'invalid_city' });

    (city.city.tiles as Array<Record<string, unknown>>)[0]!.buildingId = undefined;
    house.population = 99;
    expect(deserializeCityState(JSON.stringify(city))).toMatchObject({ ok: false, code: 'invalid_city' });

    house.population = 4;
    (city.city.simulation as Record<string, unknown>).events = { seed: 21, active: 'bad', history: [], processed: [] };
    expect(deserializeCityState(JSON.stringify(city))).toMatchObject({ ok: false, code: 'invalid_city' });
  });

  it('rejects an active epidemic missing its started marker', () => {
    const saved = JSON.parse(serializeCityState(createCityState())) as { city: { simulation: Record<string, unknown> } };
    saved.city.simulation.tick = 60;
    saved.city.simulation.events = {
      seed: 21,
      active: [{
        id: 'epidemic-founding',
        type: 'epidemic',
        status: 'active',
        warningTick: 54,
        startTick: 60,
        endTick: 72,
        message: 'Epidemic started: population growth suspended.',
      }],
      history: [],
      processed: [
        'warning:drought-founding',
        'started:drought-founding',
        'resolved:drought-founding',
        'warning:epidemic-founding',
      ],
    };

    expect(deserializeCityState(JSON.stringify(saved))).toMatchObject({ ok: false, code: 'invalid_city' });
  });

  it('uses one namespaced storage key and handles absent or failing storage safely', () => {
    const values = new Map<string, string>();
    const storage = asStorage({
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    });

    expect(saveCityState(createCityState(), storage)).toEqual({ ok: true, message: 'City saved locally.' });
    expect(JSON.parse(values.get(SAVE_STORAGE_KEY) ?? '')).toMatchObject({ schemaVersion: SAVE_SCHEMA_VERSION });
    expect(loadCityState(storage)).toMatchObject({ ok: true, message: 'City loaded locally.' });
    expect(loadCityState(asStorage({ getItem: () => null }))).toMatchObject({ ok: false, code: 'not_found' });
    expect(saveCityState(createCityState(), asStorage({
      setItem: () => { throw new Error('blocked'); },
    }))).toMatchObject({ ok: false, code: 'storage_error' });
    expect(loadCityState(asStorage({
      getItem: () => { throw new Error('blocked'); },
    }))).toMatchObject({ ok: false, code: 'storage_error' });
  });
});
