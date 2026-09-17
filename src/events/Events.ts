import type { Building, CityState } from '../simulation/CityState';

export type CityEventType = 'drought' | 'epidemic' | 'fire';
export type CityEventStatus = 'warning' | 'active';

export interface CityEvent {
  readonly id: string;
  readonly type: CityEventType;
  readonly status: CityEventStatus;
  readonly warningTick?: number;
  readonly startTick: number;
  readonly endTick: number;
  readonly message: string;
  readonly targetBuildingId?: string;
  readonly productionMultiplier?: number;
}

export interface EventMessage {
  readonly id: string;
  readonly tick: number;
  readonly message: string;
}

export interface ImperialRequest {
  readonly id: string;
  readonly requestedFood: number;
  readonly issuedTick: number;
  readonly dueTick: number;
  readonly rewardMoney: number;
  readonly failurePenalty: number;
  status: 'pending' | 'fulfilled' | 'failed';
}

export interface ImperialRequestSummary extends ImperialRequest {
  readonly ticksRemaining: number;
  readonly foodStock: number;
}

export interface EventState {
  readonly seed: number;
  active: CityEvent[];
  history: EventMessage[];
  processed: string[];
  pendingRequest?: ImperialRequest;
}

interface TimedEventDefinition {
  readonly id: string;
  readonly warningTick: number;
  readonly startTick: number;
  readonly endTick: number;
}

export interface EventSchedule {
  readonly drought: TimedEventDefinition & { readonly productionMultiplier: number };
  readonly epidemic: TimedEventDefinition;
  readonly request: {
    readonly id: string;
    readonly issueTick: number;
    readonly dueTick: number;
    readonly requestedFood: number;
    readonly rewardMoney: number;
    readonly failurePenalty: number;
  };
  readonly fire: TimedEventDefinition;
}

export interface EventSummary {
  readonly id: string;
  readonly type: CityEventType;
  readonly status: CityEventStatus;
  readonly ticksRemaining: number;
  readonly targetBuildingId?: string;
}

export const DEFAULT_EVENT_SCHEDULE: EventSchedule = Object.freeze({
  drought: Object.freeze({ id: 'drought-founding', warningTick: 24, startTick: 30, endTick: 45, productionMultiplier: 0.5 }),
  epidemic: Object.freeze({ id: 'epidemic-founding', warningTick: 54, startTick: 60, endTick: 72 }),
  request: Object.freeze({ id: 'imperial-request-founding', issueTick: 78, dueTick: 96, requestedFood: 10, rewardMoney: 35, failurePenalty: 25 }),
  fire: Object.freeze({ id: 'fire-founding', warningTick: 84, startTick: 90, endTick: 98 }),
});

const HISTORY_LIMIT = 10;
const EVENT_TYPE_ORDER: Readonly<Record<CityEventType, number>> = { drought: 0, epidemic: 1, fire: 2 };

export function createEventState(seed = 21): EventState {
  return { seed, active: [], history: [], processed: [] };
}

export function advanceEvents(city: CityState, schedule = DEFAULT_EVENT_SCHEDULE): number {
  const state = ensureEventState(city);
  const tick = city.simulation.tick;
  let populationChange = 0;

  advanceTimedEvent(city, state, schedule.drought, 'drought', () => 0, schedule.drought.productionMultiplier);
  populationChange += advanceTimedEvent(city, state, schedule.epidemic, 'epidemic', () => applyEpidemicPopulationPressure(city));
  advanceTimedEvent(city, state, schedule.fire, 'fire', () => 0);

  for (const event of [...state.active].sort(compareEvents)) {
    if (event.status !== 'active' || tick < event.endTick) continue;
    state.active = state.active.filter((candidate) => candidate.id !== event.id);
    markProcessed(state, `resolved:${event.id}`);
    publish(state, tick, event.id, resolvedMessage(event));
  }

  advanceImperialRequest(city, state, schedule.request);
  return populationChange;
}

export function getDroughtProductionMultiplier(city: CityState): number {
  return getActiveEvent(city, 'drought')?.productionMultiplier ?? 1;
}

export function isEpidemicActive(city: CityState): boolean {
  return getActiveEvent(city, 'epidemic') !== undefined;
}

export function isBuildingSuppressed(city: CityState, building: Building): boolean {
  return getActiveEvent(city, 'fire')?.targetBuildingId === building.id;
}

export function getEventSummary(city: CityState): readonly EventSummary[] {
  const tick = city.simulation.tick;
  return ensureEventState(city).active
    .slice()
    .sort(compareEvents)
    .map((event) => ({
      id: event.id,
      type: event.type,
      status: event.status,
      ticksRemaining: Math.max(0, (event.status === 'warning' ? event.startTick : event.endTick) - tick),
      ...(event.targetBuildingId === undefined ? {} : { targetBuildingId: event.targetBuildingId }),
    }));
}

export function getImperialFoodStock(city: CityState): number {
  return city.buildings.reduce((total, building) => (
    building.type === 'granary' || building.type === 'market' ? total + getStoredFood(building) : total
  ), 0);
}

export function getImperialRequestSummary(city: CityState): ImperialRequestSummary | undefined {
  const request = ensureEventState(city).pendingRequest;
  if (request === undefined) return undefined;
  return {
    ...request,
    ticksRemaining: Math.max(0, request.dueTick - city.simulation.tick),
    foodStock: getImperialFoodStock(city),
  };
}

export function canFulfillImperialRequest(city: CityState): boolean {
  const request = ensureEventState(city).pendingRequest;
  return request?.status === 'pending' && getImperialFoodStock(city) >= request.requestedFood;
}

export function fulfillImperialRequest(city: CityState): boolean {
  const state = ensureEventState(city);
  const request = state.pendingRequest;
  if (!request || request.status !== 'pending' || !canFulfillImperialRequest(city)) return false;

  let remainingFood = request.requestedFood;
  const stores = city.buildings
    .filter((building) => building.type === 'granary' || building.type === 'market')
    .sort((left, right) => storeTypeOrder(left) - storeTypeOrder(right) || compareBuildings(left, right));
  for (const store of stores) {
    const removed = Math.min(remainingFood, getStoredFood(store));
    store.storedFood = getStoredFood(store) - removed;
    remainingFood -= removed;
    if (remainingFood === 0) break;
  }

  request.status = 'fulfilled';
  markProcessed(state, `request:fulfilled:${request.id}`);
  city.resources.money += request.rewardMoney;
  publish(state, city.simulation.tick, request.id, `Imperial request fulfilled: delivered ${request.requestedFood} food; reward +${request.rewardMoney} money.`);
  return true;
}

function ensureEventState(city: CityState): EventState {
  if (city.simulation.events === undefined) city.simulation.events = createEventState();
  return city.simulation.events;
}

function advanceTimedEvent(
  city: CityState,
  state: EventState,
  definition: TimedEventDefinition,
  type: CityEventType,
  onActivate: () => number,
  productionMultiplier?: number,
): number {
  const tick = city.simulation.tick;
  if (tick >= definition.warningTick && !isProcessed(state, `warning:${definition.id}`)) {
    state.active.push(createEvent(definition, type, 'warning', undefined, productionMultiplier));
    markProcessed(state, `warning:${definition.id}`);
    publish(state, tick, definition.id, warningMessage(type));
  }

  if (tick < definition.startTick || isProcessed(state, `started:${definition.id}`)) return 0;
  const activeEvent = createEvent(
    definition,
    type,
    'active',
    type === 'fire' ? getFireTarget(city)?.id : undefined,
    productionMultiplier,
  );
  state.active = state.active.filter((event) => event.id !== definition.id);
  state.active.push(activeEvent);
  markProcessed(state, `started:${definition.id}`);
  publish(state, tick, definition.id, startedMessage(activeEvent));
  return onActivate();
}

function advanceImperialRequest(city: CityState, state: EventState, definition: EventSchedule['request']): void {
  const tick = city.simulation.tick;
  if (tick >= definition.issueTick && !isProcessed(state, `request:issued:${definition.id}`)) {
    state.pendingRequest = {
      id: definition.id,
      requestedFood: definition.requestedFood,
      issuedTick: definition.issueTick,
      dueTick: definition.dueTick,
      rewardMoney: definition.rewardMoney,
      failurePenalty: definition.failurePenalty,
      status: 'pending',
    };
    markProcessed(state, `request:issued:${definition.id}`);
    publish(state, tick, definition.id, `Imperial request: deliver ${definition.requestedFood} food by tick ${definition.dueTick}.`);
  }

  const request = state.pendingRequest;
  if (!request || request.status !== 'pending' || tick < request.dueTick) return;
  request.status = 'failed';
  markProcessed(state, `request:failed:${request.id}`);
  city.resources.money -= request.failurePenalty;
  publish(state, tick, request.id, `Imperial request failed: penalty -${request.failurePenalty} money.`);
}

function getActiveEvent(city: CityState, type: CityEventType): CityEvent | undefined {
  return ensureEventState(city).active.find((event) => event.type === type && event.status === 'active');
}

function createEvent(
  definition: TimedEventDefinition,
  type: CityEventType,
  status: CityEventStatus,
  targetBuildingId?: string,
  productionMultiplier?: number,
): CityEvent {
  return {
    id: definition.id,
    type,
    status,
    warningTick: definition.warningTick,
    startTick: definition.startTick,
    endTick: definition.endTick,
    message: status === 'warning'
      ? warningMessage(type)
      : startedMessage(targetBuildingId === undefined ? { type } : { type, targetBuildingId }),
    ...(targetBuildingId === undefined ? {} : { targetBuildingId }),
    ...(productionMultiplier === undefined ? {} : { productionMultiplier }),
  };
}

function applyEpidemicPopulationPressure(city: CityState): number {
  let populationChange = 0;
  for (const house of city.buildings.filter((building) => building.type === 'house').sort(compareBuildings)) {
    const population = house.population ?? 0;
    if (population <= 0) continue;
    house.population = population - 1;
    populationChange -= 1;
  }
  return populationChange;
}

function getFireTarget(city: CityState): Building | undefined {
  return city.buildings
    .filter((building) => building.type === 'farm' || building.type === 'granary' || building.type === 'market')
    .sort(compareBuildings)[0];
}

function warningMessage(type: CityEventType): string {
  switch (type) {
    case 'drought': return 'Drought warning: farm production will be reduced.';
    case 'epidemic': return 'Epidemic warning: population growth will be suspended.';
    case 'fire': return 'Fire warning: one workplace may be temporarily suppressed.';
  }
}

function startedMessage(event: Pick<CityEvent, 'type' | 'targetBuildingId'>): string {
  switch (event.type) {
    case 'drought': return 'Drought started: farm production reduced by 50%.';
    case 'epidemic': return 'Epidemic started: population growth suspended.';
    case 'fire': return event.targetBuildingId
      ? `Fire started: ${event.targetBuildingId} temporarily suppressed.`
      : 'Fire started: no eligible workplace was available.';
  }
}

function resolvedMessage(event: CityEvent): string {
  switch (event.type) {
    case 'drought': return 'Drought ended: farm production restored.';
    case 'epidemic': return 'Epidemic ended: population growth restored.';
    case 'fire': return event.targetBuildingId
      ? `Fire ended: ${event.targetBuildingId} restored.`
      : 'Fire ended without a suppressed workplace.';
  }
}

function publish(state: EventState, tick: number, id: string, message: string): void {
  state.history.push({ id, tick, message });
  if (state.history.length > HISTORY_LIMIT) state.history.splice(0, state.history.length - HISTORY_LIMIT);
}

function markProcessed(state: EventState, key: string): void {
  if (!isProcessed(state, key)) state.processed.push(key);
}

function isProcessed(state: EventState, key: string): boolean {
  return state.processed.includes(key);
}

function compareEvents(left: CityEvent, right: CityEvent): number {
  return EVENT_TYPE_ORDER[left.type] - EVENT_TYPE_ORDER[right.type] || left.id.localeCompare(right.id);
}

function compareBuildings(left: Building, right: Building): number {
  return left.y - right.y || left.x - right.x || left.id.localeCompare(right.id);
}

function storeTypeOrder(building: Building): number {
  return building.type === 'granary' ? 0 : 1;
}

function getStoredFood(building: Building): number {
  return Math.max(0, building.storedFood ?? 0);
}
