import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startGame } from './Game';

const doubles = vi.hoisted(() => ({
  appDestroy: vi.fn(),
  buildPanelDestroy: vi.fn(),
  scenarioPanelDestroy: vi.fn(),
  simulationControlsDestroy: vi.fn(),
  advisorDestroy: vi.fn(),
  observe: vi.fn(),
  resizeObserverDisconnect: vi.fn(),
  setInterval: vi.fn(() => 7),
  clearInterval: vi.fn(),
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
    stage: {
      addChild: vi.fn(),
      on: vi.fn(),
      eventMode: undefined,
      hitArea: undefined,
      cursor: undefined,
    },
    screen: { width: 800, height: 600 },
    renderer: { resize: vi.fn() },
    render: vi.fn(),
    destroy: doubles.appDestroy,
  })),
}));

vi.mock('../rendering/MapRenderer', () => ({
  MapRenderer: class MapRenderer {
    refresh = vi.fn();
    fit = vi.fn();
    toLocal = vi.fn();
  },
}));

vi.mock('../ui/BuildPanel', () => ({
  BUILD_LABELS: {
    farm: 'Farm',
    granary: 'Granary',
    house: 'House',
    market: 'Market',
    road: 'Road',
    well: 'Well',
  },
  BuildPanel: class BuildPanel {
    selectedTool = 'road';
    update = vi.fn();
    destroy = doubles.buildPanelDestroy;
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

describe('startGame cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('ResizeObserver', class ResizeObserver {
      observe = doubles.observe;
      disconnect = doubles.resizeObserverDisconnect;
    });
    vi.stubGlobal('window', {
      setInterval: doubles.setInterval,
      clearInterval: doubles.clearInterval,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('destroys simulation controls with the other game UI', async () => {
    const host = { clientWidth: 800, clientHeight: 600 } as HTMLElement;
    const panelHost = {} as HTMLElement;

    const cleanup = await startGame(host, panelHost);
    cleanup();

    expect(doubles.simulationControlsDestroy).toHaveBeenCalledOnce();
    expect(doubles.buildPanelDestroy).toHaveBeenCalledOnce();
    expect(doubles.scenarioPanelDestroy).toHaveBeenCalledOnce();
    expect(doubles.advisorDestroy).toHaveBeenCalledOnce();
    expect(doubles.appDestroy).toHaveBeenCalledWith(true, { children: true });
  });
});
