import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  AgentRunSchema,
  ConversationHistoryQuerySchema,
  ConversationHistorySchema,
  ConversationInvocationSchema,
  InvokeConversationBodySchema,
} from './agent.js';
import {
  ApiErrorSchema,
  ConversationIdSchema,
  MutationResultSchema,
  ProjectIdSchema,
  ReportIdSchema,
  TaskIdSchema,
} from './common.js';
import { LivenessResponseSchema, ReadinessResponseSchema } from './health.js';
import {
  CompleteIntakeBodySchema,
  ProjectIntakeSchema,
  UpdateIntakeBodySchema,
} from './intake.js';
import {
  CreateProjectBodySchema,
  DeleteProjectBodySchema,
  ProjectListQuerySchema,
  ProjectListSchema,
  ProjectSchema,
  UpdateProjectBodySchema,
} from './projects.js';
import {
  GenerateReadinessReportBodySchema,
  ReadinessPreviewRequestSchema,
  ReadinessPreviewSchema,
  ReadinessReportSchema,
} from './readiness.js';
import {
  ProjectTaskListQuerySchema,
  ProjectTaskListSchema,
  ProjectTaskSchema,
  UpdateProjectTaskBodySchema,
} from './tasks.js';

const contract = initContract();

const errorResponses = {
  400: ApiErrorSchema,
  401: ApiErrorSchema,
  403: ApiErrorSchema,
  404: ApiErrorSchema,
  409: ApiErrorSchema,
  422: ApiErrorSchema,
  429: ApiErrorSchema,
  500: ApiErrorSchema,
  503: ApiErrorSchema,
} as const;

const projectPathParams = z.object({ projectId: ProjectIdSchema }).strict();

export const AUTHORIZATION_CONVENTIONS = {
  publicRoutes: ['health.liveness', 'health.readiness'],
  authenticatedRoutes:
    'All other routes require a verified server-side identity and active organization membership.',
  ownership:
    'Project identifiers never grant access. Services must scope every project, intake, report, conversation, and task operation to the active organization.',
  implementation:
    'These contracts describe transport only. Authorization is enforced by web application services and persistence predicates.',
} as const;

export const healthContract = contract.router(
  {
    liveness: {
      method: 'GET',
      path: '/live',
      responses: {
        200: LivenessResponseSchema,
      },
      summary: 'Process liveness without dependency detail',
    },
    readiness: {
      method: 'GET',
      path: '/ready',
      responses: {
        200: ReadinessResponseSchema,
        503: ReadinessResponseSchema,
      },
      summary: 'Required dependency and configuration readiness',
    },
  },
  { pathPrefix: '/health' },
);

export const projectsContract = contract.router(
  {
    list: {
      method: 'GET',
      path: '',
      query: ProjectListQuerySchema,
      responses: { 200: ProjectListSchema, ...errorResponses },
      summary: 'List projects in the active organization',
    },
    create: {
      method: 'POST',
      path: '',
      body: CreateProjectBodySchema,
      responses: { 201: ProjectSchema, ...errorResponses },
      summary: 'Create a project in the active organization',
    },
    get: {
      method: 'GET',
      path: '/:projectId',
      pathParams: projectPathParams,
      responses: { 200: ProjectSchema, ...errorResponses },
      summary: 'Read an organization-scoped project',
    },
    update: {
      method: 'PATCH',
      path: '/:projectId',
      pathParams: projectPathParams,
      body: UpdateProjectBodySchema,
      responses: { 200: ProjectSchema, ...errorResponses },
      summary: 'Update mutable project fields using optimistic concurrency',
    },
    delete: {
      method: 'DELETE',
      path: '/:projectId',
      pathParams: projectPathParams,
      body: DeleteProjectBodySchema,
      responses: { 200: MutationResultSchema, ...errorResponses },
      summary: 'Delete synthetic/demo project data where policy permits',
    },
    getIntake: {
      method: 'GET',
      path: '/:projectId/intake',
      pathParams: projectPathParams,
      responses: { 200: ProjectIntakeSchema, ...errorResponses },
      summary: 'Read the versioned intake for a project',
    },
    updateIntake: {
      method: 'PATCH',
      path: '/:projectId/intake',
      pathParams: projectPathParams,
      body: UpdateIntakeBodySchema,
      responses: { 200: ProjectIntakeSchema, ...errorResponses },
      summary: 'Update intake answers using optimistic concurrency',
    },
    completeIntake: {
      method: 'POST',
      path: '/:projectId/intake/complete',
      pathParams: projectPathParams,
      body: CompleteIntakeBodySchema,
      responses: { 200: ProjectIntakeSchema, ...errorResponses },
      summary: 'Validate and mark a complete intake snapshot',
    },
    previewReadiness: {
      method: 'POST',
      path: '/:projectId/permit-readiness/preview',
      pathParams: projectPathParams,
      body: ReadinessPreviewRequestSchema,
      responses: { 200: ReadinessPreviewSchema, ...errorResponses },
      summary: 'Preview deterministic permit triggers and missing information',
    },
    generateReadinessReport: {
      method: 'POST',
      path: '/:projectId/permit-readiness/reports',
      pathParams: projectPathParams,
      body: GenerateReadinessReportBodySchema,
      responses: {
        201: ReadinessReportSchema,
        202: AgentRunSchema,
        ...errorResponses,
      },
      summary: 'Generate or return an idempotent readiness report',
    },
    getReadinessReport: {
      method: 'GET',
      path: '/:projectId/permit-readiness/reports/:reportId',
      pathParams: z
        .object({
          projectId: ProjectIdSchema,
          reportId: ReportIdSchema,
        })
        .strict(),
      responses: { 200: ReadinessReportSchema, ...errorResponses },
      summary: 'Read an immutable organization-scoped readiness report',
    },
    invokeConversation: {
      method: 'POST',
      path: '/:projectId/conversations/invoke',
      pathParams: projectPathParams,
      body: InvokeConversationBodySchema,
      responses: { 202: ConversationInvocationSchema, ...errorResponses },
      summary: 'Invoke the bounded permit-readiness conversation',
    },
    getConversationHistory: {
      method: 'GET',
      path: '/:projectId/conversations/:conversationId/messages',
      pathParams: z
        .object({
          projectId: ProjectIdSchema,
          conversationId: ConversationIdSchema,
        })
        .strict(),
      query: ConversationHistoryQuerySchema,
      responses: { 200: ConversationHistorySchema, ...errorResponses },
      summary: 'Read applicant-safe conversation history',
    },
    listTasks: {
      method: 'GET',
      path: '/:projectId/tasks',
      pathParams: projectPathParams,
      query: ProjectTaskListQuerySchema,
      responses: { 200: ProjectTaskListSchema, ...errorResponses },
      summary: 'List report-derived project tasks',
    },
    updateTask: {
      method: 'PATCH',
      path: '/:projectId/tasks/:taskId',
      pathParams: z
        .object({
          projectId: ProjectIdSchema,
          taskId: TaskIdSchema,
        })
        .strict(),
      body: UpdateProjectTaskBodySchema,
      responses: { 200: ProjectTaskSchema, ...errorResponses },
      summary: 'Update an applicant-owned project task status',
    },
  },
  { pathPrefix: '/projects' },
);

export const apiContract = contract.router(
  {
    health: healthContract,
    projects: projectsContract,
  },
  { pathPrefix: '/api/v1' },
);

export type ApiContract = typeof apiContract;
