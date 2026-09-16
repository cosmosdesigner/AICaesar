import { describe, expect, it } from 'vitest';
import { getSimulationIntervalMs } from './SimulationSpeed';

describe('getSimulationIntervalMs', () => {
  it('maps MVP speed controls to tick intervals', () => {
    expect(getSimulationIntervalMs(1)).toBe(1000);
    expect(getSimulationIntervalMs(2)).toBe(500);
    expect(getSimulationIntervalMs(4)).toBe(250);
  });
});
