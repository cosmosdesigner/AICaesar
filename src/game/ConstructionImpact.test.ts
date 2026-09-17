import { describe, expect, it } from 'vitest';
import { createCityState, placeBuilding } from '../simulation/CityState';
import { describeConstructionImpact, getConstructionImpact } from './ConstructionImpact';

describe('construction impact preview', () => {
  it('projects a nearby well without mutating the source city', () => {
    const city = createCityState();
    const before = JSON.stringify(city);

    const impact = getConstructionImpact(city, { x: 9, y: 14 }, 'well');

    expect(impact).toMatchObject({
      cost: 35,
      moneyAfter: 465,
      benefit: expect.stringContaining('Dá água a'),
      risk: expect.any(String),
    });
    expect(describeConstructionImpact(impact)).toContain('Custo: 35. Tesouro depois: 465.');
    expect(JSON.stringify(city)).toBe(before);
  });

  it('distinguishes a connected location from one without immediate service impact', () => {
    const city = createCityState();

    const connected = getConstructionImpact(city, { x: 9, y: 14 }, 'well');
    const isolated = getConstructionImpact(city, { x: 1, y: 1 }, 'well');

    expect(connected?.benefit).toContain('Dá água a');
    expect(isolated?.benefit).toBe('Adiciona um poço, mas ainda não alcança casas pela rede principal.');
  });

  it('does not present impact for an invalid build', () => {
    const city = createCityState();
    expect(placeBuilding(city, 20, 10, 'road')).toBe('built');
    const before = JSON.stringify(city);

    expect(getConstructionImpact(city, { x: 20, y: 10 }, 'well')).toBeNull();
    expect(describeConstructionImpact(null)).toBe('');
    expect(JSON.stringify(city)).toBe(before);
  });
});
