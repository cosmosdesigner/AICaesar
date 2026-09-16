import { type FederatedPointerEvent, Point } from 'pixi.js';
import { approveAdvisorPlan } from '../advisor/AdvisorApproval';
import { loadMapTextures } from '../assets/AssetManifest';
import { screenToGrid } from '../rendering/GridMath';
import { MapRenderer } from '../rendering/MapRenderer';
import { createPixiApp } from '../rendering/PixiApp';
import { createCityState, placeBuilding, type BuildResult } from '../simulation/CityState';
import { assignWorkers, simulateTick } from '../simulation/Simulation';
import { BuildPanel, BUILD_LABELS } from '../ui/BuildPanel';
import { AdvisorPanel } from '../ui/AdvisorPanel';

export async function startGame(host: HTMLElement, panelHost: HTMLElement): Promise<() => void> {
  let city = createCityState();
  assignWorkers(city);
  let waterOverlay = false;
  let foodOverlay = false;
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
  const advisor = new AdvisorPanel(panelHost, () => city, {
    onApprovePlan: (plan) => {
      const result = approveAdvisorPlan(city, plan);
      if (result.ok) refreshCity(result.message);
      return result;
    },
  });
  panel.update(city, 'Clique num tile vazio para construir.', waterOverlay, foodOverlay);

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
    map.toLocal(event.global, undefined, local);
    const tile = screenToGrid(local.x, local.y);
    const result = tile ? placeBuilding(city, tile.x, tile.y, panel.selectedTool) : 'outside-map';
    if (result === 'built') {
      assignWorkers(city);
      refreshCity(`${BUILD_LABELS[panel.selectedTool]} construído.`);
      return;
    }

    panel.update(city, messages[result], waterOverlay, foodOverlay);
  });

  const resize = (): void => {
    app.renderer.resize(host.clientWidth, host.clientHeight);
    map.fit(app.screen.width, app.screen.height);
    app.render();
  };

  function refreshCity(message: string): void {
    map.refresh(city, { waterOverlay, foodOverlay });
    resize();
    panel.update(city, message, waterOverlay, foodOverlay);
    app.render();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  const tickHandle = window.setInterval(() => {
    simulateTick(city);
    map.refresh(city, { waterOverlay, foodOverlay });
    panel.update(city, 'Simulação atualizada.', waterOverlay, foodOverlay);
    app.render();
  }, 1000);

  return () => {
    window.clearInterval(tickHandle);
    observer.disconnect();
    panel.destroy();
    advisor.destroy();
    app.destroy(true, { children: true });
  };
}
