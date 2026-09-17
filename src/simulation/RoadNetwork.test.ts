import { describe, expect, it } from 'vitest';
import { createCityState, type Building, type CityState } from './CityState';
import {
  getRoadDistance,
  getRoadDistances,
  getRoadNetwork,
  getRoadNetworkStats,
  isBuildingOnRoadNetwork,
} from './RoadNetwork';

function emptyCity(): CityState {
  const city = createCityState();
  city.buildings.length = 0;
  for (const tile of city.tiles) delete tile.buildingId;
  return city;
}

function add(city: CityState, type: Building['type'], x: number, y: number): Building {
  const building = { id: `${type}-${x}-${y}`, type, x, y };
  city.buildings.push(building);
  city.tiles[y * city.width + x]!.buildingId = building.id;
  return building;
}

function roads(city: CityState, positions: readonly (readonly [number, number])[]): void {
  for (const [x, y] of positions) add(city, 'road', x, y);
}

describe('main road network', () => {
  it('leaves buildings disconnected when there are no roads', () => {
    const city = emptyCity();
    const house = add(city, 'house', 1, 1);
    const well = add(city, 'well', 2, 1);
    expect([...getRoadNetwork(city).mainRoadTiles]).toEqual([]);
    expect(isBuildingOnRoadNetwork(city, house)).toBe(false);
    expect(getRoadDistance(city, well, house)).toBeUndefined();
    expect(getRoadNetworkStats(city)).toEqual({ mainRoadTiles: 0, totalBuildings: 2, connectedBuildings: 0, isolatedBuildings: 2 });
  });

  it('connects orthogonal turns but not diagonals and chooses the largest component', () => {
    const city = emptyCity();
    roads(city, [[0, 0], [1, 1], [2, 1], [2, 2], [3, 3]]);
    expect([...getRoadNetwork(city).mainRoadTiles]).toEqual(['1,1', '2,1', '2,2']);
  });

  it('breaks equal-size component ties by y then x regardless of insertion order', () => {
    const city = emptyCity();
    roads(city, [[6, 2], [5, 2], [0, 4], [1, 4], [2, 2], [1, 2]]);
    expect([...getRoadNetwork(city).mainRoadTiles]).toEqual(['1,2', '2,2']);
    city.buildings.reverse();
    expect([...getRoadNetwork(city).mainRoadTiles]).toEqual(['1,2', '2,2']);
  });

  it('connects only non-road buildings beside main roads, in deterministic order', () => {
    const city = emptyCity();
    roads(city, [[1, 2], [2, 2], [8, 2]]);
    const isolated = add(city, 'house', 8, 1);
    const connected = add(city, 'house', 2, 1);
    const diagonal = add(city, 'well', 0, 1);
    const remote = add(city, 'farm', 5, 5);
    const second = add(city, 'granary', 1, 3);
    expect(isBuildingOnRoadNetwork(city, connected)).toBe(true);
    for (const building of [isolated, diagonal, remote, city.buildings[0]!]) {
      expect(isBuildingOnRoadNetwork(city, building)).toBe(false);
    }
    expect([...getRoadNetwork(city).connectedBuildingIds]).toEqual([connected.id, second.id]);
    expect(getRoadNetworkStats(city)).toEqual({ mainRoadTiles: 2, totalBuildings: 5, connectedBuildings: 2, isolatedBuildings: 3 });
    city.buildings.reverse();
    expect([...getRoadNetwork(city).connectedBuildingIds]).toEqual([connected.id, second.id]);
  });

  it('counts road steps only, including zero for a shared entrance', () => {
    const city = emptyCity();
    roads(city, [[1, 2], [2, 2], [3, 2], [4, 2]]);
    const source = add(city, 'well', 1, 1);
    const shared = add(city, 'house', 1, 3);
    const target = add(city, 'house', 4, 3);
    expect(getRoadDistance(city, source, shared)).toBe(0);
    expect(getRoadDistance(city, source, target)).toBe(3);
    expect(getRoadDistance(city, target, source)).toBe(3);
  });

  it('uses the shortest route among multiple source and target entrances', () => {
    const city = emptyCity();
    roads(city, [[2, 1], [3, 1], [4, 1], [4, 2], [4, 3], [3, 3], [2, 3], [1, 3], [1, 2], [1, 1]]);
    const source = add(city, 'well', 2, 2);
    const target = add(city, 'house', 3, 2);
    expect(getRoadDistance(city, source, target)).toBe(1);
    const distances = getRoadDistances(getRoadNetwork(city), source, 1);
    expect([...distances.entries()]).toEqual([
      ['2,1', 0], ['2,3', 0], ['1,2', 0],
      ['3,1', 1], ['1,1', 1], ['3,3', 1], ['1,3', 1],
    ]);
    expect(distances.has('4,2')).toBe(false);
  });

  it('follows road detours instead of Manhattan proximity', () => {
    const city = emptyCity();
    roads(city, [[1, 1], [1, 2], [1, 3], [1, 4], [2, 4], [3, 4], [4, 4], [4, 3], [4, 2], [4, 1]]);
    const source = add(city, 'well', 1, 0);
    const target = add(city, 'house', 4, 0);
    expect(getRoadDistance(city, source, target)).toBe(9);
  });

  it('rejects distances to or from isolated components', () => {
    const city = emptyCity();
    roads(city, [[1, 2], [2, 2], [8, 2]]);
    const source = add(city, 'well', 1, 1);
    const isolated = add(city, 'house', 8, 1);
    expect(getRoadDistance(city, source, isolated)).toBeUndefined();
    expect(getRoadDistance(city, isolated, source)).toBeUndefined();
    expect(getRoadDistance(city, isolated, isolated)).toBeUndefined();
  });

  it('recalculates after a bridge or main-component change without mutating city state', () => {
    const city = emptyCity();
    roads(city, [[1, 2], [2, 2], [4, 2]]);
    const house = add(city, 'house', 4, 1);
    const snapshot = structuredClone(city);
    expect(isBuildingOnRoadNetwork(city, house)).toBe(false);
    getRoadNetworkStats(city);
    expect(city).toEqual(snapshot);
    add(city, 'road', 3, 2);
    expect(isBuildingOnRoadNetwork(city, house)).toBe(true);
    roads(city, [[10, 8], [11, 8], [12, 8], [13, 8], [14, 8]]);
    expect(isBuildingOnRoadNetwork(city, house)).toBe(false);
  });
});
