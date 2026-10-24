import { describe, expect, it } from 'vitest';
import * as engine from '../src/index';

// Spec D7/D8 and plan P9: the engine must never expose prediction, remedy or gemstone
// APIs. Symbol names are checked case-insensitively against these fragments.
const FORBIDDEN = [
  'Gemstone',
  'Prediction',
  'Remed',
  'LalKitab',
  'Growth',
  'Career',
  'Wealth',
  'Marriage',
  'Health',
  'Progeny',
  'Education',
];

describe('@shubhvela/engine public API', () => {
  const names = Object.keys(engine);

  it('exports something', () => {
    expect(names.length).toBeGreaterThan(20);
  });

  it('exports no prediction / gemstone / remedy symbols', () => {
    const offenders = names.filter((n) =>
      FORBIDDEN.some((f) => n.toLowerCase().includes(f.toLowerCase())),
    );
    expect(offenders).toEqual([]);
  });

  it('keeps the kept modules reachable', () => {
    expect(typeof engine.getKundli).toBe('function');
    expect(typeof engine.getYogasAndDoshas).toBe('function');
    expect(typeof engine.Observer).toBe('function');
  });
});
