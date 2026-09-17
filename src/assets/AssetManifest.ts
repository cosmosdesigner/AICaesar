import { Assets, Rectangle, Texture, type SCALE_MODE } from 'pixi.js';

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

export type MapTextures = Record<keyof typeof assetManifest | 'garden' | 'plaza' | 'fountain', Texture>;

export const PROTOTYPE_TEXTURE_SCALE_MODE: SCALE_MODE = 'nearest';

export function configureNearestSampling(texture: Texture): Texture {
  texture.source.scaleMode = PROTOTYPE_TEXTURE_SCALE_MODE;
  texture.source.style.update();
  return texture;
}

export function configureMapTextureSampling(textures: MapTextures): MapTextures {
  const configuredTextures = new Set<Texture>();
  for (const texture of Object.values(textures)) {
    if (configuredTextures.has(texture)) continue;
    configuredTextures.add(texture);
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
  return configureMapTextureSampling({
    grass,
    road,
    house,
    well,
    farm,
    granary,
    market,
    garden: farm,
    plaza: market,
    fountain: well,
  });
}

export interface VisualActivityFrame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface VisualActivityAsset {
  readonly source: string;
  readonly frames: readonly VisualActivityFrame[];
}

export interface VisualActivityAssetManifest {
  readonly citizen: VisualActivityAsset;
  readonly cart: VisualActivityAsset;
}

export type VisualActivityTextures = Record<keyof VisualActivityAssetManifest, readonly Texture[]>;

export const visualActivityManifest: VisualActivityAssetManifest = {
  citizen: {
    source: `${base}visual-activity/citizen1.png`,
    frames: [
      { x: 405, y: 771, width: 39, height: 39 },
      { x: 445, y: 771, width: 39, height: 39 },
    ],
  },
  cart: {
    source: `${base}visual-activity/carts.png`,
    frames: [
      { x: 780, y: 877, width: 39, height: 39 },
      { x: 780, y: 916, width: 39, height: 39 },
    ],
  },
};

export function parseVisualActivityManifest(value: unknown): VisualActivityAssetManifest {
  if (typeof value !== 'object' || value === null) throw new Error('Visual activity manifest must be an object.');
  const manifest = value as Partial<Record<keyof VisualActivityAssetManifest, unknown>>;
  return {
    citizen: parseVisualActivityAsset(manifest.citizen, 'citizen'),
    cart: parseVisualActivityAsset(manifest.cart, 'cart'),
  };
}

export async function loadVisualActivityTextures(): Promise<VisualActivityTextures> {
  const manifest = parseVisualActivityManifest(visualActivityManifest);
  const [citizen, cart] = await Promise.all([
    loadVisualActivityTexture(manifest.citizen),
    loadVisualActivityTexture(manifest.cart),
  ]);
  return { citizen, cart };
}

function parseVisualActivityAsset(value: unknown, kind: string): VisualActivityAsset {
  if (typeof value !== 'object' || value === null) throw new Error(`Visual activity ${kind} asset must be an object.`);
  const asset = value as Partial<VisualActivityAsset>;
  if (typeof asset.source !== 'string' || asset.source.length === 0 || !Array.isArray(asset.frames) || asset.frames.length === 0) {
    throw new Error(`Visual activity ${kind} asset must have a source and frames.`);
  }
  const frames = asset.frames.map((frame) => {
    if (typeof frame !== 'object' || frame === null) throw new Error(`Visual activity ${kind} frame must be an object.`);
    const candidate = frame as Partial<VisualActivityFrame>;
    const { x, y, width, height } = candidate;
    if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number' || !Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
      throw new Error(`Visual activity ${kind} frame must have positive integer bounds.`);
    }
    return { x, y, width, height };
  });
  return { source: asset.source, frames };
}

async function loadVisualActivityTexture(asset: VisualActivityAsset): Promise<readonly Texture[]> {
  const sourceTexture = configureNearestSampling(await Assets.load<Texture>(asset.source));
  return asset.frames.map((frame) => new Texture({
    source: sourceTexture.source,
    frame: new Rectangle(frame.x, frame.y, frame.width, frame.height),
  }));
}
