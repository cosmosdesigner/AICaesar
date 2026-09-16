export interface CameraState {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export interface PointLike {
  readonly x: number;
  readonly y: number;
}

export interface RectLike extends PointLike {
  readonly width: number;
  readonly height: number;
}

export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

export const MIN_CAMERA_ZOOM = 0.35;
export const MAX_CAMERA_ZOOM = 2;
export const DEFAULT_CAMERA_PADDING = 24;

export function clampCameraZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(MAX_CAMERA_ZOOM, Math.max(MIN_CAMERA_ZOOM, zoom));
}

export function screenToMapPoint(camera: CameraState, screenPoint: PointLike): PointLike {
  return {
    x: (screenPoint.x - camera.x) / camera.zoom,
    y: (screenPoint.y - camera.y) / camera.zoom,
  };
}

export function zoomAtScreenPoint(
  camera: CameraState,
  screenPoint: PointLike,
  nextZoom: number,
): CameraState {
  const zoom = clampCameraZoom(nextZoom);
  const mapPoint = screenToMapPoint(camera, screenPoint);
  return {
    x: screenPoint.x - mapPoint.x * zoom,
    y: screenPoint.y - mapPoint.y * zoom,
    zoom,
  };
}

export function panCamera(camera: CameraState, delta: PointLike): CameraState {
  return {
    x: camera.x + delta.x,
    y: camera.y + delta.y,
    zoom: camera.zoom,
  };
}

export function createFittedCamera(
  bounds: RectLike,
  viewport: ViewportSize,
  padding = DEFAULT_CAMERA_PADDING,
): CameraState {
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const boundsWidth = Math.max(1, bounds.width);
  const boundsHeight = Math.max(1, bounds.height);
  const zoom = clampCameraZoom(Math.min(availableWidth / boundsWidth, availableHeight / boundsHeight));

  return {
    x: (viewport.width - bounds.width * zoom) / 2 - bounds.x * zoom,
    y: (viewport.height - bounds.height * zoom) / 2 - bounds.y * zoom,
    zoom,
  };
}
