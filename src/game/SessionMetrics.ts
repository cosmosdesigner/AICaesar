import type { ScenarioProgress, ScenarioStatus, DifficultyId, ScenarioId } from '../scenario/Scenario';
import type { CityState } from '../simulation/CityState';
import { getPopulationStats } from '../simulation/Simulation';

export interface SessionMetrics {
  readonly scenarioId: ScenarioId;
  readonly difficulty: DifficultyId;
  readonly status: ScenarioStatus;
  readonly currentTick: number;
  readonly peakPopulation: number;
  readonly lowestMoney: number;
  readonly currentMoney: number;
  readonly buildingsConstructed: number;
  readonly buildingsDemolished: number;
  readonly advisorPlansApproved: number;
  readonly advisorPlansRejected: number;
  readonly imperialRequestsFulfilled: number;
  readonly imperialRequestsFailed: number;
}

export function createSessionMetrics(
  city: CityState,
  scenarioId: ScenarioId,
  difficulty: DifficultyId,
  progress: ScenarioProgress,
): SessionMetrics {
  const population = getPopulationStats(city).population;
  return {
    scenarioId,
    difficulty,
    status: progress.status,
    currentTick: city.simulation.tick,
    peakPopulation: population,
    lowestMoney: city.resources.money,
    currentMoney: city.resources.money,
    buildingsConstructed: 0,
    buildingsDemolished: 0,
    advisorPlansApproved: 0,
    advisorPlansRejected: 0,
    imperialRequestsFulfilled: 0,
    imperialRequestsFailed: 0,
  };
}

export function refreshSessionMetrics(
  metrics: SessionMetrics,
  city: CityState,
  progress: ScenarioProgress,
): SessionMetrics {
  const population = getPopulationStats(city).population;
  return {
    ...metrics,
    status: progress.status,
    currentTick: city.simulation.tick,
    peakPopulation: Math.max(metrics.peakPopulation, population),
    lowestMoney: Math.min(metrics.lowestMoney, city.resources.money),
    currentMoney: city.resources.money,
  };
}

export function recordSessionMetric(
  metrics: SessionMetrics,
  metric: 'buildingsConstructed' | 'buildingsDemolished' | 'advisorPlansApproved' | 'advisorPlansRejected' | 'imperialRequestsFulfilled' | 'imperialRequestsFailed',
): SessionMetrics {
  return { ...metrics, [metric]: metrics[metric] + 1 };
}
