import type { Prisma } from '../../apps/src/generated/prisma/client.js';
import {
  CHUNKING_VERSION,
  hash,
  normalize,
  splitText,
  type ChunkConfig,
} from './chunking.js';

export interface KnowledgeDocument {
  documentId: string;
  documentType: 'POLICY' | 'SCENARIO';
  sourceEntityId: string;
  title: string;
  content: string;
  metadata: Prisma.InputJsonObject;
  sections: {
    key: string;
    heading: string;
    ordinal: number | null;
    content: string;
  }[];
}
export type PolicySource = Prisma.PolicyGetPayload<{
  include: { sections: true };
}>;
export interface ScenarioSource {
  scenarioId: string;
  title: string;
  category: string;
  difficulty: string;
  businessContext: string;
  description: string;
  relevantFacts: Prisma.JsonValue;
  events: { sequence: number; event: string }[];
}
export function policyDocument(p: PolicySource): KnowledgeDocument {
  const sections = [...p.sections]
    .sort((a, b) => a.sectionOrdinal - b.sectionOrdinal)
    .map((s) => ({
      key: String(s.sectionOrdinal),
      heading: s.sourceHeading,
      ordinal: s.sectionOrdinal,
      content: normalize(s.bodyMarkdown),
    }));
  return {
    documentId: `POLICY:${p.policyId}`,
    documentType: 'POLICY',
    sourceEntityId: p.policyId,
    title: p.title,
    content: sections.map((s) => s.content).join('\n\n'),
    sections,
    metadata: {
      category: p.departmentId,
      department_id: p.departmentId,
      classification: p.classification,
      status: p.status,
      policy_version: p.version,
    },
  };
}
export function scenarioDocument(s: ScenarioSource): KnowledgeDocument {
  if (
    !Array.isArray(s.relevantFacts) ||
    !s.relevantFacts.every((f) => typeof f === 'string')
  )
    throw new Error(`Invalid relevant facts: ${s.scenarioId}`);
  const fields = [
    ['context', 'Business Context', s.businessContext],
    ['description', 'Description', s.description],
    [
      'events',
      'Events',
      [...s.events]
        .sort((a, b) => a.sequence - b.sequence)
        .map((e) => `${e.sequence}. ${e.event}`)
        .join('\n'),
    ],
    [
      'facts',
      'Relevant Facts',
      s.relevantFacts.map((f) => `- ${f}`).join('\n'),
    ],
  ];
  const sections = fields.map(([key, heading, content]) => ({
    key,
    heading,
    ordinal: null,
    content: normalize(content),
  }));
  return {
    documentId: `SCENARIO:${s.scenarioId}`,
    documentType: 'SCENARIO',
    sourceEntityId: s.scenarioId,
    title: s.title,
    content: sections.map((s) => s.content).join('\n\n'),
    sections,
    metadata: {
      category: s.category,
      difficulty: s.difficulty,
      synthetic: true,
    },
  };
}
export type Chunk = Prisma.KnowledgeChunkCreateManyInput;
export function documentChunks(
  doc: KnowledgeDocument,
  cfg: ChunkConfig,
): Chunk[] {
  const result: Chunk[] = [];
  for (const section of doc.sections) {
    for (const [localIndex, span] of splitText(
      section.content,
      cfg,
    ).entries()) {
      const policyId =
        doc.documentType === 'POLICY' ? doc.sourceEntityId : null;
      const scenarioId =
        doc.documentType === 'SCENARIO' ? doc.sourceEntityId : null;
      const identity = [doc.documentType, doc.sourceEntityId, section.key];
      const metadata = {
        ...doc.metadata,
        document_id: doc.documentId,
        title: doc.title,
        document_type: doc.documentType,
        source_id: doc.sourceEntityId,
        policy_id: policyId,
        policy_section_id: policyId ? `${policyId}:${section.ordinal}` : null,
        scenario_id: scenarioId,
        section_heading: section.heading,
        section_number: section.ordinal,
        section_key: section.key,
        chunk_index: result.length,
        local_chunk_index: localIndex,
        start_offset: span.start,
        end_offset: span.end,
        chunk_size: cfg.size,
        chunk_overlap: cfg.overlap,
      };
      result.push({
        id: `KC-${hash([...identity, localIndex])}`,
        documentType: doc.documentType,
        sourceId: doc.sourceEntityId,
        policyId,
        policySectionOrdinal: section.ordinal,
        scenarioId,
        chunkIndex: result.length,
        content: span.content,
        metadata,
        contentHash: hash([
          ...identity,
          doc.title,
          section.heading,
          span.content,
        ]),
        chunkingVersion: CHUNKING_VERSION,
      });
    }
  }
  return result;
}
