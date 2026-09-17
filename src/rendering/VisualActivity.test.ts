import { describe, expect, it } from 'vitest';
import { createCityState, placeBuilding } from '../simulation/CityState';
import {
  advanceVisualActivity,
  createVisualActivity,
  getVisualActivityFrame,
  getVisualActivityPosition,
  reconcileVisualActivity,
} from './VisualActivity';

function createRoadCity() {
  const city = createCityState();
  city.buildings.length = 0;
  for (const tile of city.tiles) delete tile.buildingId;
  placeBuilding(city, 1, 1, 'road');
  placeBuilding(city, 2, 1, 'road');
  placeBuilding(city, 3, 1, 'road');
  return city;
}

describe('visual activity', () => {
  it('derives a fixed small citizen and cart set without changing CityState', () => {
    const city = createRoadCity();
    const before = JSON.stringify(city);

    const first = createVisualActivity(city);
    const second = createVisualActivity(city);

    expect(first).toEqual(second);
    expect(first.entities).toHaveLength(5);
    expect(first.entities.filter((entity) => entity.kind === 'cart')).toHaveLength(1);
    expect(JSON.stringify(city)).toBe(before);
  });

  it('does not create activity when the main road has no traversable segment', () => {
    const city = createCityState();
    city.buildings.length = 0;
    for (const tile of city.tiles) delete tile.buildingId;
    placeBuilding(city, 4, 4, 'road');

    expect(createVisualActivity(city).entities).toEqual([]);
  });

  it('advances position and animation frames using the supplied delta only', () => {
    const activity = createVisualActivity(createRoadCity());
    const citizen = activity.entities[0]!;
    const before = getVisualActivityPosition(citizen);
    const beforeFrame = getVisualActivityFrame(citizen, 2);

    advanceVisualActivity(activity, 0.25);

    expect(getVisualActivityPosition(citizen)).not.toEqual(before);
    expect(getVisualActivityFrame(citizen, 2)).not.toBe(beforeFrame);
  });

  it('retains visual objects on an unchanged refresh and replaces them when roads change', () => {
    const city = createRoadCity();
    const activity = createVisualActivity(city);
    advanceVisualActivity(activity, 0.5);

    expect(reconcileVisualActivity(activity, city)).toBe(activity);
    placeBuilding(city, 4, 1, 'road');
    const reconciled = reconcileVisualActivity(activity, city);

    expect(reconciled).not.toBe(activity);
    expect(reconciled.entities).toHaveLength(5);
    expect(new Set(reconciled.entities.map((entity) => entity.id)).size).toBe(reconciled.entities.length);
  });
});
