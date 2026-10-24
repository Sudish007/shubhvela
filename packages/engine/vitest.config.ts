import { defineConfig } from 'vitest/config';

// The engine suites include sweeps (tz ICU self-test, 2,016-layout sweep, the 365-day x 5-city goodHours
// property test) that run for several seconds each and share CPU when vitest runs files in parallel; the
// default 5 s per-test timeout is too tight for them on CI runners.
export default defineConfig({
  test: {
    testTimeout: 180_000,
    hookTimeout: 60_000,
  },
});
