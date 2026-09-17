import { executePlan } from '../actions/ActionExecutor';
import { analyzeCity } from '../analysis/CityAnalyzer';
import type { CityState } from '../simulation/CityState';
import type { AdvisorPlan } from './MockAdvisor';
import { createAfterActionReport, createCityMetricsSnapshot, type AfterActionReport } from './AfterActionReport';

export interface AdvisorApprovalResult {
  readonly ok: boolean;
  readonly message: string;
  readonly report?: AfterActionReport;
}

export function approveAdvisorPlan(city: CityState, plan: AdvisorPlan): AdvisorApprovalResult {
  const before = createCityMetricsSnapshot(city);
  const result = executePlan(city, plan, plan.recommendedBudget ?? plan.estimatedCost);

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  const after = createCityMetricsSnapshot(city);
  return {
    ok: true,
    message: result.message,
    report: createAfterActionReport({
      before,
      after,
      plan,
      executedActions: result.executedActions,
      spent: result.spent,
      remainingIssues: analyzeCity(city),
    }),
  };
}
