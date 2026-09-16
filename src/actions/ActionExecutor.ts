import type { AdvisorPlan } from '../advisor/MockAdvisor';
import { placeBuilding, type CityState } from '../simulation/CityState';
import { assignWorkers } from '../simulation/Simulation';
import { getBuildingTypeForAction, validatePlan, type PlanValidationResult } from './ActionValidator';

export type { PlanValidationResult } from './ActionValidator';
export { validatePlan } from './ActionValidator';

export type PlanExecutionResult =
  | {
      readonly ok: true;
      readonly executedActions: number;
      readonly spent: number;
      readonly message: string;
    }
  | {
      readonly ok: false;
      readonly errors: readonly string[];
      readonly message: string;
    };

export function executePlan(city: CityState, plan: AdvisorPlan, approvedBudget: number): PlanExecutionResult {
  const validation: PlanValidationResult = validatePlan(city, plan, approvedBudget);
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      message: `Plan rejected: ${validation.errors.join(' ')}`,
    };
  }

  let executedActions = 0;

  for (const [index, action] of plan.actions.entries()) {
    if (action.type === 'wait') continue;

    const buildingType = getBuildingTypeForAction(action.type);
    const target = action.target;
    if (buildingType === undefined || target === undefined) {
      return unexpectedFailure(index, `Action ${index + 1} became invalid during execution.`);
    }

    const result = placeBuilding(city, target.x, target.y, buildingType);
    if (result !== 'built') {
      return unexpectedFailure(index, `Action ${index + 1} failed during execution: ${result}.`);
    }

    executedActions += 1;
  }

  if (executedActions > 0) assignWorkers(city);

  return {
    ok: true,
    executedActions,
    spent: validation.estimatedCost,
    message: `Plan executed: ${executedActions} build action(s), spent ${validation.estimatedCost}.`,
  };
}

function unexpectedFailure(index: number, error: string): PlanExecutionResult {
  return {
    ok: false,
    errors: [error],
    message: `Plan execution failed at action ${index + 1}: ${error}`,
  };
}
