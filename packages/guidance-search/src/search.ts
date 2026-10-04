import { createHash } from 'node:crypto';
import {
  GuidanceSearchResultSchema,
  type AgentProjectContext,
  type GuidanceSearchResult,
} from '@permit-readiness/contracts';
import {
  GuidanceSearchDocumentSchema,
  type EmbeddingProvider,
  type GuidanceSearchBackend,
  type GuidanceSearchDocument,
  type SearchHit,
  type SearchQuery,
} from './schema.js';

function terms(value: string): Set<string> {
  return new Set(
    value
      .toLocaleLowerCase('en-CA')
      .match(/[a-z0-9]{2,}/g)
      ?.filter((term) => term.length > 1) ?? [],
  );
}

function lexicalScore(query: string, document: GuidanceSearchDocument): number {
  const queryTerms = terms(query);
  if (queryTerms.size === 0) return 0;
  const documentTerms = terms(
    `${document.title} ${document.heading} ${document.tags.join(' ')} ${document.content}`,
  );
  let matches = 0;
  for (const term of queryTerms) if (documentTerms.has(term)) matches += 1;
  return matches / queryTerms.size;
}

export class InMemoryGuidanceSearchBackend implements GuidanceSearchBackend {
  constructor(private readonly documents: readonly GuidanceSearchDocument[]) {}

  async search(query: SearchQuery): Promise<readonly SearchHit[]> {
    const sources = new Set(query.sourceIds);
    return this.documents
      .filter(
        (document) =>
          document.jurisdictionId === query.jurisdictionId &&
          (document.projectTypeIds.length === 0 ||
            document.projectTypeIds.includes(query.projectTypeId)) &&
          (sources.size === 0 || sources.has(document.sourceId)),
      )
      .map((document) => ({
        document,
        score: lexicalScore(query.query, document),
      }))
      .filter((hit) => hit.score >= query.minimumScore)
      .sort(
        (left, right) =>
          right.score - left.score ||
          String((left.document as GuidanceSearchDocument).id).localeCompare(
            (right.document as GuidanceSearchDocument).id,
          ),
      )
      .slice(0, Math.max(query.maxResults * 3, query.maxResults));
  }
}

function evidenceStatus(
  document: GuidanceSearchDocument,
  evaluationDate: string,
): 'current' | 'stale' | 'unreviewed' | 'not_yet_effective' | 'expired' {
  if (document.reviewedAt > evaluationDate) return 'unreviewed';
  if (document.effectiveFrom > evaluationDate) return 'not_yet_effective';
  if (document.effectiveTo && document.effectiveTo < evaluationDate) {
    return 'expired';
  }
  if (document.nextReviewAt < evaluationDate) return 'stale';
  return 'current';
}

function citationId(document: GuidanceSearchDocument): string {
  return createHash('sha256')
    .update(`${document.id}\n${document.canonicalUrl}`)
    .digest('hex')
    .slice(0, 32);
}

export interface PermitGuidanceSearchOptions {
  readonly minimumScore?: number;
  readonly embeddingProvider?: EmbeddingProvider;
  readonly now?: () => Date;
}

export interface PermitGuidanceSearchRequest {
  readonly query: string;
  readonly sourceIds: readonly string[];
  readonly projectTypeIds?: readonly string[];
  readonly maxResults: number;
}

export class PermitGuidanceSearchService {
  private readonly minimumScore: number;

  constructor(
    private readonly backend: GuidanceSearchBackend,
    private readonly options: PermitGuidanceSearchOptions = {},
  ) {
    this.minimumScore = options.minimumScore ?? 0.2;
    if (this.minimumScore < 0 || this.minimumScore > 1) {
      throw new Error('Guidance minimum score must be between zero and one.');
    }
  }

  async search(
    request: PermitGuidanceSearchRequest,
    context: AgentProjectContext,
    signal?: AbortSignal,
  ): Promise<GuidanceSearchResult> {
    const projectTypeId = context.project.projectTypeId;
    if (
      request.projectTypeIds?.some((candidate) => candidate !== projectTypeId)
    ) {
      throw new Error(
        'Guidance search project type is outside the project scope.',
      );
    }
    const vector = this.options.embeddingProvider
      ? (await this.options.embeddingProvider.embed([request.query], signal))[0]
      : undefined;
    const hits = await this.backend.search({
      query: request.query,
      jurisdictionId: context.project.jurisdictionRelease.jurisdictionId,
      projectTypeId,
      sourceIds: request.sourceIds,
      maxResults: request.maxResults,
      minimumScore: this.minimumScore,
      vector,
      signal,
    });
    const accessedAt = (this.options.now?.() ?? new Date()).toISOString();
    const evaluationDate = context.evaluationDate;
    const seen = new Set<string>();
    let malformed = 0;
    let outdated = 0;
    let safetyFlag = false;
    const citations = [];

    for (const hit of hits) {
      const parsed = GuidanceSearchDocumentSchema.safeParse(hit.document);
      if (!parsed.success) {
        malformed += 1;
        continue;
      }
      const document = parsed.data;
      const approved = context.guidanceSources.find(
        (source) =>
          source.id === document.sourceId &&
          source.version === document.sourceVersion &&
          source.contentHash === document.contentHash &&
          source.url === document.canonicalUrl,
      );
      if (!approved || !document.allowedUsage.includes('citation')) continue;
      const status = evidenceStatus(document, evaluationDate);
      if (status !== 'current') {
        outdated += 1;
        continue;
      }
      const dedupeKey = `${document.canonicalUrl}\n${document.content
        .toLocaleLowerCase('en-CA')
        .replace(/\s+/g, ' ')
        .slice(0, 500)}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      safetyFlag ||= document.safetyFlag;
      citations.push({
        id: citationId(document),
        sourceId: document.sourceId,
        sourceVersion: document.sourceVersion,
        title: document.title,
        publisher: document.authority,
        url: document.canonicalUrl,
        locator: { heading: document.heading },
        excerpt: document.content.slice(0, 700),
        accessedAt,
        safety: {
          flagged: document.safetyFlag,
          reasons: document.safetyReasons,
        },
        evidenceStatus: status,
      });
      if (citations.length >= request.maxResults) break;
    }

    const warnings: string[] = [];
    if (safetyFlag) {
      warnings.push(
        'Potential instruction-like text was removed from retrieved evidence; treat the cited passage with caution.',
      );
    }
    if (outdated > 0) {
      warnings.push(
        'Stale, unreviewed, expired, or not-yet-effective guidance was excluded.',
      );
    }
    if (malformed > 0) {
      warnings.push('Malformed search documents were excluded.');
    }
    if (citations.length === 0) {
      warnings.push(
        'No current approved guidance matched the request. Confirm current requirements with the responsible authority.',
      );
    }
    return GuidanceSearchResultSchema.parse({
      available: true,
      citations,
      warning: warnings.length > 0 ? warnings.join(' ') : undefined,
      safetyFlag,
    });
  }
}
