import type { CityIssue, CityStateSummary } from '../analysis/CityAnalyzer';
import type { ScenarioProgress } from '../scenario/Scenario';
import type { AdvisorAction, AdvisorActionType, AdvisorAlternative, AdvisorPlan } from './MockAdvisor';

export interface AdvisorProvider {
  readonly name: string;
  createPlan(input: AdvisorProviderInput): Promise<AdvisorProviderResult>;
}

export interface AdvisorProviderInput {
  readonly summary: CityStateSummary;
  readonly issues: readonly CityIssue[];
  readonly scenario?: ScenarioProgress;
  readonly availableTargets?: readonly { readonly x: number; readonly y: number }[];
}

export type AdvisorProviderResult =
  | { readonly ok: true; readonly plan: AdvisorPlan; readonly provider: string }
  | { readonly ok: false; readonly error: string; readonly provider: string };

export type AdvisorPlanShapeValidationResult =
  | { readonly ok: true; readonly plan: AdvisorPlan }
  | { readonly ok: false; readonly error: string };

const ALLOWED_ACTION_TYPES: Readonly<Record<AdvisorActionType, true>> = {
  build_road: true,
  build_well: true,
  build_farm: true,
  build_granary: true,
  build_market: true,
  build_house: true,
  wait: true,
};

export function validateAdvisorPlanShape(value: unknown): AdvisorPlanShapeValidationResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, error: 'Plan must be a JSON object.' };
  }

  const plan = value as {
    readonly summary?: unknown;
    readonly reasoning?: unknown;
    readonly actions?: unknown;
    readonly estimatedCost?: unknown;
    readonly expectedImpact?: unknown;
    readonly risks?: unknown;
    readonly strategicGoal?: unknown;
    readonly recommendedBudget?: unknown;
    readonly alternatives?: unknown;
    readonly successCriteria?: unknown;
  };
  const {
    summary,
    reasoning,
    actions: rawActions,
    estimatedCost,
    expectedImpact,
    risks,
    strategicGoal,
    recommendedBudget,
    alternatives,
    successCriteria,
  } = plan;
  if (typeof summary !== 'string' || summary.length === 0) {
    return { ok: false, error: 'Plan summary must be a non-empty string.' };
  }
  if (!isStringArray(reasoning)) {
    return { ok: false, error: 'Plan reasoning must be an array of strings.' };
  }
  if (!Array.isArray(rawActions)) {
    return { ok: false, error: 'Plan actions must be an array.' };
  }

  const actions: AdvisorAction[] = [];
  for (const [index, action] of rawActions.entries()) {
    const parsed = parseAdvisorAction(action, index + 1);
    if (!parsed.ok) return parsed;
    actions.push(parsed.action);
  }

  if (typeof estimatedCost !== 'number' || !Number.isFinite(estimatedCost)) {
    return { ok: false, error: 'Plan estimatedCost must be a finite number.' };
  }
  const calculatedCost = actions.reduce((total, action) => total + action.estimatedCost, 0);
  if (estimatedCost !== calculatedCost) {
    return { ok: false, error: 'Plan estimatedCost must equal the sum of action estimatedCost values.' };
  }
  if (!isStringArray(expectedImpact)) {
    return { ok: false, error: 'Plan expectedImpact must be an array of strings.' };
  }
  if (!isStringArray(risks)) {
    return { ok: false, error: 'Plan risks must be an array of strings.' };
  }
  if (strategicGoal !== undefined && (typeof strategicGoal !== 'string' || strategicGoal.length === 0)) {
    return { ok: false, error: 'Plan strategicGoal must be a non-empty string when present.' };
  }
  if (recommendedBudget !== undefined && (
    typeof recommendedBudget !== 'number'
    || !Number.isInteger(recommendedBudget)
    || recommendedBudget < 0
    || recommendedBudget < estimatedCost
  )) {
    return { ok: false, error: 'Plan recommendedBudget must be a non-negative integer not lower than estimatedCost.' };
  }

  const parsedAlternatives = parseAlternatives(alternatives);
  if (!parsedAlternatives.ok) return parsedAlternatives;
  if (successCriteria !== undefined && !isStringArray(successCriteria)) {
    return { ok: false, error: 'Plan successCriteria must be an array of strings when present.' };
  }

  return {
    ok: true,
    plan: {
      summary,
      reasoning,
      actions,
      estimatedCost,
      expectedImpact,
      risks,
      ...(strategicGoal === undefined ? {} : { strategicGoal }),
      ...(recommendedBudget === undefined ? {} : { recommendedBudget }),
      ...(parsedAlternatives.alternatives === undefined ? {} : { alternatives: parsedAlternatives.alternatives }),
      ...(successCriteria === undefined ? {} : { successCriteria }),
    },
  };
}

type ActionShapeValidationResult =
  | { readonly ok: true; readonly action: AdvisorAction }
  | { readonly ok: false; readonly error: string };

function parseAdvisorAction(value: unknown, actionNumber: number): ActionShapeValidationResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, error: `Action ${actionNumber} must be a JSON object.` };
  }

  const action = value as {
    readonly type?: unknown;
    readonly label?: unknown;
    readonly reason?: unknown;
    readonly estimatedCost?: unknown;
    readonly target?: unknown;
  };
  const { type, label, reason, estimatedCost, target } = action;
  if (!isAdvisorActionType(type)) {
    return { ok: false, error: `Action ${actionNumber} type is not allowed.` };
  }
  if (typeof label !== 'string' || label.length === 0) {
    return { ok: false, error: `Action ${actionNumber} label must be a non-empty string.` };
  }
  if (typeof reason !== 'string' || reason.length === 0) {
    return { ok: false, error: `Action ${actionNumber} reason must be a non-empty string.` };
  }
  if (typeof estimatedCost !== 'number' || !Number.isFinite(estimatedCost)) {
    return { ok: false, error: `Action ${actionNumber} estimatedCost must be a finite number.` };
  }
  if (target === undefined) {
    return { ok: true, action: { type, label, reason, estimatedCost } };
  }
  if (typeof target !== 'object' || target === null || Array.isArray(target)) {
    return { ok: false, error: `Action ${actionNumber} target must be an object when present.` };
  }

  const point = target as { readonly x?: unknown; readonly y?: unknown };
  const { x, y } = point;
  if (typeof x !== 'number' || !Number.isFinite(x) || typeof y !== 'number' || !Number.isFinite(y)) {
    return { ok: false, error: `Action ${actionNumber} target x/y must be finite numbers.` };
  }
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return { ok: false, error: `Action ${actionNumber} target x/y must be integers.` };
  }
  return { ok: true, action: { type, label, reason, estimatedCost, target: { x, y } } };
}

type AlternativesShapeValidationResult =
  | { readonly ok: true; readonly alternatives?: readonly AdvisorAlternative[] }
  | { readonly ok: false; readonly error: string };

function parseAlternatives(rawValue: unknown): AlternativesShapeValidationResult {
  if (rawValue === undefined) return { ok: true };
  if (!Array.isArray(rawValue)) return { ok: false, error: 'Plan alternatives must be an array when present.' };

  const alternatives: AdvisorAlternative[] = [];
  for (const [index, alternativeValue] of rawValue.entries()) {
    if (typeof alternativeValue !== 'object' || alternativeValue === null || Array.isArray(alternativeValue)) {
      return { ok: false, error: `Alternative ${index + 1} must be a JSON object.` };
    }
    const alternative = alternativeValue as { readonly label?: unknown; readonly summary?: unknown; readonly tradeOffs?: unknown };
    if (typeof alternative.label !== 'string' || alternative.label.length === 0) {
      return { ok: false, error: `Alternative ${index + 1} label must be a non-empty string.` };
    }
    if (typeof alternative.summary !== 'string' || alternative.summary.length === 0) {
      return { ok: false, error: `Alternative ${index + 1} summary must be a non-empty string.` };
    }
    if (!isStringArray(alternative.tradeOffs)) {
      return { ok: false, error: `Alternative ${index + 1} tradeOffs must be an array of strings.` };
    }
    alternatives.push({ label: alternative.label, summary: alternative.summary, tradeOffs: alternative.tradeOffs });
  }
  return { ok: true, alternatives };
}

function isAdvisorActionType(value: unknown): value is AdvisorActionType {
  return typeof value === 'string' && value in ALLOWED_ACTION_TYPES;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
