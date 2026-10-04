import { z } from 'zod';
import { IsoDateTimeSchema, VersionSchema } from './common.js';

export const LivenessResponseSchema = z
  .object({
    status: z.literal('alive'),
    service: z.string().min(1).max(100),
    version: VersionSchema,
    timestamp: IsoDateTimeSchema,
  })
  .strict();

export const ReadinessDependencySchema = z
  .object({
    name: z.enum([
      'configuration',
      'authentication',
      'database',
      'reference_data',
    ]),
    status: z.enum(['ready', 'unavailable']),
    detail: z.string().min(1).max(160),
  })
  .strict();

export const ReadinessResponseSchema = z
  .object({
    status: z.enum(['ready', 'not_ready']),
    service: z.string().min(1).max(100),
    version: VersionSchema,
    timestamp: IsoDateTimeSchema,
    dependencies: z.array(ReadinessDependencySchema),
  })
  .strict()
  .superRefine((response, context) => {
    const allReady = response.dependencies.every(
      (dependency) => dependency.status === 'ready',
    );
    if ((response.status === 'ready') !== allReady) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['status'],
        message: 'Readiness status must reflect dependency readiness.',
      });
    }
  });

export type LivenessResponse = z.infer<typeof LivenessResponseSchema>;
export type ReadinessResponse = z.infer<typeof ReadinessResponseSchema>;
