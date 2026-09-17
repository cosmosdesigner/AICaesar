import type { SessionMetrics } from '../game/SessionMetrics';

export class MetricsPanel {
  private readonly element = document.createElement('section');
  private readonly details = document.createElement('p');

  constructor(host: HTMLElement) {
    this.element.className = 'metrics-panel';
    this.element.setAttribute('aria-label', 'Session metrics');
    const title = document.createElement('h2');
    title.textContent = 'Session metrics';
    this.element.append(title, this.details);
    host.append(this.element);
  }

  update(metrics: SessionMetrics): void {
    this.details.textContent = [
      `${metrics.scenarioId} / ${metrics.difficulty}`, `Status: ${metrics.status}`, `Tick: ${metrics.currentTick}`,
      `Population peak: ${metrics.peakPopulation}`, `Money: ${metrics.currentMoney} (low ${metrics.lowestMoney})`,
      `Built: ${metrics.buildingsConstructed}`, `Demolished: ${metrics.buildingsDemolished}`,
      `Advisor: ${metrics.advisorPlansApproved} approved, ${metrics.advisorPlansRejected} rejected`,
      `Requests: ${metrics.imperialRequestsFulfilled} fulfilled, ${metrics.imperialRequestsFailed} failed`,
    ].join(' · ');
  }

  destroy(): void {
    this.element.remove();
  }
}
