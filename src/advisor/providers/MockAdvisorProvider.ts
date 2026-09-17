import type { AdvisorProvider } from '../AdvisorProvider';
import { createMockAdvisorPlan } from '../MockAdvisor';

export function createMockAdvisorProvider(name = 'mock'): AdvisorProvider {
  return {
    name,
    createPlan: async (input) => {
      const context = {
        ...(input.scenario === undefined ? {} : { scenario: input.scenario }),
        ...(input.availableTargets === undefined ? {} : { availableTargets: input.availableTargets }),
      };
      return {
        ok: true,
        plan: createMockAdvisorPlan(input.summary, input.issues, context),
        provider: name,
      };
    },
  };
}
