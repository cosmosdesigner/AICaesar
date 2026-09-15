import { startGame } from './game/Game';
import './style.css';

const host = document.querySelector<HTMLElement>('#map');
const status = document.querySelector<HTMLElement>('#status');
const panelHost = document.querySelector<HTMLElement>('#build-panel');
if (!host || !status || !panelHost) throw new Error('Missing map host, status or build panel element.');

const startup = startGame(host, panelHost);
startup.then(() => {
  status.hidden = true;
}).catch((error: unknown) => {
  console.error('Could not start AICaesar:', error);
  status.setAttribute('role', 'alert');
  status.textContent = 'Não foi possível carregar o mapa. Verifique os assets locais e o suporte WebGL do browser.';
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    void startup.then((destroy) => destroy()).catch(() => {});
  });
}
