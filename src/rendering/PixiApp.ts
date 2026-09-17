import { Application } from 'pixi.js';

export async function createPixiApp(host: HTMLElement): Promise<Application> {
  const app = new Application();
  await app.init({
    width: host.clientWidth,
    height: host.clientHeight,
    background: '#182522',
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    preference: 'webgl',
    autoStart: false,
  });
  app.canvas.setAttribute('role', 'img');
  app.canvas.setAttribute('aria-label', 'Mapa 30 por 30. Toque para construir ou demolir um tile; arraste Road ou Bulldoze para traços, arraste outras ferramentas para mover o mapa e use dois dedos para zoom.');
  host.append(app.canvas);
  return app;
}
