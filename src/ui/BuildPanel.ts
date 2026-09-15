import { BUILD_COSTS, type CityState } from '../simulation/CityState';
import { getHousingStats } from '../simulation/Simulation';
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
  private readonly tick = document.createElement('strong');
  private readonly housesTotal = document.createElement('strong');
  private readonly housesRoad = document.createElement('strong');
  private readonly housesWater = document.createElement('strong');
  private readonly housesLevelTwo = document.createElement('strong');
  private readonly waterTiles = document.createElement('strong');
  private readonly waterOverlay = document.createElement('button');
  private readonly status = document.createElement('p');

  constructor(host: HTMLElement, onReset: () => void, onWaterOverlayToggle: () => boolean) {
    this.element.className = 'build-panel';
    this.element.setAttribute('aria-label', 'Construção manual');
    const balance = document.createElement('p');
    balance.append('Dinheiro: ', this.money);
    const selected = document.createElement('p');
    this.selection.textContent = BUILD_LABELS[this.selectedTool];
    selected.append('Ferramenta: ', this.selection);
    const tick = document.createElement('p');
    tick.append('Tick: ', this.tick);

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

    const housing = document.createElement('div');
    housing.className = 'build-stats';
    housing.append(
      this.createStat('Casas', this.housesTotal),
      this.createStat('Com estrada', this.housesRoad),
      this.createStat('Com água', this.housesWater),
      this.createStat('Nível 2', this.housesLevelTwo),
      this.createStat('Tiles com água', this.waterTiles),
    );

    this.waterOverlay.type = 'button';
    this.waterOverlay.textContent = 'Water overlay: Off';
    this.waterOverlay.setAttribute('aria-pressed', 'false');
    this.waterOverlay.addEventListener('click', () => {
      const enabled = onWaterOverlayToggle();
      this.setWaterOverlay(enabled);
      this.status.textContent = enabled ? 'Overlay de água ligado.' : 'Overlay de água desligado.';
    });

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Reset';
    reset.addEventListener('click', onReset);
    this.status.className = 'build-status';
    this.status.setAttribute('role', 'status');
    this.element.append(balance, selected, tick, tools, housing, this.waterOverlay, reset, this.status);
    host.append(this.element);
  }

  update(city: CityState, message: string, waterOverlay: boolean): void {
    const stats = getHousingStats(city);
    this.money.textContent = String(city.resources.money);
    this.tick.textContent = String(city.simulation.tick);
    this.housesTotal.textContent = String(stats.totalHouses);
    this.housesRoad.textContent = String(stats.housesWithRoadAccess);
    this.housesWater.textContent = String(stats.housesWithWater);
    this.housesLevelTwo.textContent = String(stats.levelTwoHouses);
    this.waterTiles.textContent = String(stats.waterCoveredTiles);
    this.setWaterOverlay(waterOverlay);
    this.status.textContent = message;
  }

  destroy(): void {
    this.element.remove();
  }

  private createStat(label: string, value: HTMLElement): HTMLElement {
    const stat = document.createElement('span');
    stat.append(`${label}: `, value);
    return stat;
  }

  private setWaterOverlay(enabled: boolean): void {
    this.waterOverlay.textContent = `Water overlay: ${enabled ? 'On' : 'Off'}`;
    this.waterOverlay.setAttribute('aria-pressed', String(enabled));
  }
}
