export interface RequiredSource {
  policyId: string;
  policySectionOrdinal: number | null;
}
export interface RetrievedSource {
  policyId: string | null;
  policySectionOrdinal: number | null;
}
export function retrievalMetrics(
  required: RequiredSource[],
  retrieved: RetrievedSource[],
  k: number,
) {
  if (!required.length) throw new Error('Metrics require ground-truth sources');
  const truth = [
    ...new Map(
      required.map((s) => [
        `${s.policyId}:${s.policySectionOrdinal ?? '*'}`,
        s,
      ]),
    ).values(),
  ];
  const matches = (r: RetrievedSource, s: RequiredSource) =>
    r.policyId === s.policyId &&
    (s.policySectionOrdinal === null ||
      r.policySectionOrdinal === s.policySectionOrdinal);
  const top = retrieved.slice(0, k);
  const found = truth.filter((s) => top.some((r) => matches(r, s))).length;
  const rank = top.findIndex((r) => truth.some((s) => matches(r, s)));
  return {
    recall: found / truth.length,
    precision: top.filter((r) => truth.some((s) => matches(r, s))).length / k,
    reciprocalRank: rank < 0 ? 0 : 1 / (rank + 1),
  };
}
