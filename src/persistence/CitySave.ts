import { DEFAULT_EVENT_SCHEDULE, type CityEvent, type EventMessage, type EventState, type ImperialRequest } from '../events/Events';
import type { Building, CityState, FinanceState, PopulationState } from '../simulation/CityState';
import { getHouseSpecification } from '../simulation/HouseSpecification';
import { recalculateDerivedState } from '../simulation/Simulation';
import type { BuildingType, Tile } from '../simulation/Tile';

export const SAVE_STORAGE_KEY = 'aicaesar.save.v1';
export const SAVE_SCHEMA_VERSION = 1;

export type SaveErrorCode = 'storage_unavailable' | 'storage_error';
export type LoadErrorCode =
  | 'not_found'
  | 'storage_unavailable'
  | 'storage_error'
  | 'invalid_json'
  | 'invalid_envelope'
  | 'incompatible_schema'
  | 'invalid_city';

export type SaveResult =
  | { readonly ok: true; readonly message: string }
  | { readonly ok: false; readonly code: SaveErrorCode; readonly message: string };

export type LoadResult =
  | { readonly ok: true; readonly city: CityState; readonly message: string }
  | { readonly ok: false; readonly code: LoadErrorCode; readonly message: string };

type SerializedCityState = {
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly Tile[];
  readonly buildings: readonly Building[];
  readonly resources: { readonly money: number };
  readonly simulation: {
    readonly tick: number;
    readonly finance: FinanceState;
    readonly population: PopulationState;
    readonly events?: EventState;
  };
};

type CitySaveEnvelope = {
  readonly schemaVersion: typeof SAVE_SCHEMA_VERSION;
  readonly city: SerializedCityState;
};

type UnknownRecord = Record<string, unknown>;

const MAX_MAP_DIMENSION = 200;
const BUILDING_TYPES: readonly BuildingType[] = [
  'road', 'house', 'well', 'farm', 'granary', 'market', 'garden', 'plaza', 'fountain',
];
const EVENT_TYPES: readonly CityEvent['type'][] = ['drought', 'epidemic', 'fire'];
const EVENT_STATUSES: readonly CityEvent['status'][] = ['warning', 'active'];
const REQUEST_STATUSES: readonly ImperialRequest['status'][] = ['pending', 'fulfilled', 'failed'];

export function serializeCityState(city: CityState): string {
  const envelope: CitySaveEnvelope = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    city: {
      width: city.width,
      height: city.height,
      tiles: city.tiles.map((tile) => ({
        x: tile.x,
        y: tile.y,
        terrain: tile.terrain,
        ...(tile.buildingId === undefined ? {} : { buildingId: tile.buildingId }),
      })),
      buildings: city.buildings.map((building) => ({ ...building })),
      resources: { money: city.resources.money },
      simulation: {
        tick: city.simulation.tick,
        finance: { ...city.simulation.finance },
        population: { ...city.simulation.population },
        ...(city.simulation.events === undefined ? {} : { events: serializeEventState(city.simulation.events) }),
      },
    },
  };
  return JSON.stringify(envelope);
}

export function deserializeCityState(payload: string): LoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return loadError('invalid_json', 'Saved city is not valid JSON.');
  }

  try {
    const city = validateEnvelope(parsed);
    return { ok: true, city: hydrateCity(city), message: 'City loaded locally.' };
  } catch (error) {
    if (error instanceof IncompatibleSchemaError) {
      return { ok: false, code: 'incompatible_schema', message: error.message };
    }
    if (error instanceof InvalidEnvelopeError) {
      return { ok: false, code: 'invalid_envelope', message: error.message };
    }
    return loadError('invalid_city', error instanceof Error ? error.message : 'Saved city is invalid.');
  }
}

export function saveCityState(city: CityState, storage?: Storage): SaveResult {
  const target = resolveStorage(storage);
  if (target === undefined) return saveError('storage_unavailable', 'Local storage is unavailable.');

  try {
    target.setItem(SAVE_STORAGE_KEY, serializeCityState(city));
    return { ok: true, message: 'City saved locally.' };
  } catch {
    return saveError('storage_error', 'Could not save city to local storage.');
  }
}

export function loadCityState(storage?: Storage): LoadResult {
  const target = resolveStorage(storage);
  if (target === undefined) return loadError('storage_unavailable', 'Local storage is unavailable.');

  let payload: string | null;
  try {
    payload = target.getItem(SAVE_STORAGE_KEY);
  } catch {
    return loadError('storage_error', 'Could not read the local save.');
  }
  if (payload === null) return loadError('not_found', 'No local save was found.');
  return deserializeCityState(payload);
}

function validateEnvelope(value: unknown): SerializedCityState {
  let envelope: UnknownRecord;
  try {
    envelope = requireRecord(value, 'Saved city envelope is invalid.');
  } catch {
    throw new InvalidEnvelopeError('Saved city envelope is invalid.');
  }
  if (!hasOwn(envelope, 'schemaVersion')) throw new InvalidEnvelopeError('Saved city schema version is missing.');
  if (typeof envelope.schemaVersion !== 'number') throw new InvalidEnvelopeError('Saved city schema version is invalid.');
  if (envelope.schemaVersion !== SAVE_SCHEMA_VERSION) {
    throw new IncompatibleSchemaError('Saved city schema is incompatible.');
  }
  if (!hasOwn(envelope, 'city')) throw new InvalidEnvelopeError('Saved city data is missing.');
  return validateCity(envelope.city);
}

function validateCity(value: unknown): SerializedCityState {
  const city = requireRecord(value, 'Saved city data is invalid.');
  const width = requirePositiveInteger(city.width, 'Saved city width is invalid.');
  const height = requirePositiveInteger(city.height, 'Saved city height is invalid.');
  if (width > MAX_MAP_DIMENSION || height > MAX_MAP_DIMENSION) throw new Error('Saved city dimensions are too large.');
  if (!Array.isArray(city.tiles) || city.tiles.length !== width * height) throw new Error('Saved city tiles are invalid.');
  if (!Array.isArray(city.buildings)) throw new Error('Saved city buildings are invalid.');

  const tiles = city.tiles.map((tile, index) => validateTile(tile, index, width));
  const buildings = city.buildings.map((building) => validateBuilding(building, width, height));
  validateBuildingReferences(tiles, buildings, width);

  const resources = requireRecord(city.resources, 'Saved city resources are invalid.');
  const money = requireFiniteNumber(resources.money, 'Saved city money is invalid.');
  const simulation = requireRecord(city.simulation, 'Saved city simulation is invalid.');
  const tick = requireNonNegativeInteger(simulation.tick, 'Saved city tick is invalid.');
  const finance = validateFinance(simulation.finance);
  const population = validatePopulation(simulation.population);
  const events = simulation.events === undefined ? undefined : validateEventState(simulation.events, buildings, tick);

  return {
    width,
    height,
    tiles,
    buildings,
    resources: { money },
    simulation: { tick, finance, population, ...(events === undefined ? {} : { events }) },
  };
}

function validateTile(value: unknown, index: number, width: number): Tile {
  const tile = requireRecord(value, 'Saved city tile is invalid.');
  const x = requireNonNegativeInteger(tile.x, 'Saved city tile coordinate is invalid.');
  const y = requireNonNegativeInteger(tile.y, 'Saved city tile coordinate is invalid.');
  if (x !== index % width || y !== Math.floor(index / width) || tile.terrain !== 'grass') {
    throw new Error('Saved city tile layout is invalid.');
  }
  if (tile.buildingId !== undefined && (typeof tile.buildingId !== 'string' || tile.buildingId.length === 0)) {
    throw new Error('Saved city tile building reference is invalid.');
  }
  return { x, y, terrain: 'grass', ...(tile.buildingId === undefined ? {} : { buildingId: tile.buildingId }) };
}

function validateBuilding(value: unknown, width: number, height: number): Building {
  const building = requireRecord(value, 'Saved city building is invalid.');
  const id = requireNonEmptyString(building.id, 'Saved city building id is invalid.');
  if (!BUILDING_TYPES.includes(building.type as BuildingType)) throw new Error('Saved city building type is invalid.');
  const type = building.type as BuildingType;
  const x = requireNonNegativeInteger(building.x, 'Saved city building coordinate is invalid.');
  const y = requireNonNegativeInteger(building.y, 'Saved city building coordinate is invalid.');
  if (x >= width || y >= height) throw new Error('Saved city building is outside the map.');

  const result: Building = { id, type, x, y };
  if (type === 'house') {
    const level = building.level === undefined ? 1 : requireHouseLevel(building.level);
    const population = building.population === undefined
      ? 0
      : requireNonNegativeInteger(building.population, 'Saved city house population is invalid.');
    if (population > getHouseSpecification(level).populationCapacity) {
      throw new Error('Saved city house population exceeds its capacity.');
    }
    result.level = level;
    result.population = population;
    result.hasRoadAccess = optionalBoolean(building.hasRoadAccess, 'Saved city house road state is invalid.') ?? false;
    result.hasWater = optionalBoolean(building.hasWater, 'Saved city house water state is invalid.') ?? false;
    result.hasFood = optionalBoolean(building.hasFood, 'Saved city house food state is invalid.') ?? false;
    result.upgradeProgress = optionalNonNegativeNumber(building.upgradeProgress, 'Saved city house upgrade progress is invalid.') ?? 0;
    result.degradeProgress = optionalNonNegativeNumber(building.degradeProgress, 'Saved city house degradation progress is invalid.') ?? 0;
  }
  if (type === 'farm' || type === 'granary' || type === 'market') {
    result.active = optionalBoolean(building.active, 'Saved city workplace state is invalid.') ?? false;
  }
  if (type === 'granary' || type === 'market') {
    result.storedFood = optionalNonNegativeNumber(building.storedFood, 'Saved city food stock is invalid.') ?? 0;
  }
  return result;
}

function validateBuildingReferences(tiles: readonly Tile[], buildings: readonly Building[], width: number): void {
  const ids = new Set<string>();
  const positions = new Set<string>();
  const buildingById = new Map<string, Building>();
  for (const building of buildings) {
    if (ids.has(building.id)) throw new Error('Saved city has duplicate building ids.');
    const position = `${building.x},${building.y}`;
    if (positions.has(position)) throw new Error('Saved city has overlapping buildings.');
    ids.add(building.id);
    positions.add(position);
    buildingById.set(building.id, building);
  }
  for (const tile of tiles) {
    const building = tile.buildingId === undefined ? undefined : buildingById.get(tile.buildingId);
    if (tile.buildingId !== undefined && building === undefined) throw new Error('Saved city has a dangling tile building reference.');
    if (building !== undefined && (building.x !== tile.x || building.y !== tile.y)) {
      throw new Error('Saved city tile building reference does not match its position.');
    }
  }
  for (const building of buildings) {
    const tile = tiles[building.y * width + building.x];
    if (tile?.buildingId !== building.id) throw new Error('Saved city building has no matching tile reference.');
  }
}

function validateFinance(value: unknown): FinanceState {
  const finance = requireRecord(value, 'Saved city finance is invalid.');
  return {
    period: requireNonNegativeInteger(finance.period, 'Saved city finance period is invalid.'),
    lastRevenue: requireFiniteNumber(finance.lastRevenue, 'Saved city finance revenue is invalid.'),
    lastUpkeep: requireFiniteNumber(finance.lastUpkeep, 'Saved city finance upkeep is invalid.'),
    lastNet: requireFiniteNumber(finance.lastNet, 'Saved city finance net is invalid.'),
  };
}

function validatePopulation(value: unknown): PopulationState {
  const population = requireRecord(value, 'Saved city population is invalid.');
  return { lastChange: requireInteger(population.lastChange, 'Saved city population change is invalid.') };
}

function validateEventState(value: unknown, buildings: readonly Building[], tick: number): EventState {
  const events = requireRecord(value, 'Saved city event state is invalid.');
  if (!Array.isArray(events.active) || !Array.isArray(events.history) || !Array.isArray(events.processed)) {
    throw new Error('Saved city event state is invalid.');
  }
  const buildingIds = new Set(buildings.map((building) => building.id));
  const active = events.active.map((event) => validateEvent(event, buildingIds));
  if (new Set(active.map((event) => event.id)).size !== active.length) throw new Error('Saved city has duplicate active events.');
  const history = events.history.map(validateEventMessage);
  const processed = events.processed.map((id) => requireNonEmptyString(id, 'Saved city processed event id is invalid.'));
  if (new Set(processed).size !== processed.length) throw new Error('Saved city has duplicate processed event ids.');
  const pendingRequest = events.pendingRequest === undefined ? undefined : validateImperialRequest(events.pendingRequest);
  validateEventStateConsistency(active, history, processed, pendingRequest, buildings, tick);
  return {
    seed: requireFiniteNumber(events.seed, 'Saved city event seed is invalid.'),
    active,
    history,
    processed,
    ...(pendingRequest === undefined ? {} : { pendingRequest }),
  };
}

function validateEventStateConsistency(
  active: readonly CityEvent[],
  history: readonly EventMessage[],
  processed: readonly string[],
  pendingRequest: ImperialRequest | undefined,
  buildings: readonly Building[],
  tick: number,
): void {
  const processedSet = new Set(processed);
  const expectedProcessed = new Set<string>();
  const definitions = [
    { type: 'drought' as const, definition: DEFAULT_EVENT_SCHEDULE.drought },
    { type: 'epidemic' as const, definition: DEFAULT_EVENT_SCHEDULE.epidemic },
    { type: 'fire' as const, definition: DEFAULT_EVENT_SCHEDULE.fire },
  ];
  if (active.some((event) => !definitions.some(({ definition }) => definition.id === event.id))) {
    throw new Error('Saved city has an unknown active event.');
  }

  for (const { type, definition } of definitions) {
    if (tick >= definition.warningTick) expectedProcessed.add(`warning:${definition.id}`);
    if (tick >= definition.startTick) expectedProcessed.add(`started:${definition.id}`);
    if (tick >= definition.endTick) expectedProcessed.add(`resolved:${definition.id}`);

    const event = active.find((candidate) => candidate.id === definition.id);
    const expectedStatus = tick < definition.warningTick || tick >= definition.endTick
      ? undefined
      : tick < definition.startTick ? 'warning' : 'active';
    if (expectedStatus === undefined) {
      if (event !== undefined) throw new Error('Saved city event is active outside its scheduled duration.');
      continue;
    }
    if (event === undefined) throw new Error('Saved city is missing its scheduled active event.');
    validateScheduledEvent(event, type, definition, expectedStatus, buildings);
  }

  validateImperialRequestConsistency(pendingRequest, expectedProcessed, tick);
  if (processedSet.size !== expectedProcessed.size || [...processedSet].some((key) => !expectedProcessed.has(key))) {
    throw new Error('Saved city processed events are inconsistent with its simulation tick.');
  }

  const scheduledIds = new Set([
    ...definitions.map(({ definition }) => definition.id),
    DEFAULT_EVENT_SCHEDULE.request.id,
  ]);
  let previousTick = -1;
  for (const message of history) {
    if (!scheduledIds.has(message.id) || message.tick > tick || message.tick < previousTick) {
      throw new Error('Saved city event history is inconsistent with its simulation tick.');
    }
    previousTick = message.tick;
  }
}

function validateScheduledEvent(
  event: CityEvent,
  type: CityEvent['type'],
  definition: { readonly id: string; readonly warningTick: number; readonly startTick: number; readonly endTick: number },
  expectedStatus: CityEvent['status'],
  buildings: readonly Building[],
): void {
  if (
    event.type !== type
    || event.status !== expectedStatus
    || event.warningTick !== definition.warningTick
    || event.startTick !== definition.startTick
    || event.endTick !== definition.endTick
  ) {
    throw new Error('Saved city event does not match the default schedule.');
  }
  if (type === 'drought') {
    if (event.productionMultiplier !== DEFAULT_EVENT_SCHEDULE.drought.productionMultiplier || event.targetBuildingId !== undefined) {
      throw new Error('Saved city drought event is invalid.');
    }
    return;
  }
  if (event.productionMultiplier !== undefined) throw new Error('Saved city event multiplier is invalid.');
  if (type === 'epidemic' && event.targetBuildingId !== undefined) throw new Error('Saved city epidemic target is invalid.');
  if (type === 'fire' && event.targetBuildingId !== undefined) {
    const target = buildings.find((building) => building.id === event.targetBuildingId);
    if (target === undefined || !['farm', 'granary', 'market'].includes(target.type)) {
      throw new Error('Saved city fire target is invalid.');
    }
  }
}

function validateImperialRequestConsistency(
  request: ImperialRequest | undefined,
  expectedProcessed: Set<string>,
  tick: number,
): void {
  const definition = DEFAULT_EVENT_SCHEDULE.request;
  if (tick < definition.issueTick) {
    if (request !== undefined) throw new Error('Saved city request was issued before its scheduled tick.');
    return;
  }

  expectedProcessed.add(`request:issued:${definition.id}`);
  if (
    request === undefined
    || request.id !== definition.id
    || request.requestedFood !== definition.requestedFood
    || request.issuedTick !== definition.issueTick
    || request.dueTick !== definition.dueTick
    || request.rewardMoney !== definition.rewardMoney
    || request.failurePenalty !== definition.failurePenalty
  ) {
    throw new Error('Saved city request does not match the default schedule.');
  }
  if (request.status === 'fulfilled') {
    expectedProcessed.add(`request:fulfilled:${definition.id}`);
    return;
  }
  if (request.status === 'failed' && tick >= definition.dueTick) {
    expectedProcessed.add(`request:failed:${definition.id}`);
    return;
  }
  if (request.status !== 'pending' || tick >= definition.dueTick) {
    throw new Error('Saved city request status is inconsistent with its simulation tick.');
  }
}

function validateEvent(value: unknown, buildingIds: ReadonlySet<string>): CityEvent {
  const event = requireRecord(value, 'Saved city event is invalid.');
  const type = event.type as CityEvent['type'];
  const status = event.status as CityEvent['status'];
  if (!EVENT_TYPES.includes(type) || !EVENT_STATUSES.includes(status)) throw new Error('Saved city event type or status is invalid.');
  const startTick = requireNonNegativeInteger(event.startTick, 'Saved city event start tick is invalid.');
  const endTick = requireNonNegativeInteger(event.endTick, 'Saved city event end tick is invalid.');
  if (endTick < startTick) throw new Error('Saved city event duration is invalid.');
  const warningTick = event.warningTick === undefined
    ? undefined
    : requireNonNegativeInteger(event.warningTick, 'Saved city event warning tick is invalid.');
  if (warningTick !== undefined && warningTick > startTick) throw new Error('Saved city event warning tick is invalid.');
  const targetBuildingId = event.targetBuildingId === undefined
    ? undefined
    : requireNonEmptyString(event.targetBuildingId, 'Saved city event target is invalid.');
  if (targetBuildingId !== undefined && !buildingIds.has(targetBuildingId)) throw new Error('Saved city event target is invalid.');
  const productionMultiplier = event.productionMultiplier === undefined
    ? undefined
    : requireNonNegativeNumber(event.productionMultiplier, 'Saved city event production multiplier is invalid.');
  return {
    id: requireNonEmptyString(event.id, 'Saved city event id is invalid.'),
    type,
    status,
    ...(warningTick === undefined ? {} : { warningTick }),
    startTick,
    endTick,
    message: requireString(event.message, 'Saved city event message is invalid.'),
    ...(targetBuildingId === undefined ? {} : { targetBuildingId }),
    ...(productionMultiplier === undefined ? {} : { productionMultiplier }),
  };
}

function validateEventMessage(value: unknown): EventMessage {
  const message = requireRecord(value, 'Saved city event message is invalid.');
  return {
    id: requireNonEmptyString(message.id, 'Saved city event message id is invalid.'),
    tick: requireNonNegativeInteger(message.tick, 'Saved city event message tick is invalid.'),
    message: requireString(message.message, 'Saved city event message is invalid.'),
  };
}

function validateImperialRequest(value: unknown): ImperialRequest {
  const request = requireRecord(value, 'Saved city imperial request is invalid.');
  const status = request.status as ImperialRequest['status'];
  if (!REQUEST_STATUSES.includes(status)) throw new Error('Saved city imperial request status is invalid.');
  const issuedTick = requireNonNegativeInteger(request.issuedTick, 'Saved city imperial request issue tick is invalid.');
  const dueTick = requireNonNegativeInteger(request.dueTick, 'Saved city imperial request due tick is invalid.');
  if (dueTick < issuedTick) throw new Error('Saved city imperial request deadline is invalid.');
  return {
    id: requireNonEmptyString(request.id, 'Saved city imperial request id is invalid.'),
    requestedFood: requireNonNegativeNumber(request.requestedFood, 'Saved city imperial request food is invalid.'),
    issuedTick,
    dueTick,
    rewardMoney: requireFiniteNumber(request.rewardMoney, 'Saved city imperial request reward is invalid.'),
    failurePenalty: requireFiniteNumber(request.failurePenalty, 'Saved city imperial request penalty is invalid.'),
    status,
  };
}

function hydrateCity(serialized: SerializedCityState): CityState {
  const city: CityState = {
    width: serialized.width,
    height: serialized.height,
    tiles: serialized.tiles.map((tile) => ({ x: tile.x, y: tile.y, terrain: tile.terrain })),
    buildings: serialized.buildings.map((building) => ({ ...building })),
    resources: { money: serialized.resources.money },
    simulation: {
      tick: serialized.simulation.tick,
      finance: { ...serialized.simulation.finance },
      population: { ...serialized.simulation.population },
      ...(serialized.simulation.events === undefined ? {} : { events: serializeEventState(serialized.simulation.events) }),
    },
  };
  for (const building of city.buildings) {
    const tile = city.tiles[building.y * city.width + building.x];
    if (tile !== undefined) tile.buildingId = building.id;
  }
  recalculateDerivedState(city);
  return city;
}

function serializeEventState(events: EventState): EventState {
  return {
    seed: events.seed,
    active: events.active.map((event) => ({ ...event })),
    history: events.history.map((message) => ({ ...message })),
    processed: [...events.processed],
    ...(events.pendingRequest === undefined ? {} : { pendingRequest: { ...events.pendingRequest } }),
  };
}

function resolveStorage(storage: Storage | undefined): Storage | undefined {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function requireRecord(value: unknown, message: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(message);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error(message);
  return value as UnknownRecord;
}

function hasOwn(value: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function requireString(value: unknown, message: string): string {
  if (typeof value !== 'string') throw new Error(message);
  return value;
}

function requireNonEmptyString(value: unknown, message: string): string {
  const result = requireString(value, message);
  if (result.length === 0) throw new Error(message);
  return result;
}

function requireFiniteNumber(value: unknown, message: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(message);
  return value;
}

function requireInteger(value: unknown, message: string): number {
  const result = requireFiniteNumber(value, message);
  if (!Number.isInteger(result)) throw new Error(message);
  return result;
}

function requireNonNegativeNumber(value: unknown, message: string): number {
  const result = requireFiniteNumber(value, message);
  if (result < 0) throw new Error(message);
  return result;
}

function requireNonNegativeInteger(value: unknown, message: string): number {
  const result = requireInteger(value, message);
  if (result < 0) throw new Error(message);
  return result;
}

function requirePositiveInteger(value: unknown, message: string): number {
  const result = requireNonNegativeInteger(value, message);
  if (result === 0) throw new Error(message);
  return result;
}

function requireHouseLevel(value: unknown): 1 | 2 | 3 {
  if (value === 1 || value === 2 || value === 3) return value;
  throw new Error('Saved city house level is invalid.');
}

function optionalBoolean(value: unknown, message: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new Error(message);
  return value;
}

function optionalNonNegativeNumber(value: unknown, message: string): number | undefined {
  if (value === undefined) return undefined;
  return requireNonNegativeNumber(value, message);
}

function saveError(code: SaveErrorCode, message: string): SaveResult {
  return { ok: false, code, message };
}

function loadError(code: LoadErrorCode, message: string): LoadResult {
  if (code === 'incompatible_schema') return { ok: false, code, message };
  return { ok: false, code, message };
}
class IncompatibleSchemaError extends Error {}
class InvalidEnvelopeError extends Error {}
