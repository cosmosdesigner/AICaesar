import { analyzeCity, type CityIssue } from '../analysis/CityAnalyzer';
import type { CityState } from '../simulation/CityState';
import { getFoodStats, getHousingStats, getWorkforceStats } from '../simulation/Simulation';
import type { AdvisorPlan } from './MockAdvisor';

export interface CityMetricsSnapshot {
  readonly money: number;
  readonly foodStored: number;
  readonly foodCapacity: number;
  readonly houses: number;
  readonly housesWithWater: number;
  readonly housesWithFood: number;
  readonly levelTwoHouses: number;
  readonly levelThreeHouses: number;
  readonly population: number;
  readonly workersAvailable: number;
  readonly workersRequired: number;
  readonly workerShortage: number;
  readonly activeWorkplaces: number;
  readonly inactiveWorkplaces: number;
  readonly issueCount: number;
  readonly highSeverityIssues: number;
}

export interface MetricDelta {
  readonly label: string;
  readonly before: number;
  readonly after: number;
  readonly delta: number;
}

export interface AdvisorPromise {
  readonly strategicGoal?: string;
  readonly expectedImpact: readonly string[];
  readonly successCriteria: readonly string[];
  readonly estimatedCost: number;
}

export interface AfterActionReport {
  readonly summary: string;
  readonly executedActions: number;
  readonly spent: number;
  readonly deltas: readonly MetricDelta[];
  readonly remainingIssues: readonly string[];
  readonly promise: AdvisorPromise;
  readonly futureEffects: readonly string[];
}

interface AfterActionReportInput {
  readonly before: CityMetricsSnapshot;
  readonly after: CityMetricsSnapshot;
  readonly plan: AdvisorPlan;
  readonly executedActions: number;
  readonly spent: number;
  readonly remainingIssues: readonly CityIssue[];
}

const DELTA_FIELDS: readonly {
  readonly key: keyof CityMetricsSnapshot;
  readonly label: string;
}[] = [
  { key: 'money', label: 'Money' },
  { key: 'foodStored', label: 'Food stored' },
  { key: 'housesWithWater', label: 'Houses with water' },
  { key: 'housesWithFood', label: 'Houses with food' },
  { key: 'population', label: 'Population' },
  { key: 'workersAvailable', label: 'Workers available' },
  { key: 'workerShortage', label: 'Worker shortage' },
  { key: 'activeWorkplaces', label: 'Active workplaces' },
  { key: 'inactiveWorkplaces', label: 'Inactive workplaces' },
  { key: 'issueCount', label: 'Issue count' },
  { key: 'highSeverityIssues', label: 'High severity issues' },
];

export function createCityMetricsSnapshot(city: CityState): CityMetricsSnapshot {
  const housingStats = getHousingStats(city);
  const foodStats = getFoodStats(city);
  const workforceStats = getWorkforceStats(city);
  const issues = analyzeCity(city);

  return {
    money: city.resources.money,
    foodStored: foodStats.foodStored,
    foodCapacity: foodStats.foodCapacity,
    houses: housingStats.totalHouses,
    housesWithWater: housingStats.housesWithWater,
    housesWithFood: housingStats.housesWithFood,
    levelTwoHouses: housingStats.levelTwoHouses,
    levelThreeHouses: housingStats.levelThreeHouses,
    population: workforceStats.population,
    workersAvailable: workforceStats.workersAvailable,
    workersRequired: workforceStats.workersRequired,
    workerShortage: workforceStats.workerShortage,
    activeWorkplaces: workforceStats.activeWorkplaces,
    inactiveWorkplaces: workforceStats.inactiveWorkplaces,
    issueCount: issues.length,
    highSeverityIssues: issues.filter((issue) => issue.severity === 'high').length,
  };
}

export function createAfterActionReport(input: AfterActionReportInput): AfterActionReport {
  const futureEffects = input.plan.actions.some((action) => (
    action.type === 'build_house'
    || action.type === 'build_farm'
    || action.type === 'build_granary'
    || action.type === 'build_market'
  ))
    ? ['Immigration, food production, distribution, and house evolution are observed only on future simulation ticks.']
    : [];
  return {
    summary: input.executedActions === 0
      ? 'No build actions executed. City observed.'
      : `Executed ${input.executedActions} action${input.executedActions === 1 ? '' : 's'}, spent ${input.spent}.`,
    executedActions: input.executedActions,
    spent: input.spent,
    deltas: createDeltas(input.before, input.after),
    remainingIssues: input.remainingIssues
      .slice(0, 3)
      .map((issue) => `[${issue.severity}] ${issue.explanation}`),
    promise: {
      ...(input.plan.strategicGoal === undefined ? {} : { strategicGoal: input.plan.strategicGoal }),
      expectedImpact: input.plan.expectedImpact,
      successCriteria: input.plan.successCriteria ?? [],
      estimatedCost: input.plan.estimatedCost,
    },
    futureEffects,
  };
}

function createDeltas(before: CityMetricsSnapshot, after: CityMetricsSnapshot): readonly MetricDelta[] {
  return DELTA_FIELDS.flatMap(({ key, label }) => {
    const beforeValue = before[key];
    const afterValue = after[key];
    if (beforeValue === afterValue) return [];
    return [{ label, before: beforeValue, after: afterValue, delta: afterValue - beforeValue }];
  });
}
