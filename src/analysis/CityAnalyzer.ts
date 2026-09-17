import type { Building, CityState } from '../simulation/CityState';
import {
  getHouseDesirability,
  LOW_DESIRABILITY_THRESHOLD,
} from '../simulation/Desirability';
import {
  getFoodCoveredTiles,
  getFoodStats,
  getHouseServices,
  getHousingStats,
  getWorkforceStats,
} from '../simulation/Simulation';
import { getHouseStatus } from '../simulation/HouseSpecification';
import { getRoadNetwork, isBuildingOnRoadNetwork, type RoadNetwork } from '../simulation/RoadNetwork';
import { getEventSummary, getImperialRequestSummary, type EventSummary } from '../events/Events';

export type CityIssueType =
  | 'water_shortage'
  | 'food_shortage'
  | 'food_production_shortage'
  | 'food_distribution_shortage'
  | 'worker_shortage'
  | 'road_access_missing'
  | 'event_active'
  | 'imperial_request'
  | 'low_desirability'
  | 'low_money';

export type CityIssueSeverity = 'low' | 'medium' | 'high';

export interface CityIssue {
  readonly type: CityIssueType;
  readonly severity: CityIssueSeverity;
  readonly affectedTiles: readonly { readonly x: number; readonly y: number }[];
  readonly explanation: string;
  readonly cause: string;
}

export interface CityStateSummary {
  readonly tick: number;
  readonly money: number;
  readonly houses: number;
  readonly housesWithoutWater: number;
  readonly housesWithoutFood: number;
  readonly foodStored: number;
  readonly foodCapacity: number;
  readonly farms: number;
  readonly markets: number;
  readonly population: number;
  readonly workersAvailable: number;
  readonly workersRequired: number;
  readonly workerShortage: number;
  readonly events?: readonly EventSummary[];
  readonly imperialRequest?: ReturnType<typeof getImperialRequestSummary>;
}

const SEVERITY_ORDER: Readonly<Record<CityIssueSeverity, number>> = {
  high: 0,
  medium: 1,
  low: 2,
};

const ISSUE_TYPE_ORDER: Readonly<Record<CityIssueType, number>> = {
  water_shortage: 0,
  food_shortage: 1,
  food_production_shortage: 2,
  food_distribution_shortage: 3,
  worker_shortage: 4,
  road_access_missing: 5,
  event_active: 6,
  imperial_request: 7,
  low_desirability: 8,
  low_money: 9,
};

export function summarizeCity(city: CityState, network = getRoadNetwork(city)): CityStateSummary {
  const housingStats = getHousingStats(city, network);
  const foodStats = getFoodStats(city, network);
  const workforceStats = getWorkforceStats(city, network);
  const events = getEventSummary(city);
  const imperialRequest = getImperialRequestSummary(city);

  return {
    tick: city.simulation.tick,
    money: city.resources.money,
    houses: housingStats.totalHouses,
    housesWithoutWater: getHousesWithoutWater(city, network).length,
    housesWithoutFood: getHousesWithoutFood(city, network).length,
    foodStored: foodStats.foodStored,
    foodCapacity: foodStats.foodCapacity,
    farms: foodStats.farms,
    markets: foodStats.markets,
    population: workforceStats.population,
    workersAvailable: workforceStats.workersAvailable,
    workersRequired: workforceStats.workersRequired,
    workerShortage: workforceStats.workerShortage,
    events,
    ...(imperialRequest === undefined ? {} : { imperialRequest }),
  };
}

export function analyzeCity(city: CityState): CityIssue[] {
  const network = getRoadNetwork(city);
  const summary = summarizeCity(city, network);
  const foodStats = getFoodStats(city, network);
  const workforceStats = getWorkforceStats(city, network);
  const issues: CityIssue[] = [];

  const housesWithoutWater = getHousesWithoutWater(city, network);
  if (housesWithoutWater.length > 0) {
    issues.push({
      type: 'water_shortage',
      severity: shortageSeverity(housesWithoutWater.length, summary.houses),
      affectedTiles: toTiles(housesWithoutWater),
      explanation: `Falta água em ${housesWithoutWater.length} casa${housesWithoutWater.length === 1 ? '' : 's'}.`,
      cause: 'Nenhum poço ligado está dentro do alcance pela rede de estradas destas casas.',
    });
  }

  const housesWithoutFood = getHousesWithoutFood(city, network);
  const foodExpected = foodStats.markets > 0
    || foodStats.granaries > 0
    || foodStats.farms > 0
    || foodStats.foodStored > 0
    || housesWithoutFood.some((building) => (building.level ?? 1) >= 2);
  if (housesWithoutFood.length > 0 && foodExpected) {
    issues.push({
      type: 'food_shortage',
      severity: shortageSeverity(housesWithoutFood.length, summary.houses),
      affectedTiles: toTiles(housesWithoutFood),
      explanation: `Falta comida em ${housesWithoutFood.length} casa${housesWithoutFood.length === 1 ? '' : 's'}.`,
      cause: 'Casas com estrada e água não recebem comida de um market ativo com stock dentro do alcance pela rede de estradas.',
    });
  }

  const activeFarms = getSortedBuildings(city, 'farm')
    .filter((building) => building.active === true && isBuildingOnRoadNetwork(city, building, network)).length;
  const needsFood = summary.houses > 0 && housesWithoutFood.length > 0 && foodExpected;
  if (needsFood && (activeFarms === 0 || foodStats.granaryCapacity === 0 || foodStats.granaryFood === 0)) {
    const cause = foodStats.granaryCapacity === 0
      ? 'Farms precisam de pelo menos um granary ativo com capacidade antes de abastecer casas.'
      : 'Não há farms ativas suficientes ou produção armazenada em granary para abastecer as casas.';
    issues.push({
      type: 'food_production_shortage',
      severity: activeFarms === 0 ? 'medium' : 'low',
      affectedTiles: toTiles(getSortedBuildings(city, activeFarms === 0 ? 'farm' : 'granary')),
      explanation: 'Produção ou armazenamento de comida insuficiente.',
      cause,
    });
  }

  const foodCoveredTiles = getFoodCoveredTiles(city, network);
  const housesOutsideFoodReach = housesWithoutFood
    .filter((building) => !foodCoveredTiles.has(`${building.x},${building.y}`));
  if (needsFood && foodStats.granaryFood > 0 && housesOutsideFoodReach.length > 0) {
    issues.push({
      type: 'food_distribution_shortage',
      severity: shortageSeverity(housesOutsideFoodReach.length, summary.houses),
      affectedTiles: toTiles(housesOutsideFoodReach),
      explanation: 'Comida armazenada não chega às casas.',
      cause: 'Granary tem comida, mas nenhum market ativo com stock dentro do alcance pela rede de estradas serve estas casas.',
    });
  }

  if (summary.workerShortage > 0) {
    issues.push({
      type: 'worker_shortage',
      severity: workerShortageSeverity(summary.workerShortage, summary.workersRequired),
      affectedTiles: toTiles(getInactiveWorkplaces(city, network)),
      explanation: `Faltam ${summary.workerShortage} trabalhadores.`,
      cause: `${workforceStats.workersRequired} trabalhadores necessários para ${workforceStats.workersAvailable} disponíveis.`,
    });
  }

  const housesWithLowDesirability = getSortedBuildings(city, 'house')
    .filter((building) => getHouseDesirability(city, building).score < LOW_DESIRABILITY_THRESHOLD);
  if (housesWithLowDesirability.length > 0) {
    const breakdowns = housesWithLowDesirability.map((building) => getHouseDesirability(city, building));
    const hasNearbyEconomicBuildings = breakdowns.some((breakdown) => breakdown.negative < 0);
    const hasNearbyAmenities = breakdowns.some((breakdown) => breakdown.positive > 0);
    const causes: string[] = [];
    if (hasNearbyEconomicBuildings) causes.push('Farms, granaries ou markets estão demasiado perto.');
    if (!hasNearbyAmenities) causes.push('Não há gardens, plazas ou fountains próximos para compensar.');
    issues.push({
      type: 'low_desirability',
      severity: shortageSeverity(housesWithLowDesirability.length, summary.houses),
      affectedTiles: toTiles(housesWithLowDesirability),
      explanation: `Desirability baixa em ${housesWithLowDesirability.length} casa${housesWithLowDesirability.length === 1 ? '' : 's'}.`,
      cause: causes.join(' '),
    });
  }

  const eventSummaries = getEventSummary(city);
  for (const event of eventSummaries.filter((candidate) => candidate.status === 'active')) {
    const target = event.targetBuildingId === undefined
      ? undefined
      : city.buildings.find((building) => building.id === event.targetBuildingId);
    issues.push({
      type: 'event_active',
      severity: event.type === 'epidemic' ? 'high' : 'medium',
      affectedTiles: target === undefined ? [] : [{ x: target.x, y: target.y }],
      explanation: `${event.type} active (${event.ticksRemaining} ticks remaining).`,
      cause: event.type === 'drought'
        ? 'Farm production is temporarily reduced.'
        : event.type === 'epidemic'
          ? 'Population growth is temporarily suspended.'
          : target === undefined
            ? 'No workplace was selected by the fire.'
            : `${event.targetBuildingId} is temporarily suppressed.`,
    });
  }

  const imperialRequest = getImperialRequestSummary(city);
  if (imperialRequest?.status === 'pending') {
    issues.push({
      type: 'imperial_request',
      severity: imperialRequest.ticksRemaining <= 3 ? 'high' : 'medium',
      affectedTiles: [],
      explanation: `Imperial request: deliver ${imperialRequest.requestedFood} food by tick ${imperialRequest.dueTick}.`,
      cause: imperialRequest.foodStock >= imperialRequest.requestedFood
        ? `${imperialRequest.foodStock} food is available; reward is +${imperialRequest.rewardMoney} money.`
        : `Only ${imperialRequest.foodStock} food is available; failure costs ${imperialRequest.failurePenalty} money.`,
    });
  }

  const buildingsWithoutRoad = getSortedBuildings(city)
    .filter((building) => building.type !== 'road' && !isBuildingOnRoadNetwork(city, building, network));
  if (buildingsWithoutRoad.length > 0) {
    issues.push({
      type: 'road_access_missing',
      severity: buildingsWithoutRoad.length >= 3 ? 'medium' : 'low',
      affectedTiles: toTiles(buildingsWithoutRoad),
      explanation: `${buildingsWithoutRoad.length} edifício${buildingsWithoutRoad.length === 1 ? '' : 's'} sem ligação à rede principal de estradas.`,
      cause: getRoadAccessCause(buildingsWithoutRoad, network),
    });
  }

  if (summary.money < 100) {
    issues.push({
      type: 'low_money',
      severity: summary.money < 20 ? 'high' : summary.money < 50 ? 'medium' : 'low',
      affectedTiles: [],
      explanation: 'Dinheiro baixo.',
      cause: `Saldo atual: ${summary.money}.`,
    });
  }

  return issues.sort(compareIssues);
}

function getHousesWithoutWater(city: CityState, network: RoadNetwork): Building[] {
  return getSortedBuildings(city, 'house')
    .filter((building) => {
      const status = getHouseStatus(building.level, getHouseServices(city, building, network));
      return status.missingForCurrentLevel === 'water' || status.missingForNextLevel === 'water';
    });
}

function getHousesWithoutFood(city: CityState, network: RoadNetwork): Building[] {
  return getSortedBuildings(city, 'house')
    .filter((building) => {
      const status = getHouseStatus(building.level, getHouseServices(city, building, network));
      return status.missingForCurrentLevel === 'food' || status.missingForNextLevel === 'food';
    });
}

function getInactiveWorkplaces(city: CityState, network: RoadNetwork): Building[] {
  return getSortedBuildings(city)
    .filter((building) => isEconomicBuilding(building)
      && (building.active !== true || !isBuildingOnRoadNetwork(city, building, network)));
}

function getSortedBuildings(city: CityState, type?: Building['type']): Building[] {
  return city.buildings
    .filter((building) => type === undefined || building.type === type)
    .sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
}

function getRoadAccessCause(buildings: readonly Building[], network: RoadNetwork): string {
  let withoutAdjacentRoad = 0;
  let besideIsolatedRoad = 0;
  for (const building of buildings) {
    if (network.roadTiles.has(`${building.x},${building.y - 1}`)
      || network.roadTiles.has(`${building.x + 1},${building.y}`)
      || network.roadTiles.has(`${building.x},${building.y + 1}`)
      || network.roadTiles.has(`${building.x - 1},${building.y}`)) {
      besideIsolatedRoad += 1;
    } else {
      withoutAdjacentRoad += 1;
    }
  }

  const causes: string[] = [];
  if (withoutAdjacentRoad > 0) {
    causes.push(`${withoutAdjacentRoad} edifício${withoutAdjacentRoad === 1 ? '' : 's'} sem estrada adjacente.`);
  }
  if (besideIsolatedRoad > 0) {
    causes.push(`${besideIsolatedRoad} edifício${besideIsolatedRoad === 1 ? '' : 's'} junto a estrada isolada, sem ligação à rede principal.`);
  }
  return causes.join(' ');
}

function shortageSeverity(shortage: number, total: number): CityIssueSeverity {
  if (total > 0 && shortage / total > 0.5) return 'high';
  if (shortage >= 2) return 'medium';
  return 'low';
}

function workerShortageSeverity(shortage: number, required: number): CityIssueSeverity {
  if (required > 0 && shortage / required >= 0.5) return 'high';
  if (required > 0 && shortage / required >= 0.25) return 'medium';
  return 'low';
}

function compareIssues(a: CityIssue, b: CityIssue): number {
  return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    || ISSUE_TYPE_ORDER[a.type] - ISSUE_TYPE_ORDER[b.type]
    || b.affectedTiles.length - a.affectedTiles.length;
}

function toTiles(buildings: readonly Building[]): readonly { readonly x: number; readonly y: number }[] {
  return buildings.map((building) => ({ x: building.x, y: building.y }));
}

function isEconomicBuilding(building: Building): boolean {
  return building.type === 'farm' || building.type === 'granary' || building.type === 'market';
}
