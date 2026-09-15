import { startGame } from './game/Game';
import './style.css';

const host = document.querySelector<HTMLElement>('#map');
const status = document.querySelector<HTMLElement>('#status');
if (!host || !status) throw new Error('Missing map host or status element.');

const startup = startGame(host);
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
