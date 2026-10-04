import 'server-only';

import {
  ConversationMessageSchema,
  ConversationSchema,
  CreateProjectBodySchema,
  InvokeConversationBodySchema,
  ProjectIntakeSchema,
  ProjectLocationSchema,
  ProjectSchema,
  ProjectSummarySchema,
  ProjectTaskSchema,
  ReadinessReportSchema,
  type IntakeAnswer,
  type PermitCondition,
  type Project,
  type ProjectTask,
} from '@permit-readiness/contracts';
import { getPermitReadinessAgent } from './agent';
import type { AuthSession } from './auth';
import {
  calculateCompleteness,
  demoConfiguration,
  DEMO_RELEASE,
  getDemoQuestionSet,
} from './demo-config';
import {
  ResourceNotFoundError,
  VersionConflictError,
  type CreateProjectInput,
  type GenerateReportInput,
  type PermitAppRepository,
  type ProjectWorkspace,
  type SaveIntakeInput,
} from './repository-types';

const isoNow = () => new Date().toISOString();
const copy = <T>(value: T): T => structuredClone(value);

function createIntake(project: Project, answers: IntakeAnswer[] = []) {
  const questionSet = getDemoQuestionSet(project.projectTypeId);
  const completeness = calculateCompleteness(project.projectTypeId, answers);
  return ProjectIntakeSchema.parse({
    projectId: project.id,
    questionSetId: questionSet.id,
    questionSetVersion: questionSet.version,
    answers,
    completeness,
    version: 1,
    updatedAt: project.updatedAt,
    completedAt: completeness.isComplete ? project.updatedAt : undefined,
  });
}

function buildProject(
  organizationId: string,
  input: CreateProjectInput,
): Project {
  const timestamp = isoNow();
  return ProjectSchema.parse({
    id: crypto.randomUUID(),
    organizationId,
    name: input.name,
    description: input.description,
    projectTypeId: input.projectTypeId,
    jurisdictionRelease: input.jurisdictionRelease,
    location: input.location,
    status: 'draft',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

function conditionMatches(
  condition: PermitCondition,
  project: Project,
  answers: IntakeAnswer[],
): boolean {
  if (condition.type === 'project_type') {
    return condition.projectTypeIds.includes(project.projectTypeId);
  }
  if (condition.type === 'location_provided') {
    return Boolean(project.location) === condition.expected;
  }
  if (condition.type === 'location_intersects_zone') return false;
  if (condition.type === 'all' || condition.type === 'any') {
    const matches = (item: PermitCondition) =>
      conditionMatches(item, project, answers);
    return condition.type === 'all'
      ? condition.conditions.every(matches)
      : condition.conditions.some(matches);
  }
  if (condition.type === 'not') {
    return !conditionMatches(condition.condition, project, answers);
  }
  if (condition.type !== 'answer') return false;
  const answer = answers.find(
    (item) => item.questionId === condition.questionId,
  );
  if (!answer || answer.state !== 'answered') return false;
  if (condition.operator === 'equals') return answer.value === condition.value;
  if (condition.operator === 'not_equals') {
    return answer.value !== condition.value;
  }
  return (
    Array.isArray(answer.value) &&
    answer.value.includes(String(condition.value))
  );
}

function buildCitations(accessedAt: string) {
  return demoConfiguration.guidanceSources.map((source) => ({
    id: `citation-${source.id}`,
    sourceId: source.id,
    sourceVersion: source.version,
    title: source.title,
    publisher: source.publisher,
    url: source.url,
    locator: { heading: 'Synthetic planning guidance' },
    excerpt:
      'Illustrative source metadata supplied to demonstrate traceable guidance.',
    accessedAt,
  }));
}

export function buildDemoReport(workspace: ProjectWorkspace) {
  const createdAt = isoNow();
  const matchedRules = demoConfiguration.rules.filter((rule) =>
    conditionMatches(
      rule.condition as PermitCondition,
      workspace.project,
      workspace.intake.answers,
    ),
  );
  const citations = buildCitations(createdAt);
  const recommendations = matchedRules.map((rule) => {
    const permit = demoConfiguration.permits.find(
      (candidate) => candidate.id === rule.permitTypeId,
    );
    if (!permit) throw new ResourceNotFoundError('Permit type not found.');
    const citationIds = permit.guidanceSourceIds.map(
      (sourceId) => `citation-${sourceId}`,
    );
    return {
      permitTypeId: permit.id,
      disposition: rule.outcome,
      title: permit.name,
      rationale: rule.explanation,
      ruleIds: [rule.id],
      citationIds,
      nextActions: [
        `Confirm the illustrative ${permit.kind} path with ${permit.authorityName}.`,
      ],
    };
  });
  const missingQuestionIds = [
    ...workspace.intake.completeness.missingRequiredQuestionIds,
    ...workspace.intake.completeness.unknownRequiredQuestionIds,
  ];
  const questionSet = getDemoQuestionSet(workspace.project.projectTypeId);
  const missingInformation = missingQuestionIds.map((questionId) => {
    const question = questionSet.questions.find(
      (candidate) => candidate.id === questionId,
    );
    return {
      id: `missing-${questionId}`,
      questionId,
      label: question?.label ?? questionId,
      reason: 'This required answer is missing or marked unknown.',
      severity: 'required' as const,
    };
  });

  return ReadinessReportSchema.parse({
    id: crypto.randomUUID(),
    projectId: workspace.project.id,
    projectVersion: workspace.project.version,
    conversationId: workspace.conversation?.id,
    status: missingInformation.length ? 'degraded' : 'completed',
    jurisdictionRelease: workspace.project.jurisdictionRelease,
    agentVersion: '1.0.0-local-demo',
    summary:
      'This synthetic readiness report organizes deterministic sample results, visible gaps, assumptions, and next actions for preparation.',
    recommendations,
    missingInformation,
    dependencies: demoConfiguration.permitDependencies,
    assumptions: [
      'The supplied location is approximate and has not been compared with authoritative land records.',
    ],
    citations,
    limitations: [
      'This guidance is for preparation only. It is not an application, approval, legal opinion, or complete statement of requirements.',
    ],
    createdAt,
  });
}

function seedWorkspace(): ProjectWorkspace {
  const timestamp = '2026-10-03T16:00:00.000Z';
  const project = ProjectSchema.parse({
    id: '33333333-3333-4333-8333-333333333333',
    organizationId: '22222222-2222-4222-8222-222222222222',
    name: 'North Valley connectivity route',
    description:
      'A synthetic rural broadband route used to demonstrate early planning.',
    projectTypeId: 'community-connectivity',
    status: 'intake_in_progress',
    jurisdictionRelease: DEMO_RELEASE,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const answers: IntakeAnswer[] = [
    {
      questionId: 'public-land-involved',
      state: 'answered',
      kind: 'boolean',
      value: true,
    },
    {
      questionId: 'near-water-feature',
      state: 'unknown',
    },
  ];
  return {
    project,
    intake: createIntake(project, answers),
    tasks: [],
    messages: [],
  };
}

export class LocalDemoRepository implements PermitAppRepository {
  readonly adapterName = 'local-demo-memory';
  private readonly workspaces = new Map<string, ProjectWorkspace>();
  private readonly projectCreationRequests = new Map<
    string,
    { fingerprint: string; projectId: string }
  >();
  private readonly reportRequests = new Map<
    string,
    { projectId: string; reportId: string }
  >();

  constructor() {
    const seeded = seedWorkspace();
    this.workspaces.set(seeded.project.id, seeded);
  }

  async listProjects(session: AuthSession) {
    return [...this.workspaces.values()]
      .filter(
        (workspace) =>
          workspace.project.organizationId === session.organizationId,
      )
      .map(({ project }) =>
        ProjectSummarySchema.parse({
          id: project.id,
          organizationId: project.organizationId,
          name: project.name,
          projectTypeId: project.projectTypeId,
          status: project.status,
          version: project.version,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        }),
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async createProject(session: AuthSession, raw: CreateProjectInput) {
    const input = CreateProjectBodySchema.parse(raw);
    const requestKey = input.idempotencyKey
      ? `${session.organizationId}:${input.idempotencyKey}`
      : undefined;
    const fingerprint = JSON.stringify(input);
    const existingRequest = requestKey
      ? this.projectCreationRequests.get(requestKey)
      : undefined;
    if (existingRequest) {
      if (existingRequest.fingerprint !== fingerprint) {
        throw new VersionConflictError(
          'The project idempotency key was already used with different input.',
        );
      }
      const existing = this.workspaces.get(existingRequest.projectId);
      if (
        !existing ||
        existing.project.organizationId !== session.organizationId
      ) {
        throw new ResourceNotFoundError('Project not found.');
      }
      return copy(existing.project);
    }
    const project = buildProject(session.organizationId, input);
    const workspace = {
      project,
      intake: createIntake(project),
      tasks: [],
      messages: [],
    };
    this.workspaces.set(project.id, workspace);
    if (requestKey) {
      this.projectCreationRequests.set(requestKey, {
        fingerprint,
        projectId: project.id,
      });
    }
    return copy(project);
  }

  async getWorkspace(session: AuthSession, projectId: string) {
    const workspace = this.workspaces.get(projectId);
    if (
      !workspace ||
      workspace.project.organizationId !== session.organizationId
    ) {
      throw new ResourceNotFoundError('Project not found.');
    }
    return copy(workspace);
  }

  async saveIntake(
    session: AuthSession,
    projectId: string,
    input: SaveIntakeInput,
  ) {
    const workspace = await this.getWorkspace(session, projectId);
    if (workspace.intake.version !== input.expectedVersion) {
      throw new VersionConflictError('The intake changed. Reload and retry.');
    }
    if (workspace.project.version !== input.expectedProjectVersion) {
      throw new VersionConflictError('The project changed. Reload and retry.');
    }
    const location = ProjectLocationSchema.parse(input.location);
    const completeness = calculateCompleteness(
      workspace.project.projectTypeId,
      input.answers,
    );
    const updatedAt = isoNow();
    workspace.intake = ProjectIntakeSchema.parse({
      ...workspace.intake,
      answers: input.answers,
      completeness,
      version: workspace.intake.version + 1,
      updatedAt,
      completedAt: completeness.isComplete ? updatedAt : undefined,
    });
    workspace.project = ProjectSchema.parse({
      ...workspace.project,
      location,
      latestReadinessReportId: undefined,
      status:
        completeness.missingRequiredQuestionIds.length === 0
          ? 'ready_for_review'
          : 'intake_in_progress',
      version: workspace.project.version + 1,
      updatedAt,
    });
    workspace.report = undefined;
    workspace.tasks = [];
    this.workspaces.set(projectId, workspace);
    return copy(workspace);
  }

  async invokeNavigator(
    session: AuthSession,
    projectId: string,
    rawMessage: string,
  ) {
    const workspace = await this.getWorkspace(session, projectId);
    const body = InvokeConversationBodySchema.parse({
      conversationId: workspace.conversation?.id,
      expectedConversationVersion: workspace.conversation?.version,
      message: rawMessage,
      idempotencyKey: crypto.randomUUID(),
    });
    const timestamp = isoNow();
    const conversation =
      workspace.conversation ??
      ConversationSchema.parse({
        id: crypto.randomUUID(),
        projectId,
        title: 'Permit readiness questions',
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    const userMessage = ConversationMessageSchema.parse({
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      role: 'user',
      content: body.message,
      createdAt: timestamp,
    });
    const response = await getPermitReadinessAgent().respond({
      project: workspace.project,
      intake: workspace.intake,
      message: body.message,
    });
    const assistantMessage = ConversationMessageSchema.parse({
      ...response,
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      createdAt: isoNow(),
    });
    workspace.conversation = ConversationSchema.parse({
      ...conversation,
      version: conversation.version + 1,
      updatedAt: assistantMessage.createdAt,
    });
    workspace.messages.push(userMessage, assistantMessage);
    workspace.messages = workspace.messages.slice(-100);
    this.workspaces.set(projectId, workspace);
    return copy(workspace);
  }

  async generateReport(
    session: AuthSession,
    projectId: string,
    input: GenerateReportInput,
  ) {
    const workspace = await this.getWorkspace(session, projectId);
    const existing = this.reportRequests.get(input.idempotencyKey);
    if (existing) {
      if (
        existing.projectId === projectId &&
        workspace.project.latestReadinessReportId === existing.reportId
      ) {
        return workspace;
      }
      throw new VersionConflictError(
        'This report request is no longer current.',
      );
    }
    if (workspace.project.version !== input.expectedProjectVersion) {
      throw new VersionConflictError(
        'The project changed. Reload and generate again.',
      );
    }
    const report = buildDemoReport(workspace);
    const timestamp = report.createdAt;
    workspace.report = report;
    workspace.tasks = [
      ...report.recommendations.map((recommendation) =>
        ProjectTaskSchema.parse({
          id: crypto.randomUUID(),
          projectId,
          kind: 'contact_authority',
          status: 'todo',
          title: recommendation.title,
          description:
            recommendation.nextActions[0] ?? recommendation.rationale,
          permitTypeId: recommendation.permitTypeId,
          version: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        }),
      ),
      ...report.missingInformation.map((missing) =>
        ProjectTaskSchema.parse({
          id: crypto.randomUUID(),
          projectId,
          kind: 'answer_question',
          status: 'todo',
          title: missing.label,
          description: missing.reason,
          version: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        }),
      ),
    ];
    workspace.project = ProjectSchema.parse({
      ...workspace.project,
      status: 'report_ready',
      latestReadinessReportId: report.id,
      version: workspace.project.version + 1,
      updatedAt: timestamp,
    });
    this.reportRequests.set(input.idempotencyKey, {
      projectId,
      reportId: report.id,
    });
    this.workspaces.set(projectId, workspace);
    return copy(workspace);
  }

  async updateTask(
    session: AuthSession,
    projectId: string,
    taskId: string,
    status: ProjectTask['status'],
  ) {
    const workspace = await this.getWorkspace(session, projectId);
    const taskIndex = workspace.tasks.findIndex((task) => task.id === taskId);
    const existing = workspace.tasks[taskIndex];
    if (!existing) throw new ResourceNotFoundError('Task not found.');
    const timestamp = isoNow();
    const updated = ProjectTaskSchema.parse({
      ...existing,
      status,
      completedAt: status === 'completed' ? timestamp : undefined,
      version: existing.version + 1,
      updatedAt: timestamp,
    });
    workspace.tasks[taskIndex] = updated;
    this.workspaces.set(projectId, workspace);
    return copy(updated);
  }
}
