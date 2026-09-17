import { analyzeCity, summarizeCity, type CityIssue, type CityStateSummary } from '../analysis/CityAnalyzer';
import { BUILD_COSTS, type CityState } from '../simulation/CityState';
import type { BuildingType } from '../simulation/Tile';

export type AdvisorActionType =
  | 'build_road'
  | 'build_well'
  | 'build_farm'
  | 'build_granary'
  | 'build_market'
  | 'build_house'
  | 'wait';

export interface AdvisorAction {
  readonly type: AdvisorActionType;
  readonly label: string;
  readonly reason: string;
  readonly target?: { readonly x: number; readonly y: number };
  readonly estimatedCost: number;
}

export interface AdvisorPlan {
  readonly summary: string;
  readonly reasoning: readonly string[];
  readonly actions: readonly AdvisorAction[];
  readonly estimatedCost: number;
  readonly expectedImpact: readonly string[];
  readonly risks: readonly string[];
}

type BuildAdvisorActionType = Exclude<AdvisorActionType, 'wait'>;

const ACTION_BUILDING_TYPE: Readonly<Record<BuildAdvisorActionType, BuildingType>> = {
  build_road: 'road',
  build_well: 'well',
  build_farm: 'farm',
  build_granary: 'granary',
  build_market: 'market',
  build_house: 'house',
};

const ACTION_LABELS: Readonly<Record<AdvisorActionType, string>> = {
  build_road: 'Build road',
  build_well: 'Build well',
  build_farm: 'Build farm',
  build_granary: 'Build granary',
  build_market: 'Build market',
  build_house: 'Build house',
  wait: 'Wait and observe',
};

export function createAdvisorPlan(city: CityState): AdvisorPlan {
  return createMockAdvisorPlan(summarizeCity(city), analyzeCity(city));
}

export function createMockAdvisorPlan(summary: CityStateSummary, issues: readonly CityIssue[]): AdvisorPlan {
  const primaryIssue = issues[0];

  if (!primaryIssue) {
    const actions = [createWaitAction('A cidade não tem problemas críticos; observar mais ticks é a ação mais segura.')];
    return createPlan({
      summary: 'City is stable. No critical issues detected.',
      reasoning: [
        `Tick ${summary.tick}: ${summary.houses} houses, ${summary.population} population, ${summary.money} money.`,
        'The deterministic analyzer returned no issues.',
      ],
      actions,
      expectedImpact: ['Observe more ticks before spending money.'],
      risks: ['No relevant risk while the city remains stable.'],
    });
  }

  const action = createActionForIssue(summary, primaryIssue);
  return createPlan({
    summary: `Primary issue: ${primaryIssue.explanation}`,
    reasoning: [
      primaryIssue.cause,
      `Severity: ${primaryIssue.severity}. Affected tiles: ${primaryIssue.affectedTiles.length}.`,
      `City snapshot: ${summary.houses} houses, ${summary.foodStored}/${summary.foodCapacity} food, ${summary.workersAvailable}/${summary.workersRequired} workers, ${summary.money} money.`,
    ],
    actions: [action],
    expectedImpact: expectedImpactFor(primaryIssue, action),
    risks: risksFor(primaryIssue, action),
  });
}

function createActionForIssue(summary: CityStateSummary, issue: CityIssue): AdvisorAction {
  switch (issue.type) {
    case 'water_shortage':
      return createBuildAction(
        'build_well',
        'Place a deterministic mock well near the first affected house.',
        getAdjacentTarget(issue.affectedTiles[0]),
      );
    case 'food_shortage':
    case 'food_production_shortage':
      return createFoodAction(summary, issue);
    case 'food_distribution_shortage':
      return createBuildAction(
        'build_market',
        'Stored food exists, but houses need market coverage.',
        getAdjacentTarget(issue.affectedTiles[0]),
      );
    case 'worker_shortage':
      return createBuildAction(
        'build_house',
        'More houses increase population and available workers.',
        getAdjacentTarget(issue.affectedTiles[0]),
      );
    case 'road_access_missing':
      return createBuildAction(
        'build_road',
        'Add road access near the first affected economic building.',
        getAdjacentTarget(issue.affectedTiles[0]),
      );
    case 'event_active':
      return createWaitAction(`React to the active event before expanding: ${issue.cause}`);
    case 'imperial_request':
      return createWaitAction('Review the imperial request and fulfil it from the event panel when enough food is available.');
    case 'low_desirability':
      return createWaitAction('Improve local urban quality manually with gardens, plazas or fountains.');
    case 'low_money':
      return createWaitAction('Money economy is not implemented enough for a safe automatic action.');
  }
}

function createFoodAction(summary: CityStateSummary, issue: CityIssue): AdvisorAction {
  const target = getAdjacentTarget(issue.affectedTiles[0]);

  if (summary.foodCapacity === 0) {
    return createBuildAction('build_granary', 'Add storage capacity before scaling food supply.', target);
  }

  if (summary.farms === 0 || issue.type === 'food_production_shortage') {
    return createBuildAction('build_farm', 'Increase deterministic food production for covered houses.', target);
  }

  return createBuildAction('build_market', 'Distribute stored or produced food to houses.', target);
}

function createBuildAction(
  type: BuildAdvisorActionType,
  reason: string,
  target: { readonly x: number; readonly y: number } | undefined,
): AdvisorAction {
  const base = {
    type,
    label: ACTION_LABELS[type],
    reason,
    estimatedCost: BUILD_COSTS[ACTION_BUILDING_TYPE[type]],
  };

  return target ? { ...base, target } : base;
}

function createWaitAction(reason: string): AdvisorAction {
  return {
    type: 'wait',
    label: ACTION_LABELS.wait,
    reason,
    estimatedCost: 0,
  };
}

function createPlan(input: Omit<AdvisorPlan, 'estimatedCost'>): AdvisorPlan {
  return {
    ...input,
    estimatedCost: input.actions.reduce((total, action) => total + action.estimatedCost, 0),
  };
}

function getAdjacentTarget(
  origin: { readonly x: number; readonly y: number } | undefined,
): { readonly x: number; readonly y: number } | undefined {
  if (!origin) return undefined;

  const candidates = [
    { x: origin.x + 1, y: origin.y },
    { x: origin.x - 1, y: origin.y },
    { x: origin.x, y: origin.y + 1 },
    { x: origin.x, y: origin.y - 1 },
  ];

  return candidates.find((candidate) => candidate.x >= 0 && candidate.y >= 0)
    ?? (origin.x >= 0 && origin.y >= 0 ? origin : undefined);
}

function expectedImpactFor(issue: CityIssue, action: AdvisorAction): readonly string[] {
  switch (action.type) {
    case 'build_well':
      return ['Increase water coverage for nearby houses.'];
    case 'build_granary':
      return ['Increase food storage capacity for future production.'];
    case 'build_farm':
      return ['Increase food production once workers and road access allow it.'];
    case 'build_market':
      return ['Increase food distribution coverage for nearby houses.'];
    case 'build_house':
      return ['Increase population and available workers after houses are serviced.'];
    case 'build_road':
      return ['Improve road access for the affected building.'];
    case 'wait':
      return issue.type === 'low_money'
        ? ['Avoid spending until a future economy system can recover money safely.']
        : ['Observe more ticks before taking action.'];
  }
}

function risksFor(issue: CityIssue, action: AdvisorAction): readonly string[] {
  if (action.type === 'wait') {
    return issue.type === 'low_money'
      ? ['Problems may persist because no safe money recovery action exists yet.']
      : ['No relevant risk while observing a stable city.'];
  }

  return [
    'Provider plans are validated again for occupancy, access, affordability, and exact costs before execution.',
    'Approve never executes advisor text directly; it only submits structured actions to the ActionExecutor.',
  ];
}
