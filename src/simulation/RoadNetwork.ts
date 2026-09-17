import type { Building, CityState } from './CityState';

interface Position {
  readonly x: number;
  readonly y: number;
}

export interface RoadNetwork {
  readonly roadTiles: ReadonlySet<string>;
  readonly mainRoadTiles: ReadonlySet<string>;
  readonly connectedBuildingIds: ReadonlySet<string>;
}

// Stable north, east, south, west traversal order.
const NEIGHBOURS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

function key(position: Position): string {
  return `${position.x},${position.y}`;
}

function adjacentRoads(roads: ReadonlySet<string>, position: Position): Position[] {
  const adjacent: Position[] = [];
  for (const [dx, dy] of NEIGHBOURS) {
    const next = { x: position.x + dx, y: position.y + dy };
    if (roads.has(key(next))) adjacent.push(next);
  }
  return adjacent;
}

export function getRoadNetwork(city: CityState): RoadNetwork {
  const buildings = [...city.buildings].sort((a, b) => a.y - b.y || a.x - b.x);
  const roads = buildings.filter((building) => building.type === 'road');
  const roadTiles = new Set(roads.map(key));
  const visited = new Set<string>();
  let mainRoadTiles = new Set<string>();

  for (const road of roads) {
    const startKey = key(road);
    if (visited.has(startKey)) continue;
    const component = new Set([startKey]);
    const queue: Position[] = [road];
    visited.add(startKey);
    for (let index = 0; index < queue.length; index++) {
      for (const next of adjacentRoads(roadTiles, queue[index]!)) {
        const nextKey = key(next);
        if (visited.has(nextKey)) continue;
        visited.add(nextKey);
        component.add(nextKey);
        queue.push(next);
      }
    }
    // Roots are row-major: retaining the first equal-sized component breaks ties.
    if (component.size > mainRoadTiles.size) mainRoadTiles = component;
  }

  const connectedBuildingIds = new Set<string>();
  for (const building of buildings) {
    if (building.type !== 'road' && adjacentRoads(mainRoadTiles, building).length > 0) {
      connectedBuildingIds.add(building.id);
    }
  }
  return { roadTiles, mainRoadTiles, connectedBuildingIds };
}

export function isBuildingOnRoadNetwork(
  city: CityState,
  building: Building,
  network = getRoadNetwork(city),
): boolean {
  return network.connectedBuildingIds.has(building.id);
}

/** Multi-source road distances; building entry and exit have no cost. */
export function getRoadDistances(
  network: RoadNetwork,
  source: Building,
  maxDistance = Infinity,
): ReadonlyMap<string, number> {
  const distances = new Map<string, number>();
  if (!network.connectedBuildingIds.has(source.id)) return distances;
  const queue = adjacentRoads(network.mainRoadTiles, source);
  for (const road of queue) distances.set(key(road), 0);

  for (let index = 0; index < queue.length; index++) {
    const road = queue[index]!;
    const distance = distances.get(key(road))!;
    if (distance >= maxDistance) continue;
    for (const next of adjacentRoads(network.mainRoadTiles, road)) {
      const nextKey = key(next);
      if (distances.has(nextKey)) continue;
      distances.set(nextKey, distance + 1);
      queue.push(next);
    }
  }
  return distances;
}

export function getDistanceToBuilding(
  network: RoadNetwork,
  distances: ReadonlyMap<string, number>,
  target: Building,
): number | undefined {
  if (!network.connectedBuildingIds.has(target.id)) return undefined;
  let shortest = Infinity;
  for (const road of adjacentRoads(network.mainRoadTiles, target)) {
    const distance = distances.get(key(road));
    if (distance !== undefined && distance < shortest) shortest = distance;
  }
  return shortest === Infinity ? undefined : shortest;
}

export function getRoadDistance(
  city: CityState,
  source: Building,
  target: Building,
  network = getRoadNetwork(city),
): number | undefined {
  return getDistanceToBuilding(network, getRoadDistances(network, source), target);
}

export function getRoadNetworkStats(city: CityState, network = getRoadNetwork(city)) {
  const totalBuildings = city.buildings.length - network.roadTiles.size;
  const connectedBuildings = network.connectedBuildingIds.size;
  return {
    mainRoadTiles: network.mainRoadTiles.size,
    totalBuildings,
    connectedBuildings,
    isolatedBuildings: totalBuildings - connectedBuildings,
  };
}
