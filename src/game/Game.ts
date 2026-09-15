import { type FederatedPointerEvent, Point } from 'pixi.js';
import { loadMapTextures } from '../assets/AssetManifest';
import { screenToGrid } from '../rendering/GridMath';
import { MapRenderer } from '../rendering/MapRenderer';
import { createPixiApp } from '../rendering/PixiApp';
import { createCityState, placeBuilding, type BuildResult } from '../simulation/CityState';
import { simulateTick } from '../simulation/Simulation';
import { BuildPanel, BUILD_LABELS } from '../ui/BuildPanel';

export async function startGame(host: HTMLElement, panelHost: HTMLElement): Promise<() => void> {
  let city = createCityState();
  let waterOverlay = false;
  const textures = await loadMapTextures();
  const app = await createPixiApp(host);
  const map = new MapRenderer(city, textures);
  app.stage.addChild(map);
  const panel = new BuildPanel(
    panelHost,
    () => {
      city = createCityState();
      map.refresh(city, { waterOverlay });
      resize();
      panel.update(city, 'Cidade, dinheiro e simulação inicial restaurados.', waterOverlay);
    },
    () => {
      waterOverlay = !waterOverlay;
      map.refresh(city, { waterOverlay });
      app.render();
      return waterOverlay;
    },
  );
  panel.update(city, 'Clique num tile vazio para construir.', waterOverlay);

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
      map.refresh(city, { waterOverlay });
      resize();
    }
    panel.update(city, result === 'built'
      ? `${BUILD_LABELS[panel.selectedTool]} construído.`
      : messages[result], waterOverlay);
  });

  const resize = (): void => {
    app.renderer.resize(host.clientWidth, host.clientHeight);
    map.fit(app.screen.width, app.screen.height);
    app.render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  const tickHandle = window.setInterval(() => {
    simulateTick(city);
    map.refresh(city, { waterOverlay });
    panel.update(city, 'Simulação atualizada.', waterOverlay);
    app.render();
  }, 1000);

  return () => {
    window.clearInterval(tickHandle);
    observer.disconnect();
    panel.destroy();
    app.destroy(true, { children: true });
  };
}
