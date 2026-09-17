import { analyzeCity, summarizeCity, type CityIssue, type CityStateSummary } from '../analysis/CityAnalyzer';
import { evaluateScenario, formatScenarioValue, type ScenarioObjective, type ScenarioProgress } from '../scenario/Scenario';
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

export interface AdvisorAlternative {
  readonly label: string;
  readonly summary: string;
  readonly tradeOffs: readonly string[];
}

export interface AdvisorPlan {
  readonly summary: string;
  readonly reasoning: readonly string[];
  readonly actions: readonly AdvisorAction[];
  readonly estimatedCost: number;
  readonly expectedImpact: readonly string[];
  readonly risks: readonly string[];
  readonly strategicGoal?: string;
  readonly recommendedBudget?: number;
  readonly alternatives?: readonly AdvisorAlternative[];
  readonly successCriteria?: readonly string[];
}

export interface MockAdvisorContext {
  readonly scenario?: ScenarioProgress;
  readonly availableTargets?: readonly { readonly x: number; readonly y: number }[];
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

const MIN_BUILD_COST = Math.min(...Object.values(ACTION_BUILDING_TYPE).map((type) => BUILD_COSTS[type]));

export function createAdvisorPlan(city: CityState): AdvisorPlan {
  return createMockAdvisorPlan(summarizeCity(city), analyzeCity(city), {
    scenario: evaluateScenario(city),
    availableTargets: getAvailableAdvisorTargets(city),
  });
}

export function getAvailableAdvisorTargets(city: CityState): readonly { readonly x: number; readonly y: number }[] {
  return city.tiles
    .filter((tile) => tile.buildingId === undefined)
    .map(({ x, y }) => ({ x, y }));
}

export function createMockAdvisorPlan(
  summary: CityStateSummary,
  issues: readonly CityIssue[],
  context: MockAdvisorContext = {},
): AdvisorPlan {
  if (context.scenario?.status !== undefined && context.scenario.status !== 'active') {
    return createStrategicPlan({
      summary: 'Scenario has ended. No advisor actions can be approved.',
      reasoning: [context.scenario.resultMessage ?? 'The scenario is no longer active.'],
      actions: [createWaitAction('Approval is blocked until the scenario is reset.')],
      expectedImpact: ['Preserve the terminal city state.'],
      risks: ['No advisor action can be approved after victory or defeat.'],
      strategicGoal: 'Keep the completed scenario state unchanged.',
      alternatives: [{
        label: 'Reset the scenario',
        summary: 'Start a new settlement before requesting another advisor plan.',
        tradeOffs: ['Reset replaces the current city state.'],
      }],
      successCriteria: ['Scenario is active before approving another plan.'],
    });
  }

  const primaryIssue = selectStrategicIssue(issues, context.scenario);
  const objective = selectScenarioObjective(context.scenario, primaryIssue);
  const strategicGoal = objective
    ? `Advance ${objective.label} from ${formatScenarioValue(objective.current, objective.unit)} toward ${formatScenarioValue(objective.target, objective.unit)}.`
    : primaryIssue
      ? `Resolve ${primaryIssue.explanation}`
      : 'Preserve a stable settlement while future ticks advance remaining objectives.';

  if (summary.money < MIN_BUILD_COST) {
    return createStrategicPlan({
      summary: 'Treasury is too low for a safe expansion.',
      reasoning: [
        strategicGoal,
        `Available money ${summary.money} is below the cheapest supported build cost ${MIN_BUILD_COST}.`,
      ],
      actions: [createWaitAction('Preserve the remaining treasury and observe future ticks.')],
      expectedImpact: ['Avoid spending while the city cannot fund a supported build.'],
      risks: ['Issues and incomplete objectives may persist until the treasury recovers.'],
      strategicGoal,
      alternatives: [createObserveAlternative()],
      successCriteria: objective ? [objectiveSuccessCriterion(objective)] : ['Retain enough money for a safe future build.'],
    });
  }

  if (primaryIssue === undefined) {
    const actions = objective?.id === 'population'
      ? createBuildActions(summary, context.availableTargets, undefined, ['build_house'])
      : [];
    return createStrategicPlan({
      summary: actions.length === 0
        ? 'City is stable. No immediate safe build is needed.'
        : 'City is stable, but a small expansion supports the remaining scenario objective.',
      reasoning: [
        strategicGoal,
        'The deterministic analyzer returned no issues requiring an immediate correction.',
        `City snapshot: ${summary.houses} houses, ${summary.population} population, ${summary.money} money.`,
      ],
      actions: actions.length === 0 ? [createWaitAction('Observe more ticks before spending money.')] : actions,
      expectedImpact: actions.length === 0
        ? ['Observe more ticks before spending money.']
        : ['Add future housing capacity; population arrives only on future simulation ticks.'],
      risks: actions.length === 0
        ? ['No relevant risk while the city remains stable.']
        : ['A newly built house is empty until services and future ticks allow immigration.'],
      strategicGoal,
      alternatives: [createObserveAlternative()],
      successCriteria: objective ? [objectiveSuccessCriterion(objective)] : ['Keep the city stable.'],
    });
  }

  const actions = createActionsForIssue(summary, primaryIssue, context.availableTargets);
  const safeActions = actions.length === 0
    ? [createWaitAction('No free target is available for a safe supported build.')]
    : actions;
  return createStrategicPlan({
    summary: `Strategic priority: ${primaryIssue.explanation}`,
    reasoning: [
      strategicGoal,
      primaryIssue.cause,
      `Severity: ${primaryIssue.severity}. Affected tiles: ${primaryIssue.affectedTiles.length}.`,
      `City snapshot: ${summary.houses} houses, ${summary.foodStored}/${summary.foodCapacity} food, ${summary.workersAvailable}/${summary.workersRequired} workers, ${summary.money} money.`,
    ],
    actions: safeActions,
    expectedImpact: expectedImpactFor(primaryIssue, safeActions),
    risks: risksFor(safeActions),
    strategicGoal,
    alternatives: [createAlternative(primaryIssue)],
    successCriteria: objective ? [objectiveSuccessCriterion(objective)] : [issueSuccessCriterion(primaryIssue)],
  });
}

export function selectStrategicIssue(issues: readonly CityIssue[], scenario: ScenarioProgress | undefined): CityIssue | undefined {
  const incomplete = new Set(scenario?.objectives.filter((objective) => !objective.completed).map((objective) => objective.id));
  return issues.find((issue) => (
    (incomplete.has('food-coverage') && isFoodIssue(issue))
    || (incomplete.has('water-coverage') && issue.type === 'water_shortage')
    || (incomplete.has('worker-shortage') && issue.type === 'worker_shortage')
    || (incomplete.has('population') && issue.type === 'worker_shortage')
  )) ?? issues[0];
}

function selectScenarioObjective(scenario: ScenarioProgress | undefined, issue: CityIssue | undefined): ScenarioObjective | undefined {
  const incomplete = scenario?.objectives.filter((objective) => !objective.completed) ?? [];
  if (issue === undefined) return incomplete[0];
  return incomplete.find((objective) => (
    (objective.id === 'food-coverage' && isFoodIssue(issue))
    || (objective.id === 'water-coverage' && issue.type === 'water_shortage')
    || (objective.id === 'worker-shortage' && issue.type === 'worker_shortage')
    || (objective.id === 'population' && issue.type === 'worker_shortage')
  )) ?? incomplete[0];
}

function createActionsForIssue(
  summary: CityStateSummary,
  issue: CityIssue,
  availableTargets: readonly { readonly x: number; readonly y: number }[] | undefined,
): readonly AdvisorAction[] {
  switch (issue.type) {
    case 'water_shortage':
      return createBuildActions(summary, availableTargets, issue.affectedTiles[0], ['build_well']);
    case 'food_shortage':
    case 'food_production_shortage':
      return createBuildActions(summary, availableTargets, issue.affectedTiles[0], foodActionTypes(summary, issue));
    case 'food_distribution_shortage':
      return createBuildActions(summary, availableTargets, issue.affectedTiles[0], ['build_market']);
    case 'worker_shortage':
      return createBuildActions(summary, availableTargets, issue.affectedTiles[0], ['build_house']);
    case 'road_access_missing':
      return createBuildActions(summary, availableTargets, issue.affectedTiles[0], ['build_road']);
    case 'event_active':
      return [createWaitAction(`React to the active event before expanding: ${issue.cause}`)];
    case 'imperial_request':
      return [createWaitAction('Review the imperial request and fulfil it from the event panel when enough food is available.')];
    case 'low_desirability':
      return [createWaitAction('Improve local urban quality manually with gardens, plazas or fountains.')];
    case 'low_money':
      return [createWaitAction('Preserve money until future city revenue can fund a safe supported build.')];
  }
}

function foodActionTypes(summary: CityStateSummary, issue: CityIssue): readonly BuildAdvisorActionType[] {
  const actions: BuildAdvisorActionType[] = [];
  if (summary.foodCapacity === 0) actions.push('build_granary');
  if (summary.farms === 0 || issue.type === 'food_production_shortage') actions.push('build_farm');
  if (summary.markets === 0 && issue.type === 'food_shortage') actions.push('build_market');
  return actions.length > 0 ? actions : ['build_market'];
}

function createBuildActions(
  summary: CityStateSummary,
  availableTargets: readonly { readonly x: number; readonly y: number }[] | undefined,
  origin: { readonly x: number; readonly y: number } | undefined,
  types: readonly BuildAdvisorActionType[],
): readonly AdvisorAction[] {
  if (availableTargets === undefined) return [];

  const reservedTargets = new Set<string>();
  const actions: AdvisorAction[] = [];
  let remainingBudget = summary.money;
  for (const type of types) {
    const cost = BUILD_COSTS[ACTION_BUILDING_TYPE[type]];
    const target = getAvailableTarget(availableTargets, origin, reservedTargets);
    if (target === undefined || cost > remainingBudget) continue;
    actions.push(createBuildAction(type, buildReason(type), target));
    reservedTargets.add(targetKey(target));
    remainingBudget -= cost;
  }
  return actions;
}

function getAvailableTarget(
  candidates: readonly { readonly x: number; readonly y: number }[],
  origin: { readonly x: number; readonly y: number } | undefined,
  reservedTargets: ReadonlySet<string>,
): { readonly x: number; readonly y: number } | undefined {
  return candidates
    .filter((candidate) => !reservedTargets.has(targetKey(candidate)))
    .sort((a, b) => distanceTo(a, origin) - distanceTo(b, origin) || a.y - b.y || a.x - b.x)[0];
}

function buildReason(type: BuildAdvisorActionType): string {
  switch (type) {
    case 'build_well': return 'Restore water coverage near the affected houses.';
    case 'build_road': return 'Add road access near the affected economic building.';
    case 'build_farm': return 'Increase food production once workers and road access allow it.';
    case 'build_granary': return 'Add food storage capacity before scaling food supply.';
    case 'build_market': return 'Distribute stored or produced food to nearby houses.';
    case 'build_house': return 'Add housing capacity for future population and workers.';
  }
}

function createBuildAction(
  type: BuildAdvisorActionType,
  reason: string,
  target: { readonly x: number; readonly y: number },
): AdvisorAction {
  return {
    type,
    label: ACTION_LABELS[type],
    reason,
    target,
    estimatedCost: BUILD_COSTS[ACTION_BUILDING_TYPE[type]],
  };
}

function createWaitAction(reason: string): AdvisorAction {
  return { type: 'wait', label: ACTION_LABELS.wait, reason, estimatedCost: 0 };
}

function createStrategicPlan(input: Omit<AdvisorPlan, 'estimatedCost' | 'recommendedBudget'>): AdvisorPlan {
  const estimatedCost = input.actions.reduce((total, action) => total + action.estimatedCost, 0);
  return { ...input, estimatedCost, recommendedBudget: estimatedCost };
}

function expectedImpactFor(issue: CityIssue, actions: readonly AdvisorAction[]): readonly string[] {
  const types = new Set(actions.map((action) => action.type));
  const impact: string[] = [];
  if (types.has('build_well')) impact.push('Increase water coverage for nearby houses.');
  if (types.has('build_granary')) impact.push('Increase food storage capacity for future production.');
  if (types.has('build_farm')) impact.push('Increase food production once workers and road access allow it.');
  if (types.has('build_market')) impact.push('Increase food distribution coverage for nearby houses.');
  if (types.has('build_house')) impact.push('Increase population and available workers after houses are serviced.');
  if (types.has('build_road')) impact.push('Improve road access for the affected building.');
  if (types.has('wait')) {
    impact.push(issue.type === 'low_money'
      ? 'Avoid spending until future city revenue can recover money safely.'
      : 'Observe more ticks before taking another action.');
  }
  return impact;
}

function risksFor(actions: readonly AdvisorAction[]): readonly string[] {
  if (actions.every((action) => action.type === 'wait')) {
    return ['Issues may persist because no safe supported build is available now.'];
  }
  return [
    'Each target is distinct and free in this city snapshot.',
    'Plans are validated again for occupancy, affordability, exact costs, and map limits before execution.',
    'Benefits such as immigration, production, and house evolution may require future ticks.',
  ];
}

function createAlternative(issue: CityIssue): AdvisorAlternative {
  return {
    label: 'Observe before expanding',
    summary: `Wait for more simulation information instead of immediately addressing ${issue.type.replaceAll('_', ' ')}.`,
    tradeOffs: ['Preserves money now.', 'Delays progress toward the affected scenario objective.'],
  };
}

function createObserveAlternative(): AdvisorAlternative {
  return {
    label: 'Wait and observe',
    summary: 'Spend nothing and re-evaluate after future simulation ticks.',
    tradeOffs: ['Preserves the treasury.', 'Does not immediately advance incomplete objectives.'],
  };
}

function objectiveSuccessCriterion(objective: ScenarioObjective): string {
  return `${objective.label} reaches ${formatScenarioValue(objective.target, objective.unit)} (currently ${formatScenarioValue(objective.current, objective.unit)}).`;
}

function issueSuccessCriterion(issue: CityIssue): string {
  return `The ${issue.type.replaceAll('_', ' ')} issue is no longer reported after execution and future ticks.`;
}

function isFoodIssue(issue: CityIssue): boolean {
  return issue.type === 'food_shortage' || issue.type === 'food_production_shortage' || issue.type === 'food_distribution_shortage';
}

function distanceTo(candidate: { readonly x: number; readonly y: number }, origin: { readonly x: number; readonly y: number } | undefined): number {
  return origin === undefined ? 0 : Math.abs(candidate.x - origin.x) + Math.abs(candidate.y - origin.y);
}

function targetKey(target: { readonly x: number; readonly y: number }): string {
  return `${target.x},${target.y}`;
}
