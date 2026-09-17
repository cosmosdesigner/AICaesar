import type { AdvisorPlan } from '../advisor/MockAdvisor';
import { BUILD_COSTS, getTile, type CityState } from '../simulation/CityState';
import type { BuildingType } from '../simulation/Tile';

export type PlanValidationResult =
  | { readonly ok: true; readonly estimatedCost: number }
  | { readonly ok: false; readonly errors: readonly string[] };

const BUILD_ACTION_TO_TYPE = {
  build_road: 'road',
  build_well: 'well',
  build_farm: 'farm',
  build_granary: 'granary',
  build_market: 'market',
  build_house: 'house',
} as const satisfies Readonly<Record<string, BuildingType>>;

export function getBuildingTypeForAction(type: string): BuildingType | undefined {
  if (type === 'build_road') return BUILD_ACTION_TO_TYPE.build_road;
  if (type === 'build_well') return BUILD_ACTION_TO_TYPE.build_well;
  if (type === 'build_farm') return BUILD_ACTION_TO_TYPE.build_farm;
  if (type === 'build_granary') return BUILD_ACTION_TO_TYPE.build_granary;
  if (type === 'build_market') return BUILD_ACTION_TO_TYPE.build_market;
  if (type === 'build_house') return BUILD_ACTION_TO_TYPE.build_house;
  return undefined;
}

export function validatePlan(city: CityState, plan: AdvisorPlan, approvedBudget: number): PlanValidationResult {
  const errors: string[] = [];
  let calculatedCost = 0;
  const reservedTiles = new Set<string>();


  if (!Number.isInteger(approvedBudget) || approvedBudget < 0) {
    errors.push('Approved budget must be a non-negative integer.');
  }

  if (plan.recommendedBudget !== undefined && (
    !Number.isInteger(plan.recommendedBudget)
    || plan.recommendedBudget < 0
    || plan.recommendedBudget < plan.estimatedCost
  )) {
    errors.push('Plan recommended budget must be a non-negative integer not lower than its estimated cost.');
  }
  if (plan.actions.length === 0) {
    errors.push('Plan must contain at least one action.');
  }

  for (const [index, action] of plan.actions.entries()) {
    const actionNumber = index + 1;

    if (action.type === 'wait') {
      if (action.estimatedCost !== 0) {
        errors.push(`Action ${actionNumber} wait cost must be 0.`);
      }
      continue;
    }

    const buildingType = getBuildingTypeForAction(action.type);
    if (buildingType === undefined) {
      errors.push(`Action ${actionNumber} has unsupported type: ${String(action.type)}.`);
      continue;
    }

    const expectedCost = BUILD_COSTS[buildingType];
    calculatedCost += expectedCost;
    if (action.estimatedCost !== expectedCost) {
      errors.push(`Action ${actionNumber} cost ${action.estimatedCost} does not match ${buildingType} cost ${expectedCost}.`);
    }

    if (action.target === undefined) {
      errors.push(`Action ${actionNumber} requires a target.`);
      continue;
    }

    const tile = getTile(city, action.target.x, action.target.y);
    if (tile === undefined) {
      errors.push(`Action ${actionNumber} target (${action.target.x}, ${action.target.y}) is outside the map.`);
      continue;
    }

    const targetKey = `${action.target.x},${action.target.y}`;
    if (tile.buildingId !== undefined || reservedTiles.has(targetKey)) {
      errors.push(`Action ${actionNumber} target (${action.target.x}, ${action.target.y}) is occupied.`);
      continue;
    }

    reservedTiles.add(targetKey);
  }

  if (calculatedCost !== plan.estimatedCost) {
    errors.push(`Plan estimated cost ${plan.estimatedCost} does not match calculated cost ${calculatedCost}.`);
  }

  if (plan.estimatedCost > approvedBudget) {
    errors.push(`Plan estimated cost ${plan.estimatedCost} exceeds approved budget ${approvedBudget}.`);
  }

  if (plan.estimatedCost > city.resources.money) {
    errors.push(`Plan estimated cost ${plan.estimatedCost} exceeds available money ${city.resources.money}.`);
  }

  return errors.length === 0
    ? { ok: true, estimatedCost: calculatedCost }
    : { ok: false, errors };
}
