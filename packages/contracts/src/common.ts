import { z } from 'zod';

export const CONTRACT_VERSION = '1.0.0';

export const SlugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const VersionSchema = z
  .string()
  .min(3)
  .max(64)
  .regex(/^[0-9]+(?:\.[0-9]+){1,2}(?:-[a-z0-9.-]+)?$/i);

export const PlatformAgentVersionSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/);

export const UuidSchema = z.string().uuid();
export const UserIdSchema = UuidSchema.brand<'UserId'>();
export const OrganizationIdSchema = UuidSchema.brand<'OrganizationId'>();
export const MembershipIdSchema = UuidSchema.brand<'MembershipId'>();
export const ProjectIdSchema = UuidSchema.brand<'ProjectId'>();
export const ReportIdSchema = UuidSchema.brand<'ReportId'>();
export const ConversationIdSchema = UuidSchema.brand<'ConversationId'>();
export const RunIdSchema = UuidSchema.brand<'RunId'>();
export const TaskIdSchema = UuidSchema.brand<'TaskId'>();

export const IsoDateSchema = z.string().refine(
  (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      return false;
    }
    const date = new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
    );
    return date.toISOString().slice(0, 10) === value;
  },
  { message: 'Expected a valid ISO calendar date (YYYY-MM-DD).' },
);

export const IsoDateTimeSchema = z.string().datetime({ offset: true });

export const CorrelationIdSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

export const PaginationQuerySchema = z
  .object({
    cursor: z.string().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export const PaginationMetaSchema = z
  .object({
    nextCursor: z.string().min(1).max(512).nullable(),
    hasMore: z.boolean(),
  })
  .strict();

export function createPaginatedSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z
    .object({
      items: z.array(itemSchema),
      page: PaginationMetaSchema,
    })
    .strict();
}

export const ApiErrorCodeSchema = z.enum([
  'BAD_REQUEST',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'VALIDATION_FAILED',
  'RATE_LIMITED',
  'DEPENDENCY_UNAVAILABLE',
  'INTERNAL_ERROR',
]);

export const ApiFieldErrorSchema = z
  .object({
    path: z.array(z.union([z.string(), z.number().int().nonnegative()])),
    code: z.string().min(1).max(80),
    message: z.string().min(1).max(500),
  })
  .strict();

export const ApiErrorSchema = z
  .object({
    error: z
      .object({
        code: ApiErrorCodeSchema,
        message: z.string().min(1).max(500),
        correlationId: CorrelationIdSchema,
        retryable: z.boolean(),
        fieldErrors: z.array(ApiFieldErrorSchema).max(100).optional(),
      })
      .strict(),
  })
  .strict();

export const MutationResultSchema = z
  .object({
    success: z.literal(true),
  })
  .strict();

export type ApiError = z.infer<typeof ApiErrorSchema>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type PlatformAgentVersion = z.infer<typeof PlatformAgentVersionSchema>;
