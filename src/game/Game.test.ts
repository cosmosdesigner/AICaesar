import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createCityState, getTile, placeBuilding, type CityState } from '../simulation/CityState';
import type { LoadResult, SaveResult } from '../persistence/CitySave';
import { getPopulationStats, getWorkforceStats } from '../simulation/Simulation';
import { startGame } from './Game';
import type { BuildTool } from '../ui/BuildPanel';

type PointerHandler = (event: {
  readonly button: number;
  readonly pointerId?: number;
  readonly pointerType?: string;
  readonly global: { readonly x: number; readonly y: number };
  preventDefault: () => void;
}) => void;
const doubles = vi.hoisted(() => ({
  appDestroy: vi.fn(),
  buildPanelDestroy: vi.fn(),
  cameraControlsDestroy: vi.fn(),
  scenarioPanelDestroy: vi.fn(),
  scenarioSelectorDestroy: vi.fn(),
  metricsPanelDestroy: vi.fn(),
  eventPanelDestroy: vi.fn(),
  scenarioPanelInstances: [] as Array<{
    update: Mock;
    setDefinition: Mock;
  }>,
  selectorInstances: [] as Array<{
    onStart: (selection: { readonly scenarioId: 'founding-settlement' | 'merchant-quarter' | 'resilient-province'; readonly difficulty: 'easy' | 'normal' }) => void;
  }>,
  metricsPanelInstances: [] as Array<{
    update: Mock;
  }>,
  simulationControlsDestroy: vi.fn(),
  advisorDestroy: vi.fn(),
  saveLoadControlsDestroy: vi.fn(),
  persistenceSave: vi.fn<() => SaveResult>(() => ({ ok: true, message: 'City saved locally.' })),
  persistenceLoad: vi.fn<() => LoadResult>(() => ({
    ok: false, code: 'not_found', message: 'No local save was found.',
  })),
  observe: vi.fn(),
  resizeObserverDisconnect: vi.fn(),
  setInterval: vi.fn((_callback: () => void) => 7),
  clearInterval: vi.fn(),
  rendererResize: vi.fn(),
  appRender: vi.fn(),
  selectedTool: 'road' as BuildTool,
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
  advisorInstances: [] as Array<{
    invalidateForCityChange: ReturnType<typeof vi.fn>;
  }>,
  saveLoadControlInstances: [] as Array<{
    onSave: () => { readonly ok: boolean; readonly message: string };
    onLoad: () => { readonly ok: boolean; readonly message: string };
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
    bulldoze: 'Bulldoze',
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
    get selectedTool(): BuildTool {
      return doubles.selectedTool;
    }
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
    setDefinition = vi.fn();
    destroy = doubles.scenarioPanelDestroy;

    constructor() {
      doubles.scenarioPanelInstances.push({ update: this.update, setDefinition: this.setDefinition });
    }
  },
}));

vi.mock('../ui/ScenarioSelector', () => ({
  ScenarioSelector: class ScenarioSelector {
    destroy = doubles.scenarioSelectorDestroy;

    constructor(
      _host: HTMLElement,
      _selection: unknown,
      onStart: (selection: { readonly scenarioId: 'founding-settlement' | 'merchant-quarter' | 'resilient-province'; readonly difficulty: 'easy' | 'normal' }) => void,
    ) {
      doubles.selectorInstances.push({ onStart });
    }
  },
}));

vi.mock('../ui/MetricsPanel', () => ({
  MetricsPanel: class MetricsPanel {
    update = vi.fn();
    destroy = doubles.metricsPanelDestroy;

    constructor() {
      doubles.metricsPanelInstances.push({ update: this.update });
    }
  },
}));


vi.mock('../ui/EventPanel', () => ({
  EventPanel: class EventPanel {
    update = vi.fn();
    destroy = doubles.eventPanelDestroy;
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
    invalidateForCityChange = vi.fn();
    destroy = doubles.advisorDestroy;

    constructor() {
      doubles.advisorInstances.push(this);
    }
  },
}));

vi.mock('../persistence/CitySave', () => ({
  saveCityState: doubles.persistenceSave,
  loadCityState: doubles.persistenceLoad,
}));

vi.mock('../ui/SaveLoadControls', () => ({
  SaveLoadControls: class SaveLoadControls {
    destroy = doubles.saveLoadControlsDestroy;

    constructor(
      _host: HTMLElement,
      onSave: () => { readonly ok: boolean; readonly message: string },
      onLoad: () => { readonly ok: boolean; readonly message: string },
    ) {
      doubles.saveLoadControlInstances.push({ onSave, onLoad });
    }
  },
}));

function getMapRendererDouble() {
  const map = doubles.mapInstances[0];
  if (map === undefined) throw new Error('Expected MapRenderer to be constructed.');
  return map;
}

function gridPoint(x: number, y: number): { x: number; y: number } {
  return { x: (x - y) * 60, y: (x + y) * 30 };
}

function touchEvent(pointerId: number, point: { readonly x: number; readonly y: number }) {
  return {
    button: 0,
    pointerId,
    pointerType: 'touch',
    global: point,
    preventDefault: vi.fn(),
  };
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
    doubles.scenarioPanelInstances.length = 0;
    doubles.selectorInstances.length = 0;
    doubles.metricsPanelInstances.length = 0;
    doubles.advisorInstances.length = 0;
    doubles.saveLoadControlInstances.length = 0;
    doubles.persistenceSave.mockReturnValue({ ok: true, message: 'City saved locally.' });
    doubles.persistenceLoad.mockReturnValue({ ok: false, code: 'not_found', message: 'No local save was found.' });
    doubles.selectedTool = 'road';
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
    expect(doubles.scenarioSelectorDestroy).toHaveBeenCalledOnce();
    expect(doubles.metricsPanelDestroy).toHaveBeenCalledOnce();
    expect(doubles.eventPanelDestroy).toHaveBeenCalledOnce();
    expect(doubles.advisorDestroy).toHaveBeenCalledOnce();
    expect(doubles.saveLoadControlsDestroy).toHaveBeenCalledOnce();
    expect(doubles.appDestroy).toHaveBeenCalledWith(true, { children: true });
  });

  it('saves the current city and loads a validated replacement through the central refresh flow', async () => {
    const cleanup = await startGame(
      { clientWidth: 800, clientHeight: 600 } as HTMLElement,
      {} as HTMLElement,
    );
    const controls = doubles.saveLoadControlInstances[0];
    const panel = doubles.buildPanelInstances[0];
    const map = getMapRendererDouble();
    if (controls === undefined || panel === undefined) throw new Error('Expected save controls and build panel.');
    const initialCity = panel.update.mock.lastCall?.[0] as CityState;
    const loadedCity = createCityState();
    loadedCity.resources.money = 123;
    loadedCity.simulation.tick = 17;
    doubles.persistenceLoad.mockReturnValueOnce({ ok: true, city: loadedCity, message: 'City loaded locally.' });

    expect(controls.onSave()).toMatchObject({ ok: true });
    expect(doubles.persistenceSave).toHaveBeenLastCalledWith(initialCity);
    expect(controls.onLoad()).toMatchObject({ ok: true, message: 'City loaded locally.' });
    expect(doubles.persistenceLoad).toHaveBeenCalledOnce();
    expect(doubles.advisorInstances[0]?.invalidateForCityChange).toHaveBeenCalledWith(
      'Advisor plan cleared after loading a different city.',
    );
    expect(panel.update).toHaveBeenLastCalledWith(
      loadedCity,
      'City loaded locally.',
      false,
      false,
      false,
      false,
      { buildBlocked: false },
    );
    expect(map.refresh).toHaveBeenLastCalledWith(loadedCity, {
      waterOverlay: false, foodOverlay: false, desirabilityOverlay: false, roadNetworkOverlay: false,
    });
    expect(map.fitCamera).toHaveBeenCalledOnce();
    cleanup();
  });

  it('keeps the active city and skips refresh when Load fails', async () => {
    const cleanup = await startGame(
      { clientWidth: 800, clientHeight: 600 } as HTMLElement,
      {} as HTMLElement,
    );
    const controls = doubles.saveLoadControlInstances[0];
    const panel = doubles.buildPanelInstances[0];
    const map = getMapRendererDouble();
    if (controls === undefined || panel === undefined) throw new Error('Expected save controls and build panel.');
    const initialCity = panel.update.mock.lastCall?.[0] as CityState;
    const refreshCount = map.refresh.mock.calls.length;

    expect(controls.onLoad()).toMatchObject({ ok: false, code: 'not_found' });
    expect(panel.update.mock.lastCall?.[0]).toBe(initialCity);
    expect(map.refresh).toHaveBeenCalledTimes(refreshCount);
    expect(doubles.advisorInstances[0]?.invalidateForCityChange).not.toHaveBeenCalled();
    cleanup();
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

  it('starts the selected scenario and difficulty, resets that profile, invalidates the advisor, and preserves terminal blocking', async () => {
    const cleanup = await startGame(
      { clientWidth: 800, clientHeight: 600 } as HTMLElement,
      {} as HTMLElement,
    );
    const selector = doubles.selectorInstances[0];
    const panel = doubles.buildPanelInstances[0];
    const scenarioPanel = doubles.scenarioPanelInstances[0];
    const metricsPanel = doubles.metricsPanelInstances[0];
    const map = getMapRendererDouble();
    if (selector === undefined || panel === undefined || scenarioPanel === undefined || metricsPanel === undefined) {
      throw new Error('Expected Phase 25 scenario panels.');
    }

    selector.onStart({ scenarioId: 'merchant-quarter', difficulty: 'easy' });
    const selectedCity = panel.update.mock.lastCall?.[0] as CityState;
    expect(selectedCity.resources.money).toBe(550);
    expect(scenarioPanel.setDefinition).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'merchant-quarter', initialMoney: 550, maxTicks: 900, loseBelowMoney: 0,
    }));
    expect(metricsPanel.update).toHaveBeenLastCalledWith(expect.objectContaining({
      scenarioId: 'merchant-quarter', difficulty: 'easy', buildingsConstructed: 0,
    }));
    expect(doubles.advisorInstances[0]?.invalidateForCityChange).toHaveBeenLastCalledWith(
      'Advisor plan and report cleared for a fresh city.',
    );
    expect(map.fitCamera).toHaveBeenCalledTimes(2);

    const terminalTarget = selectedCity.buildings.find((building) => building.type === 'road');
    if (terminalTarget === undefined) throw new Error('Expected selected scenario road.');
    selectedCity.resources.money = -1;
    const before = JSON.stringify(selectedCity);
    map.toLocal.mockImplementation((_global, _container, out) => {
      out.x = (terminalTarget.x - terminalTarget.y) * 60;
      out.y = (terminalTarget.x + terminalTarget.y) * 30;
      return out;
    });
    doubles.selectedTool = 'bulldoze';
    doubles.stageHandlers.get('pointerdown')?.({
      button: 0,
      global: { x: 320, y: 180 },
      preventDefault: vi.fn(),
    });
    expect(JSON.stringify(selectedCity)).toBe(before);
    expect(panel.update).toHaveBeenLastCalledWith(
      selectedCity,
      'Defeat: the settlement treasury fell below 0.',
      false,
      false,
      false,
      false,
      { buildBlocked: true },
    );

    panel.onReset();
    const resetCity = panel.update.mock.lastCall?.[0] as CityState;
    expect(resetCity).not.toBe(selectedCity);
    expect(resetCity).toMatchObject({ resources: { money: 550 }, simulation: { tick: 0 } });
    expect(metricsPanel.update).toHaveBeenLastCalledWith(expect.objectContaining({
      scenarioId: 'merchant-quarter', difficulty: 'easy', buildingsConstructed: 0,
    }));
    expect(map.fitCamera).toHaveBeenCalledTimes(3);
    cleanup();
  });

  it('records only successful player builds in session metrics', async () => {
    const cleanup = await startGame(
      { clientWidth: 800, clientHeight: 600 } as HTMLElement,
      {} as HTMLElement,
    );
    const metricsPanel = doubles.metricsPanelInstances[0];
    if (metricsPanel === undefined) throw new Error('Expected metrics panel.');

    doubles.stageHandlers.get('pointerdown')?.({
      button: 0,
      global: { x: 320, y: 180 },
      preventDefault: vi.fn(),
    });
    expect(metricsPanel.update).toHaveBeenLastCalledWith(expect.objectContaining({ buildingsConstructed: 1 }));
    doubles.stageHandlers.get('pointerdown')?.({
      button: 0,
      global: { x: 320, y: 180 },
      preventDefault: vi.fn(),
    });
    expect(metricsPanel.update).toHaveBeenLastCalledWith(expect.objectContaining({ buildingsConstructed: 1 }));
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

  it('demolishes through the selected tool without advancing simulation or resetting session state', async () => {
    const cleanup = await startGame(
      { clientWidth: 800, clientHeight: 600 } as HTMLElement,
      {} as HTMLElement,
    );
    const panel = doubles.buildPanelInstances[0];
    const map = getMapRendererDouble();
    if (panel === undefined) throw new Error('Expected build panel.');
    const city = panel.update.mock.lastCall?.[0] as CityState;
    const target = city.buildings.find((building) => building.type === 'farm');
    if (target === undefined) throw new Error('Expected seeded farm.');
    const moneyBefore = city.resources.money;
    const tickBefore = city.simulation.tick;
    const buildingCountBefore = city.buildings.length;
    const workersRequiredBefore = getWorkforceStats(city).workersRequired;
    map.toLocal.mockImplementation((_global, _container, out) => {
      out.x = (target.x - target.y) * 60;
      out.y = (target.x + target.y) * 30;
      return out;
    });
    expect(panel.onWaterOverlayToggle()).toBe(true);
    expect(panel.onFoodOverlayToggle()).toBe(true);
    expect(panel.onDesirabilityOverlayToggle()).toBe(true);
    expect(panel.onRoadNetworkOverlayToggle()).toBe(true);
    doubles.selectedTool = 'bulldoze';

    doubles.stageHandlers.get('pointerdown')?.({
      button: 0,
      global: { x: 320, y: 180 },
      preventDefault: vi.fn(),
    });

    expect(city.buildings).toHaveLength(buildingCountBefore - 1);
    expect(getTile(city, target.x, target.y)?.buildingId).toBeUndefined();
    expect(city.resources.money).toBe(moneyBefore);
    expect(city.simulation.tick).toBe(tickBefore);
    expect(getWorkforceStats(city).workersRequired).toBe(workersRequiredBefore - 6);
    expect(doubles.persistenceSave).not.toHaveBeenCalled();
    expect(doubles.advisorInstances[0]?.invalidateForCityChange).toHaveBeenCalledWith(
      'Advisor plan cleared after demolition.',
    );
    expect(map.refresh).toHaveBeenLastCalledWith(city, {
      waterOverlay: true, foodOverlay: true, desirabilityOverlay: true, roadNetworkOverlay: true,
    });
    expect(map.fitCamera).toHaveBeenCalledOnce();
    cleanup();
  });

  it('blocks bulldoze without mutating a terminal scenario', async () => {
    const cleanup = await startGame(
      { clientWidth: 800, clientHeight: 600 } as HTMLElement,
      {} as HTMLElement,
    );
    const panel = doubles.buildPanelInstances[0];
    const map = getMapRendererDouble();
    if (panel === undefined) throw new Error('Expected build panel.');
    const city = panel.update.mock.lastCall?.[0] as CityState;
    const target = city.buildings.find((building) => building.type === 'road');
    if (target === undefined) throw new Error('Expected seeded road.');
    city.resources.money = 0;
    const before = JSON.stringify(city);
    map.toLocal.mockImplementation((_global, _container, out) => {
      out.x = (target.x - target.y) * 60;
      out.y = (target.x + target.y) * 30;
      return out;
    });
    doubles.selectedTool = 'bulldoze';

    doubles.stageHandlers.get('pointerdown')?.({
      button: 0,
      global: { x: 320, y: 180 },
      preventDefault: vi.fn(),
    });

    expect(JSON.stringify(city)).toBe(before);
    expect(doubles.advisorInstances[0]?.invalidateForCityChange).not.toHaveBeenCalled();
    expect(panel.update).toHaveBeenLastCalledWith(
      city,
      'Defeat: the settlement treasury fell below 50.',
      false,
      false,
      false,
      false,
      { buildBlocked: true },
    );
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

  it('pans with a desktop middle-button drag without applying a tile operation', async () => {
    const cleanup = await startGame(
      { clientWidth: 800, clientHeight: 600 } as HTMLElement,
      {} as HTMLElement,
    );
    const panel = doubles.buildPanelInstances[0];
    const map = getMapRendererDouble();
    if (panel === undefined) throw new Error('Expected build panel.');
    const city = panel.update.mock.lastCall?.[0] as CityState;
    const buildingCount = city.buildings.length;
    const preventDefault = vi.fn();

    doubles.stageHandlers.get('pointerdown')?.({ button: 1, global: { x: 100, y: 100 }, preventDefault });
    doubles.stageHandlers.get('pointermove')?.({ button: 1, global: { x: 130, y: 150 }, preventDefault });
    doubles.stageHandlers.get('pointerup')?.({ button: 1, global: { x: 130, y: 150 }, preventDefault });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(city.buildings).toHaveLength(buildingCount);
    expect(map.toLocal).not.toHaveBeenCalled();
    expect(map.applyCamera).toHaveBeenLastCalledWith({ x: 130, y: 100, zoom: 0.5 });
    cleanup();
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
  it('keeps touch taps as single Road construction and Bulldoze demolition', async () => {
    const cleanup = await startGame(
      { clientWidth: 800, clientHeight: 600 } as HTMLElement,
      {} as HTMLElement,
    );
    const panel = doubles.buildPanelInstances[0];
    const map = getMapRendererDouble();
    if (panel === undefined) throw new Error('Expected build panel.');
    const city = panel.update.mock.lastCall?.[0] as CityState;
    const point = gridPoint(22, 10);
    map.toLocal.mockImplementation((global, _container, out) => {
      out.x = global.x;
      out.y = global.y;
      return out;
    });

    doubles.stageHandlers.get('pointerdown')?.(touchEvent(1, point));
    doubles.stageHandlers.get('pointerup')?.(touchEvent(1, point));
    expect(getTile(city, 22, 10)?.buildingId).toBe('road-22-10');
    expect(doubles.metricsPanelInstances[0]?.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ buildingsConstructed: 1, buildingsDemolished: 0 }),
    );

    doubles.selectedTool = 'bulldoze';
    doubles.stageHandlers.get('pointerdown')?.(touchEvent(2, point));
    doubles.stageHandlers.get('pointerup')?.(touchEvent(2, point));
    expect(getTile(city, 22, 10)?.buildingId).toBeUndefined();
    expect(doubles.metricsPanelInstances[0]?.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ buildingsConstructed: 1, buildingsDemolished: 1 }),
    );
    cleanup();
  });

  it('constructs each new Road tile once during a touch drag', async () => {
    const cleanup = await startGame(
      { clientWidth: 800, clientHeight: 600 } as HTMLElement,
      {} as HTMLElement,
    );
    const panel = doubles.buildPanelInstances[0];
    const map = getMapRendererDouble();
    if (panel === undefined) throw new Error('Expected build panel.');
    const city = panel.update.mock.lastCall?.[0] as CityState;
    map.toLocal.mockImplementation((global, _container, out) => {
      out.x = global.x;
      out.y = global.y;
      return out;
    });

    doubles.stageHandlers.get('pointerdown')?.(touchEvent(1, gridPoint(20, 10)));
    doubles.stageHandlers.get('pointermove')?.(touchEvent(1, gridPoint(21, 10)));
    doubles.stageHandlers.get('pointermove')?.(touchEvent(1, gridPoint(22, 10)));
    doubles.stageHandlers.get('pointermove')?.(touchEvent(1, gridPoint(22, 10)));
    doubles.stageHandlers.get('pointerup')?.(touchEvent(1, gridPoint(22, 10)));

    expect(getTile(city, 20, 10)?.buildingId).toBeUndefined();
    expect(getTile(city, 21, 10)?.buildingId).toBe('road-21-10');
    expect(getTile(city, 22, 10)?.buildingId).toBe('road-22-10');
    expect(doubles.metricsPanelInstances[0]?.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ buildingsConstructed: 2 }),
    );
    cleanup();
  });

  it('continues a Road trace after occupied and outside-map tiles while recording only successful builds', async () => {
    const cleanup = await startGame(
      { clientWidth: 800, clientHeight: 600 } as HTMLElement,
      {} as HTMLElement,
    );
    const panel = doubles.buildPanelInstances[0];
    const map = getMapRendererDouble();
    if (panel === undefined) throw new Error('Expected build panel.');
    const city = panel.update.mock.lastCall?.[0] as CityState;
    expect(placeBuilding(city, 20, 10, 'road')).toBe('built');
    const buildingCountBefore = city.buildings.length;
    const moneyBefore = city.resources.money;
    map.toLocal.mockImplementation((global, _container, out) => {
      out.x = global.x;
      out.y = global.y;
      return out;
    });

    doubles.stageHandlers.get('pointerdown')?.(touchEvent(1, gridPoint(19, 10)));
    doubles.stageHandlers.get('pointermove')?.(touchEvent(1, gridPoint(20, 10)));
    doubles.stageHandlers.get('pointermove')?.(touchEvent(1, gridPoint(30, 10)));
    doubles.stageHandlers.get('pointermove')?.(touchEvent(1, gridPoint(21, 10)));
    doubles.stageHandlers.get('pointerup')?.(touchEvent(1, gridPoint(21, 10)));

    expect(getTile(city, 20, 10)?.buildingId).toBe('road-20-10');
    expect(getTile(city, 21, 10)?.buildingId).toBe('road-21-10');
    expect(city.buildings).toHaveLength(buildingCountBefore + 1);
    expect(city.resources.money).toBe(moneyBefore - 4);
    expect(doubles.metricsPanelInstances[0]?.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ buildingsConstructed: 1 }),
    );
    cleanup();
  });

  it('demolishes each new tile once during a touch Bulldoze drag', async () => {
    const cleanup = await startGame(
      { clientWidth: 800, clientHeight: 600 } as HTMLElement,
      {} as HTMLElement,
    );
    const panel = doubles.buildPanelInstances[0];
    const map = getMapRendererDouble();
    if (panel === undefined) throw new Error('Expected build panel.');
    const city = panel.update.mock.lastCall?.[0] as CityState;
    expect(placeBuilding(city, 20, 10, 'road')).toBe('built');
    expect(placeBuilding(city, 21, 10, 'road')).toBe('built');
    doubles.selectedTool = 'bulldoze';
    map.toLocal.mockImplementation((global, _container, out) => {
      out.x = global.x;
      out.y = global.y;
      return out;
    });

    doubles.stageHandlers.get('pointerdown')?.(touchEvent(1, gridPoint(19, 10)));
    doubles.stageHandlers.get('pointermove')?.(touchEvent(1, gridPoint(20, 10)));
    doubles.stageHandlers.get('pointermove')?.(touchEvent(1, gridPoint(21, 10)));
    doubles.stageHandlers.get('pointermove')?.(touchEvent(1, gridPoint(21, 10)));
    doubles.stageHandlers.get('pointerup')?.(touchEvent(1, gridPoint(21, 10)));

    expect(getTile(city, 20, 10)?.buildingId).toBeUndefined();
    expect(getTile(city, 21, 10)?.buildingId).toBeUndefined();
    expect(doubles.metricsPanelInstances[0]?.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ buildingsDemolished: 2 }),
    );
    cleanup();
  });

  it('continues a Bulldoze trace after empty and outside-map tiles while recording only demolitions', async () => {
    const cleanup = await startGame(
      { clientWidth: 800, clientHeight: 600 } as HTMLElement,
      {} as HTMLElement,
    );
    const panel = doubles.buildPanelInstances[0];
    const map = getMapRendererDouble();
    if (panel === undefined) throw new Error('Expected build panel.');
    const city = panel.update.mock.lastCall?.[0] as CityState;
    expect(placeBuilding(city, 20, 10, 'road')).toBe('built');
    expect(placeBuilding(city, 22, 10, 'road')).toBe('built');
    const buildingCountBefore = city.buildings.length;
    doubles.selectedTool = 'bulldoze';
    map.toLocal.mockImplementation((global, _container, out) => {
      out.x = global.x;
      out.y = global.y;
      return out;
    });

    doubles.stageHandlers.get('pointerdown')?.(touchEvent(1, gridPoint(19, 10)));
    doubles.stageHandlers.get('pointermove')?.(touchEvent(1, gridPoint(20, 10)));
    doubles.stageHandlers.get('pointermove')?.(touchEvent(1, gridPoint(21, 10)));
    doubles.stageHandlers.get('pointermove')?.(touchEvent(1, gridPoint(30, 10)));
    doubles.stageHandlers.get('pointermove')?.(touchEvent(1, gridPoint(22, 10)));
    doubles.stageHandlers.get('pointerup')?.(touchEvent(1, gridPoint(22, 10)));

    expect(getTile(city, 20, 10)?.buildingId).toBeUndefined();
    expect(getTile(city, 21, 10)?.buildingId).toBeUndefined();
    expect(getTile(city, 22, 10)?.buildingId).toBeUndefined();
    expect(city.buildings).toHaveLength(buildingCountBefore - 2);
    expect(doubles.metricsPanelInstances[0]?.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ buildingsDemolished: 2 }),
    );
    cleanup();
  });

  it('cancels an active Road trace when a second touch starts', async () => {
    const cleanup = await startGame(
      { clientWidth: 800, clientHeight: 600 } as HTMLElement,
      {} as HTMLElement,
    );
    const panel = doubles.buildPanelInstances[0];
    const map = getMapRendererDouble();
    if (panel === undefined) throw new Error('Expected build panel.');
    const city = panel.update.mock.lastCall?.[0] as CityState;
    map.toLocal.mockImplementation((global, _container, out) => {
      out.x = global.x;
      out.y = global.y;
      return out;
    });

    doubles.stageHandlers.get('pointerdown')?.(touchEvent(1, gridPoint(19, 10)));
    doubles.stageHandlers.get('pointermove')?.(touchEvent(1, gridPoint(20, 10)));
    doubles.stageHandlers.get('pointerdown')?.(touchEvent(2, gridPoint(21, 10)));
    doubles.stageHandlers.get('pointermove')?.(touchEvent(1, gridPoint(21, 10)));
    doubles.stageHandlers.get('pointerup')?.(touchEvent(2, gridPoint(21, 10)));
    doubles.stageHandlers.get('pointermove')?.(touchEvent(1, gridPoint(22, 10)));
    doubles.stageHandlers.get('pointerup')?.(touchEvent(1, gridPoint(22, 10)));

    expect(getTile(city, 20, 10)?.buildingId).toBe('road-20-10');
    expect(getTile(city, 21, 10)?.buildingId).toBeUndefined();
    expect(getTile(city, 22, 10)?.buildingId).toBeUndefined();
    expect(doubles.metricsPanelInstances[0]?.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ buildingsConstructed: 1 }),
    );
    cleanup();
  });

  it('cancels an active Bulldoze trace when a second touch starts', async () => {
    const cleanup = await startGame(
      { clientWidth: 800, clientHeight: 600 } as HTMLElement,
      {} as HTMLElement,
    );
    const panel = doubles.buildPanelInstances[0];
    const map = getMapRendererDouble();
    if (panel === undefined) throw new Error('Expected build panel.');
    const city = panel.update.mock.lastCall?.[0] as CityState;
    expect(placeBuilding(city, 20, 10, 'road')).toBe('built');
    expect(placeBuilding(city, 22, 10, 'road')).toBe('built');
    doubles.selectedTool = 'bulldoze';
    map.toLocal.mockImplementation((global, _container, out) => {
      out.x = global.x;
      out.y = global.y;
      return out;
    });

    doubles.stageHandlers.get('pointerdown')?.(touchEvent(1, gridPoint(19, 10)));
    doubles.stageHandlers.get('pointermove')?.(touchEvent(1, gridPoint(20, 10)));
    doubles.stageHandlers.get('pointerdown')?.(touchEvent(2, gridPoint(21, 10)));
    doubles.stageHandlers.get('pointermove')?.(touchEvent(1, gridPoint(21, 10)));
    doubles.stageHandlers.get('pointerup')?.(touchEvent(2, gridPoint(21, 10)));
    doubles.stageHandlers.get('pointermove')?.(touchEvent(1, gridPoint(22, 10)));
    doubles.stageHandlers.get('pointerup')?.(touchEvent(1, gridPoint(22, 10)));

    expect(getTile(city, 20, 10)?.buildingId).toBeUndefined();
    expect(getTile(city, 22, 10)?.buildingId).toBe('road-22-10');
    expect(doubles.metricsPanelInstances[0]?.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ buildingsDemolished: 1 }),
    );
    cleanup();
  });

  it('pans without building during a one-finger drag with a building tool', async () => {
    const cleanup = await startGame(
      { clientWidth: 800, clientHeight: 600 } as HTMLElement,
      {} as HTMLElement,
    );
    const panel = doubles.buildPanelInstances[0];
    const map = getMapRendererDouble();
    if (panel === undefined) throw new Error('Expected build panel.');
    const city = panel.update.mock.lastCall?.[0] as CityState;
    const buildingCount = city.buildings.length;
    doubles.selectedTool = 'garden';

    doubles.stageHandlers.get('pointerdown')?.(touchEvent(1, { x: 100, y: 100 }));
    doubles.stageHandlers.get('pointermove')?.(touchEvent(1, { x: 120, y: 100 }));
    doubles.stageHandlers.get('pointerup')?.(touchEvent(1, { x: 120, y: 100 }));

    expect(city.buildings).toHaveLength(buildingCount);
    expect(map.toLocal).not.toHaveBeenCalled();
    expect(map.applyCamera).toHaveBeenLastCalledWith({ x: 120, y: 50, zoom: 0.5 });
    cleanup();
  });

  it('pinches around the midpoint without changing city tiles and clears cancelled gestures', async () => {
    const cleanup = await startGame(
      { clientWidth: 800, clientHeight: 600 } as HTMLElement,
      {} as HTMLElement,
    );
    const panel = doubles.buildPanelInstances[0];
    const map = getMapRendererDouble();
    if (panel === undefined) throw new Error('Expected build panel.');
    const city = panel.update.mock.lastCall?.[0] as CityState;
    const buildingCount = city.buildings.length;

    doubles.stageHandlers.get('pointerdown')?.(touchEvent(1, { x: 100, y: 100 }));
    doubles.stageHandlers.get('pointerdown')?.(touchEvent(2, { x: 110, y: 100 }));
    doubles.stageHandlers.get('pointermove')?.(touchEvent(2, { x: 120, y: 100 }));
    doubles.stageHandlers.get('pointerup')?.(touchEvent(2, { x: 120, y: 100 }));
    doubles.stageHandlers.get('pointerup')?.(touchEvent(1, { x: 100, y: 100 }));

    expect(city.buildings).toHaveLength(buildingCount);
    expect(map.toLocal).not.toHaveBeenCalled();
    expect(map.applyCamera).toHaveBeenLastCalledWith({ x: 90, y: 0, zoom: 1 });

    doubles.stageHandlers.get('pointerdown')?.(touchEvent(3, gridPoint(22, 10)));
    doubles.stageHandlers.get('pointercancel')?.(touchEvent(3, gridPoint(22, 10)));
    doubles.stageHandlers.get('pointerup')?.(touchEvent(3, gridPoint(22, 10)));
    doubles.stageHandlers.get('pointerdown')?.(touchEvent(4, gridPoint(23, 10)));
    doubles.stageHandlers.get('pointerupoutside')?.(touchEvent(4, gridPoint(23, 10)));
    doubles.stageHandlers.get('pointerup')?.(touchEvent(4, gridPoint(23, 10)));
    expect(city.buildings).toHaveLength(buildingCount);
    cleanup();
  });
});
