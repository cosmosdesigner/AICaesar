import {
  FOUNDING_SETTLEMENT_SCENARIO,
  formatScenarioValue,
  type ScenarioDefinition,
  type ScenarioProgress,
  type ScenarioStatus,
} from '../scenario/Scenario';

const STATUS_LABELS: Readonly<Record<ScenarioStatus, string>> = {
  active: 'Active',
  won: 'Victory',
  lost: 'Defeat',
};

export class ScenarioPanel {
  private readonly element = document.createElement('section');
  private readonly status = document.createElement('strong');
  private readonly tick = document.createElement('strong');
  private readonly objectives = document.createElement('ol');
  private readonly result = document.createElement('p');

  constructor(host: HTMLElement, definition: ScenarioDefinition = FOUNDING_SETTLEMENT_SCENARIO) {
    this.element.className = 'scenario-panel';
    this.element.setAttribute('aria-label', 'Scenario');

    const title = document.createElement('h2');
    title.textContent = definition.title;

    const briefing = document.createElement('p');
    briefing.textContent = definition.briefing;

    const state = document.createElement('p');
    state.append('Status: ', this.status);

    const ticks = document.createElement('p');
    ticks.append('Tick limit: ', this.tick);

    this.result.className = 'scenario-result';
    this.result.setAttribute('role', 'status');

    this.element.append(title, briefing, state, ticks, this.objectives, this.result);
    host.append(this.element);
  }

  update(progress: ScenarioProgress): void {
    this.status.textContent = STATUS_LABELS[progress.status];
    this.tick.textContent = `${progress.currentTick}/${progress.maxTicks}`;
    this.objectives.replaceChildren();

    for (const objective of progress.objectives) {
      const item = document.createElement('li');
      item.className = objective.completed ? 'scenario-objective-complete' : 'scenario-objective-incomplete';
      item.textContent = `${objective.completed ? '✓' : '○'} ${objective.label}: ${formatScenarioValue(objective.current, objective.unit)} / ${formatScenarioValue(objective.target, objective.unit)}`;
      this.objectives.append(item);
    }

    this.result.textContent = progress.resultMessage
      ?? `${progress.completedObjectives}/${progress.totalObjectives} objectives complete.`;
  }

  destroy(): void {
    this.element.remove();
  }
}
