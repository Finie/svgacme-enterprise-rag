export type Route =
  'POLICY' | 'STRUCTURED' | 'SEMANTIC' | 'HYBRID' | 'CROSS_DOMAIN';
export type InputDecision =
  'ALLOW' | 'OUT_OF_SCOPE' | 'PROMPT_INJECTION' | 'UNSAFE' | 'INVALID';
export interface InputResult {
  decision: InputDecision;
  route?: Route;
  reason: string;
}
export interface Evidence {
  id?: string;
  sourceType: 'policy' | 'structured';
  sourceId: string;
  section?: string;
  content: string;
  score: number;
  category?: string;
  authoritative: boolean;
  covers: string[];
  facts?: { key: string; value: string }[];
}
export interface Retrieval {
  evidence: Evidence[];
  required: string[];
  strategy: Route;
}
export interface EvidenceResult {
  decision: 'SUFFICIENT' | 'INSUFFICIENT' | 'NO_EVIDENCE' | 'CONFLICTING';
  evidenceCount: number;
  bestScore?: number;
  reason: string;
}
export type GroundingStatus =
  | 'GROUNDED'
  | 'UNSUPPORTED_CLAIM'
  | 'INVALID_CITATION'
  | 'INSUFFICIENT_EVIDENCE';
