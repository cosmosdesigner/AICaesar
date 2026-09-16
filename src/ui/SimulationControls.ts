import type { SimulationSpeed } from '../game/SimulationSpeed';

const SPEEDS: readonly SimulationSpeed[] = [1, 2, 4];

export class SimulationControls {
  private readonly element = document.createElement('section');
  private readonly state = document.createElement('strong');
  private readonly toggle = document.createElement('button');
  private readonly speedButtons: Partial<Record<SimulationSpeed, HTMLButtonElement>> = {};

  constructor(
    host: HTMLElement,
    private readonly onTogglePause: () => boolean,
    private readonly onSpeedChange: (speed: SimulationSpeed) => void,
  ) {
    this.element.className = 'simulation-controls';
    this.element.setAttribute('aria-label', 'Simulation controls');

    const title = document.createElement('h2');
    title.textContent = 'Simulation';

    const status = document.createElement('p');
    status.append('Status: ', this.state);

    this.toggle.type = 'button';
    this.toggle.title = 'Pause or resume simulation ticks';
    this.toggle.addEventListener('click', () => {
      const paused = this.onTogglePause();
      this.setPaused(paused);
    });

    const speeds = document.createElement('div');
    speeds.className = 'speed-controls';
    speeds.setAttribute('role', 'group');
    speeds.setAttribute('aria-label', 'Simulation speed');
    speeds.append('Speed: ');

    for (const speed of SPEEDS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${speed}x`;
      button.title = `Run simulation at ${speed}x speed`;
      button.addEventListener('click', () => {
        this.onSpeedChange(speed);
        this.setSpeed(speed);
      });
      this.speedButtons[speed] = button;
      speeds.append(button);
    }

    this.element.append(title, status, this.toggle, speeds);
    host.append(this.element);
  }

  update(paused: boolean, speed: SimulationSpeed): void {
    this.setPaused(paused);
    this.setSpeed(speed);
  }

  destroy(): void {
    this.element.remove();
  }

  private setPaused(paused: boolean): void {
    this.state.textContent = paused ? 'Paused' : 'Running';
    this.toggle.textContent = paused ? 'Play' : 'Pause';
    this.toggle.setAttribute('aria-pressed', String(paused));
  }

  private setSpeed(activeSpeed: SimulationSpeed): void {
    for (const speed of SPEEDS) {
      this.speedButtons[speed]?.setAttribute('aria-pressed', String(speed === activeSpeed));
    }
  }
}
