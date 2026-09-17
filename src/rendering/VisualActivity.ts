import type { CityState } from '../simulation/CityState';
import { getRoadNetwork } from '../simulation/RoadNetwork';

export type VisualActivityKind = 'citizen' | 'cart';

export interface VisualActivityPoint {
  readonly x: number;
  readonly y: number;
}

export interface VisualActivityEntity {
  readonly id: string;
  readonly kind: VisualActivityKind;
  readonly route: readonly VisualActivityPoint[];
  readonly speed: number;
  progress: number;
  animationTime: number;
}

export interface VisualActivity {
  readonly roadSignature: string;
  readonly entities: VisualActivityEntity[];
}

export interface VisualActivityOptions {
  readonly citizenCount?: number;
  readonly cartCount?: number;
}

const DEFAULT_CITIZEN_COUNT = 4;
const DEFAULT_CART_COUNT = 1;
const NEIGHBOURS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

/**
 * Derives a small presentation-only road walk. It is a deterministic DFS traversal
 * with backtracking, not a unit pathfinder.
 */
export function createVisualActivity(city: CityState, options: VisualActivityOptions = {}): VisualActivity {
  const route = createMainRoadWalk(city);
  const roadSignature = route.map(pointKey).join('|');
  if (route.length < 2) return { roadSignature, entities: [] };

  const citizenCount = options.citizenCount ?? DEFAULT_CITIZEN_COUNT;
  const cartCount = options.cartCount ?? DEFAULT_CART_COUNT;
  const entities: VisualActivityEntity[] = [];
  for (let index = 0; index < citizenCount; index += 1) {
    entities.push(createEntity('citizen', index, route, 0.62 + index * 0.06));
  }
  for (let index = 0; index < cartCount; index += 1) {
    entities.push(createEntity('cart', index, route, 0.38 + index * 0.04));
  }
  return { roadSignature, entities };
}

/** Reuses current presentation state until the main-road traversal changes. */
export function reconcileVisualActivity(activity: VisualActivity, city: CityState, options: VisualActivityOptions = {}): VisualActivity {
  const next = createVisualActivity(city, options);
  return next.roadSignature === activity.roadSignature ? activity : next;
}

/** Advances only ephemeral visual state. Delta is injected by the renderer/tests. */
export function advanceVisualActivity(activity: VisualActivity, deltaSeconds: number): void {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
  for (const entity of activity.entities) {
    const segmentCount = entity.route.length - 1;
    if (segmentCount < 1) continue;
    entity.progress = wrap(entity.progress + entity.speed * deltaSeconds, segmentCount);
    entity.animationTime += deltaSeconds;
  }
}

export function getVisualActivityPosition(entity: VisualActivityEntity): VisualActivityPoint {
  const segmentCount = entity.route.length - 1;
  if (segmentCount < 1) return entity.route[0] ?? { x: 0, y: 0 };
  const progress = wrap(entity.progress, segmentCount);
  const segment = Math.floor(progress);
  const fraction = progress - segment;
  const from = entity.route[segment]!;
  const to = entity.route[segment + 1]!;
  return {
    x: from.x + (to.x - from.x) * fraction,
    y: from.y + (to.y - from.y) * fraction,
  };
}

export function getVisualActivityFrame(entity: VisualActivityEntity, frameCount: number): number {
  if (frameCount < 1) return 0;
  return Math.floor(entity.animationTime * 5) % frameCount;
}

function createMainRoadWalk(city: CityState): VisualActivityPoint[] {
  const mainRoadTiles = getRoadNetwork(city).mainRoadTiles;
  const roads = [...mainRoadTiles].map(parsePoint).sort(comparePoints);
  const start = roads[0];
  if (start === undefined) return [];

  const visited = new Set<string>();
  const walk: VisualActivityPoint[] = [];
  const visit = (point: VisualActivityPoint): void => {
    visited.add(pointKey(point));
    walk.push(point);
    for (const [dx, dy] of NEIGHBOURS) {
      const next = { x: point.x + dx, y: point.y + dy };
      if (!mainRoadTiles.has(pointKey(next)) || visited.has(pointKey(next))) continue;
      visit(next);
      walk.push(point);
    }
  };
  visit(start);
  return walk;
}

function createEntity(kind: VisualActivityKind, index: number, route: readonly VisualActivityPoint[], speed: number): VisualActivityEntity {
  const segmentCount = route.length - 1;
  const phase = (index + (kind === 'cart' ? 0.5 : 0)) / (DEFAULT_CITIZEN_COUNT + DEFAULT_CART_COUNT);
  return {
    id: `${kind}-${index}`,
    kind,
    route,
    speed,
    progress: phase * segmentCount,
    animationTime: phase,
  };
}

function parsePoint(value: string): VisualActivityPoint {
  const [x, y] = value.split(',').map(Number);
  return { x: x!, y: y! };
}

function comparePoints(a: VisualActivityPoint, b: VisualActivityPoint): number {
  return a.y - b.y || a.x - b.x;
}

function pointKey(point: VisualActivityPoint): string {
  return `${point.x},${point.y}`;
}

function wrap(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}
