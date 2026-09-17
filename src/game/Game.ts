import { type FederatedPointerEvent, Point } from 'pixi.js';
import { approveAdvisorPlan } from '../advisor/AdvisorApproval';
import { loadMapTextures, loadVisualActivityTextures } from '../assets/AssetManifest';
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
import { AgoraPanel } from '../ui/AgoraPanel';
import { BuildPanel, BUILD_LABELS } from '../ui/BuildPanel';
import { EventPanel } from '../ui/EventPanel';
import { AdvisorPanel } from '../ui/AdvisorPanel';
import { ScenarioPanel } from '../ui/ScenarioPanel';
import { ScenarioSelector } from '../ui/ScenarioSelector';
import { MetricsPanel } from '../ui/MetricsPanel';
import { SimulationControls } from '../ui/SimulationControls';
import { CameraControls } from '../ui/CameraControls';
import { SaveLoadControls } from '../ui/SaveLoadControls';
import { deriveAgoraSummary } from './AgoraSummary';
import { getSimulationIntervalMs, type SimulationSpeed } from './SimulationSpeed';
import { createSessionMetrics, recordSessionMetric, refreshSessionMetrics } from './SessionMetrics';
import { TouchGestureRecognizer, type TouchGestureUpdate } from '../input/TouchGestureRecognizer';
import {
  describeTilePreview,
  getTilePreview,
  type TilePreview,
} from './TilePreview';
import {
  describeConstructionImpact,
  getConstructionImpact,
} from './ConstructionImpact';

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
  const touchGesture = new TouchGestureRecognizer();
  const tracedTileKeys = new Set<string>();
  const agora = new AgoraPanel(panelHost);
  const buildHost = createCollapsiblePanelHost(panelHost, 'Construção', true);
  let advisor: AdvisorPanel | undefined;
  const [textures, activityTextures] = await Promise.all([
    loadMapTextures(),
    loadVisualActivityTextures().catch(() => undefined),
  ]);
  const app = await createPixiApp(host);
  const map = new MapRenderer(city, textures, activityTextures);
  const visualActivityTicker = (ticker: { readonly deltaMS: number }): void => {
    if (!paused) map.updateVisualActivity(ticker.deltaMS / 1_000);
  };
  app.ticker.add(visualActivityTicker);
  app.ticker.start();
  app.stage.addChild(map);
  let camera: CameraState = map.fitCamera(app.screen.width, app.screen.height);
  const panel = new BuildPanel(
    buildHost,
    () => resetActiveScenario('Cenário reiniciado com o perfil determinístico selecionado.'),
    () => toggleOverlay('water'),
    () => toggleOverlay('food'),
    () => toggleOverlay('desirability'),
    () => toggleOverlay('road-network'),
    () => {
      if (preview !== null) setPreview(preview);
    },
  );
  const cameraControls = new CameraControls(
    createCollapsiblePanelHost(panelHost, 'Navegação do mapa'),
    () => zoomAt({ x: app.screen.width / 2, y: app.screen.height / 2 }, ZOOM_STEP),
    () => zoomAt({ x: app.screen.width / 2, y: app.screen.height / 2 }, 1 / ZOOM_STEP),
    centerCamera,
  );
  const simulationControls = new SimulationControls(
    createCollapsiblePanelHost(panelHost, 'Simulação'),
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
  const scenarioPanel = new ScenarioPanel(createCollapsiblePanelHost(panelHost, 'Cenário'), activeScenario);
  const metricsPanel = new MetricsPanel(createCollapsiblePanelHost(panelHost, 'Métricas'));
  const eventPanel = new EventPanel(createCollapsiblePanelHost(panelHost, 'Eventos'), () => city, () => {
    const fulfilled = fulfillImperialRequest(city);
    if (fulfilled) {
      metrics = recordSessionMetric(metrics, 'imperialRequestsFulfilled');
      refreshCity('Imperial request fulfilled.');
    }
    return fulfilled;
  });
  advisor = new AdvisorPanel(createCollapsiblePanelHost(panelHost, 'Conselheiro'), () => city, {
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
  const selector = new ScenarioSelector(createCollapsiblePanelHost(panelHost, 'Configuração do cenário'), { scenarioId: selectedScenarioId, difficulty: selectedDifficulty }, ({ scenarioId, difficulty }) => {
    selectedScenarioId = scenarioId;
    selectedDifficulty = difficulty;
    activeScenario = resolveScenario(getScenario(selectedScenarioId), selectedDifficulty);
    resetActiveScenario('Started a fresh city for the selected scenario and difficulty.');
  });

  const saveLoadControls = new SaveLoadControls(
    createCollapsiblePanelHost(panelHost, 'Guardar e carregar'),
    () => saveCityState(city),
    () => {
      const result = loadCityState();
      if (result.ok) {
        city = result.city;
        map.resetVisualActivity(city);
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
  let preview: TilePreview | null = null;

  app.stage.eventMode = 'static';
  app.stage.hitArea = app.screen;
  updateCursor();
  app.stage.on('pointerdown', handlePointerDown);
  app.stage.on('pointermove', handlePointerMove);
  app.stage.on('pointerup', handlePointerUp);
  app.stage.on('pointerupoutside', handlePointerUpOutside);
  app.stage.on('pointercancel', handlePointerCancel);
  app.stage.on('pointerout', handlePointerOut);

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
    map.resetVisualActivity(city);
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
    syncPreview();

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
    agora.update(deriveAgoraSummary(city, scenarioProgress));
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

  function handlePointerDown(event: FederatedPointerEvent): void {
    clearPreview();
    if (event.pointerType === 'touch') {
      event.preventDefault();
      touchGesture.pointerDown(event.pointerId, event.global);
      tracedTileKeys.clear();
      if (touchGesture.isPinching) stopPan();
      return;
    }

    if (shouldStartPan(event)) {
      event.preventDefault();
      isPanning = true;
      lastPanPoint = { x: event.global.x, y: event.global.y };
      updateCursor();
      return;
    }
    if (event.button !== 0) return;
    applySingleToolAtPoint(event.global);
  }

  function handlePointerMove(event: FederatedPointerEvent): void {
    if (event.pointerType === 'touch') {
      event.preventDefault();
      const gesture = touchGesture.pointerMove(event.pointerId, event.global);
      if (gesture.type === 'none' && touchGesture.isActive && !touchGesture.isPinching) {
        updatePreviewAtPoint(event.global);
      } else {
        clearPreview();
      }
      applyTouchGesture(gesture);
      return;
    }

    if (!isPanning || lastPanPoint === undefined) {
      updatePreviewAtPoint(event.global);
      return;
    }
    clearPreview();
    const point = { x: event.global.x, y: event.global.y };
    applyCamera(panCamera(camera, { x: point.x - lastPanPoint.x, y: point.y - lastPanPoint.y }));
    lastPanPoint = point;
  }

  function handlePointerUp(event: FederatedPointerEvent): void {
    clearPreview();
    if (event.pointerType !== 'touch') {
      stopPan();
      return;
    }

    event.preventDefault();
    const gesture = touchGesture.pointerUp(event.pointerId, event.global);
    applyTouchGesture(gesture);
    if (!touchGesture.isActive) tracedTileKeys.clear();
  }

  function handlePointerUpOutside(event: FederatedPointerEvent): void {
    clearPreview();
    if (event.pointerType !== 'touch') {
      stopPan();
      return;
    }

    event.preventDefault();
    cancelTouchGesture();
  }

  function handlePointerCancel(event: FederatedPointerEvent): void {
    clearPreview();
    if (event.pointerType !== 'touch') return;
    event.preventDefault();
    cancelTouchGesture();
  }

  function handlePointerOut(): void {
    clearPreview();
  }
  function applyTouchGesture(gesture: TouchGestureUpdate): void {
    if (gesture.type === 'tap') {
      applySingleToolAtPoint(gesture.point);
    } else if (gesture.type === 'pinch') {
      applyCamera(zoomAtScreenPoint(panCamera(camera, gesture.delta), gesture.midpoint, camera.zoom * gesture.scale));
    } else if (gesture.type === 'drag') {
      if (panel.selectedTool === 'road' || panel.selectedTool === 'bulldoze') {
        applyTraceAtPoint(gesture.point);
      } else {
        applyCamera(panCamera(camera, gesture.delta));
      }
    }
  }


  function cancelTouchGesture(): void {
    touchGesture.cancel();
    tracedTileKeys.clear();
    clearPreview();
  }

  function updatePreviewAtPoint(screenPoint: { readonly x: number; readonly y: number }): void {
    map.toLocal(screenPoint, undefined, local);
    setPreview(getTilePreview(city, screenToGrid(local.x, local.y)));
  }

  function setPreview(nextPreview: TilePreview | null, render = true): void {
    preview = nextPreview;
    map.setPreview(preview);
    const selectedTool = panel.selectedTool;
    let impactDescription = '';
    if (selectedTool !== 'bulldoze' && nextPreview?.state === 'free') {
      impactDescription = describeConstructionImpact(getConstructionImpact(city, nextPreview, selectedTool));
    }
    const tileDescription = describeTilePreview(nextPreview, selectedTool === 'bulldoze' ? 'demolish' : 'build');
    panel.setPreviewStatus(`${tileDescription}${impactDescription === '' ? '' : ` ${impactDescription}`}`);
    if (render) app.render();
  }

  function syncPreview(): void {
    if (preview !== null) setPreview(getTilePreview(city, preview), false);
  }

  function clearPreview(): void {
    preview = null;
    map.setPreview(null);
    panel.setPreviewStatus('');
    app.render();
  }

  function applySingleToolAtPoint(screenPoint: { readonly x: number; readonly y: number }): void {
    if (isScenarioTerminal()) {
      refreshCity('Construção e demolição bloqueadas: o cenário terminou. Use Reset para recomeçar.');
      return;
    }
    map.toLocal(screenPoint, undefined, local);
    applyToolAtTile(screenToGrid(local.x, local.y), false);
  }

  function applyTraceAtPoint(screenPoint: { readonly x: number; readonly y: number }): void {
    if (isScenarioTerminal()) return;
    map.toLocal(screenPoint, undefined, local);
    const tile = screenToGrid(local.x, local.y);
    if (tile === null) return;
    const tileKey = `${tile.x}:${tile.y}`;
    if (tracedTileKeys.has(tileKey)) return;
    tracedTileKeys.add(tileKey);
    applyToolAtTile(tile, true);
  }

  function applyToolAtTile(tile: { readonly x: number; readonly y: number } | null, isTrace: boolean): void {
    if (panel.selectedTool === 'bulldoze') {
      const result = tile ? demolishBuilding(city, tile.x, tile.y) : 'outside-map';
      if (result === 'demolished') {
        assignWorkers(city);
        metrics = recordSessionMetric(metrics, 'buildingsDemolished');
        advisor?.invalidateForCityChange('Advisor plan cleared after demolition.');
        refreshCity('Edifício demolido.');
      } else if (!isTrace) {
        panel.update(city, demolishMessages[result], waterOverlay, foodOverlay, desirabilityOverlay, roadNetworkOverlay, { buildBlocked: isScenarioTerminal() });
      }
      return;
    }

    const result = tile ? placeBuilding(city, tile.x, tile.y, panel.selectedTool) : 'outside-map';
    if (result === 'built') {
      assignWorkers(city);
      metrics = recordSessionMetric(metrics, 'buildingsConstructed');
      advisor?.invalidateForCityChange('Advisor plan cleared after construction.');
      refreshCity(`${BUILD_LABELS[panel.selectedTool]} construído.`);
    } else if (!isTrace) {
      panel.update(city, buildMessages[result], waterOverlay, foodOverlay, desirabilityOverlay, roadNetworkOverlay, { buildBlocked: isScenarioTerminal() });
    }
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
    clearPreview();

    cancelTouchGesture();
    if (tickHandle !== undefined) window.clearInterval(tickHandle);
    app.ticker.remove(visualActivityTicker);
    observer.disconnect();
    app.canvas.removeEventListener('wheel', handleWheel);
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    agora.destroy();
    panel.destroy();
    cameraControls.destroy();
    simulationControls.destroy();
    scenarioPanel.destroy();
    metricsPanel.destroy();
    eventPanel.destroy();
    advisor?.destroy();
    selector.destroy();
    saveLoadControls.destroy();
    for (const wrapper of panelHost.querySelectorAll?.('.secondary-panel') ?? []) wrapper.remove();
    app.destroy(true, { children: true });
  };
}

function createCollapsiblePanelHost(host: HTMLElement, title: string, open = false): HTMLElement {
  if (typeof document === 'undefined') return host;
  const details = document.createElement('details');
  details.className = 'secondary-panel';
  details.open = open;
  const summary = document.createElement('summary');
  summary.textContent = title;
  const content = document.createElement('div');
  content.className = 'secondary-panel-content';
  details.append(summary, content);
  host.append(details);
  return content;
}
