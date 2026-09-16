import { type FederatedPointerEvent, Point } from 'pixi.js';
import { approveAdvisorPlan } from '../advisor/AdvisorApproval';
import { loadMapTextures } from '../assets/AssetManifest';
import { screenToGrid } from '../rendering/GridMath';
import { MapRenderer } from '../rendering/MapRenderer';
import { panCamera, zoomAtScreenPoint, type CameraState } from '../rendering/Camera';
import { createPixiApp } from '../rendering/PixiApp';
import {
  FOUNDING_SETTLEMENT_SCENARIO,
  evaluateScenario,
  getScenarioContext,
} from '../scenario/Scenario';
import { createCityState, placeBuilding, type BuildResult } from '../simulation/CityState';
import { assignWorkers, simulateTick } from '../simulation/Simulation';
import { BuildPanel, BUILD_LABELS } from '../ui/BuildPanel';
import { AdvisorPanel } from '../ui/AdvisorPanel';
import { ScenarioPanel } from '../ui/ScenarioPanel';
import { SimulationControls } from '../ui/SimulationControls';
import { CameraControls } from '../ui/CameraControls';
import { getSimulationIntervalMs, type SimulationSpeed } from './SimulationSpeed';

export async function startGame(host: HTMLElement, panelHost: HTMLElement): Promise<() => void> {
  const ZOOM_STEP = 1.1;
  let city = createCityState();
  assignWorkers(city);
  let waterOverlay = false;
  let foodOverlay = false;
  let paused = false;
  let speed: SimulationSpeed = 1;
  let tickHandle: number | undefined;
  let spacePanActive = false;
  let isPanning = false;
  let lastPanPoint: { x: number; y: number } | undefined;
  const textures = await loadMapTextures();
  const app = await createPixiApp(host);
  const map = new MapRenderer(city, textures);
  app.stage.addChild(map);
  let camera: CameraState = map.fitCamera(app.screen.width, app.screen.height);
  const panel = new BuildPanel(
    panelHost,
    () => {
      city = createCityState();
      assignWorkers(city);
      refreshCity('Cidade, dinheiro e simulação inicial restaurados.');
      centerCamera();
    },
    () => {
      waterOverlay = !waterOverlay;
      map.refresh(city, { waterOverlay, foodOverlay });
      app.render();
      return waterOverlay;
    },
    () => {
      foodOverlay = !foodOverlay;
      map.refresh(city, { waterOverlay, foodOverlay });
      app.render();
      return foodOverlay;
    },
  );
  const cameraControls = new CameraControls(
    panelHost,
    () => zoomAt({ x: app.screen.width / 2, y: app.screen.height / 2 }, ZOOM_STEP),
    () => zoomAt({ x: app.screen.width / 2, y: app.screen.height / 2 }, 1 / ZOOM_STEP),
    centerCamera,
  );
  const simulationControls = new SimulationControls(
    panelHost,
    () => {
      if (isScenarioTerminal()) {
        paused = true;
        return paused;
      }
      paused = !paused;
      scheduleTick();
      return paused;
    },
    (nextSpeed) => {
      speed = nextSpeed;
      scheduleTick();
    },
  );
  simulationControls.update(paused, speed);
  const scenarioPanel = new ScenarioPanel(panelHost, FOUNDING_SETTLEMENT_SCENARIO);
  const advisor = new AdvisorPanel(panelHost, () => city, {
    getScenarioContext: () => getScenarioContext(evaluateScenario(city, FOUNDING_SETTLEMENT_SCENARIO)),
    isApprovalBlocked: isScenarioTerminal,
    onApprovePlan: (plan) => {
      if (isScenarioTerminal()) {
        return { ok: false, message: 'Advisor plan approval is blocked because the scenario has ended.' };
      }
      const result = approveAdvisorPlan(city, plan);
      if (result.ok) refreshCity(result.message);
      return result;
    },
  });

  const messages: Record<Exclude<BuildResult, 'built'>, string> = {
    'outside-map': 'Construa dentro do mapa.',
    occupied: 'Tile ocupado. Escolha um tile vazio.',
    'insufficient-funds': 'Dinheiro insuficiente.',
  };
  const local = new Point();
  app.stage.eventMode = 'static';
  app.stage.hitArea = app.screen;
  updateCursor();
  app.stage.on('pointerdown', (event: FederatedPointerEvent) => {
    if (shouldStartPan(event)) {
      event.preventDefault();
      isPanning = true;
      lastPanPoint = { x: event.global.x, y: event.global.y };
      updateCursor();
      return;
    }
    if (event.button !== 0) return;
    if (isScenarioTerminal()) {
      refreshCity('Construção bloqueada: o cenário terminou. Use Reset para recomeçar.');
      return;
    }

    map.toLocal(event.global, undefined, local);
    const tile = screenToGrid(local.x, local.y);
    const result = tile ? placeBuilding(city, tile.x, tile.y, panel.selectedTool) : 'outside-map';
    if (result === 'built') {
      assignWorkers(city);
      refreshCity(`${BUILD_LABELS[panel.selectedTool]} construído.`);
      return;
    }

    panel.update(city, messages[result], waterOverlay, foodOverlay, { buildBlocked: isScenarioTerminal() });
  });
  app.stage.on('pointermove', (event: FederatedPointerEvent) => {
    if (!isPanning || lastPanPoint === undefined) return;
    const point = { x: event.global.x, y: event.global.y };
    applyCamera(panCamera(camera, { x: point.x - lastPanPoint.x, y: point.y - lastPanPoint.y }));
    lastPanPoint = point;
  });
  app.stage.on('pointerup', stopPan);
  app.stage.on('pointerupoutside', stopPan);

  app.canvas.addEventListener('wheel', handleWheel, { passive: false });
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  const resize = (): void => {
    app.renderer.resize(host.clientWidth, host.clientHeight);
    app.stage.hitArea = app.screen;
    map.applyCamera(camera);
    app.render();
  };

  function refreshCity(message: string): void {
    map.refresh(city, { waterOverlay, foodOverlay });
    const scenarioProgress = evaluateScenario(city, FOUNDING_SETTLEMENT_SCENARIO);
    if (scenarioProgress.status !== 'active') {
      paused = true;
      scheduleTick();
      simulationControls.update(paused, speed);
    }
    scenarioPanel.update(scenarioProgress);
    advisor.updateScenarioContext();
    panel.update(
      city,
      scenarioProgress.resultMessage ?? message,
      waterOverlay,
      foodOverlay,
      { buildBlocked: scenarioProgress.status !== 'active' },
    );
    app.render();
  }

  function scheduleTick(): void {
    if (tickHandle !== undefined) {
      window.clearInterval(tickHandle);
      tickHandle = undefined;
    }
    if (paused) return;

    tickHandle = window.setInterval(() => {
      simulateTick(city);
      refreshCity('Simulação atualizada.');
    }, getSimulationIntervalMs(speed));
  }

  function isScenarioTerminal(): boolean {
    return evaluateScenario(city, FOUNDING_SETTLEMENT_SCENARIO).status !== 'active';
  }

  function applyCamera(nextCamera: CameraState): void {
    camera = nextCamera;
    map.applyCamera(camera);
    app.render();
  }

  function centerCamera(): void {
    camera = map.fitCamera(app.screen.width, app.screen.height);
    app.render();
  }

  function zoomAt(screenPoint: { x: number; y: number }, multiplier: number): void {
    applyCamera(zoomAtScreenPoint(camera, screenPoint, camera.zoom * multiplier));
  }

  function shouldStartPan(event: FederatedPointerEvent): boolean {
    return event.button === 1 || (event.button === 0 && spacePanActive);
  }

  function stopPan(): void {
    if (!isPanning) return;
    isPanning = false;
    lastPanPoint = undefined;
    updateCursor();
  }

  function updateCursor(): void {
    app.stage.cursor = isPanning ? 'grabbing' : (spacePanActive ? 'grab' : 'crosshair');
  }

  function handleWheel(event: WheelEvent): void {
    event.preventDefault();
    if (event.deltaY === 0) return;
    const bounds = app.canvas.getBoundingClientRect();
    zoomAt(
      { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
      event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP,
    );
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.code !== 'Space') return;
    event.preventDefault();
    spacePanActive = true;
    updateCursor();
  }

  function handleKeyUp(event: KeyboardEvent): void {
    if (event.code !== 'Space') return;
    event.preventDefault();
    spacePanActive = false;
    updateCursor();
  }

  refreshCity('Clique num tile vazio para construir.');

  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  scheduleTick();

  return () => {
    if (tickHandle !== undefined) window.clearInterval(tickHandle);
    observer.disconnect();
    app.canvas.removeEventListener('wheel', handleWheel);
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    panel.destroy();
    cameraControls.destroy();
    simulationControls.destroy();
    scenarioPanel.destroy();
    advisor.destroy();
    app.destroy(true, { children: true });
  };
}
