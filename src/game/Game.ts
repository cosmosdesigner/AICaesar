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
  getScenario,
  getScenarioContext,
  resolveScenario,
  type DifficultyId,
  type ScenarioId,
} from '../scenario/Scenario';
import {
  createCityStateForScenario,
  demolishBuilding,
  placeBuilding,
  type BuildResult,
  type DemolishResult,
} from '../simulation/CityState';
import { assignWorkers, simulateTick } from '../simulation/Simulation';
import { fulfillImperialRequest } from '../events/Events';
import { loadCityState, saveCityState } from '../persistence/CitySave';
import { BuildPanel, BUILD_LABELS } from '../ui/BuildPanel';
import { EventPanel } from '../ui/EventPanel';
import { AdvisorPanel } from '../ui/AdvisorPanel';
import { ScenarioPanel } from '../ui/ScenarioPanel';
import { ScenarioSelector } from '../ui/ScenarioSelector';
import { MetricsPanel } from '../ui/MetricsPanel';
import { SimulationControls } from '../ui/SimulationControls';
import { CameraControls } from '../ui/CameraControls';
import { SaveLoadControls } from '../ui/SaveLoadControls';
import { getSimulationIntervalMs, type SimulationSpeed } from './SimulationSpeed';
import { createSessionMetrics, recordSessionMetric, refreshSessionMetrics } from './SessionMetrics';

export async function startGame(host: HTMLElement, panelHost: HTMLElement): Promise<() => void> {
  const ZOOM_STEP = 1.1;
  let selectedScenarioId: ScenarioId = FOUNDING_SETTLEMENT_SCENARIO.id;
  let selectedDifficulty: DifficultyId = 'normal';
  let activeScenario = resolveScenario(FOUNDING_SETTLEMENT_SCENARIO, selectedDifficulty);
  let city = createCityStateForScenario(activeScenario);
  assignWorkers(city);
  let metrics = createSessionMetrics(city, selectedScenarioId, selectedDifficulty, evaluateScenario(city, activeScenario));
  const failedRequestIds = new Set<string>();
  let waterOverlay = false;
  let foodOverlay = false;
  let desirabilityOverlay = false;
  let roadNetworkOverlay = false;
  let paused = false;
  let speed: SimulationSpeed = 1;
  let tickHandle: number | undefined;
  let spacePanActive = false;
  let isPanning = false;
  let lastPanPoint: { x: number; y: number } | undefined;
  let advisor: AdvisorPanel | undefined;
  const textures = await loadMapTextures();
  const app = await createPixiApp(host);
  const map = new MapRenderer(city, textures);
  app.stage.addChild(map);
  let camera: CameraState = map.fitCamera(app.screen.width, app.screen.height);
  const panel = new BuildPanel(
    panelHost,
    () => resetActiveScenario('Scenario reset with the selected deterministic profile.'),
    () => toggleOverlay('water'),
    () => toggleOverlay('food'),
    () => toggleOverlay('desirability'),
    () => toggleOverlay('road-network'),
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
  const scenarioPanel = new ScenarioPanel(panelHost, activeScenario);
  const metricsPanel = new MetricsPanel(panelHost);
  const eventPanel = new EventPanel(panelHost, () => city, () => {
    const fulfilled = fulfillImperialRequest(city);
    if (fulfilled) {
      metrics = recordSessionMetric(metrics, 'imperialRequestsFulfilled');
      refreshCity('Imperial request fulfilled.');
    }
    return fulfilled;
  });
  advisor = new AdvisorPanel(panelHost, () => city, {
    getScenarioContext: () => getScenarioContext(evaluateScenario(city, activeScenario)),
    getScenarioProgress: () => evaluateScenario(city, activeScenario),
    isApprovalBlocked: isScenarioTerminal,
    onApprovePlan: (plan) => {
      if (isScenarioTerminal()) return { ok: false, message: 'Advisor plan approval is blocked because the scenario has ended.' };
      const buildingCount = city.buildings.length;
      const result = approveAdvisorPlan(city, plan);
      if (result.ok) {
        metrics = recordSessionMetric(metrics, 'advisorPlansApproved');
        for (let index = buildingCount; index < city.buildings.length; index += 1) metrics = recordSessionMetric(metrics, 'buildingsConstructed');
        refreshCity(result.message);
      }
      return result;
    },
    onRejectPlan: () => { metrics = recordSessionMetric(metrics, 'advisorPlansRejected'); },
  });
  const selector = new ScenarioSelector(panelHost, { scenarioId: selectedScenarioId, difficulty: selectedDifficulty }, ({ scenarioId, difficulty }) => {
    selectedScenarioId = scenarioId;
    selectedDifficulty = difficulty;
    activeScenario = resolveScenario(getScenario(selectedScenarioId), selectedDifficulty);
    resetActiveScenario('Started a fresh city for the selected scenario and difficulty.');
  });

  const saveLoadControls = new SaveLoadControls(
    panelHost,
    () => saveCityState(city),
    () => {
      const result = loadCityState();
      if (result.ok) {
        city = result.city;
        advisor?.invalidateForCityChange('Advisor plan cleared after loading a different city.');
        refreshCity(result.message);
      }
      return result;
    },
  );

  const buildMessages: Record<Exclude<BuildResult, 'built'>, string> = {
    'outside-map': 'Construa dentro do mapa.', occupied: 'Tile ocupado. Escolha um tile vazio.', 'insufficient-funds': 'Dinheiro insuficiente.',
  };
  const demolishMessages: Record<Exclude<DemolishResult, 'demolished'>, string> = {
    'outside-map': 'Demola dentro do mapa.', empty: 'Não há edifício ou estrada neste tile.', 'inconsistent-state': 'Demolição bloqueada: os dados do edifício são inconsistentes.',
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
      refreshCity('Construção e demolição bloqueadas: o cenário terminou. Use Reset para recomeçar.');
      return;
    }
    map.toLocal(event.global, undefined, local);
    const tile = screenToGrid(local.x, local.y);
    if (panel.selectedTool === 'bulldoze') {
      const result = tile ? demolishBuilding(city, tile.x, tile.y) : 'outside-map';
      if (result === 'demolished') {
        assignWorkers(city);
        metrics = recordSessionMetric(metrics, 'buildingsDemolished');
        advisor?.invalidateForCityChange('Advisor plan cleared after demolition.');
        refreshCity('Edifício demolido.');
        return;
      }
      panel.update(city, demolishMessages[result], waterOverlay, foodOverlay, desirabilityOverlay, roadNetworkOverlay, { buildBlocked: isScenarioTerminal() });
      return;
    }
    const result = tile ? placeBuilding(city, tile.x, tile.y, panel.selectedTool) : 'outside-map';
    if (result === 'built') {
      assignWorkers(city);
      metrics = recordSessionMetric(metrics, 'buildingsConstructed');
      refreshCity(`${BUILD_LABELS[panel.selectedTool]} construído.`);
      return;
    }
    panel.update(city, buildMessages[result], waterOverlay, foodOverlay, desirabilityOverlay, roadNetworkOverlay, { buildBlocked: isScenarioTerminal() });
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

  function resetActiveScenario(message: string): void {
    city = createCityStateForScenario(activeScenario);
    assignWorkers(city);
    failedRequestIds.clear();
    metrics = createSessionMetrics(city, selectedScenarioId, selectedDifficulty, evaluateScenario(city, activeScenario));
    advisor?.invalidateForCityChange('Advisor plan and report cleared for a fresh city.');
    scenarioPanel.setDefinition(activeScenario);
    refreshCity(message);
    centerCamera();
  }

  function toggleOverlay(kind: 'water' | 'food' | 'desirability' | 'road-network'): boolean {
    if (kind === 'water') waterOverlay = !waterOverlay;
    if (kind === 'food') foodOverlay = !foodOverlay;
    if (kind === 'desirability') desirabilityOverlay = !desirabilityOverlay;
    if (kind === 'road-network') roadNetworkOverlay = !roadNetworkOverlay;
    map.refresh(city, { waterOverlay, foodOverlay, desirabilityOverlay, roadNetworkOverlay });
    app.render();
    return kind === 'water' ? waterOverlay : kind === 'food' ? foodOverlay : kind === 'desirability' ? desirabilityOverlay : roadNetworkOverlay;
  }

  function refreshCity(message: string): void {
    map.refresh(city, { waterOverlay, foodOverlay, desirabilityOverlay, roadNetworkOverlay });
    const scenarioProgress = evaluateScenario(city, activeScenario);
    const request = city.simulation.events?.pendingRequest;
    if (request?.status === 'failed' && !failedRequestIds.has(request.id)) {
      failedRequestIds.add(request.id);
      metrics = recordSessionMetric(metrics, 'imperialRequestsFailed');
    }
    metrics = refreshSessionMetrics(metrics, city, scenarioProgress);
    if (scenarioProgress.status !== 'active') {
      paused = true;
      scheduleTick();
      simulationControls.update(paused, speed);
    }
    scenarioPanel.update(scenarioProgress);
    metricsPanel.update(metrics);
    eventPanel.update(city);
    advisor?.updateScenarioContext();
    panel.update(city, scenarioProgress.resultMessage ?? message, waterOverlay, foodOverlay, desirabilityOverlay, roadNetworkOverlay, { buildBlocked: scenarioProgress.status !== 'active' });
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
    return evaluateScenario(city, activeScenario).status !== 'active';
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
    zoomAt({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
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
    metricsPanel.destroy();
    eventPanel.destroy();
    advisor?.destroy();
    selector.destroy();
    saveLoadControls.destroy();
    app.destroy(true, { children: true });
  };
}
