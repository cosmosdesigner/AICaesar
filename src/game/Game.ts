import { loadMapTextures } from '../assets/AssetManifest';
import { MapRenderer } from '../rendering/MapRenderer';
import { createPixiApp } from '../rendering/PixiApp';
import { createCityState } from '../simulation/CityState';

export async function startGame(host: HTMLElement): Promise<() => void> {
  const city = createCityState();
  const textures = await loadMapTextures();
  const app = await createPixiApp(host);
  const map = new MapRenderer(city, textures);
  app.stage.addChild(map);

  const resize = (): void => {
    app.renderer.resize(host.clientWidth, host.clientHeight);
    map.fit(app.screen.width, app.screen.height);
    app.render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  // No simulation or animation loop in Phase 1. Render only on setup/resize.
  return () => {
    observer.disconnect();
    app.destroy(true, { children: true });
  };
}
