import { createAdvisorPlan, type AdvisorPlan } from '../advisor/MockAdvisor';
import type { CityState } from '../simulation/CityState';

export class AdvisorPanel {
  private plan: AdvisorPlan | undefined;
  private readonly element = document.createElement('section');
  private readonly summary = document.createElement('p');
  private readonly reasoning = document.createElement('ul');
  private readonly actions = document.createElement('ol');
  private readonly estimatedCost = document.createElement('p');
  private readonly expectedImpact = document.createElement('ul');
  private readonly risks = document.createElement('ul');
  private readonly controls = document.createElement('div');
  private readonly status = document.createElement('p');

  constructor(host: HTMLElement, private readonly getCity: () => CityState) {
    this.element.className = 'advisor-panel';
    this.element.setAttribute('aria-label', 'Advisor');

    const title = document.createElement('h2');
    title.textContent = 'Advisor';

    const analyze = document.createElement('button');
    analyze.type = 'button';
    analyze.textContent = 'Analyze city';
    analyze.addEventListener('click', () => {
      this.plan = createAdvisorPlan(this.getCity());
      this.renderPlan();
      this.status.textContent = 'Plan generated.';
    });

    const approve = document.createElement('button');
    approve.type = 'button';
    approve.textContent = 'Approve';
    approve.addEventListener('click', () => {
      this.status.textContent = 'Plan approved for future execution. Execution is not implemented yet.';
    });

    const reject = document.createElement('button');
    reject.type = 'button';
    reject.textContent = 'Reject';
    reject.addEventListener('click', () => {
      this.plan = undefined;
      this.renderPlan();
      this.status.textContent = 'Plan rejected.';
    });

    this.summary.className = 'advisor-summary';
    this.controls.className = 'advisor-controls';
    this.controls.append(approve, reject);
    this.status.className = 'advisor-status';
    this.status.setAttribute('role', 'status');
    this.status.textContent = 'No advisor plan generated yet.';

    this.element.append(
      title,
      analyze,
      this.summary,
      this.createSection('Reasoning', this.reasoning),
      this.createSection('Actions', this.actions),
      this.estimatedCost,
      this.createSection('Expected impact', this.expectedImpact),
      this.createSection('Risks', this.risks),
      this.controls,
      this.status,
    );
    this.renderPlan();
    host.append(this.element);
  }

  destroy(): void {
    this.element.remove();
  }

  private renderPlan(): void {
    this.reasoning.replaceChildren();
    this.actions.replaceChildren();
    this.expectedImpact.replaceChildren();
    this.risks.replaceChildren();
    this.controls.hidden = this.plan === undefined;

    if (!this.plan) {
      this.summary.textContent = 'Click Analyze city to generate a deterministic mock plan.';
      this.estimatedCost.textContent = '';
      return;
    }

    this.summary.textContent = this.plan.summary;
    this.renderItems(this.reasoning, this.plan.reasoning);
    this.renderItems(this.actions, this.plan.actions.map((action) => {
      const target = action.target ? ` Target: (${action.target.x}, ${action.target.y}).` : '';
      return `${action.label} — ${action.reason}${target} Cost: ${action.estimatedCost}.`;
    }));
    this.estimatedCost.textContent = `Estimated cost: ${this.plan.estimatedCost}`;
    this.renderItems(this.expectedImpact, this.plan.expectedImpact);
    this.renderItems(this.risks, this.plan.risks);
  }

  private createSection(title: string, list: HTMLUListElement | HTMLOListElement): HTMLElement {
    const section = document.createElement('div');
    const heading = document.createElement('h3');
    heading.textContent = title;
    section.append(heading, list);
    return section;
  }

  private renderItems(list: HTMLUListElement | HTMLOListElement, items: readonly string[]): void {
    for (const itemText of items) {
      const item = document.createElement('li');
      item.textContent = itemText;
      list.append(item);
    }
  }
}
