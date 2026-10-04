import { z } from 'zod';
import {
  OrganizationIdSchema,
  ProjectIdSchema,
  ReportIdSchema,
  RunIdSchema,
  SlugSchema,
  IsoDateSchema,
  VersionSchema,
} from './common.js';
import { CitationSchema, GuidanceSourceSchema } from './guidance.js';
import { IntakeQuestionSetSchema, ProjectIntakeSchema } from './intake.js';
import {
  MissingInformationSchema,
  PermitDependencySchema,
  PermitRuleSchema,
  PermitTypeSchema,
  TriggerEvaluationSchema,
} from './permits.js';
import { ProjectSchema } from './projects.js';
import { ReadinessReportSchema } from './readiness.js';

export const AgentScopeSchema = z
  .object({
    organizationId: OrganizationIdSchema,
    projectId: ProjectIdSchema,
    runId: RunIdSchema,
    correlationId: z.string().uuid(),
  })
  .strict();

export const AgentProjectContextSchema = z
  .object({
    scope: AgentScopeSchema,
    project: ProjectSchema,
    intake: ProjectIntakeSchema,
    questionSet: IntakeQuestionSetSchema,
    permitTypes: z.array(PermitTypeSchema).max(250),
    rules: z.array(PermitRuleSchema).max(1000),
    permitDependencies: z.array(PermitDependencySchema).max(500),
    guidanceSources: z.array(GuidanceSourceSchema).max(500),
    evaluationDate: IsoDateSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.project.id !== value.scope.projectId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['project', 'id'],
        message: 'Project context must match the scoped project.',
      });
    }
    if (value.project.organizationId !== value.scope.organizationId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['project', 'organizationId'],
        message: 'Project context must match the scoped organization.',
      });
    }
    if (value.intake.projectId !== value.scope.projectId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['intake', 'projectId'],
        message: 'Intake context must match the scoped project.',
      });
    }
  });

export const AgentInvocationEnvelopeSchema = z
  .object({
    kind: z.literal('permit_readiness_request'),
    version: z.literal('1.0.0'),
    context: AgentProjectContextSchema,
    message: z.string().trim().min(1).max(20_000),
  })
  .strict();

export const ScopedProjectToolInputSchema = AgentScopeSchema.pick({
  organizationId: true,
  projectId: true,
  runId: true,
}).strict();

export const EvaluatePermitTriggersToolInputSchema =
  ScopedProjectToolInputSchema.extend({
    ruleReleaseId: SlugSchema,
    ruleReleaseVersion: VersionSchema,
  }).strict();

export const SearchPermitGuidanceToolInputSchema =
  ScopedProjectToolInputSchema.extend({
    query: z.string().trim().min(2).max(500),
    sourceIds: z.array(SlugSchema).max(50).default([]),
    projectTypeIds: z.array(SlugSchema).max(20).default([]),
    maxResults: z.number().int().min(1).max(10).default(5),
  }).strict();

export const BuildPermitSequenceToolInputSchema =
  ScopedProjectToolInputSchema.extend({
    permitTypeIds: z.array(SlugSchema).max(100),
  }).strict();

export const ComposeReadinessReportToolInputSchema =
  ScopedProjectToolInputSchema.extend({
    summary: z.string().trim().min(10).max(5000),
    evaluations: z.array(TriggerEvaluationSchema).max(100),
    missingInformation: z.array(MissingInformationSchema).max(100),
    citationIds: z.array(SlugSchema).max(50),
    assumptions: z.array(z.string().min(1).max(1000)).max(100),
  }).strict();

export const PermitSequencePlanSchema = z
  .object({
    status: z.enum(['ready', 'blocked']),
    groups: z.array(
      z
        .object({
          order: z.number().int().positive(),
          permitTypeIds: z.array(SlugSchema),
        })
        .strict(),
    ),
    entries: z.array(
      z
        .object({
          permitTypeId: SlugSchema,
          blockingPrerequisiteIds: z.array(SlugSchema),
          externalBlockingPrerequisiteIds: z.array(SlugSchema),
          parallelPermitTypeIds: z.array(SlugSchema),
        })
        .strict(),
    ),
    cycles: z.array(
      z.object({ permitTypeIds: z.array(SlugSchema).min(1) }).strict(),
    ),
    issues: z.array(z.string().min(1).max(1000)),
  })
  .strict();

export const GuidanceSearchResultSchema = z
  .object({
    available: z.boolean(),
    citations: z.array(CitationSchema).max(10),
    warning: z.string().min(1).max(500).optional(),
    safetyFlag: z.boolean().default(false),
  })
  .strict()
  .superRefine((result, context) => {
    if (!result.available && !result.warning) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['warning'],
        message: 'Unavailable guidance search requires a warning.',
      });
    }
  });

export const AgentStructuredOutputSchema = z
  .object({
    content: z.string().trim().min(1).max(20_000),
    citations: z.array(CitationSchema).max(50).default([]),
    uncertainty: z.array(z.string().min(1).max(1000)).max(50).default([]),
    escalationRequired: z.boolean(),
    readinessReport: ReadinessReportSchema.optional(),
  })
  .strict();

export const AgentModelOutputSchema = z
  .object({
    content: z.string().trim().min(1).max(20_000),
    citationIds: z.array(SlugSchema).max(50),
    uncertainty: z.array(z.string().min(1).max(1000)).max(50),
    escalationRequired: z.boolean(),
    readinessReportId: ReportIdSchema.nullable(),
  })
  .strict()
  .superRefine((output, context) => {
    if (new Set(output.citationIds).size !== output.citationIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['citationIds'],
        message: 'Citation identifiers must be unique.',
      });
    }
  });

export type AgentInvocationEnvelope = z.infer<
  typeof AgentInvocationEnvelopeSchema
>;
export type AgentModelOutput = z.infer<typeof AgentModelOutputSchema>;
export type AgentProjectContext = z.infer<typeof AgentProjectContextSchema>;
export type AgentScope = z.infer<typeof AgentScopeSchema>;
export type AgentStructuredOutput = z.infer<typeof AgentStructuredOutputSchema>;
export type GuidanceSearchResult = z.infer<typeof GuidanceSearchResultSchema>;
