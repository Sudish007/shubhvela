import { describe, expect, it } from 'vitest';
import { Observer, getKundli } from '../src/index';

// Sample birth used across the design mocks: 1998-03-14 06:42 IST, Lucknow (26.85 N, 80.95 E).
// 06:42 IST = 01:12 UTC.
describe('vendored jyotish smoke', () => {
  it('computes a Moon sign for the sample birth', () => {
    const kundli = getKundli(new Date('1998-03-14T01:12:00Z'), new Observer(26.85, 80.95, 0));
    const moon = kundli.planets.Moon;
    expect(moon).toBeDefined();
    expect(typeof moon.rashiName).toBe('string');
    expect(moon.rashiName.length).toBeGreaterThan(0);
    expect(moon.longitude).toBeGreaterThanOrEqual(0);
    expect(moon.longitude).toBeLessThan(360);
  });
});
