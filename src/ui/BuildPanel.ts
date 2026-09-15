import { BUILD_COSTS, type CityState } from '../simulation/CityState';
import { getFoodStats, getHousingStats } from '../simulation/Simulation';
import type { BuildingType } from '../simulation/Tile';

export const BUILD_LABELS: Readonly<Record<BuildingType, string>> = {
  road: 'Road',
  house: 'House',
  well: 'Well',
  farm: 'Farm',
  granary: 'Granary',
  market: 'Market',
};

const BUILD_TOOLS: readonly BuildingType[] = ['road', 'house', 'well', 'farm', 'granary', 'market'];

export class BuildPanel {
  selectedTool: BuildingType = 'road';
  private readonly element = document.createElement('section');
  private readonly money = document.createElement('strong');
  private readonly selection = document.createElement('strong');
  private readonly tick = document.createElement('strong');
  private readonly housesTotal = document.createElement('strong');
  private readonly housesRoad = document.createElement('strong');
  private readonly housesWater = document.createElement('strong');
  private readonly housesFood = document.createElement('strong');
  private readonly housesLevelTwo = document.createElement('strong');
  private readonly housesLevelThree = document.createElement('strong');
  private readonly waterTiles = document.createElement('strong');
  private readonly foodStored = document.createElement('strong');
  private readonly farms = document.createElement('strong');
  private readonly granaries = document.createElement('strong');
  private readonly markets = document.createElement('strong');
  private readonly foodTiles = document.createElement('strong');
  private readonly waterOverlay = document.createElement('button');
  private readonly foodOverlay = document.createElement('button');
  private readonly status = document.createElement('p');

  constructor(
    host: HTMLElement,
    onReset: () => void,
    onWaterOverlayToggle: () => boolean,
    onFoodOverlayToggle: () => boolean,
  ) {
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
    for (const tool of BUILD_TOOLS) {
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

    const stats = document.createElement('div');
    stats.className = 'build-stats';
    stats.append(
      this.createStat('Casas', this.housesTotal),
      this.createStat('Com estrada', this.housesRoad),
      this.createStat('Com água', this.housesWater),
      this.createStat('Com comida', this.housesFood),
      this.createStat('Nível 2', this.housesLevelTwo),
      this.createStat('Nível 3', this.housesLevelThree),
      this.createStat('Tiles com água', this.waterTiles),
      this.createStat('Comida', this.foodStored),
      this.createStat('Farms', this.farms),
      this.createStat('Granaries', this.granaries),
      this.createStat('Markets', this.markets),
      this.createStat('Tiles com comida', this.foodTiles),
    );

    this.waterOverlay.type = 'button';
    this.waterOverlay.textContent = 'Water overlay: Off';
    this.waterOverlay.setAttribute('aria-pressed', 'false');
    this.waterOverlay.addEventListener('click', () => {
      const enabled = onWaterOverlayToggle();
      this.setWaterOverlay(enabled);
      this.status.textContent = enabled ? 'Overlay de água ligado.' : 'Overlay de água desligado.';
    });

    this.foodOverlay.type = 'button';
    this.foodOverlay.textContent = 'Food overlay: Off';
    this.foodOverlay.setAttribute('aria-pressed', 'false');
    this.foodOverlay.addEventListener('click', () => {
      const enabled = onFoodOverlayToggle();
      this.setFoodOverlay(enabled);
      this.status.textContent = enabled ? 'Overlay de comida ligado.' : 'Overlay de comida desligado.';
    });

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Reset';
    reset.addEventListener('click', onReset);
    this.status.className = 'build-status';
    this.status.setAttribute('role', 'status');
    this.element.append(
      balance,
      selected,
      tick,
      tools,
      stats,
      this.waterOverlay,
      this.foodOverlay,
      reset,
      this.status,
    );
    host.append(this.element);
  }

  update(city: CityState, message: string, waterOverlay: boolean, foodOverlay: boolean): void {
    const housingStats = getHousingStats(city);
    const foodStats = getFoodStats(city);
    this.money.textContent = String(city.resources.money);
    this.tick.textContent = String(city.simulation.tick);
    this.housesTotal.textContent = String(housingStats.totalHouses);
    this.housesRoad.textContent = String(housingStats.housesWithRoadAccess);
    this.housesWater.textContent = String(housingStats.housesWithWater);
    this.housesFood.textContent = String(housingStats.housesWithFood);
    this.housesLevelTwo.textContent = String(housingStats.levelTwoHouses);
    this.housesLevelThree.textContent = String(housingStats.levelThreeHouses);
    this.waterTiles.textContent = String(housingStats.waterCoveredTiles);
    this.foodStored.textContent = `${foodStats.foodStored}/${foodStats.foodCapacity}`;
    this.farms.textContent = String(foodStats.farms);
    this.granaries.textContent = String(foodStats.granaries);
    this.markets.textContent = String(foodStats.markets);
    this.foodTiles.textContent = String(foodStats.foodCoveredTiles);
    this.setWaterOverlay(waterOverlay);
    this.setFoodOverlay(foodOverlay);
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

  private setFoodOverlay(enabled: boolean): void {
    this.foodOverlay.textContent = `Food overlay: ${enabled ? 'On' : 'Off'}`;
    this.foodOverlay.setAttribute('aria-pressed', String(enabled));
  }
}
