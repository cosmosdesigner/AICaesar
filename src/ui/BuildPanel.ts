import { analyzeCity } from '../analysis/CityAnalyzer';
import { BUILD_COSTS, type CityState } from '../simulation/CityState';
import { getDesirabilityStats } from '../simulation/Desirability';
import { getRoadNetworkStats } from '../simulation/RoadNetwork';
import { getFinanceStats, getFoodStats, getHousingStats, getPopulationStats, getWorkforceStats } from '../simulation/Simulation';
import type { BuildingType } from '../simulation/Tile';

export type BuildTool = BuildingType | 'bulldoze';

export const BUILD_LABELS: Readonly<Record<BuildTool, string>> = {
  road: 'Estrada',
  house: 'Casa',
  well: 'Poço',
  farm: 'Quinta',
  granary: 'Celeiro',
  market: 'Mercado',
  garden: 'Jardim',
  plaza: 'Praça',
  fountain: 'Fonte',
  bulldoze: 'Demolir',
};

const BUILD_TITLES: Readonly<Record<BuildTool, string>> = {
  road: 'As estradas ligam edifícios à rede principal. Estradas isoladas não ativam edifícios.',
  house: 'As casas atraem habitantes com ligação à estrada principal, água e comida pela rede.',
  well: 'Poços ligados à rede principal fornecem água num raio de 3 passos de estrada.',
  farm: 'As quintas produzem comida com ligação à rede principal e trabalhadores suficientes.',
  granary: 'Os celeiros armazenam comida com ligação à rede principal e trabalhadores suficientes.',
  market: 'Os mercados ativos abastecem casas próximas pela rede de estradas.',
  garden: 'O jardim melhora a atratividade urbana nas redondezas.',
  plaza: 'A praça melhora a atratividade urbana nas redondezas.',
  fountain: 'A fonte melhora a atratividade urbana nas redondezas.',
  bulldoze: 'Remove um edifício ou estrada sem reembolso.',
};

const BUILD_TOOLS: readonly BuildTool[] = [
  'road', 'house', 'well', 'farm', 'granary', 'market', 'garden', 'plaza', 'fountain', 'bulldoze',
];

export interface BuildPanelUpdateOptions {
  readonly buildBlocked?: boolean;
}


export class BuildPanel {
  selectedTool: BuildTool = 'road';
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
  private readonly mainRoadTiles = document.createElement('strong');
  private readonly connectedBuildings = document.createElement('strong');
  private readonly isolatedBuildings = document.createElement('strong');
  private readonly housesWater = document.createElement('strong');
  private readonly housesFood = document.createElement('strong');
  private readonly housesLevelTwo = document.createElement('strong');
  private readonly housesLevelThree = document.createElement('strong');
  private readonly waterTiles = document.createElement('strong');
  private readonly blockedByRoad = document.createElement('strong');
  private readonly blockedByWater = document.createElement('strong');
  private readonly blockedByFood = document.createElement('strong');
  private readonly degradingHouses = document.createElement('strong');
  private readonly averageDesirability = document.createElement('strong');
  private readonly lowDesirabilityHouses = document.createElement('strong');
  private readonly goodDesirabilityHouses = document.createElement('strong');
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
  private readonly roadNetworkOverlay = document.createElement('button');
  private readonly desirabilityOverlay = document.createElement('button');
  private readonly status = document.createElement('p');
  private readonly tilePreview = document.createElement('p');


  constructor(
    host: HTMLElement,
    onReset: () => void,
    onWaterOverlayToggle: () => boolean,
    onFoodOverlayToggle: () => boolean,
    onDesirabilityOverlayToggle: () => boolean,
    onRoadNetworkOverlayToggle: () => boolean,
    onToolChange: () => void = () => undefined,
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
      button.textContent = tool === 'bulldoze'
        ? BUILD_LABELS[tool]
        : `${BUILD_LABELS[tool]} (${BUILD_COSTS[tool]})`;
      button.title = BUILD_TITLES[tool];
      button.setAttribute('aria-pressed', String(tool === this.selectedTool));
      button.addEventListener('click', () => {
        this.selectedTool = tool;
        this.selection.textContent = BUILD_LABELS[tool];
        for (const sibling of tools.children) sibling.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-pressed', 'true');
        this.status.textContent = tool === 'bulldoze'
          ? 'Clique num edifício ou estrada para demolir.'
          : 'Clique num tile vazio para construir.';
        onToolChange();
      });
      this.toolButtons.push(button);
      tools.append(button);
    }

    const stats = document.createElement('div');
    stats.className = 'build-stats';
    stats.append(
      this.createStat('Rede principal', this.mainRoadTiles),
      this.createStat('Edifícios ligados', this.connectedBuildings),
      this.createStat('Edifícios isolados', this.isolatedBuildings),
      this.createStat('Casas', this.housesTotal),
      this.createStat('Na rede principal', this.housesRoad),
      this.createStat('Com água', this.housesWater),
      this.createStat('Com comida', this.housesFood),
      this.createStat('Nível 2', this.housesLevelTwo),
      this.createStat('Nível 3', this.housesLevelThree),
      this.createStat('Tiles com água', this.waterTiles),
      this.createStat('Comida total', this.foodStored),
      this.createStat('Stock do celeiro', this.granaryStock),
      this.createStat('Stock do mercado', this.marketStock),
      this.createStat('Procura do mercado', this.marketDemand),
      this.createStat('Mercados abastecidos', this.suppliedMarkets),
      this.createStat('Quintas', this.farms),
      this.createStat('Celeiros', this.granaries),
      this.createStat('Mercados', this.markets),
      this.createStat('Tiles com comida', this.foodTiles),
      this.createStat('Atratividade média', this.averageDesirability),
      this.createStat('Casas com baixa atratividade', this.lowDesirabilityHouses),
      this.createStat('Casas com boa atratividade', this.goodDesirabilityHouses),
      this.createStat('População', this.population),
      this.createStat('Habitação disponível', this.availableHousing),
      this.createStat('Variação no último tick', this.populationLastChange),
      this.createStat('Trabalhadores disponíveis', this.workersAvailable),
      this.createStat('Trabalhadores necessários', this.workersRequired),
      this.createStat('Trabalhadores atribuídos', this.workersAssigned),
      this.createStat('Desempregados', this.unemployedWorkers),
      this.createStat('Falta de trabalhadores', this.workerShortage),
      this.createStat('Locais de trabalho ativos', this.activeWorkplaces),
      this.createStat('Locais de trabalho inativos', this.inactiveWorkplaces),
    );

    const housingRequirements = document.createElement('div');
    housingRequirements.className = 'housing-requirements';
    const housingRequirementsTitle = document.createElement('h2');
    housingRequirementsTitle.textContent = 'Requisitos das casas';
    housingRequirements.append(
      housingRequirementsTitle,
      this.createStat('Bloqueadas por estrada', this.blockedByRoad),
      this.createStat('Bloqueadas por água', this.blockedByWater),
      this.createStat('Bloqueadas por comida', this.blockedByFood),
      this.createStat('Em degradação', this.degradingHouses),
    );

    const finance = document.createElement('div');
    finance.className = 'finance-stats';
    finance.title = 'Impostos das casas menos manutenção de poços, quintas, celeiros e mercados a cada 10 ticks.';
    const financeTitle = document.createElement('h2');
    financeTitle.textContent = 'Finanças';
    finance.append(
      financeTitle,
      this.createStat('Período', this.financePeriod),
      this.createStat('Impostos', this.financeTaxes),
      this.createStat('Manutenção', this.financeUpkeep),
      this.createStat('Saldo', this.financeNet),
      this.createStat('Tesouro', this.financeTreasury),
      this.createStat('Próximo balanço', this.financeNext),
    );


    this.waterOverlay.type = 'button';
    this.waterOverlay.textContent = 'Mostrar cobertura de água: não';
    this.waterOverlay.title = 'Mostra estradas alcançadas por poços ligados e edifícios adjacentes.';
    this.waterOverlay.setAttribute('aria-pressed', 'false');
    this.waterOverlay.addEventListener('click', () => {
      const enabled = onWaterOverlayToggle();
      this.setWaterOverlay(enabled);
      this.status.textContent = enabled
        ? 'A cobertura de água mostra estradas principais alcançadas e edifícios adjacentes.'
        : 'Cobertura de água ocultada.';
    });

    this.foodOverlay.type = 'button';
    this.foodOverlay.textContent = 'Mostrar cobertura de comida: não';
    this.foodOverlay.title = 'Mostra o alcance dos mercados ativos com stock.';
    this.foodOverlay.setAttribute('aria-pressed', 'false');
    this.foodOverlay.addEventListener('click', () => {
      const enabled = onFoodOverlayToggle();
      this.setFoodOverlay(enabled);
      this.status.textContent = enabled
        ? 'A cobertura de comida mostra o alcance dos mercados ativos.'
        : 'Cobertura de comida ocultada.';
    });

    this.desirabilityOverlay.type = 'button';
    this.desirabilityOverlay.textContent = 'Mostrar atratividade: não';
    this.desirabilityOverlay.title = 'Mostra a qualidade urbana local: verde é boa, laranja média e vermelho baixa.';
    this.desirabilityOverlay.setAttribute('aria-pressed', 'false');
    this.desirabilityOverlay.addEventListener('click', () => {
      const enabled = onDesirabilityOverlayToggle();
      this.setDesirabilityOverlay(enabled);
      this.status.textContent = enabled
        ? 'Atratividade: verde = boa, laranja = média, vermelho = baixa.'
        : 'Atratividade ocultada.';
    });

    this.roadNetworkOverlay.type = 'button';
    this.roadNetworkOverlay.textContent = 'Mostrar rede de estradas: não';
    this.roadNetworkOverlay.title = 'Estradas verdes pertencem à rede principal; as laranja estão isoladas.';
    this.roadNetworkOverlay.setAttribute('aria-pressed', 'false');
    this.roadNetworkOverlay.addEventListener('click', () => {
      const enabled = onRoadNetworkOverlayToggle();
      this.setRoadNetworkOverlay(enabled);
      this.status.textContent = enabled
        ? 'Rede de estradas: verde = principal, laranja = isolada.'
        : 'Rede de estradas ocultada.';
    });

    this.issues.className = 'city-issues';
    this.issues.append('Principais problemas:', this.issuesMessage, this.issuesList);

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Reiniciar';
    reset.title = 'Reinicia dinheiro, edifícios e tick da simulação.';
    reset.addEventListener('click', onReset);
    this.status.className = 'build-status';
    this.status.setAttribute('role', 'status');
    this.tilePreview.className = 'tile-preview';
    this.tilePreview.setAttribute('role', 'status');
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
      this.desirabilityOverlay,
      this.roadNetworkOverlay,
      this.issues,
      reset,
      this.tilePreview,
      this.status,
    );
    host.append(this.element);
  }

  update(
    city: CityState,
    message: string,
    waterOverlay: boolean,
    foodOverlay: boolean,
    desirabilityOverlay: boolean,
    roadNetworkOverlay: boolean,
    options: BuildPanelUpdateOptions = {},
  ): void {
    const housingStats = getHousingStats(city);
    const foodStats = getFoodStats(city);
    const workforceStats = getWorkforceStats(city);
    const populationStats = getPopulationStats(city);
    const financeStats = getFinanceStats(city);
    const networkStats = getRoadNetworkStats(city);
    const desirabilityStats = getDesirabilityStats(city);
    this.mainRoadTiles.textContent = `${networkStats.mainRoadTiles} tiles`;
    this.connectedBuildings.textContent = `${networkStats.connectedBuildings}/${networkStats.totalBuildings}`;
    this.isolatedBuildings.textContent = String(networkStats.isolatedBuildings);
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
    this.averageDesirability.textContent = String(desirabilityStats.average);
    this.lowDesirabilityHouses.textContent = String(desirabilityStats.housesWithLowDesirability);
    this.goodDesirabilityHouses.textContent = String(desirabilityStats.housesWithGoodDesirability);
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
    this.setDesirabilityOverlay(desirabilityOverlay);
    this.setRoadNetworkOverlay(roadNetworkOverlay);
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

  setPreviewStatus(description: string): void {
    this.tilePreview.textContent = description;
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
    this.waterOverlay.textContent = `Mostrar cobertura de água: ${enabled ? 'sim' : 'não'}`;
    this.waterOverlay.setAttribute('aria-pressed', String(enabled));
  }

  private setFoodOverlay(enabled: boolean): void {
    this.foodOverlay.textContent = `Mostrar cobertura de comida: ${enabled ? 'sim' : 'não'}`;
    this.foodOverlay.setAttribute('aria-pressed', String(enabled));
  }

  private setDesirabilityOverlay(enabled: boolean): void {
    this.desirabilityOverlay.textContent = `Mostrar atratividade: ${enabled ? 'sim' : 'não'}`;
    this.desirabilityOverlay.setAttribute('aria-pressed', String(enabled));
  }

  private setRoadNetworkOverlay(enabled: boolean): void {
    this.roadNetworkOverlay.textContent = `Mostrar rede de estradas: ${enabled ? 'sim' : 'não'}`;
    this.roadNetworkOverlay.setAttribute('aria-pressed', String(enabled));
  }
}

function formatSignedFinanceValue(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}`;
}
