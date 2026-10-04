import 'server-only';

import {
  ProjectLocationSchema,
  type ProjectTask,
} from '@permit-readiness/contracts';
import {
  ConversationRepository,
  conflict,
  IntakeRepository,
  OrganizationAccessRepository,
  ProjectRepository,
  ReportRepository,
  TaskRepository,
  createDatabaseConnection,
  parseDatabaseConfig,
} from '@permit-readiness/db';
import { getPermitReadinessAgent } from './agent';
import type { AuthSession } from './auth';
import { calculateCompleteness, getDemoQuestionSet } from './demo-config';
import {
  DependencyUnavailableError,
  type CreateProjectInput,
  type GenerateReportInput,
  type PermitAppRepository,
  type SaveIntakeInput,
} from './repository-types';
import { buildDemoReport } from './local-repository';

const connection = createDatabaseConnection(parseDatabaseConfig());
const accessRepository = new OrganizationAccessRepository(connection.db);
const projectRepository = new ProjectRepository(connection.db);
const intakeRepository = new IntakeRepository(connection.db);
const reportRepository = new ReportRepository(connection.db);
const conversationRepository = new ConversationRepository(connection.db);
const taskRepository = new TaskRepository(connection.db);

const scopeFor = (session: AuthSession, projectId: string) => ({
  organizationId: session.organizationId,
  projectId,
});

const auditFor = (session: AuthSession) => ({
  actorType: 'user' as const,
  actorId: session.userId,
  userId: session.userId,
  correlationId: crypto.randomUUID(),
});

export class DrizzlePermitAppRepository implements PermitAppRepository {
  readonly adapterName = 'postgres-drizzle';

  private async authorize(session: AuthSession) {
    await accessRepository.requireMembership({
      organizationId: session.organizationId,
      userId: session.userId,
    });
  }

  async listProjects(session: AuthSession) {
    await this.authorize(session);
    return [...(await projectRepository.list(session.organizationId))];
  }

  async createProject(session: AuthSession, input: CreateProjectInput) {
    await this.authorize(session);
    const questionSet = getDemoQuestionSet(input.projectTypeId);
    const project = await projectRepository.create({
      ...input,
      organizationId: session.organizationId,
      initialIntake: {
        questionSetId: questionSet.id,
        questionSetVersion: questionSet.version,
        completeness: calculateCompleteness(input.projectTypeId, []),
      },
      audit: auditFor(session),
    });
    return project;
  }

  async getWorkspace(session: AuthSession, projectId: string) {
    await this.authorize(session);
    const scope = scopeFor(session, projectId);
    const project = await projectRepository.get(scope);
    const intake = await intakeRepository.get(scope);
    const tasks = [...(await taskRepository.list(scope))];
    const report = project.latestReadinessReportId
      ? await reportRepository.get(scope, project.latestReadinessReportId)
      : undefined;
    const conversation = await conversationRepository.getActive(scope);
    const messages = conversation
      ? [...(await conversationRepository.listMessages(scope, conversation.id))]
      : [];
    return { project, intake, tasks, report, conversation, messages };
  }

  async saveIntake(
    session: AuthSession,
    projectId: string,
    input: SaveIntakeInput,
  ) {
    await this.authorize(session);
    const scope = scopeFor(session, projectId);
    const project = await projectRepository.get(scope);
    const location = ProjectLocationSchema.parse(input.location);
    const completeness = calculateCompleteness(
      project.projectTypeId,
      input.answers,
    );
    await intakeRepository.saveProjectIntake({
      scope,
      expectedVersion: input.expectedVersion,
      expectedProjectVersion: input.expectedProjectVersion,
      answers: input.answers,
      completeness,
      location,
      audit: auditFor(session),
    });
    return this.getWorkspace(session, projectId);
  }

  async invokeNavigator(
    session: AuthSession,
    projectId: string,
    message: string,
  ) {
    await this.authorize(session);
    const scope = scopeFor(session, projectId);
    const workspace = await this.getWorkspace(session, projectId);
    const conversation = await conversationRepository.getOrCreateActive(
      scope,
      'Permit readiness questions',
    );
    const response = await getPermitReadinessAgent().respond({
      project: workspace.project,
      intake: workspace.intake,
      message,
    });
    await conversationRepository.appendMessages(
      scope,
      conversation.id,
      conversation.version,
      [
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: message,
        },
        { id: crypto.randomUUID(), ...response },
      ],
    );
    return this.getWorkspace(session, projectId);
  }

  async generateReport(
    session: AuthSession,
    projectId: string,
    input: GenerateReportInput,
  ) {
    await this.authorize(session);
    const scope = scopeFor(session, projectId);
    const workspace = await this.getWorkspace(session, projectId);
    const existing = await reportRepository.getByIdempotencyKey(
      scope,
      input.idempotencyKey,
    );
    if (existing) {
      if (workspace.project.latestReadinessReportId === existing.id) {
        return workspace;
      }
      throw conflict('This report request is no longer current.');
    }
    if (workspace.project.version !== input.expectedProjectVersion) {
      throw conflict('Project was changed before the report was generated.');
    }

    const report = buildDemoReport(workspace);
    const tasks = [
      ...report.recommendations.map((recommendation, index) => ({
        recommendationKey: `recommendation-${index + 1}`,
        kind: 'contact_authority' as const,
        title: recommendation.title,
        description: recommendation.nextActions[0] ?? recommendation.rationale,
        permitTypeId: recommendation.permitTypeId,
      })),
      ...report.missingInformation.map((missing) => ({
        kind: 'answer_question' as const,
        title: missing.label,
        description: missing.reason,
      })),
    ];
    await reportRepository.persist({
      organizationId: session.organizationId,
      report,
      idempotencyKey: input.idempotencyKey,
      tasks,
      audit: auditFor(session),
    });
    return this.getWorkspace(session, projectId);
  }

  async updateTask(
    session: AuthSession,
    projectId: string,
    taskId: string,
    status: ProjectTask['status'],
  ) {
    await this.authorize(session);
    const scope = scopeFor(session, projectId);
    const task = (await taskRepository.list(scope)).find(
      (candidate) => candidate.id === taskId,
    );
    if (!task) throw new DependencyUnavailableError('Task not found.');
    return taskRepository.updateStatus(scope, taskId, task.version, status);
  }
}
