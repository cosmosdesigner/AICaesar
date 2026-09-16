import { validateAdvisorPlanShape, type AdvisorProvider, type AdvisorProviderInput, type AdvisorProviderResult } from '../AdvisorProvider';

export function createSafeAdvisorProvider(primary: AdvisorProvider, fallback: AdvisorProvider): AdvisorProvider {
  return {
    name: `${primary.name}-safe`,
    createPlan: async (input) => {
      try {
        const primaryResult = await primary.createPlan(input);
        if (primaryResult.ok && validateAdvisorPlanShape(primaryResult.plan).ok) return primaryResult;

        const reason = primaryResult.ok ? 'primary returned an invalid plan shape' : primaryResult.error;
        return createFallbackResult(input, fallback, primary.name, reason);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return createFallbackResult(input, fallback, primary.name, message);
      }
    },
  };
}

async function createFallbackResult(
  input: AdvisorProviderInput,
  fallback: AdvisorProvider,
  primaryName: string,
  reason: string,
): Promise<AdvisorProviderResult> {
  const provider = `${primaryName}-fallback-${fallback.name}`;

  try {
    const fallbackResult = await fallback.createPlan(input);
    if (fallbackResult.ok && validateAdvisorPlanShape(fallbackResult.plan).ok) {
      return { ok: true, plan: fallbackResult.plan, provider };
    }

    const fallbackError = fallbackResult.ok ? 'fallback returned an invalid plan shape' : fallbackResult.error;
    return { ok: false, error: `Primary failed (${reason}); fallback failed (${fallbackError}).`, provider };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Primary failed (${reason}); fallback threw (${message}).`, provider };
  }
}
