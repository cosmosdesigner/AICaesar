import type { CityIssue, CityStateSummary } from '../analysis/CityAnalyzer';
import type { AdvisorAction, AdvisorActionType, AdvisorPlan } from './MockAdvisor';

export interface AdvisorProvider {
  readonly name: string;
  createPlan(input: AdvisorProviderInput): Promise<AdvisorProviderResult>;
}

export interface AdvisorProviderInput {
  readonly summary: CityStateSummary;
  readonly issues: readonly CityIssue[];
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
  };
  const { summary, reasoning, actions: rawActions, estimatedCost, expectedImpact, risks } = plan;
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

  return { ok: true, plan: { summary, reasoning, actions, estimatedCost, expectedImpact, risks } };
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

  return { ok: true, action: { type, label, reason, estimatedCost, target: { x, y } } };
}

function isAdvisorActionType(value: unknown): value is AdvisorActionType {
  return typeof value === 'string' && value in ALLOWED_ACTION_TYPES;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
