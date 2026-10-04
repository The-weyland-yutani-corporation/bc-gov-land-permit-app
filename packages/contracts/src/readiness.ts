import { z } from 'zod';
import {
  ConversationIdSchema,
  IsoDateTimeSchema,
  PlatformAgentVersionSchema,
  ProjectIdSchema,
  ReportIdSchema,
  RunIdSchema,
  SlugSchema,
} from './common.js';
import { CitationSchema } from './guidance.js';
import {
  MissingInformationSchema,
  PermitDependencySchema,
  TriggerEvaluationSchema,
} from './permits.js';
import { JurisdictionReleaseReferenceSchema } from './projects.js';

export const ReadinessRecommendationSchema = z
  .object({
    permitTypeId: SlugSchema,
    disposition: z.enum([
      'likely',
      'may_apply',
      'not_indicated',
      'needs_information',
    ]),
    title: z.string().min(2).max(300),
    rationale: z.string().min(10).max(3000),
    ruleIds: z.array(SlugSchema).max(100),
    citationIds: z.array(SlugSchema).max(100),
    nextActions: z.array(z.string().min(2).max(1000)).max(25),
  })
  .strict()
  .superRefine((recommendation, context) => {
    if (
      ['likely', 'may_apply'].includes(recommendation.disposition) &&
      recommendation.ruleIds.length === 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ruleIds'],
        message: 'Positive recommendations require deterministic rule IDs.',
      });
    }
    if (
      ['likely', 'may_apply'].includes(recommendation.disposition) &&
      recommendation.citationIds.length === 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['citationIds'],
        message: 'Positive recommendations require guidance citations.',
      });
    }
  });

export const ReadinessPreviewRequestSchema = z
  .object({
    expectedProjectVersion: z.number().int().positive(),
  })
  .strict();

export const ReadinessPreviewSchema = z
  .object({
    projectId: ProjectIdSchema,
    projectVersion: z.number().int().positive(),
    jurisdictionRelease: JurisdictionReleaseReferenceSchema,
    evaluations: z.array(TriggerEvaluationSchema),
    missingInformation: z.array(MissingInformationSchema),
    canGenerateReport: z.boolean(),
    generatedAt: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((preview, context) => {
    const hasRequiredGap = preview.missingInformation.some(
      (missing) => missing.severity === 'required',
    );
    if (preview.canGenerateReport === hasRequiredGap) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['canGenerateReport'],
        message:
          'A report can be generated only when required information is present.',
      });
    }
  });

export const ReadinessReportSchema = z
  .object({
    id: ReportIdSchema,
    projectId: ProjectIdSchema,
    projectVersion: z.number().int().positive(),
    conversationId: ConversationIdSchema.optional(),
    runId: RunIdSchema.optional(),
    status: z.enum(['completed', 'degraded']),
    jurisdictionRelease: JurisdictionReleaseReferenceSchema,
    agentVersion: PlatformAgentVersionSchema.optional(),
    summary: z.string().min(10).max(5000),
    recommendations: z.array(ReadinessRecommendationSchema).max(100),
    missingInformation: z.array(MissingInformationSchema).max(100),
    dependencies: z.array(PermitDependencySchema).max(200),
    assumptions: z.array(z.string().min(1).max(1000)).max(100),
    citations: z.array(CitationSchema).max(250),
    limitations: z.array(z.string().min(5).max(1000)).min(1).max(50),
    createdAt: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((report, context) => {
    const citationIds = new Set(
      report.citations.map((citation) => citation.id),
    );
    if (citationIds.size !== report.citations.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['citations'],
        message: 'Citation identifiers must be unique.',
      });
    }

    report.recommendations.forEach((recommendation, index) => {
      for (const citationId of recommendation.citationIds) {
        if (!citationIds.has(citationId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['recommendations', index, 'citationIds'],
            message: `Recommendation references unknown citation ${citationId}.`,
          });
        }
      }
    });

    if (
      report.status === 'completed' &&
      report.recommendations.some(
        (recommendation) => recommendation.disposition === 'needs_information',
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['status'],
        message:
          'Reports with unresolved recommendation information are degraded.',
      });
    }
  });

export const GenerateReadinessReportBodySchema = z
  .object({
    expectedProjectVersion: z.number().int().positive(),
    conversationId: ConversationIdSchema.optional(),
    idempotencyKey: z.string().uuid(),
  })
  .strict();

export type ReadinessPreview = z.infer<typeof ReadinessPreviewSchema>;
export type ReadinessRecommendation = z.infer<
  typeof ReadinessRecommendationSchema
>;
export type ReadinessReport = z.infer<typeof ReadinessReportSchema>;
