import type { Building, CityState } from './CityState';

export const DESIRABILITY_BASE_SCORE = 50;
export const LOW_DESIRABILITY_THRESHOLD = 40;
export const GOOD_DESIRABILITY_THRESHOLD = 60;

export type DesirabilityTier = 'low' | 'medium' | 'good';

export interface DesirabilityBreakdown {
  readonly score: number;
  readonly positive: number;
  readonly negative: number;
}

export interface DesirabilityStats {
  readonly average: number;
  readonly housesWithLowDesirability: number;
  readonly housesWithGoodDesirability: number;
}

interface DesirabilityModifier {
  readonly value: number;
  readonly radius: number;
}

const DESIRABILITY_MODIFIERS: Readonly<Partial<Record<Building['type'], DesirabilityModifier>>> = {
  garden: { value: 8, radius: 2 },
  plaza: { value: 12, radius: 3 },
  fountain: { value: 15, radius: 3 },
  farm: { value: -10, radius: 3 },
  granary: { value: -12, radius: 3 },
  market: { value: -6, radius: 2 },
};

export function getTileDesirability(city: CityState, x: number, y: number): DesirabilityBreakdown {
  let positive = 0;
  let negative = 0;

  for (const building of city.buildings) {
    const modifier = DESIRABILITY_MODIFIERS[building.type];
    if (modifier === undefined || Math.abs(x - building.x) + Math.abs(y - building.y) > modifier.radius) continue;
    if (modifier.value > 0) positive += modifier.value;
    else negative += modifier.value;
  }

  return {
    score: Math.max(0, Math.min(100, DESIRABILITY_BASE_SCORE + positive + negative)),
    positive,
    negative,
  };
}

export function getHouseDesirability(city: CityState, house: Building): DesirabilityBreakdown {
  return getTileDesirability(city, house.x, house.y);
}

export function getDesirabilityOverlayTiles(city: CityState): Map<string, DesirabilityBreakdown> {
  return new Map(city.tiles.map((tile) => [
    `${tile.x},${tile.y}`,
    getTileDesirability(city, tile.x, tile.y),
  ]));
}

export function getDesirabilityStats(city: CityState): DesirabilityStats {
  const houses = city.buildings.filter((building) => building.type === 'house');
  if (houses.length === 0) {
    return { average: 0, housesWithLowDesirability: 0, housesWithGoodDesirability: 0 };
  }

  let totalScore = 0;
  let housesWithLowDesirability = 0;
  let housesWithGoodDesirability = 0;
  for (const house of houses) {
    const score = getHouseDesirability(city, house).score;
    totalScore += score;
    if (score < LOW_DESIRABILITY_THRESHOLD) housesWithLowDesirability += 1;
    if (score >= GOOD_DESIRABILITY_THRESHOLD) housesWithGoodDesirability += 1;
  }

  return {
    average: Math.round(totalScore / houses.length),
    housesWithLowDesirability,
    housesWithGoodDesirability,
  };
}

export function getDesirabilityTier(score: number): DesirabilityTier {
  if (score < LOW_DESIRABILITY_THRESHOLD) return 'low';
  if (score >= GOOD_DESIRABILITY_THRESHOLD) return 'good';
  return 'medium';
}
