import {
  DIFFICULTY_PROFILES,
  SCENARIO_CATALOG,
  type DifficultyId,
  type ScenarioId,
} from '../scenario/Scenario';

export interface ScenarioSelection {
  readonly scenarioId: ScenarioId;
  readonly difficulty: DifficultyId;
}

export class ScenarioSelector {
  private readonly element = document.createElement('section');
  private readonly scenario = document.createElement('select');
  private readonly difficulty = document.createElement('select');
  private readonly start = document.createElement('button');

  constructor(host: HTMLElement, selection: ScenarioSelection, private readonly onStart: (selection: ScenarioSelection) => void) {
    this.element.className = 'scenario-selector';
    this.element.setAttribute('aria-label', 'Scenario selection');

    const title = document.createElement('h2');
    title.textContent = 'Scenario setup';
    const scenarioLabel = document.createElement('label');
    scenarioLabel.textContent = 'Scenario';
    this.scenario.setAttribute('aria-label', 'Scenario');
    for (const definition of SCENARIO_CATALOG) {
      const option = document.createElement('option');
      option.value = definition.id;
      option.textContent = definition.title;
      option.selected = definition.id === selection.scenarioId;
      this.scenario.append(option);
    }

    const difficultyLabel = document.createElement('label');
    difficultyLabel.textContent = 'Difficulty';
    this.difficulty.setAttribute('aria-label', 'Difficulty');
    for (const profile of DIFFICULTY_PROFILES) {
      const option = document.createElement('option');
      option.value = profile.id;
      option.textContent = profile.label;
      option.selected = profile.id === selection.difficulty;
      this.difficulty.append(option);
    }

    this.start.type = 'button';
    this.start.textContent = 'Start selected scenario';
    this.start.title = 'Start a fresh deterministic city using the selected scenario and difficulty.';
    this.start.addEventListener('click', this.handleStart);
    this.element.append(title, scenarioLabel, this.scenario, difficultyLabel, this.difficulty, this.start);
    host.append(this.element);
  }

  destroy(): void {
    this.start.removeEventListener('click', this.handleStart);
    this.element.remove();
  }

  private readonly handleStart = (): void => {
    this.onStart({ scenarioId: this.scenario.value as ScenarioId, difficulty: this.difficulty.value as DifficultyId });
  };
}
