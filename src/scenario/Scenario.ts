import type { CityState } from '../simulation/CityState';
import type { BuildingType } from '../simulation/Tile';
import { getHousingStats, getWorkforceStats } from '../simulation/Simulation';

export type ScenarioId = 'founding-settlement' | 'merchant-quarter' | 'resilient-province';
export type DifficultyId = 'easy' | 'normal';
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

export interface ScenarioSeedBuilding {
  readonly type: BuildingType;
  readonly x: number;
  readonly y: number;
  readonly initialPopulation?: number;
}

export interface ScenarioSeedProfile {
  readonly buildings: readonly ScenarioSeedBuilding[];
}

export interface ScenarioDefinition {
  readonly id: ScenarioId;
  readonly title: string;
  readonly briefing: string;
  readonly initialMoney: number;
  readonly maxTicks: number;
  readonly loseBelowMoney: number;
  readonly objectives: readonly ScenarioObjectiveDefinition[];
  readonly seed: ScenarioSeedProfile;
}

export interface DifficultyProfile {
  readonly id: DifficultyId;
  readonly label: string;
  readonly initialMoney: number;
  readonly objectiveTargetMultiplier: number;
  readonly maxTickMultiplier: number;
  readonly loseBelowMoney: number;
  readonly workerShortageSlack: number;
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

const foundingSeed = freezeSeed([
  ...road(5, 24, 15),
  house(8, 14), house(10, 14), house(12, 14), house(14, 14),
  house(8, 16), house(10, 16), house(12, 16), house(14, 16),
  building('well', 16, 14), building('farm', 18, 16), building('granary', 20, 14), building('market', 22, 16),
]);

const merchantSeed = freezeSeed([
  ...road(4, 25, 15), ...road(8, 18, 13),
  house(7, 14), house(9, 14), house(11, 14), house(13, 14), house(15, 14), house(17, 14),
  building('well', 6, 14), building('farm', 19, 14), building('granary', 21, 14), building('market', 23, 14),
]);

const resilientSeed = freezeSeed([
  ...road(4, 25, 15), ...road(8, 16, 13), ...road(8, 16, 17),
  house(8, 14), house(10, 14), house(12, 14), house(14, 14), house(16, 14),
  house(8, 16), house(10, 16), house(12, 16), house(14, 16), house(16, 16),
  building('well', 6, 14), building('well', 18, 16), building('farm', 20, 14), building('granary', 22, 14), building('market', 24, 16),
]);

export const FOUNDING_SETTLEMENT_SCENARIO: ScenarioDefinition = freezeScenario({
  id: 'founding-settlement',
  title: 'Found a functioning settlement',
  briefing: 'Build a stable settlement. Expand housing, keep basic services running, and prove that the city can support its population.',
  initialMoney: 500,
  maxTicks: 900,
  loseBelowMoney: 50,
  objectives: [
    objective('population', 'Population', 80, 'at-least'),
    objective('water-coverage', 'Water coverage', 70, 'at-least', 'percent'),
    objective('food-coverage', 'Food coverage', 50, 'at-least', 'percent'),
    objective('worker-shortage', 'Worker shortage', 20, 'at-most', 'percent'),
    objective('money', 'Money', 100, 'at-least'),
  ],
  seed: foundingSeed,
});

export const MERCHANT_QUARTER_SCENARIO: ScenarioDefinition = freezeScenario({
  id: 'merchant-quarter',
  title: 'Establish a merchant quarter',
  briefing: 'Work from a lean treasury. Connect the food chain, preserve workers, and grow a profitable quarter without wasting road space.',
  initialMoney: 350,
  maxTicks: 720,
  loseBelowMoney: 25,
  objectives: [
    objective('population', 'Population', 90, 'at-least'),
    objective('water-coverage', 'Water coverage', 80, 'at-least', 'percent'),
    objective('food-coverage', 'Food coverage', 70, 'at-least', 'percent'),
    objective('worker-shortage', 'Worker shortage', 25, 'at-most', 'percent'),
    objective('money', 'Money', 125, 'at-least'),
  ],
  seed: merchantSeed,
});

export const RESILIENT_PROVINCE_SCENARIO: ScenarioDefinition = freezeScenario({
  id: 'resilient-province',
  title: 'Keep a resilient province',
  briefing: 'Start with more residents, then maintain food, labour, and treasury through the fixed drought, epidemic, request, and fire calendar.',
  initialMoney: 425,
  maxTicks: 180,
  loseBelowMoney: 25,
  objectives: [
    objective('population', 'Population', 80, 'at-least'),
    objective('water-coverage', 'Water coverage', 70, 'at-least', 'percent'),
    objective('food-coverage', 'Food coverage', 50, 'at-least', 'percent'),
    objective('worker-shortage', 'Worker shortage', 30, 'at-most', 'percent'),
    objective('money', 'Money', 150, 'at-least'),
  ],
  seed: resilientSeed,
});

export const SCENARIO_CATALOG: readonly ScenarioDefinition[] = Object.freeze([
  FOUNDING_SETTLEMENT_SCENARIO,
  MERCHANT_QUARTER_SCENARIO,
  RESILIENT_PROVINCE_SCENARIO,
]);

export const DIFFICULTY_PROFILES: readonly DifficultyProfile[] = Object.freeze([
  Object.freeze({ id: 'easy', label: 'Easy', initialMoney: 700, objectiveTargetMultiplier: 0.75, maxTickMultiplier: 1.25, loseBelowMoney: 0, workerShortageSlack: 20 }),
  Object.freeze({ id: 'normal', label: 'Normal', initialMoney: 500, objectiveTargetMultiplier: 1, maxTickMultiplier: 1, loseBelowMoney: 50, workerShortageSlack: 0 }),
]);

export function getScenario(id: ScenarioId): ScenarioDefinition {
  const scenario = SCENARIO_CATALOG.find((candidate) => candidate.id === id);
  if (scenario === undefined) throw new Error(`Unknown scenario: ${id}`);
  return scenario;
}

export function getDifficultyProfile(id: DifficultyId): DifficultyProfile {
  const profile = DIFFICULTY_PROFILES.find((candidate) => candidate.id === id);
  if (profile === undefined) throw new Error(`Unknown difficulty: ${id}`);
  return profile;
}

export function resolveScenario(definition: ScenarioDefinition, difficulty: DifficultyId): ScenarioDefinition {
  const profile = getDifficultyProfile(difficulty);
  const normal = getDifficultyProfile('normal');
  const moneyBonus = profile.initialMoney - normal.initialMoney;
  return freezeScenario({
    ...definition,
    initialMoney: definition.initialMoney + moneyBonus,
    maxTicks: Math.ceil(definition.maxTicks * profile.maxTickMultiplier),
    loseBelowMoney: Math.min(definition.loseBelowMoney, profile.loseBelowMoney),
    objectives: definition.objectives.map((candidate) => {
      const target = candidate.direction === 'at-most'
        ? clampPercent(candidate.target + profile.workerShortageSlack, candidate.unit)
        : clampPercent(Math.round(candidate.target * profile.objectiveTargetMultiplier), candidate.unit);
      return Object.freeze({ ...candidate, target });
    }),
  });
}

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
    'worker-shortage': workforce.workersRequired === 0 ? 0 : percentage(workforce.workerShortage, workforce.workersRequired),
    money: city.resources.money,
  };

  const objectives = definition.objectives.map((objectiveDefinition) => {
    const current = objectiveValues[objectiveDefinition.id];
    const completed = objectiveDefinition.direction === 'at-most'
      ? current <= objectiveDefinition.target
      : current >= objectiveDefinition.target;
    return optionalUnit({
      id: objectiveDefinition.id,
      label: objectiveDefinition.label,
      current,
      target: objectiveDefinition.target,
      completed,
    }, objectiveDefinition.unit);
  });

  const completedObjectives = objectives.filter((objectiveDefinition) => objectiveDefinition.completed).length;
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
  const remaining = progress.objectives.find((objectiveDefinition) => !objectiveDefinition.completed);
  if (remaining === undefined) return `${prefix} All objectives complete.`;
  return `${prefix} Primary remaining objective: ${remaining.label} ${formatScenarioValue(remaining.current, remaining.unit)}/${formatScenarioValue(remaining.target, remaining.unit)}.`;
}

export function formatScenarioValue(value: number, unit?: ScenarioObjective['unit']): string {
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return unit === 'percent' ? `${rounded}%` : rounded;
}

function objective(id: ScenarioObjectiveId, label: string, target: number, direction: ObjectiveDirection, unit?: 'percent'): ScenarioObjectiveDefinition {
  return unit === undefined ? Object.freeze({ id, label, target, direction }) : Object.freeze({ id, label, target, direction, unit });
}

function building(type: BuildingType, x: number, y: number): ScenarioSeedBuilding {
  return Object.freeze({ type, x, y });
}

function house(x: number, y: number): ScenarioSeedBuilding {
  return Object.freeze({ type: 'house', x, y, initialPopulation: 4 });
}

function road(firstX: number, lastX: number, y: number): readonly ScenarioSeedBuilding[] {
  return Array.from({ length: lastX - firstX + 1 }, (_, index) => building('road', firstX + index, y));
}

function freezeSeed(buildings: readonly ScenarioSeedBuilding[]): ScenarioSeedProfile {
  return Object.freeze({ buildings: Object.freeze([...buildings]) });
}

function freezeScenario(definition: ScenarioDefinition): ScenarioDefinition {
  return Object.freeze({ ...definition, objectives: Object.freeze([...definition.objectives]), seed: freezeSeed(definition.seed.buildings) });
}

function clampPercent(target: number, unit: ScenarioObjectiveDefinition['unit']): number {
  return unit === 'percent' ? Math.max(0, Math.min(100, target)) : target;
}

function percentage(part: number, total: number): number {
  return total === 0 ? 0 : (part / total) * 100;
}

function getResultMessage(status: ScenarioStatus, definition: ScenarioDefinition, lostByMoney: boolean): string | undefined {
  if (status === 'won') return 'Victory: the settlement is stable and self-supporting.';
  if (status !== 'lost') return undefined;
  if (lostByMoney) return `Defeat: the settlement treasury fell below ${definition.loseBelowMoney}.`;
  return `Defeat: the settlement failed to meet its goals before tick ${definition.maxTicks}.`;
}

function optionalUnit(objectiveDefinition: Omit<ScenarioObjective, 'unit'>, unit: ScenarioObjective['unit']): ScenarioObjective {
  return unit === undefined ? objectiveDefinition : { ...objectiveDefinition, unit };
}

function optionalResultMessage(progress: Omit<ScenarioProgress, 'resultMessage'>, resultMessage: string | undefined): ScenarioProgress {
  return resultMessage === undefined ? progress : { ...progress, resultMessage };
}
