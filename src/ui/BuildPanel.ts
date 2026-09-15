import { BUILD_COSTS, type ResourceState } from '../simulation/CityState';
import type { BuildingType } from '../simulation/Tile';

export const BUILD_LABELS: Readonly<Record<BuildingType, string>> = {
  road: 'Road',
  house: 'House',
  well: 'Well',
};

export class BuildPanel {
  selectedTool: BuildingType = 'road';
  private readonly element = document.createElement('section');
  private readonly money = document.createElement('strong');
  private readonly selection = document.createElement('strong');
  private readonly status = document.createElement('p');

  constructor(host: HTMLElement, onReset: () => void) {
    this.element.className = 'build-panel';
    this.element.setAttribute('aria-label', 'Construção manual');
    const balance = document.createElement('p');
    balance.append('Dinheiro: ', this.money);
    const selected = document.createElement('p');
    this.selection.textContent = BUILD_LABELS[this.selectedTool];
    selected.append('Ferramenta: ', this.selection);

    const tools = document.createElement('div');
    tools.className = 'build-tools';
    tools.setAttribute('role', 'group');
    tools.setAttribute('aria-label', 'Ferramentas de construção');
    for (const tool of ['road', 'house', 'well'] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${BUILD_LABELS[tool]} (${BUILD_COSTS[tool]})`;
      button.setAttribute('aria-pressed', String(tool === this.selectedTool));
      button.addEventListener('click', () => {
        this.selectedTool = tool;
        this.selection.textContent = BUILD_LABELS[tool];
        for (const sibling of tools.children) sibling.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-pressed', 'true');
        this.status.textContent = 'Clique num tile vazio para construir.';
      });
      tools.append(button);
    }

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Reset';
    reset.addEventListener('click', onReset);
    this.status.className = 'build-status';
    this.status.setAttribute('role', 'status');
    this.element.append(balance, selected, tools, reset, this.status);
    host.append(this.element);
  }

  update(resources: ResourceState, message: string): void {
    this.money.textContent = String(resources.money);
    this.status.textContent = message;
  }

  destroy(): void {
    this.element.remove();
  }
}
