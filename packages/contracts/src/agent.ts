import { z } from 'zod';
import {
  ConversationIdSchema,
  IsoDateTimeSchema,
  PaginationQuerySchema,
  PlatformAgentVersionSchema,
  ProjectIdSchema,
  RunIdSchema,
  createPaginatedSchema,
} from './common.js';
import { CitationSchema } from './guidance.js';

export const ConversationMessageRoleSchema = z.enum(['user', 'assistant']);

export const ConversationMessageSchema = z
  .object({
    id: z.string().uuid(),
    conversationId: ConversationIdSchema,
    role: ConversationMessageRoleSchema,
    content: z.string().min(1).max(20_000),
    citations: z.array(CitationSchema).max(50).optional(),
    createdAt: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((message, context) => {
    if (message.role === 'user' && message.citations?.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['citations'],
        message: 'User messages cannot attach system guidance citations.',
      });
    }
  });

export const AgentRunStatusSchema = z.enum([
  'queued',
  'running',
  'needs_input',
  'completed',
  'failed',
  'cancelled',
]);

export const AgentRunSchema = z
  .object({
    id: RunIdSchema,
    conversationId: ConversationIdSchema,
    projectId: ProjectIdSchema,
    status: AgentRunStatusSchema,
    agentVersion: PlatformAgentVersionSchema,
    idempotencyKey: z.string().uuid(),
    startedAt: IsoDateTimeSchema.optional(),
    completedAt: IsoDateTimeSchema.optional(),
    assistantMessage: ConversationMessageSchema.optional(),
    failure: z
      .object({
        code: z.enum([
          'AGENT_UNAVAILABLE',
          'AGENT_TIMEOUT',
          'INVALID_OUTPUT',
          'GUIDANCE_UNAVAILABLE',
          'CANCELLED',
        ]),
        message: z.string().min(1).max(500),
        retryable: z.boolean(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((run, context) => {
    if (run.status === 'completed' && !run.assistantMessage) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['assistantMessage'],
        message: 'Completed runs require an assistant message.',
      });
    }
    if (run.status === 'failed' && !run.failure) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['failure'],
        message: 'Failed runs require a safe failure description.',
      });
    }
    if (!['failed', 'cancelled'].includes(run.status) && run.failure) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['failure'],
        message: 'Only failed or cancelled runs may include failure details.',
      });
    }
    if (
      ['completed', 'failed', 'cancelled'].includes(run.status) &&
      !run.completedAt
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['completedAt'],
        message: 'Terminal runs require completedAt.',
      });
    }
  });

export const ConversationSchema = z
  .object({
    id: ConversationIdSchema,
    projectId: ProjectIdSchema,
    title: z.string().min(1).max(160).optional(),
    version: z.number().int().positive(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict();

export const InvokeConversationBodySchema = z
  .object({
    conversationId: ConversationIdSchema.optional(),
    message: z.string().trim().min(1).max(20_000),
    expectedConversationVersion: z.number().int().positive().optional(),
    idempotencyKey: z.string().uuid(),
  })
  .strict()
  .superRefine((body, context) => {
    if (
      body.expectedConversationVersion !== undefined &&
      body.conversationId === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expectedConversationVersion'],
        message:
          'A conversation version can be supplied only for an existing conversation.',
      });
    }
  });

export const ConversationInvocationSchema = z
  .object({
    conversation: ConversationSchema,
    run: AgentRunSchema,
  })
  .strict();

export const ConversationHistoryQuerySchema = PaginationQuerySchema;
export const ConversationHistorySchema = createPaginatedSchema(
  ConversationMessageSchema,
);

export type AgentRun = z.infer<typeof AgentRunSchema>;
export type Conversation = z.infer<typeof ConversationSchema>;
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;
