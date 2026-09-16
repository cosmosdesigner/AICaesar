export type SimulationSpeed = 1 | 2 | 4;

export const SIMULATION_INTERVAL_MS: Readonly<Record<SimulationSpeed, number>> = {
  1: 1000,
  2: 500,
  4: 250,
};

export function getSimulationIntervalMs(speed: SimulationSpeed): number {
  return SIMULATION_INTERVAL_MS[speed];
}
