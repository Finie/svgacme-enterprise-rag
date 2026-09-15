import { describe, expect, it } from 'vitest';
import { retrievalMetrics } from './retrieval-metrics.js';
describe('retrieval metrics', () => {
  it('counts unique sources, honors section locators and computes MRR', () => {
    const truth = [
      { policyId: 'P', policySectionOrdinal: 5 },
      { policyId: 'Q', policySectionOrdinal: null },
    ];
    const retrieved = [
      { policyId: 'P', policySectionOrdinal: 1 },
      { policyId: 'P', policySectionOrdinal: 5 },
      { policyId: 'P', policySectionOrdinal: 5 },
    ];
    expect(retrievalMetrics(truth, retrieved, 3)).toEqual({
      recall: 0.5,
      precision: 2 / 3,
      reciprocalRank: 0.5,
    });
    expect(retrievalMetrics(truth, retrieved, 1)).toEqual({
      recall: 0,
      precision: 0,
      reciprocalRank: 0,
    });
  });
  it('uses K for precision when fewer results exist and deduplicates ground truth', () => {
    const truth = [{ policyId: 'P', policySectionOrdinal: null }];
    expect(retrievalMetrics([...truth, ...truth], truth, 5)).toEqual({
      recall: 1,
      precision: 0.2,
      reciprocalRank: 1,
    });
  });
});
