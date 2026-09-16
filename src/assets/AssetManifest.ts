import { Assets, type SCALE_MODE, type Texture } from 'pixi.js';

const base = `${import.meta.env.BASE_URL}assets/prototype/`;

export const assetManifest = {
  grass: `${base}ground/land1a_00001.png`,
  road: `${base}way/ground_00002.png`,
  house: `${base}houses/housng1a_00007.png`,
  well: `${base}well/well_00001.png`,
  farm: `${base}farm/vegfarm_00001.png`,
  granary: `${base}granary/warehouse_00001.png`,
  market: `${base}market/commerce_00001.png`,
} as const;

export type MapTextures = Record<keyof typeof assetManifest, Texture>;

export const PROTOTYPE_TEXTURE_SCALE_MODE: SCALE_MODE = 'nearest';

export function configureNearestSampling(texture: Texture): Texture {
  texture.source.scaleMode = PROTOTYPE_TEXTURE_SCALE_MODE;
  texture.source.style.update();
  return texture;
}

export function configureMapTextureSampling(textures: MapTextures): MapTextures {
  for (const texture of Object.values(textures)) {
    configureNearestSampling(texture);
  }
  return textures;
}


export async function loadMapTextures(): Promise<MapTextures> {
  const [grass, road, house, well, farm, granary, market] = await Promise.all([
    Assets.load<Texture>(assetManifest.grass),
    Assets.load<Texture>(assetManifest.road),
    Assets.load<Texture>(assetManifest.house),
    Assets.load<Texture>(assetManifest.well),
    Assets.load<Texture>(assetManifest.farm),
    Assets.load<Texture>(assetManifest.granary),
    Assets.load<Texture>(assetManifest.market),
  ]);
  return configureMapTextureSampling({ grass, road, house, well, farm, granary, market });
}
