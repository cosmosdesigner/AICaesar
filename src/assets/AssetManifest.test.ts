import { describe, expect, it, vi } from 'vitest';
import type { Texture } from 'pixi.js';
import {
  PROTOTYPE_TEXTURE_SCALE_MODE,
  configureMapTextureSampling,
  configureNearestSampling,
  type MapTextures,
} from './AssetManifest';

function createTexture(): Texture {
  return {
    source: {
      scaleMode: 'linear',
      style: {
        update: vi.fn(),
      },
    },
  } as unknown as Texture;
}

describe('prototype asset texture sampling', () => {
  it('uses the supported PixiJS v8 nearest scale mode string', () => {
    expect(PROTOTYPE_TEXTURE_SCALE_MODE).toBe('nearest');
  });

  it('configures a loaded texture source for nearest-neighbor sampling', () => {
    const texture = createTexture();

    const configured = configureNearestSampling(texture);

    expect(configured).toBe(texture);
    expect(texture.source.scaleMode).toBe('nearest');
    expect(texture.source.style.update).toHaveBeenCalledOnce();
  });

  it('configures every map prototype texture after load', () => {
    const textures: MapTextures = {
      farm: createTexture(),
      granary: createTexture(),
      grass: createTexture(),
      house: createTexture(),
      market: createTexture(),
      road: createTexture(),
      well: createTexture(),
    };

    const configured = configureMapTextureSampling(textures);

    expect(configured).toBe(textures);
    expect(Object.values(textures).map((texture) => texture.source.scaleMode)).toEqual([
      'nearest',
      'nearest',
      'nearest',
      'nearest',
      'nearest',
      'nearest',
      'nearest',
    ]);
    for (const texture of Object.values(textures)) {
      expect(texture.source.style.update).toHaveBeenCalledOnce();
    }
  });
});
