import { z } from 'zod';

const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const GuidanceSearchDocumentSchema = z
  .object({
    id: z.string().regex(/^[a-f0-9]{64}$/),
    sourceId: z.string().min(2).max(80),
    sourceVersion: z.string().min(3).max(64),
    indexOwner: z.string().min(3).max(100),
    manifestSchemaVersion: z.string().min(3).max(64),
    releaseId: z.string().min(2).max(80),
    releaseVersion: z.string().min(3).max(64),
    jurisdictionId: z.string().min(2).max(80),
    projectTypeIds: z.array(z.string().min(2).max(80)).max(100),
    title: z.string().min(2).max(300),
    authority: z.string().min(2).max(200),
    canonicalUrl: z.string().url().startsWith('https://'),
    content: z.string().min(1).max(8_000),
    heading: z.string().min(1).max(300),
    chunkIndex: z.number().int().nonnegative(),
    chunkCount: z.number().int().positive(),
    contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    effectiveFrom: IsoDateSchema,
    effectiveTo: IsoDateSchema.optional(),
    reviewedAt: IsoDateSchema,
    nextReviewAt: IsoDateSchema,
    tags: z.array(z.string().min(2).max(80)).max(30),
    allowedUsage: z.array(z.string().min(2).max(40)).max(3),
    synthetic: z.boolean(),
    safetyFlag: z.boolean(),
    safetyReasons: z.array(z.string().min(1).max(200)).max(10),
    contentVector: z.array(z.number().finite()).min(1).optional(),
  })
  .strict()
  .superRefine((document, context) => {
    if (document.chunkIndex >= document.chunkCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['chunkIndex'],
        message: 'Chunk index must be less than chunk count.',
      });
    }
  });

export type GuidanceSearchDocument = z.infer<
  typeof GuidanceSearchDocumentSchema
>;

export interface SearchQuery {
  readonly query: string;
  readonly jurisdictionId: string;
  readonly projectTypeId: string;
  readonly sourceIds: readonly string[];
  readonly maxResults: number;
  readonly minimumScore: number;
  readonly vector?: readonly number[];
  readonly signal?: AbortSignal;
}

export interface SearchHit {
  readonly document: unknown;
  readonly score: number;
}

export interface GuidanceSearchBackend {
  search(query: SearchQuery): Promise<readonly SearchHit[]>;
}

export interface EmbeddingProvider {
  embed(texts: readonly string[], signal?: AbortSignal): Promise<number[][]>;
}
