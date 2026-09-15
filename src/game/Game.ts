import { type FederatedPointerEvent, Point } from 'pixi.js';
import { loadMapTextures } from '../assets/AssetManifest';
import { screenToGrid } from '../rendering/GridMath';
import { MapRenderer } from '../rendering/MapRenderer';
import { createPixiApp } from '../rendering/PixiApp';
import { build, createCityState, type BuildResult } from '../simulation/CityState';
import { BuildPanel, BUILD_LABELS } from '../ui/BuildPanel';

export async function startGame(host: HTMLElement, panelHost: HTMLElement): Promise<() => void> {
  let city = createCityState();
  const textures = await loadMapTextures();
  const app = await createPixiApp(host);
  const map = new MapRenderer(city, textures);
  app.stage.addChild(map);
  const panel = new BuildPanel(panelHost, () => {
    city = createCityState();
    map.refresh(city);
    resize();
    panel.update(city.money, 'Cidade e dinheiro inicial restaurados.');
  });
  panel.update(city.money, 'Clique num tile vazio para construir.');

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
    const result = tile ? build(city, tile.x, tile.y, panel.selectedTool) : 'outside-map';
    if (result === 'built') {
      map.refresh(city);
      resize();
    }
    panel.update(city.money, result === 'built'
      ? `${BUILD_LABELS[panel.selectedTool]} construído.`
      : messages[result]);
  });

  const resize = (): void => {
    app.renderer.resize(host.clientWidth, host.clientHeight);
    map.fit(app.screen.width, app.screen.height);
    app.render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  // No simulation loop: render only on setup, resize, construction and reset.
  return () => {
    observer.disconnect();
    panel.destroy();
    app.destroy(true, { children: true });
  };
}
