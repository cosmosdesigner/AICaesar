import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import type { MapTextures } from '../assets/AssetManifest';
import { createCityState, placeBuilding } from '../simulation/CityState';
import { gridToScreen, TILE_HEIGHT } from './GridMath';
import { MapRenderer } from './MapRenderer';

const textures: MapTextures = {
  grass: Texture.EMPTY,
  road: Texture.EMPTY,
  house: Texture.EMPTY,
  well: Texture.EMPTY,
  farm: Texture.EMPTY,
  granary: Texture.EMPTY,
  market: Texture.EMPTY,
  garden: Texture.EMPTY,
  plaza: Texture.EMPTY,
  fountain: Texture.EMPTY,
};

function createRoadCity() {
  const city = createCityState();
  city.buildings.length = 0;
  for (const tile of city.tiles) delete tile.buildingId;
  placeBuilding(city, 1, 1, 'road');
  placeBuilding(city, 2, 1, 'road');
  placeBuilding(city, 5, 5, 'road');
  return city;
}

function getRoadSprite(map: MapRenderer, x: number, y: number): Sprite {
  const buildings = map.children[2] as Container;
  const screen = gridToScreen(x, y);
  const sprite = buildings.children.find((child) => (
    child instanceof Sprite && child.x === screen.x && child.y === screen.y + TILE_HEIGHT / 2
  ));
  if (!(sprite instanceof Sprite)) throw new Error(`Missing road sprite at ${x},${y}`);
  return sprite;
}

describe('road network rendering', () => {
  it('tints actual main and isolated road sprites distinctly and reclassifies after construction', () => {
    const city = createRoadCity();
    const map = new MapRenderer(city, textures);
    map.refresh(city, { roadNetworkOverlay: true });

    const mainTint = getRoadSprite(map, 1, 1).tint;
    const isolatedTint = getRoadSprite(map, 5, 5).tint;
    expect(mainTint).not.toBe(isolatedTint);
    expect(mainTint).not.toBe(0xffffff);
    expect(isolatedTint).not.toBe(0xffffff);
    expect(getRoadSprite(map, 2, 1).tint).toBe(mainTint);

    placeBuilding(city, 6, 5, 'road');
    placeBuilding(city, 7, 5, 'road');
    map.refresh(city, { roadNetworkOverlay: true });
    expect(getRoadSprite(map, 1, 1).tint).toBe(isolatedTint);
    expect(getRoadSprite(map, 5, 5).tint).toBe(mainTint);
    expect(getRoadSprite(map, 7, 5).tint).toBe(mainTint);

    map.refresh(city, { roadNetworkOverlay: false });
    expect(getRoadSprite(map, 1, 1).tint).toBe(0xffffff);
    expect(getRoadSprite(map, 5, 5).tint).toBe(0xffffff);
    map.destroy({ children: true });
  });

  it('preserves actual camera pan and zoom across overlay toggles and city refreshes', () => {
    const city = createRoadCity();
    const map = new MapRenderer(city, textures);
    const camera = { x: -215, y: 137, zoom: 1.6 };
    map.applyCamera(camera);

    map.refresh(city, { roadNetworkOverlay: true });
    expect(map.getCameraState()).toEqual(camera);
    placeBuilding(city, 3, 1, 'road');
    map.refresh(city, { roadNetworkOverlay: true });
    expect(map.getCameraState()).toEqual(camera);
    map.refresh(city, { roadNetworkOverlay: false });
    expect(map.getCameraState()).toEqual(camera);
    map.destroy({ children: true });
  });
});

describe('tile preview rendering', () => {
  it('renders ephemeral free and occupied highlights without changing the city or camera', () => {
    const city = createRoadCity();
    const map = new MapRenderer(city, textures);
    const camera = { x: -215, y: 137, zoom: 1.6 };
    const before = JSON.stringify(city);
    map.applyCamera(camera);

    map.setPreview({ x: 3, y: 3, state: 'free' });
    const preview = map.children[3];
    expect(preview).toBeInstanceOf(Graphics);
    if (!(preview instanceof Graphics)) throw new Error('Expected preview graphics layer.');
    expect(preview.getLocalBounds().width).toBeGreaterThan(0);

    map.setPreview({ x: 1, y: 1, state: 'occupied', buildingType: 'road' });
    map.refresh(city);
    const refreshedPreview = map.children[3];
    expect(refreshedPreview).toBeInstanceOf(Graphics);
    if (!(refreshedPreview instanceof Graphics)) throw new Error('Expected refreshed preview graphics layer.');
    expect(refreshedPreview.getLocalBounds().width).toBeGreaterThan(0);
    expect(map.getCameraState()).toEqual(camera);
    expect(JSON.stringify(city)).toBe(before);
    map.destroy({ children: true });
  });
});

describe('desirability rendering', () => {
  it('draws a full-map desirability overlay without affecting water and food overlays', () => {
    const city = createRoadCity();
    placeBuilding(city, 3, 2, 'garden');
    const map = new MapRenderer(city, textures);

    map.refresh(city, { waterOverlay: true, foodOverlay: true, desirabilityOverlay: true });

    const overlays = map.children[1] as Container;
    expect(overlays.children).toHaveLength(3);
    map.destroy({ children: true });
  });
});
