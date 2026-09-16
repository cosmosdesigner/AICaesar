const OBJECTIVES: readonly string[] = [
  'Observe or build houses near the central road.',
  'Use wells to give houses water coverage.',
  'Keep farm, granary and market active for food.',
  'Add houses when workplaces need more workers.',
  'Click Analyze city to get an advisor plan.',
  'Approve a plan and read the after-action report.',
];

export class ObjectivesPanel {
  private readonly element = document.createElement('section');

  constructor(host: HTMLElement) {
    this.element.className = 'objectives-panel';
    this.element.setAttribute('aria-label', 'MVP objectives');

    const title = document.createElement('h2');
    title.textContent = 'MVP objectives';

    const intro = document.createElement('p');
    intro.textContent = 'Five-minute demo flow:';

    const list = document.createElement('ol');
    for (const objective of OBJECTIVES) {
      const item = document.createElement('li');
      item.textContent = objective;
      list.append(item);
    }

    this.element.append(title, intro, list);
    host.append(this.element);
  }

  destroy(): void {
    this.element.remove();
  }
}
