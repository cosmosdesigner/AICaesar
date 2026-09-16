import type { AdvisorProvider } from '../advisor/AdvisorProvider';
import type { AdvisorPlan } from '../advisor/MockAdvisor';
import { createMockAdvisorProvider } from '../advisor/providers/MockAdvisorProvider';
import { analyzeCity, summarizeCity } from '../analysis/CityAnalyzer';
import type { CityState } from '../simulation/CityState';

export interface AdvisorApprovalResult {
  readonly ok: boolean;
  readonly message: string;
}

export interface AdvisorPanelOptions {
  readonly provider?: AdvisorProvider;
  readonly onApprovePlan?: (plan: AdvisorPlan) => AdvisorApprovalResult;
}

export class AdvisorPanel {
  private plan: AdvisorPlan | undefined;
  private providerUsed: string | undefined;
  private analysisRequest = 0;
  private readonly advisorProvider: AdvisorProvider;
  private readonly element = document.createElement('section');
  private readonly summary = document.createElement('p');
  private readonly provider = document.createElement('p');
  private readonly reasoning = document.createElement('ul');
  private readonly actions = document.createElement('ol');
  private readonly estimatedCost = document.createElement('p');
  private readonly expectedImpact = document.createElement('ul');
  private readonly risks = document.createElement('ul');
  private readonly controls = document.createElement('div');
  private readonly status = document.createElement('p');

  constructor(
    host: HTMLElement,
    private readonly getCity: () => CityState,
    private readonly options: AdvisorPanelOptions = {},
  ) {
    this.advisorProvider = options.provider ?? createMockAdvisorProvider();

    this.element.className = 'advisor-panel';
    this.element.setAttribute('aria-label', 'Advisor');

    const title = document.createElement('h2');
    title.textContent = 'Advisor';

    const analyze = document.createElement('button');
    analyze.type = 'button';
    analyze.textContent = 'Analyze city';
    analyze.addEventListener('click', () => {
      void this.analyzeCity();
    });

    const approve = document.createElement('button');
    approve.type = 'button';
    approve.textContent = 'Approve';
    approve.addEventListener('click', () => {
      if (this.plan === undefined) {
        this.status.textContent = 'No advisor plan to approve.';
        return;
      }

      const result = this.options.onApprovePlan?.(this.plan);
      if (result === undefined) {
        this.status.textContent = 'No advisor executor configured.';
        return;
      }

      this.status.textContent = result.message;
      if (result.ok) {
        this.plan = undefined;
        this.renderPlan();
      }
    });

    const reject = document.createElement('button');
    reject.type = 'button';
    reject.textContent = 'Reject';
    reject.addEventListener('click', () => {
      this.plan = undefined;
      this.renderPlan();
      this.providerUsed = undefined;
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
      this.provider,
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
    this.analysisRequest += 1;
    this.element.remove();
  }

  private async analyzeCity(): Promise<void> {
    const request = this.analysisRequest + 1;
    this.analysisRequest = request;
    this.plan = undefined;
    this.providerUsed = undefined;
    this.renderPlan();
    this.status.textContent = 'Analyzing...';

    const city = this.getCity();
    const input = { summary: summarizeCity(city), issues: analyzeCity(city) };
    const result = await this.advisorProvider.createPlan(input).catch((error: unknown) => ({
      ok: false as const,
      error: error instanceof Error ? error.message : String(error),
      provider: this.advisorProvider.name,
    }));
    if (request !== this.analysisRequest) return;

    if (!result.ok) {
      this.status.textContent = `Advisor provider failed: ${result.error}`;
      this.renderPlan();
      return;
    }

    this.plan = result.plan;
    this.providerUsed = result.provider;
    this.renderPlan();
    this.status.textContent = result.provider.includes('-fallback-')
      ? 'Plan generated via fallback provider.'
      : 'Plan generated.';
  }

  private renderPlan(): void {
    this.reasoning.replaceChildren();
    this.actions.replaceChildren();
    this.expectedImpact.replaceChildren();
    this.risks.replaceChildren();
    this.controls.hidden = this.plan === undefined;

    if (!this.plan) {
      this.summary.textContent = 'Click Analyze city to generate an advisor provider plan.';
      this.provider.textContent = '';
      this.estimatedCost.textContent = '';
      return;
    }

    this.summary.textContent = this.plan.summary;
    this.provider.textContent = `Provider: ${this.providerUsed ?? this.advisorProvider.name}`;
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
