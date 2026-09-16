import type { Building, CityState } from '../simulation/CityState';
import {
  getFoodCoveredTiles,
  getFoodStats,
  getHouseServices,
  getHousingStats,
  getWorkforceStats,
  hasAdjacentRoad,
} from '../simulation/Simulation';
import { getHouseStatus } from '../simulation/HouseSpecification';

export type CityIssueType =
  | 'water_shortage'
  | 'food_shortage'
  | 'food_production_shortage'
  | 'food_distribution_shortage'
  | 'worker_shortage'
  | 'road_access_missing'
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
  low_money: 6,
};

export function summarizeCity(city: CityState): CityStateSummary {
  const housingStats = getHousingStats(city);
  const foodStats = getFoodStats(city);
  const workforceStats = getWorkforceStats(city);

  return {
    tick: city.simulation.tick,
    money: city.resources.money,
    houses: housingStats.totalHouses,
    housesWithoutWater: getHousesWithoutWater(city).length,
    housesWithoutFood: getHousesWithoutFood(city).length,
    foodStored: foodStats.foodStored,
    foodCapacity: foodStats.foodCapacity,
    farms: foodStats.farms,
    markets: foodStats.markets,
    population: workforceStats.population,
    workersAvailable: workforceStats.workersAvailable,
    workersRequired: workforceStats.workersRequired,
    workerShortage: workforceStats.workerShortage,
  };
}

export function analyzeCity(city: CityState): CityIssue[] {
  const summary = summarizeCity(city);
  const foodStats = getFoodStats(city);
  const workforceStats = getWorkforceStats(city);
  const issues: CityIssue[] = [];

  const housesWithoutWater = getHousesWithoutWater(city);
  if (housesWithoutWater.length > 0) {
    issues.push({
      type: 'water_shortage',
      severity: shortageSeverity(housesWithoutWater.length, summary.houses),
      affectedTiles: toTiles(housesWithoutWater),
      explanation: `Falta água em ${housesWithoutWater.length} casa${housesWithoutWater.length === 1 ? '' : 's'}.`,
      cause: 'Casas com estrada ficam fora do raio de poços existentes.',
    });
  }

  const housesWithoutFood = getHousesWithoutFood(city);
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
      cause: 'Casas com estrada e água ainda não recebem comida.',
    });
  }

  const activeFarms = countBuildings(city, 'farm', true);
  if (summary.houses > 0 && ((foodStats.markets > 0 && activeFarms === 0)
    || (foodStats.foodStored === 0 && housesWithoutFood.length > 0 && foodExpected))) {
    issues.push({
      type: 'food_production_shortage',
      severity: foodStats.markets > 0 && activeFarms === 0 ? 'medium' : 'low',
      affectedTiles: toTiles(getSortedBuildings(city, 'farm')),
      explanation: 'Produção de comida insuficiente.',
      cause: 'Não há farms ativas suficientes para abastecer as casas.',
    });
  }

  const foodCoveredTiles = getFoodCoveredTiles(city).size;
  if (foodStats.foodStored > 0 && housesWithoutFood.length > 0 && foodCoveredTiles === 0) {
    issues.push({
      type: 'food_distribution_shortage',
      severity: shortageSeverity(housesWithoutFood.length, summary.houses),
      affectedTiles: toTiles(housesWithoutFood),
      explanation: 'Comida armazenada não chega às casas.',
      cause: 'Não há markets ativos com cobertura de comida.',
    });
  }

  if (summary.workerShortage > 0) {
    issues.push({
      type: 'worker_shortage',
      severity: workerShortageSeverity(summary.workerShortage, summary.workersRequired),
      affectedTiles: toTiles(getInactiveWorkplaces(city)),
      explanation: `Faltam ${summary.workerShortage} trabalhadores.`,
      cause: `${workforceStats.workersRequired} trabalhadores necessários para ${workforceStats.workersAvailable} disponíveis.`,
    });
  }

  const buildingsWithoutRoad = getSortedBuildings(city)
    .filter((building) => isEconomicBuilding(building) && !hasAdjacentRoad(city, building));
  if (buildingsWithoutRoad.length > 0) {
    issues.push({
      type: 'road_access_missing',
      severity: buildingsWithoutRoad.length >= 3 ? 'medium' : 'low',
      affectedTiles: toTiles(buildingsWithoutRoad),
      explanation: `${buildingsWithoutRoad.length} edifício${buildingsWithoutRoad.length === 1 ? '' : 's'} económico${buildingsWithoutRoad.length === 1 ? '' : 's'} sem estrada.`,
      cause: 'Farms, granaries e markets precisam de estrada adjacente para orientação futura.',
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

function getHousesWithoutWater(city: CityState): Building[] {
  return getSortedBuildings(city, 'house')
    .filter((building) => {
      const status = getHouseStatus(building.level, getHouseServices(city, building));
      return status.missingForCurrentLevel === 'water' || status.missingForNextLevel === 'water';
    });
}

function getHousesWithoutFood(city: CityState): Building[] {
  return getSortedBuildings(city, 'house')
    .filter((building) => {
      const status = getHouseStatus(building.level, getHouseServices(city, building));
      return status.missingForCurrentLevel === 'food' || status.missingForNextLevel === 'food';
    });
}

function getInactiveWorkplaces(city: CityState): Building[] {
  return getSortedBuildings(city)
    .filter((building) => isEconomicBuilding(building) && building.active !== true);
}

function getSortedBuildings(city: CityState, type?: Building['type']): Building[] {
  return city.buildings
    .filter((building) => type === undefined || building.type === type)
    .sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
}

function countBuildings(city: CityState, type: Building['type'], activeOnly = false): number {
  return city.buildings.reduce((total, building) => (
    total + (building.type === type && (!activeOnly || building.active === true) ? 1 : 0)
  ), 0);
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
