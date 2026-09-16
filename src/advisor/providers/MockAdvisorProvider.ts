import type { AdvisorProvider } from '../AdvisorProvider';
import { createMockAdvisorPlan } from '../MockAdvisor';

export function createMockAdvisorProvider(name = 'mock'): AdvisorProvider {
  return {
    name,
    createPlan: async (input) => ({
      ok: true,
      plan: createMockAdvisorPlan(input.summary, input.issues),
      provider: name,
    }),
  };
}
