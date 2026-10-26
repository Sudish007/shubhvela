// Phase B rule ids: unique, every id has a params entry (B02 writes one rules-corpus sentence per id and the content
// tests read RULE_IDS / ruleParamsB), the public API exports the new modules and the muhurat namespace.
import { describe, expect, it } from 'vitest';
import * as engine from '../src/index';
import { PHASE_B_RULE_IDS, RULE_IDS, RULE_PARAMS_B, ruleParamsB } from '../src/rules/ruleIds';

describe('Phase B rule ids', () => {
  it('are unique, part of RULE_IDS, and each resolves to a params list', () => {
    expect(new Set(RULE_IDS).size).toBe(RULE_IDS.length);
    expect(PHASE_B_RULE_IDS.length).toBeGreaterThanOrEqual(100);
    for (const id of PHASE_B_RULE_IDS) {
      expect(RULE_IDS).toContain(id);
      const params = ruleParamsB(id);
      expect(params, `${id} has no params entry`).toBeDefined();
      expect(params!.length).toBeGreaterThan(0);
      for (const p of params!) expect(p).toMatch(/^[a-zA-Z][a-zA-Z0-9]*$/);
    }
    // Wildcard families resolve; the ids in RULE_PARAMS_B are valid identifiers or families.
    expect(ruleParamsB('varga-d9')).toBe(RULE_PARAMS_B['varga-*']);
    expect(ruleParamsB('yoga-hamsa')).toBe(RULE_PARAMS_B['yoga-*']);
    expect(ruleParamsB('muhurat-marriage')).toBe(RULE_PARAMS_B['muhurat-*']);
    expect(ruleParamsB('muhurat-rule-tithi')).toBe(RULE_PARAMS_B['muhurat-rule-tithi']);
    expect(ruleParamsB('no-such-rule')).toBeUndefined();
    expect(ruleParamsB('disha-shool')).toBeDefined();
  });

  it('counts: 15 vargas, 7 ashtakavarga/KP, 38 yogas+bhanga, 7 varshaphal, 24 muhurat, 1 naamkaran, 23 matching, 3 report', () => {
    const count = (re: RegExp) => PHASE_B_RULE_IDS.filter((id) => re.test(id)).length;
    expect(count(/^varga-/)).toBe(15);
    expect(count(/^ashtakavarga-/) + count(/^kp-/)).toBe(7);
    expect(count(/^yoga-/)).toBe(31);
    expect(count(/^(?!yoga-)[a-z-]+-bhanga-|^parivartana-dainya$/)).toBe(7);
    expect(count(/^varshaphal-/)).toBe(7);
    expect(count(/^muhurat-rule-/)).toBe(10);
    expect(count(/^muhurat-(?!rule-)/)).toBe(14);
    expect(count(/^naamkaran-/)).toBe(1);
    expect(count(/^koota-|^nadi-exception|^bhakoot-|^mangal-|^beyond-/)).toBe(23);
    expect(count(/^avakahada-|^ghatak-|^how-computed$/)).toBe(3);
  });

  it('the public API exposes the B01 modules and the muhurat namespace', () => {
    expect(typeof engine.varga).toBe('function');
    expect(typeof engine.allVargas).toBe('function');
    expect(typeof engine.ashtakavarga).toBe('function');
    expect(typeof engine.kp).toBe('function');
    expect(typeof engine.rulingPlanets).toBe('function');
    expect(typeof engine.yogas).toBe('function');
    expect(typeof engine.varshaphal).toBe('function');
    expect(typeof engine.muhurat.score).toBe('function');
    expect(typeof engine.scoreMuhurat).toBe('function');
    expect(typeof engine.toIcs).toBe('function');
    expect(typeof engine.travelNote).toBe('function');
    expect(typeof engine.syllables).toBe('function');
    expect(typeof engine.ashtakoota).toBe('function');
    expect(typeof engine.mangalDosha).toBe('function');
    expect(typeof engine.beyondGunMilan).toBe('function');
    expect(typeof engine.encodeShareCode).toBe('function');
    expect(typeof engine.decodeShareCode).toBe('function');
    expect(typeof engine.toShareUrl).toBe('function');
    expect(typeof engine.parseShareUrl).toBe('function');
    expect(typeof engine.janamPatriModel).toBe('function');
    expect(typeof engine.matchingReportModel).toBe('function');
    expect(typeof engine.varshaphalReportModel).toBe('function');
    expect(typeof engine.computeChartAt).toBe('function');
    expect(engine.MUHURAT_ACTIVITY_IDS).toHaveLength(14);
    expect(engine.DIVISIONAL_CHART_IDS).toHaveLength(15);
  });
});
