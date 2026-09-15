export const TILE_WIDTH = 120;
export const TILE_HEIGHT = 60;

// Coordinates refer to diamond centres in map-local space, before camera transforms.
export function gridToScreen(x: number, y: number): { x: number; y: number } {
  return {
    x: (x - y) * TILE_WIDTH / 2,
    y: (x + y) * TILE_HEIGHT / 2,
  };
}

// Undo the map container's transform before calling this function.
export function screenToGrid(x: number, y: number): { x: number; y: number } | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  return {
    x: Math.floor(x / TILE_WIDTH + y / TILE_HEIGHT + 0.5),
    y: Math.floor(y / TILE_HEIGHT - x / TILE_WIDTH + 0.5),
  };
}
