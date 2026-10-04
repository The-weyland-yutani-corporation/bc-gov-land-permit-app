import { z } from 'zod';
import {
  IsoDateSchema,
  IsoDateTimeSchema,
  SlugSchema,
  VersionSchema,
} from './common.js';

export const GUIDANCE_MANIFEST_SCHEMA_VERSION = '1.0.0';

export const GuidanceAllowedUsageSchema = z.enum([
  'grounding',
  'citation',
  'display_summary',
]);

export const GuidanceContentReferenceSchema = z
  .object({
    kind: z.enum(['inline', 'file', 'remote']),
    value: z.string().min(1).max(50_000),
    mediaType: z
      .enum(['text/plain', 'text/markdown', 'text/html'])
      .default('text/markdown'),
  })
  .strict()
  .superRefine((content, context) => {
    if (
      content.kind === 'remote' &&
      !z.string().url().startsWith('https://').safeParse(content.value).success
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Remote guidance content must use HTTPS.',
      });
    }
    if (
      content.kind === 'file' &&
      (!/^[A-Za-z0-9_./-]+$/.test(content.value) ||
        content.value.startsWith('/') ||
        content.value.includes('..'))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Guidance file paths must be safe relative paths.',
      });
    }
  });

export const GuidanceManifestSourceSchema = z
  .object({
    id: SlugSchema,
    version: VersionSchema,
    jurisdictionId: SlugSchema,
    title: z.string().min(2).max(300),
    canonicalUrl: z.string().url().startsWith('https://'),
    authority: z
      .object({
        name: z.string().min(2).max(200),
        url: z.string().url().startsWith('https://').optional(),
      })
      .strict(),
    content: GuidanceContentReferenceSchema,
    contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    effectiveFrom: IsoDateSchema,
    effectiveTo: IsoDateSchema.optional(),
    reviewedAt: IsoDateSchema,
    nextReviewAt: IsoDateSchema,
    tags: z.array(SlugSchema).max(30).default([]),
    projectTypeIds: z.array(SlugSchema).max(100).default([]),
    allowedUsage: z.array(GuidanceAllowedUsageSchema).min(1).max(3),
    license: z.string().min(2).max(300),
    synthetic: z.boolean(),
  })
  .strict()
  .superRefine((source, context) => {
    let canonicalUrl: URL | undefined;
    try {
      canonicalUrl = new URL(source.canonicalUrl);
    } catch {
      canonicalUrl = undefined;
    }
    if (
      canonicalUrl &&
      (canonicalUrl.username ||
        canonicalUrl.password ||
        canonicalUrl.hash ||
        canonicalUrl.protocol !== 'https:')
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['canonicalUrl'],
        message:
          'Canonical guidance URLs must use HTTPS without credentials or fragments.',
      });
    }
    if (source.effectiveTo && source.effectiveTo < source.effectiveFrom) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['effectiveTo'],
        message: 'Guidance effective end cannot precede its start.',
      });
    }
    if (source.nextReviewAt < source.reviewedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nextReviewAt'],
        message: 'Next review cannot precede the completed review.',
      });
    }
  });

export const GuidanceSourceManifestSchema = z
  .object({
    schemaVersion: z.literal(GUIDANCE_MANIFEST_SCHEMA_VERSION),
    releaseId: SlugSchema,
    releaseVersion: VersionSchema,
    jurisdictionId: SlugSchema,
    title: z.string().min(2).max(300),
    reviewedAt: IsoDateSchema,
    sources: z.array(GuidanceManifestSourceSchema).min(1).max(500),
  })
  .strict()
  .superRefine((manifest, context) => {
    const ids = new Set<string>();
    manifest.sources.forEach((source, index) => {
      if (ids.has(source.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sources', index, 'id'],
          message: 'Guidance source identifiers must be unique.',
        });
      }
      ids.add(source.id);
      if (source.jurisdictionId !== manifest.jurisdictionId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sources', index, 'jurisdictionId'],
          message: 'Source jurisdiction must match its manifest.',
        });
      }
    });
  });

export const GuidanceSourceSchema = z
  .object({
    id: SlugSchema,
    version: VersionSchema,
    title: z.string().min(2).max(300),
    publisher: z.string().min(2).max(200),
    url: z.string().url().startsWith('https://'),
    jurisdictionId: SlugSchema,
    publishedAt: IsoDateSchema.optional(),
    reviewedAt: IsoDateSchema,
    expiresAt: IsoDateSchema.optional(),
    license: z.string().min(2).max(200).optional(),
    synthetic: z.boolean(),
    contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  })
  .strict()
  .superRefine((source, context) => {
    if (!source.synthetic && !source.license) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['license'],
        message: 'Non-synthetic guidance requires licensing metadata.',
      });
    }
    if (source.expiresAt && source.expiresAt < source.reviewedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expiresAt'],
        message: 'Guidance expiry cannot precede its review date.',
      });
    }
  });

export const CitationLocatorSchema = z
  .object({
    heading: z.string().min(1).max(300).optional(),
    page: z.number().int().positive().optional(),
    paragraph: z.string().min(1).max(100).optional(),
  })
  .strict()
  .refine(
    (locator) =>
      locator.heading !== undefined ||
      locator.page !== undefined ||
      locator.paragraph !== undefined,
    'A citation locator requires a heading, page, or paragraph.',
  );

export const CitationSchema = z
  .object({
    id: SlugSchema,
    sourceId: SlugSchema,
    sourceVersion: VersionSchema,
    title: z.string().min(2).max(300),
    publisher: z.string().min(2).max(200),
    url: z.string().url().startsWith('https://'),
    locator: CitationLocatorSchema,
    excerpt: z.string().min(1).max(1000).optional(),
    accessedAt: IsoDateTimeSchema,
    safety: z
      .object({
        flagged: z.boolean(),
        reasons: z.array(z.string().min(1).max(200)).max(10),
      })
      .strict()
      .optional(),
    evidenceStatus: z
      .enum(['current', 'stale', 'unreviewed', 'not_yet_effective', 'expired'])
      .optional(),
  })
  .strict();

export type Citation = z.infer<typeof CitationSchema>;
export type GuidanceSource = z.infer<typeof GuidanceSourceSchema>;
export type GuidanceManifestSource = z.infer<
  typeof GuidanceManifestSourceSchema
>;
export type GuidanceSourceManifest = z.infer<
  typeof GuidanceSourceManifestSchema
>;
