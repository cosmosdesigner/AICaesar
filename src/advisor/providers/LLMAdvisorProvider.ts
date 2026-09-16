import type { AdvisorProvider, AdvisorProviderInput, AdvisorProviderResult } from '../AdvisorProvider';
import { validateAdvisorPlanShape } from '../AdvisorProvider';

export interface LLMPlanClient {
  complete(prompt: string): Promise<string>;
}

export class LLMAdvisorProvider implements AdvisorProvider {
  constructor(
    private readonly client: LLMPlanClient,
    readonly name = 'llm',
  ) {}

  async createPlan(input: AdvisorProviderInput): Promise<AdvisorProviderResult> {
    let response: string;
    try {
      response = await this.client.complete(buildAdvisorPrompt(input));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: `LLM client failed: ${message}`, provider: this.name };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(response);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: `LLM response was not valid JSON: ${message}`, provider: this.name };
    }

    const validation = validateAdvisorPlanShape(parsed);
    if (!validation.ok) {
      return { ok: false, error: `LLM response did not match AdvisorPlan shape: ${validation.error}`, provider: this.name };
    }

    return { ok: true, plan: validation.plan, provider: this.name };
  }
}

export function buildAdvisorPrompt(input: AdvisorProviderInput): string {
  return [
    'You are an AICaesar city advisor. Return JSON only. Do not execute actions.',
    'Use only the provided CityStateSummary and CityIssue[] data.',
    'Allowed action types: build_road, build_well, build_farm, build_granary, build_market, build_house, wait.',
    'AdvisorPlan JSON shape: {"summary": string, "reasoning": string[], "actions": [{"type": actionType, "label": string, "reason": string, "target"?: {"x": number, "y": number}, "estimatedCost": number}], "estimatedCost": number, "expectedImpact": string[], "risks": string[]}.',
    'Plan estimatedCost must equal the sum of action estimatedCost values.',
    `CityStateSummary: ${JSON.stringify(input.summary)}`,
    `CityIssue[]: ${JSON.stringify(input.issues)}`,
  ].join('\n');
}
