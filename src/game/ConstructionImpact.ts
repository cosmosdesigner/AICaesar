import { analyzeCity } from '../analysis/CityAnalyzer';
import { getDesirabilityStats } from '../simulation/Desirability';
import { BUILD_COSTS, placeBuilding, type CityState } from '../simulation/CityState';
import { getRoadNetworkStats } from '../simulation/RoadNetwork';
import {
  getFoodStats,
  getHousingStats,
  getPopulationStats,
  recalculateDerivedState,
} from '../simulation/Simulation';
import type { BuildingType } from '../simulation/Tile';

export interface ConstructionImpact {
  readonly cost: number;
  readonly moneyAfter: number;
  readonly benefit: string;
  readonly risk: string;
}

interface ImpactSnapshot {
  readonly connectedBuildings: number;
  readonly housesWithFood: number;
  readonly housesWithRoadAccess: number;
  readonly housesWithWater: number;
  readonly foodCapacity: number;
  readonly housingCapacity: number;
  readonly goodDesirabilityHouses: number;
  readonly averageDesirability: number;
}

/**
 * Projects a valid build onto a deep copy of the city. The source city, including
 * its derived fields, remains unchanged while the preview moves across the map.
 */
export function getConstructionImpact(
  city: CityState,
  tile: { readonly x: number; readonly y: number },
  type: BuildingType,
): ConstructionImpact | null {
  const baseline = structuredClone(city);
  recalculateDerivedState(baseline);
  const before = getImpactSnapshot(baseline);
  const projected = structuredClone(baseline);
  if (placeBuilding(projected, tile.x, tile.y, type) !== 'built') return null;
  recalculateDerivedState(projected);
  const after = getImpactSnapshot(projected);

  return {
    cost: BUILD_COSTS[type],
    moneyAfter: projected.resources.money,
    benefit: describeBenefit(before, after, type),
    risk: describeRisk(projected),
  };
}

export function describeConstructionImpact(impact: ConstructionImpact | null): string {
  if (impact === null) return '';
  return `Custo: ${impact.cost}. Tesouro depois: ${impact.moneyAfter}. Benefício: ${impact.benefit} Risco: ${impact.risk}`;
}

function getImpactSnapshot(city: CityState): ImpactSnapshot {
  const housing = getHousingStats(city);
  const food = getFoodStats(city);
  const population = getPopulationStats(city);
  const network = getRoadNetworkStats(city);
  const desirability = getDesirabilityStats(city);
  return {
    connectedBuildings: network.connectedBuildings,
    housesWithFood: housing.housesWithFood,
    housesWithRoadAccess: housing.housesWithRoadAccess,
    housesWithWater: housing.housesWithWater,
    foodCapacity: food.foodCapacity,
    housingCapacity: population.capacity,
    goodDesirabilityHouses: desirability.housesWithGoodDesirability,
    averageDesirability: desirability.average,
  };
}

function describeBenefit(before: ImpactSnapshot, after: ImpactSnapshot, type: BuildingType): string {
  const waterHouses = after.housesWithWater - before.housesWithWater;
  if (waterHouses > 0) return `Dá água a ${formatCount(waterHouses, 'casa')}.`;

  const roadHouses = after.housesWithRoadAccess - before.housesWithRoadAccess;
  if (roadHouses > 0) return `Liga ${formatCount(roadHouses, 'casa')} à rede principal.`;

  const foodHouses = after.housesWithFood - before.housesWithFood;
  if (foodHouses > 0) return `Leva comida a ${formatCount(foodHouses, 'casa')}.`;

  const foodCapacity = after.foodCapacity - before.foodCapacity;
  if (foodCapacity > 0) return `Acrescenta ${foodCapacity} de capacidade de comida.`;

  const housingCapacity = after.housingCapacity - before.housingCapacity;
  if (housingCapacity > 0) return `Acrescenta ${housingCapacity} lugares de habitação.`;

  const connectedBuildings = after.connectedBuildings - before.connectedBuildings;
  if (connectedBuildings > 0) return `Liga ${formatCount(connectedBuildings, 'edifício')} à rede principal.`;

  const goodDesirabilityHouses = after.goodDesirabilityHouses - before.goodDesirabilityHouses;
  if (goodDesirabilityHouses > 0) return `Melhora a atratividade de ${formatCount(goodDesirabilityHouses, 'casa')}.`;

  const desirability = after.averageDesirability - before.averageDesirability;
  if (desirability > 0) return `Melhora a atratividade média em ${desirability}.`;

  return describeDeferredBenefit(type);
}

function describeDeferredBenefit(type: BuildingType): string {
  switch (type) {
    case 'farm': return 'Adiciona uma quinta; precisa de estrada e trabalhadores para produzir.';
    case 'granary': return 'Adiciona um celeiro; precisa de estrada e trabalhadores para armazenar comida.';
    case 'market': return 'Adiciona um mercado; precisa de estrada, trabalhadores e stock para servir casas.';
    case 'road': return 'Adiciona uma estrada, mas ainda não altera a rede principal.';
    case 'house': return 'Adiciona uma casa, mas ainda não cria capacidade de habitação relevante.';
    case 'well': return 'Adiciona um poço, mas ainda não alcança casas pela rede principal.';
    case 'garden': return 'Adiciona um jardim, sem efeito imediato mensurável nas casas.';
    case 'plaza': return 'Adiciona uma praça, sem efeito imediato mensurável nas casas.';
    case 'fountain': return 'Adiciona uma fonte, sem efeito imediato mensurável nas casas.';
  }
}

function describeRisk(city: CityState): string {
  const issue = analyzeCity(city)[0];
  return issue === undefined
    ? 'Não há problema crítico previsto.'
    : `${issue.explanation} ${issue.cause}`;
}

function formatCount(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
