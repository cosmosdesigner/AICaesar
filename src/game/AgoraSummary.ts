import { createMockAdvisorPlan, getAvailableAdvisorTargets, selectStrategicIssue, type AdvisorAction, type AdvisorActionType } from '../advisor/MockAdvisor';
import { analyzeCity, summarizeCity, type CityIssue } from '../analysis/CityAnalyzer';
import { getEventSummary, getImperialRequestSummary } from '../events/Events';
import { formatScenarioValue, type ScenarioObjective, type ScenarioProgress } from '../scenario/Scenario';
import type { CityState } from '../simulation/CityState';
import { getFinanceStats, getWorkforceStats } from '../simulation/Simulation';

export type AgoraTone = 'active' | 'issue' | 'risk' | 'success' | 'failure';

export interface AgoraMessage {
  readonly tone: AgoraTone;
  readonly text: string;
}

export interface AgoraObjective {
  readonly label: string;
  readonly current: number;
  readonly target: number;
  readonly completed: boolean;
  readonly progress: string;
}

export interface AgoraAction {
  readonly type: AdvisorActionType;
  readonly label: string;
  readonly estimatedCost: number;
}

export interface AgoraSummary {
  readonly status: AgoraMessage;
  readonly objective: AgoraObjective | undefined;
  readonly issue: AgoraMessage;
  readonly action: AgoraAction;
  readonly resources: { readonly money: number; readonly population: number };
  readonly timing: AgoraMessage;
}

const ACTION_LABELS: Readonly<Record<AdvisorActionType, string>> = {
  build_road: 'Construir estrada',
  build_well: 'Construir poço',
  build_farm: 'Construir quinta',
  build_granary: 'Construir celeiro',
  build_market: 'Construir mercado',
  build_house: 'Construir casa',
  wait: 'Aguardar e observar',
};

export function deriveAgoraSummary(city: CityState, progress: ScenarioProgress): AgoraSummary {
  const objective = selectObjective(progress);
  const resources = { money: city.resources.money, population: getWorkforceStats(city).population };
  const status = deriveStatus(progress);
  if (progress.status !== 'active') {
    return {
      status,
      objective,
      issue: { tone: progress.status === 'won' ? 'success' : 'failure', text: status.text },
      action: { type: 'wait', label: 'Recomece o cenário para agir.', estimatedCost: 0 },
      resources,
      timing: { tone: progress.status === 'won' ? 'success' : 'failure', text: status.text },
    };
  }

  const issues = analyzeCity(city);
  const priorityIssue = selectStrategicIssue(issues, progress) ?? issues[0];
  const action = suggestedAction(city, progress, issues);
  return {
    status,
    objective,
    issue: priorityIssue === undefined
      ? { tone: 'success', text: 'Sem problemas críticos detetados.' }
      : { tone: 'issue', text: priorityIssue.explanation },
    action,
    resources,
    timing: deriveTiming(city),
  };
}

function selectObjective(progress: ScenarioProgress): AgoraObjective | undefined {
  const objective = progress.objectives.find((candidate) => !candidate.completed) ?? progress.objectives[0];
  return objective === undefined ? undefined : toAgoraObjective(objective);
}
function toAgoraObjective(objective: ScenarioObjective): AgoraObjective {
  return {
    label: objective.label,
    current: objective.current,
    target: objective.target,
    completed: objective.completed,
    progress: `${formatScenarioValue(objective.current, objective.unit)} / ${formatScenarioValue(objective.target, objective.unit)}`,
  };
}

function deriveStatus(progress: ScenarioProgress): AgoraMessage {
  if (progress.status === 'won') return { tone: 'success', text: progress.resultMessage ?? 'Vitória: todos os objetivos foram cumpridos.' };
  if (progress.status === 'lost') return { tone: 'failure', text: progress.resultMessage ?? 'Derrota: o cenário terminou.' };
  return { tone: 'active', text: 'Cenário em curso.' };
}

function suggestedAction(city: CityState, progress: ScenarioProgress, issues: readonly CityIssue[]): AgoraAction {
  const action = createMockAdvisorPlan(summarizeCity(city), issues, {
    scenario: progress,
    availableTargets: getAvailableAdvisorTargets(city),
  }).actions[0];
  return toAgoraAction(action);
}

function toAgoraAction(action: AdvisorAction | undefined): AgoraAction {
  if (action === undefined) return { type: 'wait', label: ACTION_LABELS.wait, estimatedCost: 0 };
  return { type: action.type, label: ACTION_LABELS[action.type], estimatedCost: action.estimatedCost };
}

function deriveTiming(city: CityState): AgoraMessage {
  const activeEvent = getEventSummary(city).find((event) => event.status === 'active');
  if (activeEvent !== undefined) {
    return { tone: 'risk', text: `Evento ativo: ${activeEvent.type} termina em ${activeEvent.ticksRemaining} ticks.` };
  }

  const request = getImperialRequestSummary(city);
  if (request?.status === 'pending') {
    return { tone: 'risk', text: `Pedido imperial: entregar ${request.requestedFood} comida em ${request.ticksRemaining} ticks.` };
  }

  const ticks = getFinanceStats(city).ticksUntilNextPeriod;
  return { tone: 'risk', text: `Próximo balanço financeiro em ${ticks} tick${ticks === 1 ? '' : 's'}.` };
}
