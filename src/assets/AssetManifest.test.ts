import { describe, expect, it, vi } from 'vitest';
import type { Texture } from 'pixi.js';
import {
  PROTOTYPE_TEXTURE_SCALE_MODE,
  configureMapTextureSampling,
  configureNearestSampling,
  parseVisualActivityManifest,
  visualActivityManifest,
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
      garden: createTexture(),
      plaza: createTexture(),
      fountain: createTexture(),
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
      'nearest',
      'nearest',
      'nearest',
    ]);
    for (const texture of Object.values(textures)) {
      expect(texture.source.style.update).toHaveBeenCalledOnce();
    }
  });
});

describe('visual activity assets', () => {
  it('parses the two local Caesaria spritesheets and their small runtime frame sets', () => {
    expect(parseVisualActivityManifest(visualActivityManifest)).toEqual(visualActivityManifest);
  });

  it('keeps every declared runtime frame inside its copied spritesheet', () => {
    const dimensions = { citizen: { width: 2048, height: 2048 }, cart: { width: 1024, height: 2048 } } as const;
    for (const kind of ['citizen', 'cart'] as const) {
      for (const frame of visualActivityManifest[kind].frames) {
        expect(frame.x).toBeGreaterThanOrEqual(0);
        expect(frame.y).toBeGreaterThanOrEqual(0);
        expect(frame.x + frame.width).toBeLessThanOrEqual(dimensions[kind].width);
        expect(frame.y + frame.height).toBeLessThanOrEqual(dimensions[kind].height);
      }
    }
  });

  it('rejects a visual activity asset without a usable frame set', () => {
    expect(() => parseVisualActivityManifest({
      citizen: { source: 'citizen.png', frames: [] },
      cart: { source: 'cart.png', frames: [{ x: 0, y: 0, width: 39, height: 39 }] },
    })).toThrow('source and frames');
  });
});
