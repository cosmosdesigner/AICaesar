import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CityState } from '../simulation/CityState';
import { getPopulationStats } from '../simulation/Simulation';
import { startGame } from './Game';

type PointerHandler = (event: {
  readonly button: number;
  readonly global: { readonly x: number; readonly y: number };
  preventDefault: () => void;
}) => void;

const doubles = vi.hoisted(() => ({
  appDestroy: vi.fn(),
  buildPanelDestroy: vi.fn(),
  cameraControlsDestroy: vi.fn(),
  scenarioPanelDestroy: vi.fn(),
  simulationControlsDestroy: vi.fn(),
  advisorDestroy: vi.fn(),
  observe: vi.fn(),
  resizeObserverDisconnect: vi.fn(),
  setInterval: vi.fn((_callback: () => void) => 7),
  clearInterval: vi.fn(),
  rendererResize: vi.fn(),
  appRender: vi.fn(),
  stageHandlers: new Map<string, PointerHandler>(),
  windowHandlers: new Map<string, (event: KeyboardEvent) => void>(),
  canvasHandlers: new Map<string, (event: WheelEvent) => void>(),
  mapInstances: [] as Array<{
    refresh: ReturnType<typeof vi.fn>;
    applyCamera: ReturnType<typeof vi.fn>;
    fitCamera: ReturnType<typeof vi.fn>;
    toLocal: ReturnType<typeof vi.fn>;
  }>,
  buildPanelInstances: [] as Array<{
    selectedTool: 'road';
    update: ReturnType<typeof vi.fn>;
    onReset: () => void;
    onWaterOverlayToggle: () => boolean;
    onFoodOverlayToggle: () => boolean;
    onDesirabilityOverlayToggle: () => boolean;
    onRoadNetworkOverlayToggle: () => boolean;
  }>,
  cameraControlsInstances: [] as Array<{
    onZoomIn: () => void;
    onZoomOut: () => void;
    onCenterMap: () => void;
  }>,
  resizeCallback: undefined as ResizeObserverCallback | undefined,
}));

vi.mock('pixi.js', () => ({
  Point: class Point {
    x = 0;
    y = 0;
  },
}));

vi.mock('../assets/AssetManifest', () => ({
  loadMapTextures: vi.fn(async () => ({})),
}));

vi.mock('../rendering/PixiApp', () => ({
  createPixiApp: vi.fn(async () => ({
    canvas: {
      addEventListener: vi.fn((event: string, handler: (event: WheelEvent) => void) => {
        doubles.canvasHandlers.set(event, handler);
      }),
      removeEventListener: vi.fn((event: string) => {
        doubles.canvasHandlers.delete(event);
      }),
      getBoundingClientRect: vi.fn(() => ({ left: 10, top: 20 })),
    },
    stage: {
      addChild: vi.fn(),
      on: vi.fn((event: string, handler: PointerHandler) => {
        doubles.stageHandlers.set(event, handler);
      }),
      eventMode: undefined,
      hitArea: undefined,
      cursor: undefined,
    },
    screen: { width: 800, height: 600 },
    renderer: { resize: doubles.rendererResize },
    render: doubles.appRender,
    destroy: doubles.appDestroy,
  })),
}));

vi.mock('../rendering/MapRenderer', () => ({
  MapRenderer: class MapRenderer {
    refresh = vi.fn();
    applyCamera = vi.fn();
    fitCamera = vi.fn(() => ({ x: 100, y: 50, zoom: 0.5 }));
    toLocal = vi.fn((_global, _container, out) => {
      out.x = 15;
      out.y = 30;
      return out;
    });

    constructor() {
      doubles.mapInstances.push(this);
    }
  },
}));

vi.mock('../ui/BuildPanel', () => ({
  BUILD_LABELS: {
    farm: 'Farm',
    fountain: 'Fountain',
    garden: 'Garden',
    granary: 'Granary',
    house: 'House',
    market: 'Market',
    plaza: 'Plaza',
    road: 'Road',
    well: 'Well',
  },
  BuildPanel: class BuildPanel {
    selectedTool = 'road' as const;
    update = vi.fn();
    destroy = doubles.buildPanelDestroy;

    constructor(
      _host: HTMLElement,
      onReset: () => void,
      onWaterOverlayToggle: () => boolean,
      onFoodOverlayToggle: () => boolean,
      onDesirabilityOverlayToggle: () => boolean,
      onRoadNetworkOverlayToggle: () => boolean,
    ) {
      doubles.buildPanelInstances.push({
        selectedTool: this.selectedTool,
        update: this.update,
        onReset,
        onWaterOverlayToggle,
        onFoodOverlayToggle,
        onDesirabilityOverlayToggle,
        onRoadNetworkOverlayToggle,
      });
    }
  },
}));

vi.mock('../ui/CameraControls', () => ({
  CameraControls: class CameraControls {
    destroy = doubles.cameraControlsDestroy;

    constructor(
      _host: HTMLElement,
      onZoomIn: () => void,
      onZoomOut: () => void,
      onCenterMap: () => void,
    ) {
      doubles.cameraControlsInstances.push({ onZoomIn, onZoomOut, onCenterMap });
    }
  },
}));

vi.mock('../ui/ScenarioPanel', () => ({
  ScenarioPanel: class ScenarioPanel {
    update = vi.fn();
    destroy = doubles.scenarioPanelDestroy;
  },
}));

vi.mock('../ui/SimulationControls', () => ({
  SimulationControls: class SimulationControls {
    update = vi.fn();
    destroy = doubles.simulationControlsDestroy;
  },
}));

vi.mock('../ui/AdvisorPanel', () => ({
  AdvisorPanel: class AdvisorPanel {
    updateScenarioContext = vi.fn();
    destroy = doubles.advisorDestroy;
  },
}));

function getMapRendererDouble() {
  const map = doubles.mapInstances[0];
  if (map === undefined) throw new Error('Expected MapRenderer to be constructed.');
  return map;
}

describe('startGame camera and cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    doubles.stageHandlers.clear();
    doubles.windowHandlers.clear();
    doubles.canvasHandlers.clear();
    doubles.mapInstances.length = 0;
    doubles.buildPanelInstances.length = 0;
    doubles.cameraControlsInstances.length = 0;
    doubles.resizeCallback = undefined;
    vi.stubGlobal('ResizeObserver', class ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        doubles.resizeCallback = callback;
      }

      observe = doubles.observe;
      disconnect = doubles.resizeObserverDisconnect;
    });
    vi.stubGlobal('window', {
      setInterval: doubles.setInterval,
      clearInterval: doubles.clearInterval,
      addEventListener: vi.fn((event: string, handler: (event: KeyboardEvent) => void) => {
        doubles.windowHandlers.set(event, handler);
      }),
      removeEventListener: vi.fn((event: string) => {
        doubles.windowHandlers.delete(event);
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('destroys camera controls with the other game UI', async () => {
    const host = { clientWidth: 800, clientHeight: 600 } as HTMLElement;
    const panelHost = {} as HTMLElement;

    const cleanup = await startGame(host, panelHost);
    cleanup();

    expect(doubles.cameraControlsDestroy).toHaveBeenCalledOnce();
    expect(doubles.simulationControlsDestroy).toHaveBeenCalledOnce();
    expect(doubles.buildPanelDestroy).toHaveBeenCalledOnce();
    expect(doubles.scenarioPanelDestroy).toHaveBeenCalledOnce();
    expect(doubles.advisorDestroy).toHaveBeenCalledOnce();
    expect(doubles.appDestroy).toHaveBeenCalledWith(true, { children: true });
  });

  it('fits on initial load and reset, but ordinary resize preserves the camera', async () => {
    const host = { clientWidth: 800, clientHeight: 600 } as HTMLElement;
    const panelHost = {} as HTMLElement;

    await startGame(host, panelHost);
    const map = getMapRendererDouble();
    expect(map.fitCamera).toHaveBeenCalledOnce();

    doubles.resizeCallback?.([], {} as ResizeObserver);
    expect(map.fitCamera).toHaveBeenCalledOnce();
    expect(map.applyCamera).toHaveBeenLastCalledWith({ x: 100, y: 50, zoom: 0.5 });

    doubles.buildPanelInstances[0]?.onReset();
    expect(map.fitCamera).toHaveBeenCalledTimes(2);
  });

  it('restores seed occupancy and clears population change when Reset follows simulation ticks', async () => {
    const cleanup = await startGame(
      { clientWidth: 800, clientHeight: 600 } as HTMLElement,
      {} as HTMLElement,
    );
    const panel = doubles.buildPanelInstances[0];
    const tick = doubles.setInterval.mock.calls[0]?.[0];
    if (panel === undefined || tick === undefined) throw new Error('Expected game controls and timer.');
    const city = panel.update.mock.lastCall?.[0] as CityState;
    const houses = city.buildings.filter((building) => building.type === 'house');
    const seedOccupancy = houses.map(({ x, y, level, population }) => ({ x, y, level, population }));
    const seedStats = getPopulationStats(city);
    expect(seedStats.population).toBeGreaterThan(0);
    expect(seedStats.availableHousing).toBe(0);

    for (const house of houses) house.population = 1;
    for (let index = 0; index < 5; index++) tick();
    expect(city.simulation.tick).toBe(5);
    expect(getPopulationStats(city)).toMatchObject({
      population: 0,
      lastChange: -houses.length,
    });

    panel.onReset();
    const resetCity = panel.update.mock.lastCall?.[0] as CityState;
    expect(resetCity.simulation.tick).toBe(0);
    expect(resetCity.buildings
      .filter((building) => building.type === 'house')
      .map(({ x, y, level, population }) => ({ x, y, level, population }))).toEqual(seedOccupancy);
    expect(getPopulationStats(resetCity)).toEqual({ ...seedStats, lastChange: 0 });
    cleanup();
  });

  it('keeps road overlays enabled across other toggles, ticks and reset without recentering until reset', async () => {
    const cleanup = await startGame(
      { clientWidth: 800, clientHeight: 600 } as HTMLElement,
      {} as HTMLElement,
    );
    const map = getMapRendererDouble();
    const panel = doubles.buildPanelInstances[0];
    const tick = doubles.setInterval.mock.calls[0]?.[0];
    if (panel === undefined || tick === undefined) throw new Error('Expected game controls and timer.');

    expect(panel.onRoadNetworkOverlayToggle()).toBe(true);
    expect(panel.onWaterOverlayToggle()).toBe(true);
    expect(panel.onFoodOverlayToggle()).toBe(true);
    expect(panel.onDesirabilityOverlayToggle()).toBe(true);
    tick();
    expect(map.refresh).toHaveBeenLastCalledWith(expect.anything(), {
      waterOverlay: true, foodOverlay: true, desirabilityOverlay: true, roadNetworkOverlay: true,
    });
    expect(map.fitCamera).toHaveBeenCalledOnce();

    panel.onReset();
    expect(map.refresh).toHaveBeenLastCalledWith(expect.anything(), {
      waterOverlay: true, foodOverlay: true, desirabilityOverlay: true, roadNetworkOverlay: true,
    });
    expect(map.fitCamera).toHaveBeenCalledTimes(2);
    expect(panel.onRoadNetworkOverlayToggle()).toBe(false);
    expect(map.refresh).toHaveBeenLastCalledWith(expect.anything(), {
      waterOverlay: true, foodOverlay: true, desirabilityOverlay: true, roadNetworkOverlay: false,
    });
    cleanup();
  });

  it('zooms with the wheel and camera controls', async () => {
    const host = { clientWidth: 800, clientHeight: 600 } as HTMLElement;
    const panelHost = {} as HTMLElement;

    await startGame(host, panelHost);
    const map = getMapRendererDouble();
    const preventDefault = vi.fn();

    doubles.canvasHandlers.get('wheel')?.({
      clientX: 100,
      clientY: 100,
      deltaY: -1,
      preventDefault,
    } as unknown as WheelEvent);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(map.applyCamera).toHaveBeenLastCalledWith({ x: 101, y: 47, zoom: 0.55 });

    doubles.cameraControlsInstances[0]?.onCenterMap();
    expect(map.fitCamera).toHaveBeenCalledTimes(2);
  });

  it('pans with Space plus left drag without building', async () => {
    const host = { clientWidth: 800, clientHeight: 600 } as HTMLElement;
    const panelHost = {} as HTMLElement;

    await startGame(host, panelHost);
    const map = getMapRendererDouble();
    const preventDefault = vi.fn();

    doubles.windowHandlers.get('keydown')?.({ code: 'Space', preventDefault } as unknown as KeyboardEvent);
    doubles.stageHandlers.get('pointerdown')?.({ button: 0, global: { x: 100, y: 100 }, preventDefault });
    doubles.stageHandlers.get('pointermove')?.({ button: 0, global: { x: 130, y: 150 }, preventDefault });
    doubles.stageHandlers.get('pointerup')?.({ button: 0, global: { x: 130, y: 150 }, preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(map.toLocal).not.toHaveBeenCalled();
    expect(map.applyCamera).toHaveBeenLastCalledWith({ x: 130, y: 100, zoom: 0.5 });
  });

  it('keeps ordinary left click construction using map-local coordinates', async () => {
    const host = { clientWidth: 800, clientHeight: 600 } as HTMLElement;
    const panelHost = {} as HTMLElement;

    await startGame(host, panelHost);
    const map = getMapRendererDouble();

    doubles.stageHandlers.get('pointerdown')?.({
      button: 0,
      global: { x: 320, y: 180 },
      preventDefault: vi.fn(),
    });

    expect(map.toLocal).toHaveBeenCalled();
    expect(map.refresh).toHaveBeenCalled();
    expect(map.fitCamera).toHaveBeenCalledOnce();
  });
});
