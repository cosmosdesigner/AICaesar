import { type FederatedPointerEvent, Point } from 'pixi.js';
import { approveAdvisorPlan } from '../advisor/AdvisorApproval';
import { loadMapTextures } from '../assets/AssetManifest';
import { screenToGrid } from '../rendering/GridMath';
import { MapRenderer } from '../rendering/MapRenderer';
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
import { getSimulationIntervalMs, type SimulationSpeed } from './SimulationSpeed';

export async function startGame(host: HTMLElement, panelHost: HTMLElement): Promise<() => void> {
  let city = createCityState();
  assignWorkers(city);
  let waterOverlay = false;
  let foodOverlay = false;
  let paused = false;
  let speed: SimulationSpeed = 1;
  let tickHandle: number | undefined;
  const textures = await loadMapTextures();
  const app = await createPixiApp(host);
  const map = new MapRenderer(city, textures);
  app.stage.addChild(map);
  const panel = new BuildPanel(
    panelHost,
    () => {
      city = createCityState();
      assignWorkers(city);
      refreshCity('Cidade, dinheiro e simulação inicial restaurados.');
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
  app.stage.cursor = 'crosshair';
  app.stage.on('pointerdown', (event: FederatedPointerEvent) => {
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

  const resize = (): void => {
    app.renderer.resize(host.clientWidth, host.clientHeight);
    map.fit(app.screen.width, app.screen.height);
    app.render();
  };

  function refreshCity(message: string): void {
    map.refresh(city, { waterOverlay, foodOverlay });
    resize();
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

  refreshCity('Clique num tile vazio para construir.');

  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  scheduleTick();

  return () => {
    if (tickHandle !== undefined) window.clearInterval(tickHandle);
    observer.disconnect();
    panel.destroy();
    simulationControls.destroy();
    scenarioPanel.destroy();
    advisor.destroy();
    app.destroy(true, { children: true });
  };
}
