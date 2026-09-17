import { describe, expect, it } from 'vitest';
import { createCityState } from '../simulation/CityState';
import { assignWorkers } from '../simulation/Simulation';
import { evaluateScenario } from '../scenario/Scenario';
import { deriveAgoraSummary } from './AgoraSummary';

describe('deriveAgoraSummary', () => {
  it('derives active objective, priority, suggested action, and city snapshot', () => {
    const city = createCityState();
    assignWorkers(city);

    const summary = deriveAgoraSummary(city, evaluateScenario(city));

    expect(summary.status).toEqual({ tone: 'active', text: 'Cenário em curso.' });
    expect(summary.objective).toMatchObject({ label: 'Population', completed: false });
    expect(summary.resources).toEqual({ money: city.resources.money, population: expect.any(Number) });
    expect(summary.issue.tone).toBe('issue');
    expect(summary.action).toMatchObject({ type: expect.any(String), label: expect.any(String) });
  });

  it('reports no critical issues and keeps an advisor-derived action available', () => {
    const city = createCityState();
    city.buildings.length = 0;
    for (const tile of city.tiles) delete tile.buildingId;

    const summary = deriveAgoraSummary(city, evaluateScenario(city));

    expect(summary.issue).toEqual({ tone: 'success', text: 'Sem problemas críticos detetados.' });
    expect(summary.action).toMatchObject({ type: 'build_house', label: 'Construir casa', estimatedCost: 20 });
  });

  it('prioritizes an active event as the timing risk', () => {
    const city = createCityState();
    city.simulation.tick = 31;
    city.simulation.events?.active.push({
      id: 'drought', type: 'drought', status: 'active', startTick: 30, endTick: 45, message: 'Seca ativa.',
    });

    const summary = deriveAgoraSummary(city, evaluateScenario(city));

    expect(summary.timing).toEqual({ tone: 'risk', text: 'Evento ativo: drought termina em 14 ticks.' });
  });

  it('reports the imminent financial balance when no event or request is active', () => {
    const city = createCityState();
    city.buildings.length = 0;
    for (const tile of city.tiles) delete tile.buildingId;
    city.simulation.tick = 9;

    const summary = deriveAgoraSummary(city, evaluateScenario(city));

    expect(summary.timing).toEqual({ tone: 'risk', text: 'Próximo balanço financeiro em 1 tick.' });
  });

  it.each([
    ['won', 'Vitória: todos os objetivos foram cumpridos.', 'success'],
    ['lost', 'Derrota: o cenário terminou.', 'failure'],
  ] as const)('reports %s terminal state without an actionable recommendation', (status, text, tone) => {
    const city = createCityState();
    const progress = { ...evaluateScenario(city), status, resultMessage: text };

    const summary = deriveAgoraSummary(city, progress);

    expect(summary.status).toEqual({ tone, text });
    expect(summary.action).toEqual({ type: 'wait', label: 'Recomece o cenário para agir.', estimatedCost: 0 });
  });
});
