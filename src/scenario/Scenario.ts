import type { CityState } from '../simulation/CityState';
import { getHousingStats, getWorkforceStats } from '../simulation/Simulation';

export type ScenarioStatus = 'active' | 'won' | 'lost';
export type ScenarioObjectiveId = 'population' | 'water-coverage' | 'food-coverage' | 'worker-shortage' | 'money';

type ObjectiveDirection = 'at-least' | 'at-most';

export interface ScenarioObjectiveDefinition {
  readonly id: ScenarioObjectiveId;
  readonly label: string;
  readonly target: number;
  readonly direction: ObjectiveDirection;
  readonly unit?: 'percent';
}

export interface ScenarioDefinition {
  readonly id: string;
  readonly title: string;
  readonly briefing: string;
  readonly maxTicks: number;
  readonly loseBelowMoney: number;
  readonly objectives: readonly ScenarioObjectiveDefinition[];
}

export interface ScenarioObjective {
  readonly id: ScenarioObjectiveId;
  readonly label: string;
  readonly current: number;
  readonly target: number;
  readonly completed: boolean;
  readonly unit?: 'percent';
}

export interface ScenarioProgress {
  readonly status: ScenarioStatus;
  readonly objectives: readonly ScenarioObjective[];
  readonly completedObjectives: number;
  readonly totalObjectives: number;
  readonly currentTick: number;
  readonly maxTicks: number;
  readonly resultMessage?: string;
}

const OBJECTIVES: readonly ScenarioObjectiveDefinition[] = Object.freeze([
  Object.freeze({ id: 'population', label: 'Population', target: 80, direction: 'at-least' }),
  Object.freeze({ id: 'water-coverage', label: 'Water coverage', target: 70, direction: 'at-least', unit: 'percent' }),
  Object.freeze({ id: 'food-coverage', label: 'Food coverage', target: 50, direction: 'at-least', unit: 'percent' }),
  Object.freeze({ id: 'worker-shortage', label: 'Worker shortage', target: 20, direction: 'at-most', unit: 'percent' }),
  Object.freeze({ id: 'money', label: 'Money', target: 100, direction: 'at-least' }),
]);

export const FOUNDING_SETTLEMENT_SCENARIO: ScenarioDefinition = Object.freeze({
  id: 'founding-settlement',
  title: 'Found a functioning settlement',
  briefing: 'Build a stable settlement. Expand housing, keep basic services running, and prove that the city can support its population.',
  maxTicks: 900,
  loseBelowMoney: 50,
  objectives: OBJECTIVES,
});

export function evaluateScenario(
  city: CityState,
  definition: ScenarioDefinition = FOUNDING_SETTLEMENT_SCENARIO,
): ScenarioProgress {
  const housing = getHousingStats(city);
  const workforce = getWorkforceStats(city);
  const objectiveValues: Readonly<Record<ScenarioObjectiveId, number>> = {
    population: workforce.population,
    'water-coverage': percentage(housing.housesWithWater, housing.totalHouses),
    'food-coverage': percentage(housing.housesWithFood, housing.totalHouses),
    'worker-shortage': workforce.workersRequired === 0
      ? 0
      : percentage(workforce.workerShortage, workforce.workersRequired),
    money: city.resources.money,
  };

  const objectives = definition.objectives.map((objective) => {
    const current = objectiveValues[objective.id];
    const completed = objective.direction === 'at-most'
      ? current <= objective.target
      : current >= objective.target;
    return optionalUnit({
      id: objective.id,
      label: objective.label,
      current,
      target: objective.target,
      completed,
    }, objective.unit);
  });

  const completedObjectives = objectives.filter((objective) => objective.completed).length;
  const won = completedObjectives === objectives.length;
  const lostByMoney = city.resources.money < definition.loseBelowMoney;
  const lostByTimeout = city.simulation.tick >= definition.maxTicks;
  const status: ScenarioStatus = won ? 'won' : lostByMoney || lostByTimeout ? 'lost' : 'active';
  const resultMessage = getResultMessage(status, definition, lostByMoney);

  return optionalResultMessage({
    status,
    objectives,
    completedObjectives,
    totalObjectives: objectives.length,
    currentTick: city.simulation.tick,
    maxTicks: definition.maxTicks,
  }, resultMessage);
}

export function getScenarioContext(progress: ScenarioProgress): string {
  const prefix = `Scenario progress: ${progress.completedObjectives}/${progress.totalObjectives} objectives complete.`;
  const remaining = progress.objectives.find((objective) => !objective.completed);
  if (remaining === undefined) return `${prefix} All objectives complete.`;

  return `${prefix} Primary remaining objective: ${remaining.label} ${formatScenarioValue(remaining.current, remaining.unit)}/${formatScenarioValue(remaining.target, remaining.unit)}.`;
}

export function formatScenarioValue(value: number, unit?: ScenarioObjective['unit']): string {
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return unit === 'percent' ? `${rounded}%` : rounded;
}

function percentage(part: number, total: number): number {
  return total === 0 ? 0 : (part / total) * 100;
}

function getResultMessage(
  status: ScenarioStatus,
  definition: ScenarioDefinition,
  lostByMoney: boolean,
): string | undefined {
  if (status === 'won') return 'Victory: the settlement is stable and self-supporting.';
  if (status !== 'lost') return undefined;
  if (lostByMoney) return `Defeat: the settlement treasury fell below ${definition.loseBelowMoney}.`;
  return `Defeat: the settlement failed to meet its goals before tick ${definition.maxTicks}.`;
}

function optionalUnit(objective: Omit<ScenarioObjective, 'unit'>, unit: ScenarioObjective['unit']): ScenarioObjective {
  return unit === undefined ? objective : { ...objective, unit };
}

function optionalResultMessage(
  progress: Omit<ScenarioProgress, 'resultMessage'>,
  resultMessage: string | undefined,
): ScenarioProgress {
  return resultMessage === undefined ? progress : { ...progress, resultMessage };
}
