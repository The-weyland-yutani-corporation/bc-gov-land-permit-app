import { z } from 'zod';
import {
  IsoDateTimeSchema,
  OrganizationIdSchema,
  PaginationQuerySchema,
  ProjectIdSchema,
  ReportIdSchema,
  SlugSchema,
  VersionSchema,
  createPaginatedSchema,
} from './common.js';
import { ProjectLocationSchema } from './geography.js';

export const ProjectStatusSchema = z.enum([
  'draft',
  'intake_in_progress',
  'ready_for_review',
  'assessment_in_progress',
  'report_ready',
  'archived',
]);

export const ProjectTypeSchema = z
  .object({
    id: SlugSchema,
    name: z.string().min(2).max(120),
    description: z.string().min(10).max(1000),
    enabled: z.boolean(),
    intakeQuestionSetId: SlugSchema,
  })
  .strict();

export const JurisdictionReleaseReferenceSchema = z
  .object({
    schemaVersion: VersionSchema,
    jurisdictionId: SlugSchema,
    releaseVersion: VersionSchema,
    contentVersion: VersionSchema,
    ruleVersion: VersionSchema,
    guidanceVersion: VersionSchema,
  })
  .strict();

const ProjectObjectSchema = z
  .object({
    id: ProjectIdSchema,
    organizationId: OrganizationIdSchema,
    name: z.string().trim().min(2).max(160),
    description: z.string().trim().min(1).max(2000).optional(),
    projectTypeId: SlugSchema,
    status: ProjectStatusSchema,
    location: ProjectLocationSchema.optional(),
    jurisdictionRelease: JurisdictionReleaseReferenceSchema,
    latestReadinessReportId: ReportIdSchema.optional(),
    version: z.number().int().positive(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
    archivedAt: IsoDateTimeSchema.optional(),
  })
  .strict();

export const ProjectSchema = ProjectObjectSchema.superRefine(
  (project, context) => {
    if (project.status === 'archived' && !project.archivedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['archivedAt'],
        message: 'Archived projects require archivedAt.',
      });
    }
    if (project.status !== 'archived' && project.archivedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['archivedAt'],
        message: 'Only archived projects may include archivedAt.',
      });
    }
    if (project.status === 'report_ready' && !project.latestReadinessReportId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['latestReadinessReportId'],
        message: 'Report-ready projects require a readiness report.',
      });
    }
    if (
      ['draft', 'intake_in_progress', 'ready_for_review'].includes(
        project.status,
      ) &&
      project.latestReadinessReportId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['latestReadinessReportId'],
        message: 'This project status is incompatible with a saved report.',
      });
    }
  },
);

export const ProjectSummarySchema = ProjectObjectSchema.pick({
  id: true,
  organizationId: true,
  name: true,
  projectTypeId: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
});

export const ProjectListQuerySchema = PaginationQuerySchema.extend({
  status: ProjectStatusSchema.optional(),
  projectTypeId: SlugSchema.optional(),
});

export const ProjectListSchema = createPaginatedSchema(ProjectSummarySchema);

export const CreateProjectBodySchema = z
  .object({
    idempotencyKey: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(160),
    description: z.string().trim().min(1).max(2000).optional(),
    projectTypeId: SlugSchema,
    jurisdictionRelease: JurisdictionReleaseReferenceSchema,
    location: ProjectLocationSchema.optional(),
  })
  .strict();

export const UpdateProjectBodySchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    name: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().min(1).max(2000).nullable().optional(),
    projectTypeId: SlugSchema.optional(),
    location: ProjectLocationSchema.nullable().optional(),
    status: z.enum(['draft', 'intake_in_progress', 'archived']).optional(),
  })
  .strict()
  .refine(
    (body) => Object.keys(body).some((key) => key !== 'expectedVersion'),
    'At least one project field must be updated.',
  );

export const DeleteProjectBodySchema = z
  .object({
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export type Project = z.infer<typeof ProjectSchema>;
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type ProjectType = z.infer<typeof ProjectTypeSchema>;
