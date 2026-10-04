import { z } from 'zod';
import {
  IsoDateSchema,
  IsoDateTimeSchema,
  PaginationQuerySchema,
  ProjectIdSchema,
  SlugSchema,
  TaskIdSchema,
  createPaginatedSchema,
} from './common.js';

export const ProjectTaskStatusSchema = z.enum([
  'todo',
  'in_progress',
  'completed',
  'dismissed',
]);

export const ProjectTaskKindSchema = z.enum([
  'answer_question',
  'contact_authority',
  'review_guidance',
  'prepare_information',
  'other',
]);

export const ProjectTaskSchema = z
  .object({
    id: TaskIdSchema,
    projectId: ProjectIdSchema,
    kind: ProjectTaskKindSchema,
    status: ProjectTaskStatusSchema,
    title: z.string().min(2).max(300),
    description: z.string().min(2).max(2000),
    permitTypeId: SlugSchema.optional(),
    sourceRecommendationId: SlugSchema.optional(),
    dueDate: IsoDateSchema.optional(),
    completedAt: IsoDateTimeSchema.optional(),
    version: z.number().int().positive(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((task, context) => {
    if ((task.status === 'completed') !== Boolean(task.completedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['completedAt'],
        message: 'completedAt must be present exactly for completed tasks.',
      });
    }
  });

export const ProjectTaskListQuerySchema = PaginationQuerySchema.extend({
  status: ProjectTaskStatusSchema.optional(),
});

export const ProjectTaskListSchema = createPaginatedSchema(ProjectTaskSchema);

export const UpdateProjectTaskBodySchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    status: ProjectTaskStatusSchema,
  })
  .strict();

export type ProjectTask = z.infer<typeof ProjectTaskSchema>;
