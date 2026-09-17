import { describe, expect, it } from 'vitest';
import { createCityState, placeBuilding } from '../simulation/CityState';
import { describeTilePreview, getTilePreview } from './TilePreview';

describe('tile preview state', () => {
  it('derives a free tile and build description without mutating city state', () => {
    const city = createCityState();
    const before = JSON.stringify(city);

    const preview = getTilePreview(city, { x: 20, y: 10 });

    expect(preview).toEqual({ x: 20, y: 10, state: 'free' });
    expect(describeTilePreview(preview, 'build')).toBe('Tile (20, 10): livre — construir.');
    expect(JSON.stringify(city)).toBe(before);
  });

  it('derives occupied tile information for demolition without mutating city state', () => {
    const city = createCityState();
    expect(placeBuilding(city, 20, 10, 'well')).toBe('built');
    const before = JSON.stringify(city);

    const preview = getTilePreview(city, { x: 20, y: 10 });

    expect(preview).toEqual({ x: 20, y: 10, state: 'occupied', buildingType: 'well' });
    expect(describeTilePreview(preview, 'demolish')).toBe('Tile (20, 10): ocupado por Well — demolir.');
    expect(JSON.stringify(city)).toBe(before);
  });

  it('reports positions outside the map without creating a preview', () => {
    const city = createCityState();

    expect(getTilePreview(city, { x: -1, y: 10 })).toBeNull();
    expect(getTilePreview(city, null)).toBeNull();
    expect(describeTilePreview(null, 'build')).toBe('Tile: fora do mapa.');
  });
});
