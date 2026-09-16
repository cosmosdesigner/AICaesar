import { analyzeCity } from '../analysis/CityAnalyzer';
import { BUILD_COSTS, type CityState } from '../simulation/CityState';
import { getFinanceStats, getFoodStats, getHousingStats, getPopulationStats, getWorkforceStats } from '../simulation/Simulation';
import type { BuildingType } from '../simulation/Tile';

export const BUILD_LABELS: Readonly<Record<BuildingType, string>> = {
  road: 'Road',
  house: 'House',
  well: 'Well',
  farm: 'Farm',
  granary: 'Granary',
  market: 'Market',
};

const BUILD_TITLES: Readonly<Record<BuildingType, string>> = {
  road: 'Roads connect services and buildings.',
  house: 'Houses begin empty and attract residents when they have road, water and food.',
  well: 'Wells provide water coverage to nearby houses.',
  farm: 'Farms produce food when enough workers are available.',
  granary: 'Granaries add food storage capacity when active.',
  market: 'Markets distribute stored food to nearby houses when active.',
};

const BUILD_TOOLS: readonly BuildingType[] = ['road', 'house', 'well', 'farm', 'granary', 'market'];

export interface BuildPanelUpdateOptions {
  readonly buildBlocked?: boolean;
}


export class BuildPanel {
  selectedTool: BuildingType = 'road';
  private readonly toolButtons: HTMLButtonElement[] = [];
  private readonly element = document.createElement('section');
  private readonly money = document.createElement('strong');
  private readonly selection = document.createElement('strong');
  private readonly tick = document.createElement('strong');
  private readonly financePeriod = document.createElement('strong');
  private readonly financeTaxes = document.createElement('strong');
  private readonly financeUpkeep = document.createElement('strong');
  private readonly financeNet = document.createElement('strong');
  private readonly financeTreasury = document.createElement('strong');
  private readonly financeNext = document.createElement('strong');
  private readonly housesTotal = document.createElement('strong');
  private readonly housesRoad = document.createElement('strong');
  private readonly housesWater = document.createElement('strong');
  private readonly housesFood = document.createElement('strong');
  private readonly housesLevelTwo = document.createElement('strong');
  private readonly housesLevelThree = document.createElement('strong');
  private readonly waterTiles = document.createElement('strong');
  private readonly blockedByRoad = document.createElement('strong');
  private readonly blockedByWater = document.createElement('strong');
  private readonly blockedByFood = document.createElement('strong');
  private readonly degradingHouses = document.createElement('strong');
  private readonly foodStored = document.createElement('strong');
  private readonly granaryStock = document.createElement('strong');
  private readonly marketStock = document.createElement('strong');
  private readonly marketDemand = document.createElement('strong');
  private readonly suppliedMarkets = document.createElement('strong');
  private readonly farms = document.createElement('strong');
  private readonly granaries = document.createElement('strong');
  private readonly markets = document.createElement('strong');
  private readonly foodTiles = document.createElement('strong');
  private readonly population = document.createElement('strong');
  private readonly availableHousing = document.createElement('strong');
  private readonly populationLastChange = document.createElement('strong');
  private readonly workersAvailable = document.createElement('strong');
  private readonly workersRequired = document.createElement('strong');
  private readonly workersAssigned = document.createElement('strong');
  private readonly unemployedWorkers = document.createElement('strong');
  private readonly workerShortage = document.createElement('strong');
  private readonly activeWorkplaces = document.createElement('strong');
  private readonly inactiveWorkplaces = document.createElement('strong');
  private readonly issues = document.createElement('div');
  private readonly issuesMessage = document.createElement('p');
  private readonly issuesList = document.createElement('ol');
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
      button.title = BUILD_TITLES[tool];
      button.setAttribute('aria-pressed', String(tool === this.selectedTool));
      button.addEventListener('click', () => {
        this.selectedTool = tool;
        this.selection.textContent = BUILD_LABELS[tool];
        for (const sibling of tools.children) sibling.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-pressed', 'true');
        this.status.textContent = 'Clique num tile vazio para construir.';
      });
      this.toolButtons.push(button);
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
      this.createStat('Comida total', this.foodStored),
      this.createStat('Granary stock', this.granaryStock),
      this.createStat('Market stock', this.marketStock),
      this.createStat('Market demand', this.marketDemand),
      this.createStat('Supplied markets', this.suppliedMarkets),
      this.createStat('Farms', this.farms),
      this.createStat('Granaries', this.granaries),
      this.createStat('Markets', this.markets),
      this.createStat('Tiles com comida', this.foodTiles),
      this.createStat('População', this.population),
      this.createStat('Available housing', this.availableHousing),
      this.createStat('Growth last tick', this.populationLastChange),
      this.createStat('Trabalhadores disponíveis', this.workersAvailable),
      this.createStat('Trabalhadores necessários', this.workersRequired),
      this.createStat('Trabalhadores atribuídos', this.workersAssigned),
      this.createStat('Desempregados', this.unemployedWorkers),
      this.createStat('Falta de trabalhadores', this.workerShortage),
      this.createStat('Workplaces ativos', this.activeWorkplaces),
      this.createStat('Workplaces inativos', this.inactiveWorkplaces),
    );

    const housingRequirements = document.createElement('div');
    housingRequirements.className = 'housing-requirements';
    const housingRequirementsTitle = document.createElement('h2');
    housingRequirementsTitle.textContent = 'Housing requirements';
    housingRequirements.append(
      housingRequirementsTitle,
      this.createStat('Blocked by road', this.blockedByRoad),
      this.createStat('Blocked by water', this.blockedByWater),
      this.createStat('Blocked by food', this.blockedByFood),
      this.createStat('Degrading', this.degradingHouses),
    );

    const finance = document.createElement('div');
    finance.className = 'finance-stats';
    finance.title = 'Taxes from houses minus upkeep for wells, farms, granaries and markets every 10 ticks.';
    const financeTitle = document.createElement('h2');
    financeTitle.textContent = 'Finance';
    finance.append(
      financeTitle,
      this.createStat('Period', this.financePeriod),
      this.createStat('Taxes', this.financeTaxes),
      this.createStat('Upkeep', this.financeUpkeep),
      this.createStat('Net', this.financeNet),
      this.createStat('Treasury', this.financeTreasury),
      this.createStat('Next balance', this.financeNext),
    );


    this.waterOverlay.type = 'button';
    this.waterOverlay.textContent = 'Show water coverage: Off';
    this.waterOverlay.title = 'Toggle tiles covered by wells.';
    this.waterOverlay.setAttribute('aria-pressed', 'false');
    this.waterOverlay.addEventListener('click', () => {
      const enabled = onWaterOverlayToggle();
      this.setWaterOverlay(enabled);
      this.status.textContent = enabled
        ? 'Water coverage overlay shows tiles served by wells.'
        : 'Water coverage overlay hidden.';
    });

    this.foodOverlay.type = 'button';
    this.foodOverlay.textContent = 'Show food coverage: Off';
    this.foodOverlay.title = 'Toggle tiles covered by active markets.';
    this.foodOverlay.setAttribute('aria-pressed', 'false');
    this.foodOverlay.addEventListener('click', () => {
      const enabled = onFoodOverlayToggle();
      this.setFoodOverlay(enabled);
      this.status.textContent = enabled
        ? 'Food coverage overlay shows active market reach and hungry houses.'
        : 'Food coverage overlay hidden.';
    });

    this.issues.className = 'city-issues';
    this.issues.append('Principais problemas:', this.issuesMessage, this.issuesList);

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Reset';
    reset.title = 'Reset city money, buildings and simulation tick.';
    reset.addEventListener('click', onReset);
    this.status.className = 'build-status';
    this.status.setAttribute('role', 'status');
    this.element.append(
      balance,
      selected,
      tick,
      tools,
      stats,
      housingRequirements,
      finance,
      this.waterOverlay,
      this.foodOverlay,
      this.issues,
      reset,
      this.status,
    );
    host.append(this.element);
  }

  update(city: CityState, message: string, waterOverlay: boolean, foodOverlay: boolean, options: BuildPanelUpdateOptions = {}): void {
    const housingStats = getHousingStats(city);
    const foodStats = getFoodStats(city);
    const workforceStats = getWorkforceStats(city);
    const populationStats = getPopulationStats(city);
    const financeStats = getFinanceStats(city);
    this.money.textContent = String(city.resources.money);
    this.tick.textContent = String(city.simulation.tick);
    this.housesTotal.textContent = String(housingStats.totalHouses);
    this.housesRoad.textContent = String(housingStats.housesWithRoadAccess);
    this.housesWater.textContent = String(housingStats.housesWithWater);
    this.housesFood.textContent = String(housingStats.housesWithFood);
    this.housesLevelTwo.textContent = String(housingStats.levelTwoHouses);
    this.housesLevelThree.textContent = String(housingStats.levelThreeHouses);
    this.waterTiles.textContent = String(housingStats.waterCoveredTiles);
    this.blockedByRoad.textContent = String(housingStats.blockedByRoad);
    this.blockedByWater.textContent = String(housingStats.blockedByWater);
    this.blockedByFood.textContent = String(housingStats.blockedByFood);
    this.degradingHouses.textContent = String(housingStats.degradingHouses);
    this.foodStored.textContent = `${foodStats.foodStored}/${foodStats.foodCapacity}`;
    this.granaryStock.textContent = `${foodStats.granaryFood}/${foodStats.granaryCapacity}`;
    this.marketStock.textContent = `${foodStats.marketFood}/${foodStats.marketCapacity}`;
    this.marketDemand.textContent = String(foodStats.marketDemand);
    this.suppliedMarkets.textContent = `${foodStats.suppliedMarkets}/${foodStats.markets}`;
    this.farms.textContent = String(foodStats.farms);
    this.granaries.textContent = String(foodStats.granaries);
    this.markets.textContent = String(foodStats.markets);
    this.foodTiles.textContent = String(foodStats.foodCoveredTiles);
    this.population.textContent = `${populationStats.population}/${populationStats.capacity}`;
    this.availableHousing.textContent = String(populationStats.availableHousing);
    this.populationLastChange.textContent = formatSignedFinanceValue(populationStats.lastChange);
    this.workersAvailable.textContent = String(workforceStats.workersAvailable);
    this.workersRequired.textContent = String(workforceStats.workersRequired);
    this.workersAssigned.textContent = String(workforceStats.workersAssigned);
    this.unemployedWorkers.textContent = String(workforceStats.unemployedWorkers);
    this.workerShortage.textContent = String(workforceStats.workerShortage);
    this.activeWorkplaces.textContent = String(workforceStats.activeWorkplaces);
    this.inactiveWorkplaces.textContent = String(workforceStats.inactiveWorkplaces);
    this.financePeriod.textContent = String(financeStats.period);
    this.financeTaxes.textContent = `+${financeStats.revenue}`;
    this.financeUpkeep.textContent = financeStats.upkeep === 0 ? '0' : `-${financeStats.upkeep}`;
    this.financeNet.textContent = formatSignedFinanceValue(financeStats.net);
    this.financeTreasury.textContent = String(financeStats.money);
    this.financeNext.textContent = `${financeStats.ticksUntilNextPeriod} ticks`;
    const buildBlocked = options.buildBlocked === true;
    for (const button of this.toolButtons) button.disabled = buildBlocked;
    this.setWaterOverlay(waterOverlay);
    this.setFoodOverlay(foodOverlay);
    const issues = analyzeCity(city).slice(0, 3);
    this.issuesList.replaceChildren();
    if (issues.length === 0) {
      this.issuesMessage.textContent = 'Sem problemas críticos detetados.';
      this.issuesList.hidden = true;
    } else {
      this.issuesMessage.textContent = '';
      this.issuesList.hidden = false;
      for (const issue of issues) {
        const item = document.createElement('li');
        item.textContent = `[${issue.severity}] ${issue.explanation} ${issue.cause}`;
        this.issuesList.append(item);
      }
    }
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
    this.waterOverlay.textContent = `Show water coverage: ${enabled ? 'On' : 'Off'}`;
    this.waterOverlay.setAttribute('aria-pressed', String(enabled));
  }

  private setFoodOverlay(enabled: boolean): void {
    this.foodOverlay.textContent = `Show food coverage: ${enabled ? 'On' : 'Off'}`;
    this.foodOverlay.setAttribute('aria-pressed', String(enabled));
  }
}

function formatSignedFinanceValue(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}`;
}
