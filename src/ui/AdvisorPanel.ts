import type { AdvisorProvider } from '../advisor/AdvisorProvider';
import type { AdvisorApprovalResult } from '../advisor/AdvisorApproval';
import type { AfterActionReport } from '../advisor/AfterActionReport';
import { getAvailableAdvisorTargets, type AdvisorPlan } from '../advisor/MockAdvisor';
import { createMockAdvisorProvider } from '../advisor/providers/MockAdvisorProvider';
import { analyzeCity, summarizeCity } from '../analysis/CityAnalyzer';
import type { CityState } from '../simulation/CityState';
import type { ScenarioProgress } from '../scenario/Scenario';

export interface AdvisorPanelOptions {
  readonly provider?: AdvisorProvider;
  readonly onApprovePlan?: (plan: AdvisorPlan) => AdvisorApprovalResult;
  readonly getScenarioContext?: () => string;
  readonly getScenarioProgress?: () => ScenarioProgress;
  readonly isApprovalBlocked?: () => boolean;
}

export class AdvisorPanel {
  private plan: AdvisorPlan | undefined;
  private report: AfterActionReport | undefined;
  private providerUsed: string | undefined;
  private analysisRequest = 0;
  private readonly advisorProvider: AdvisorProvider;
  private readonly element = document.createElement('section');
  private readonly scenarioContext = document.createElement('p');
  private readonly summary = document.createElement('p');
  private readonly provider = document.createElement('p');
  private readonly reasoning = document.createElement('ul');
  private readonly actions = document.createElement('ol');
  private readonly estimatedCost = document.createElement('p');
  private readonly strategicGoal = document.createElement('p');
  private readonly recommendedBudget = document.createElement('p');
  private readonly alternatives = document.createElement('ul');
  private readonly successCriteria = document.createElement('ul');
  private readonly expectedImpact = document.createElement('ul');
  private readonly risks = document.createElement('ul');
  private readonly controls = document.createElement('div');
  private readonly approve = document.createElement('button');
  private readonly status = document.createElement('p');
  private readonly reportSection = document.createElement('div');
  private readonly reportSummary = document.createElement('p');
  private readonly reportDeltas = document.createElement('ul');
  private readonly reportIssuesLabel = document.createElement('p');
  private readonly reportIssues = document.createElement('ul');
  private readonly reportPromise = document.createElement('p');
  private readonly reportExpectedImpact = document.createElement('ul');
  private readonly reportSuccessCriteria = document.createElement('ul');
  private readonly reportFutureEffects = document.createElement('ul');

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
    analyze.title = 'Analyze city issues and request a local advisor plan.';
    analyze.addEventListener('click', () => {
      void this.analyzeCity();
    });

    this.approve.type = 'button';
    this.approve.textContent = 'Approve';
    this.approve.title = 'Approve and execute the current validated advisor plan.';
    this.approve.addEventListener('click', () => {
      if (this.plan === undefined) {
        this.status.textContent = 'No advisor plan to approve.';
        return;
      }
      if (this.options.isApprovalBlocked?.() === true) {
        this.status.textContent = 'Advisor plan approval is blocked because the scenario has ended.';
        this.updateScenarioContext();
        return;
      }

      const result = this.options.onApprovePlan?.(this.plan);
      if (result === undefined) {
        this.status.textContent = 'No advisor executor configured.';
        return;
      }

      this.report = result.ok ? result.report : undefined;
      this.status.textContent = result.message;
      if (result.ok) {
        this.plan = undefined;
        this.providerUsed = undefined;
      }
      this.renderPlan();
    });

    const reject = document.createElement('button');
    reject.type = 'button';
    reject.textContent = 'Reject';
    reject.title = 'Reject the current advisor plan without changing the city.';
    reject.addEventListener('click', () => {
      this.plan = undefined;
      this.report = undefined;
      this.renderPlan();
      this.providerUsed = undefined;
      this.status.textContent = 'Plan rejected.';
    });

    this.summary.className = 'advisor-summary';
    this.controls.className = 'advisor-controls';
    this.controls.append(this.approve, reject);
    this.status.className = 'advisor-status';
    this.status.setAttribute('role', 'status');
    this.scenarioContext.className = 'advisor-scenario-context';
    this.status.textContent = 'No advisor plan generated yet.';

    const reportTitle = document.createElement('h3');
    reportTitle.textContent = 'After-action report';
    this.reportSection.className = 'after-action-report';
    this.reportIssuesLabel.className = 'after-action-issues-label';
    this.reportSection.append(
      reportTitle,
      this.reportSummary,
      this.reportPromise,
      this.createSection('Promised impact', this.reportExpectedImpact),
      this.createSection('Success criteria', this.reportSuccessCriteria),
      this.createSection('Future effects', this.reportFutureEffects),
      this.reportDeltas,
      this.reportIssuesLabel,
      this.reportIssues,
    );

    this.element.append(
      title,
      analyze,
      this.summary,
      this.scenarioContext,
      this.provider,
      this.createSection('Reasoning', this.reasoning),
      this.createSection('Actions', this.actions),
      this.estimatedCost,
      this.strategicGoal,
      this.recommendedBudget,
      this.createSection('Alternatives and trade-offs', this.alternatives),
      this.createSection('Success criteria', this.successCriteria),
      this.createSection('Expected impact', this.expectedImpact),
      this.createSection('Risks', this.risks),
      this.controls,
      this.status,
      this.reportSection,
    );
    this.renderPlan();
    host.append(this.element);
  }

  destroy(): void {
    this.analysisRequest += 1;
    this.element.remove();
  }

  updateScenarioContext(): void {
    this.scenarioContext.textContent = this.options.getScenarioContext?.() ?? '';
    this.approve.disabled = this.options.isApprovalBlocked?.() === true;
  }

  invalidateForCityChange(message: string): void {
    this.analysisRequest += 1;
    this.plan = undefined;
    this.report = undefined;
    this.providerUsed = undefined;
    this.renderPlan();
    this.status.textContent = message;
  }

  private async analyzeCity(): Promise<void> {
    const request = this.analysisRequest + 1;
    this.analysisRequest = request;
    this.plan = undefined;
    this.providerUsed = undefined;
    this.report = undefined;
    this.renderPlan();
    this.status.textContent = 'Analyzing...';

    const city = this.getCity();
    const scenario = this.options.getScenarioProgress?.();
    const input = {
      summary: summarizeCity(city),
      issues: analyzeCity(city),
      availableTargets: getAvailableAdvisorTargets(city),
      ...(scenario === undefined ? {} : { scenario }),
    };
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
    this.alternatives.replaceChildren();
    this.successCriteria.replaceChildren();
    this.renderReport();
    this.updateScenarioContext();
    this.controls.hidden = this.plan === undefined;
    if (!this.plan) {
      this.summary.textContent = 'Click Analyze city to generate an advisor provider plan.';
      this.provider.textContent = '';
      this.estimatedCost.textContent = '';
      this.strategicGoal.textContent = '';
      this.recommendedBudget.textContent = '';
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
    this.strategicGoal.textContent = this.plan.strategicGoal ? `Strategic goal: ${this.plan.strategicGoal}` : '';
    const approvedBudget = this.plan.recommendedBudget ?? this.plan.estimatedCost;
    this.recommendedBudget.textContent = `Recommended budget: ${this.plan.recommendedBudget ?? this.plan.estimatedCost}. Approved budget: ${approvedBudget}.`;
    this.renderItems(this.alternatives, (this.plan.alternatives ?? []).map((alternative) => (
      `${alternative.label}: ${alternative.summary} Trade-offs: ${alternative.tradeOffs.join(' ')}`
    )));
    this.renderItems(this.successCriteria, this.plan.successCriteria ?? []);
    this.renderItems(this.expectedImpact, this.plan.expectedImpact);
    this.renderItems(this.risks, this.plan.risks);
  }

  private renderReport(): void {
    this.reportDeltas.replaceChildren();
    this.reportIssues.replaceChildren();
    this.reportExpectedImpact.replaceChildren();
    this.reportSuccessCriteria.replaceChildren();
    this.reportFutureEffects.replaceChildren();
    this.reportSection.hidden = this.report === undefined;

    if (this.report === undefined) return;

    this.reportSummary.textContent = `Summary: ${this.report.summary}`;
    this.reportPromise.textContent = [
      this.report.promise.strategicGoal ? `Strategic goal: ${this.report.promise.strategicGoal}` : undefined,
      `Promised cost: ${this.report.promise.estimatedCost}. Actual spent: ${this.report.spent}.`,
    ].filter((value): value is string => value !== undefined).join(' ');
    this.renderItems(this.reportExpectedImpact, this.report.promise.expectedImpact);
    this.renderItems(this.reportSuccessCriteria, this.report.promise.successCriteria);
    this.renderItems(
      this.reportFutureEffects,
      this.report.futureEffects.length === 0
        ? ['Immediate effects are reflected in the metric deltas below.']
        : this.report.futureEffects,
    );
    if (this.report.deltas.length === 0) {
      this.renderItems(this.reportDeltas, ['No tracked metric changes.']);
    } else {
      this.renderItems(this.reportDeltas, this.report.deltas.map((delta) => (
        `${delta.label}: ${delta.before} → ${delta.after} (${formatSigned(delta.delta)})`
      )));
    }

    if (this.report.remainingIssues.length === 0) {
      this.reportIssuesLabel.textContent = 'No remaining critical issues detected.';
      return;
    }

    this.reportIssuesLabel.textContent = 'Remaining issues:';
    this.renderItems(this.reportIssues, this.report.remainingIssues);
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

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}
