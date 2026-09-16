import { describe, expect, it } from 'vitest';
import {
  MAX_CAMERA_ZOOM,
  MIN_CAMERA_ZOOM,
  clampCameraZoom,
  createFittedCamera,
  panCamera,
  screenToMapPoint,
  zoomAtScreenPoint,
} from './Camera';

describe('camera math', () => {
  it('clamps zoom to supported navigation limits', () => {
    expect(clampCameraZoom(MIN_CAMERA_ZOOM / 10)).toBe(MIN_CAMERA_ZOOM);
    expect(clampCameraZoom(MAX_CAMERA_ZOOM * 10)).toBe(MAX_CAMERA_ZOOM);
    expect(clampCameraZoom(1.25)).toBe(1.25);
  });

  it('keeps the map-local point under the cursor stable while zooming', () => {
    const camera = { x: 120, y: 80, zoom: 0.75 };
    const cursor = { x: 450, y: 280 };
    const before = screenToMapPoint(camera, cursor);

    const zoomed = zoomAtScreenPoint(camera, cursor, 1.5);
    const after = screenToMapPoint(zoomed, cursor);

    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
    expect(zoomed.zoom).toBe(1.5);
  });

  it('adds pan deltas to camera position without changing zoom', () => {
    expect(panCamera({ x: 10, y: 20, zoom: 1.25 }, { x: -4, y: 9 })).toEqual({
      x: 6,
      y: 29,
      zoom: 1.25,
    });
  });

  it('fits bounds into the viewport and centers their visual midpoint', () => {
    const camera = createFittedCamera(
      { x: -120, y: 0, width: 3600, height: 1800 },
      { width: 1800, height: 1200 },
    );

    const left = -120 * camera.zoom + camera.x;
    const right = (-120 + 3600) * camera.zoom + camera.x;
    const top = camera.y;
    const bottom = 1800 * camera.zoom + camera.y;

    expect(camera.zoom).toBeLessThanOrEqual(MAX_CAMERA_ZOOM);
    expect((left + right) / 2).toBeCloseTo(900, 10);
    expect((top + bottom) / 2).toBeCloseTo(600, 10);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(right).toBeLessThanOrEqual(1800);
  });

  it('clamps fitted zoom to the minimum supported navigation limit', () => {
    const camera = createFittedCamera(
      { x: -50, y: 25, width: 10_000, height: 8_000 },
      { width: 8, height: 6 },
    );

    expect(camera.zoom).toBe(MIN_CAMERA_ZOOM);
  });
});
