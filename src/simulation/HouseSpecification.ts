export type HouseLevel = 1 | 2 | 3;
export type HouseRequirement = 'road' | 'water' | 'food' | 'desirability';
export type HouseDesirability = 'low' | 'medium' | 'good';

export interface HouseLevelSpecification {
  readonly level: HouseLevel;
  readonly populationCapacity: number;
  readonly taxPerPeriod: number;
  readonly requirements: readonly HouseRequirement[];
  readonly upgradeTicks: number;
}

export interface HouseServices {
  readonly road: boolean;
  readonly water: boolean;
  readonly food: boolean;
  readonly desirability: HouseDesirability;
}

export interface HouseStatus {
  readonly currentLevel: HouseLevel;
  readonly targetLevel: HouseLevel;
  readonly missingForCurrentLevel?: HouseRequirement;
  readonly missingForNextLevel?: HouseRequirement;
  readonly canUpgrade: boolean;
  readonly shouldDegrade: boolean;
}

export const HOUSE_REQUIREMENT_ORDER: readonly HouseRequirement[] = ['road', 'water', 'food', 'desirability'];
export const HOUSE_DEGRADE_TICKS = 4;

export const HOUSE_SPECIFICATIONS: Readonly<Record<HouseLevel, HouseLevelSpecification>> = {
  1: { level: 1, populationCapacity: 4, taxPerPeriod: 2, requirements: [], upgradeTicks: 0 },
  2: { level: 2, populationCapacity: 8, taxPerPeriod: 4, requirements: ['road', 'water'], upgradeTicks: 3 },
  3: { level: 3, populationCapacity: 14, taxPerPeriod: 7, requirements: ['road', 'water', 'food', 'desirability'], upgradeTicks: 5 },
};

export function normalizeHouseLevel(level: number | undefined): HouseLevel {
  if (level === undefined || level <= 1) return 1;
  if (level >= 3) return 3;
  return 2;
}

export function getHouseSpecification(level: number | undefined): HouseLevelSpecification {
  return HOUSE_SPECIFICATIONS[normalizeHouseLevel(level)];
}

export function getHouseStatus(level: number | undefined, services: HouseServices): HouseStatus {
  const currentLevel = normalizeHouseLevel(level);
  const targetLevel = getTargetLevel(services);
  const nextLevel = currentLevel < 3 ? ((currentLevel + 1) as HouseLevel) : undefined;
  const missingForCurrentLevel = getMissingRequirement(HOUSE_SPECIFICATIONS[currentLevel], services);
  const missingForNextLevel = nextLevel === undefined
    ? undefined
    : getMissingRequirement(HOUSE_SPECIFICATIONS[nextLevel], services);

  return {
    currentLevel,
    targetLevel,
    ...(missingForCurrentLevel === undefined ? {} : { missingForCurrentLevel }),
    ...(missingForNextLevel === undefined ? {} : { missingForNextLevel }),
    canUpgrade: targetLevel > currentLevel,
    shouldDegrade: targetLevel < currentLevel,
  };
}

function getTargetLevel(services: HouseServices): HouseLevel {
  if (services.desirability === 'low') return 1;
  for (const level of [3, 2] as const) {
    if (HOUSE_SPECIFICATIONS[level].requirements.every((requirement) => isRequirementMet(requirement, services))) {
      return level;
    }
  }
  return 1;
}

function getMissingRequirement(
  specification: HouseLevelSpecification,
  services: HouseServices,
): HouseRequirement | undefined {
  return HOUSE_REQUIREMENT_ORDER.find((requirement) => (
    specification.requirements.includes(requirement) && !isRequirementMet(requirement, services)
  ));
}

function isRequirementMet(requirement: HouseRequirement, services: HouseServices): boolean {
  if (requirement === 'desirability') return services.desirability === 'good';
  return services[requirement];
}
