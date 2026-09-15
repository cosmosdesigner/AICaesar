import { Assets, type Texture } from 'pixi.js';

const base = `${import.meta.env.BASE_URL}assets/prototype/`;

export const assetManifest = {
  grass: `${base}ground/land1a_00001.png`,
  road: `${base}way/ground_00002.png`,
  house: `${base}houses/housng1a_00007.png`,
  well: `${base}well/well_00001.png`,
} as const;

export type MapTextures = Record<keyof typeof assetManifest, Texture>;

export async function loadMapTextures(): Promise<MapTextures> {
  const [grass, road, house, well] = await Promise.all([
    Assets.load<Texture>(assetManifest.grass),
    Assets.load<Texture>(assetManifest.road),
    Assets.load<Texture>(assetManifest.house),
    Assets.load<Texture>(assetManifest.well),
  ]);
  return { grass, road, house, well };
}
