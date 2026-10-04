import {
  ConversationMessageSchema,
  ConversationSchema,
  IntakeCompletenessSchema,
  ProjectIntakeSchema,
  ProjectSchema,
  ProjectSummarySchema,
  ProjectTaskSchema,
  ProjectTaskStatusSchema,
  ReadinessReportSchema,
  type AgentRun,
  type Conversation,
  type ConversationMessage,
  type IntakeAnswer,
  type Project,
  type ProjectLocation,
  type ProjectSummary,
  type ProjectTask,
  type ReadinessReport,
} from '@permit-readiness/contracts';
import { createHash } from 'node:crypto';
import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { Database, DatabaseExecutor } from './client.js';
import {
  conflict,
  dependencyUnavailable,
  forbidden,
  resourceNotFound,
} from './errors.js';
import { parseGeometryGeoJson, serializeGeometryToEwkt } from './geometry.js';
import {
  buildConversationByIdQuery,
  buildIntakeQuery,
  buildProjectByIdQuery,
  buildProjectListQuery,
  buildReportByIdQuery,
  buildTaskListQuery,
  type OrganizationProjectScope,
} from './queries.js';
import {
  agentRuns,
  auditEvents,
  conversationMessages,
  conversations,
  intakeAnswers,
  intakeQuestionSets,
  memberships,
  organizations,
  projectIntakes,
  projectLocations,
  projectTasks,
  projects,
  readinessRecommendations,
  readinessReports,
  users,
} from './schema.js';
import {
  completeIntakeTransaction,
  createProjectTransaction,
  persistReportTransaction,
  saveIntakeTransaction,
  type TransactionBoundary,
} from './transactions.js';

type IntakeCompleteness = z.infer<typeof IntakeCompletenessSchema>;
type ProjectTaskStatus = z.infer<typeof ProjectTaskStatusSchema>;

export interface OrganizationScope {
  readonly organizationId: string;
  readonly userId: string;
}

export interface AuditContext {
  readonly actorType: 'user' | 'service' | 'agent' | 'system';
  readonly actorId: string;
  readonly userId?: string;
  readonly correlationId: string;
}

export interface CreateProjectCommand {
  readonly id?: string;
  readonly idempotencyKey?: string;
  readonly organizationId: string;
  readonly name: string;
  readonly description?: string;
  readonly projectTypeId: string;
  readonly jurisdictionRelease: Project['jurisdictionRelease'];
  readonly location?: ProjectLocation;
  readonly initialIntake: {
    readonly questionSetId: string;
    readonly questionSetVersion: string;
    readonly completeness: IntakeCompleteness;
  };
  readonly audit: AuditContext;
}

export interface InitializeIntakeCommand {
  readonly scope: OrganizationProjectScope;
  readonly questionSetKey: string;
  readonly completeness: IntakeCompleteness;
}

export interface SaveIntakeCommand {
  readonly scope: OrganizationProjectScope;
  readonly expectedVersion: number;
  readonly answers: readonly IntakeAnswer[];
  readonly completeness: IntakeCompleteness;
}

export interface SaveProjectIntakeCommand extends SaveIntakeCommand {
  readonly expectedProjectVersion: number;
  readonly location: ProjectLocation;
  readonly audit: AuditContext;
}

export interface CompleteIntakeCommand {
  readonly scope: OrganizationProjectScope;
  readonly expectedVersion: number;
  readonly completedAt: Date;
  readonly audit: AuditContext;
}

export interface PersistReportCommand {
  readonly organizationId: string;
  readonly report: ReadinessReport;
  readonly idempotencyKey: string;
  readonly tasks: readonly {
    id?: string;
    recommendationKey?: string;
    kind: ProjectTask['kind'];
    title: string;
    description: string;
    permitTypeId?: string;
    dueDate?: string;
  }[];
  readonly audit: AuditContext;
}

class DrizzleTransactionBoundary
  implements TransactionBoundary<DatabaseExecutor>
{
  constructor(private readonly database: Database) {}

  run<T>(work: (session: DatabaseExecutor) => Promise<T>): Promise<T> {
    return this.database.transaction(async (transaction) => {
      const session: DatabaseExecutor = transaction;
      return work(session);
    });
  }
}

function iso(value: Date): string {
  return value.toISOString();
}

export function deriveProjectCreationId(
  organizationId: string,
  idempotencyKey: string,
): string {
  const hex = createHash('sha256')
    .update(`project:${organizationId}:${idempotencyKey}`)
    .digest('hex')
    .slice(0, 32);
  const characters = [...hex];
  characters[12] = '5';
  characters[16] = (
    (Number.parseInt(characters[16]!, 16) & 0x3) |
    0x8
  ).toString(16);
  const normalized = characters.join('');
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20)}`;
}

function projectMatchesCreateCommand(
  row: typeof projects.$inferSelect,
  command: CreateProjectCommand,
): boolean {
  return (
    row.organizationId === command.organizationId &&
    row.name === command.name &&
    (row.description ?? undefined) === command.description &&
    row.projectTypeId === command.projectTypeId &&
    row.jurisdictionSchemaVersion ===
      command.jurisdictionRelease.schemaVersion &&
    row.jurisdictionId === command.jurisdictionRelease.jurisdictionId &&
    row.jurisdictionReleaseVersion ===
      command.jurisdictionRelease.releaseVersion &&
    row.contentVersion === command.jurisdictionRelease.contentVersion &&
    row.ruleVersion === command.jurisdictionRelease.ruleVersion &&
    row.guidanceVersion === command.jurisdictionRelease.guidanceVersion
  );
}

async function existingLocationMatches(
  database: DatabaseExecutor,
  projectId: string,
  command: CreateProjectCommand,
): Promise<boolean> {
  const rows = await database
    .select({
      geometryJson: sql<string>`ST_AsGeoJSON(${projectLocations.geometry})`,
      source: projectLocations.source,
      description: projectLocations.description,
    })
    .from(projectLocations)
    .where(
      and(
        eq(projectLocations.projectId, projectId),
        eq(projectLocations.organizationId, command.organizationId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!command.location) {
    return !row;
  }
  if (!row) {
    return false;
  }
  return (
    JSON.stringify(parseGeometryGeoJson(row.geometryJson)) ===
      JSON.stringify(command.location.geometry) &&
    row.source === command.location.source &&
    (row.description ?? undefined) === command.location.description
  );
}

function mapProject(
  row: typeof projects.$inferSelect,
  location?: {
    geometry: ProjectLocation['geometry'];
    source: ProjectLocation['source'];
    description?: string;
  },
): Project {
  return ProjectSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    description: row.description ?? undefined,
    projectTypeId: row.projectTypeId,
    status: row.status,
    location,
    jurisdictionRelease: {
      schemaVersion: row.jurisdictionSchemaVersion,
      jurisdictionId: row.jurisdictionId,
      releaseVersion: row.jurisdictionReleaseVersion,
      contentVersion: row.contentVersion,
      ruleVersion: row.ruleVersion,
      guidanceVersion: row.guidanceVersion,
    },
    latestReadinessReportId: row.latestReadinessReportId ?? undefined,
    version: row.version,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    archivedAt: row.archivedAt ? iso(row.archivedAt) : undefined,
  });
}

function mapProjectSummary(row: typeof projects.$inferSelect): ProjectSummary {
  return ProjectSummarySchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    projectTypeId: row.projectTypeId,
    status: row.status,
    version: row.version,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  });
}

async function insertAuditEvent(
  database: DatabaseExecutor,
  input: AuditContext & {
    organizationId?: string;
    projectId?: string;
    eventType: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, string | number | boolean | null>;
  },
): Promise<void> {
  await database.insert(auditEvents).values({
    organizationId: input.organizationId,
    projectId: input.projectId,
    userId: input.userId,
    actorType: input.actorType,
    actorId: input.actorId,
    eventType: input.eventType,
    targetType: input.targetType,
    targetId: input.targetId,
    correlationId: input.correlationId,
    metadata: input.metadata ?? {},
  });
}

export class OrganizationAccessRepository {
  constructor(private readonly database: DatabaseExecutor) {}

  async requireMembership(scope: OrganizationScope): Promise<void> {
    const membership = await this.database
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.organizationId, scope.organizationId),
          eq(memberships.userId, scope.userId),
        ),
      )
      .limit(1);

    if (!membership[0]) {
      throw forbidden();
    }
  }
}

export interface ExternalIdentitySession {
  readonly userId: string;
  readonly organizationId: string;
  readonly displayName: string;
  readonly email?: string;
}

export class ExternalIdentityRepository {
  constructor(private readonly database: DatabaseExecutor) {}

  async resolveSession(input: {
    provider: 'entra_external_id';
    subjectId: string;
    organizationId: string;
  }): Promise<ExternalIdentitySession | null> {
    const rows = await this.database
      .select({
        userId: users.id,
        organizationId: memberships.organizationId,
        displayName: users.displayName,
        email: users.email,
      })
      .from(users)
      .innerJoin(memberships, eq(memberships.userId, users.id))
      .innerJoin(
        organizations,
        eq(organizations.id, memberships.organizationId),
      )
      .where(
        and(
          eq(users.provider, input.provider),
          eq(users.subjectId, input.subjectId),
          eq(memberships.organizationId, input.organizationId),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return {
      userId: row.userId,
      organizationId: row.organizationId,
      displayName: row.displayName,
      email: row.email ?? undefined,
    };
  }
}
export class ProjectRepository {
  private readonly transactions: TransactionBoundary<DatabaseExecutor>;

  constructor(
    private readonly database: Database,
    transactions: TransactionBoundary<DatabaseExecutor> = new DrizzleTransactionBoundary(
      database,
    ),
  ) {
    this.transactions = transactions;
  }

  async create(command: CreateProjectCommand): Promise<Project> {
    const projectId =
      command.id ??
      (command.idempotencyKey
        ? deriveProjectCreationId(
            command.organizationId,
            command.idempotencyKey,
          )
        : undefined);
    return createProjectTransaction(
      this.transactions,
      {
        insertOrGetProject: async (session) => {
          const insert = session.insert(projects).values({
            id: projectId,
            organizationId: command.organizationId,
            name: command.name,
            description: command.description,
            projectTypeId: command.projectTypeId,
            jurisdictionSchemaVersion:
              command.jurisdictionRelease.schemaVersion,
            jurisdictionId: command.jurisdictionRelease.jurisdictionId,
            jurisdictionReleaseVersion:
              command.jurisdictionRelease.releaseVersion,
            contentVersion: command.jurisdictionRelease.contentVersion,
            ruleVersion: command.jurisdictionRelease.ruleVersion,
            guidanceVersion: command.jurisdictionRelease.guidanceVersion,
          });
          const rows = command.idempotencyKey
            ? await insert
                .onConflictDoNothing({ target: projects.id })
                .returning()
            : await insert.returning();
          const row = rows[0];
          if (row) {
            return { result: row, created: true };
          }
          if (!projectId) {
            throw new Error('Project insert returned no row.');
          }
          const existingRows = await session
            .select()
            .from(projects)
            .where(
              and(
                eq(projects.id, projectId),
                eq(projects.organizationId, command.organizationId),
              ),
            )
            .limit(1);
          const existing = existingRows[0];
          if (
            !existing ||
            !projectMatchesCreateCommand(existing, command) ||
            !(await existingLocationMatches(session, projectId, command))
          ) {
            throw conflict(
              'The project idempotency key was already used with different input.',
            );
          }
          return { result: existing, created: false };
        },
        resolveQuestionSet: async (session) => {
          const rows = await session
            .select({
              id: intakeQuestionSets.id,
              projectTypeIds: intakeQuestionSets.projectTypeIds,
            })
            .from(intakeQuestionSets)
            .where(
              and(
                eq(
                  intakeQuestionSets.jurisdictionId,
                  command.jurisdictionRelease.jurisdictionId,
                ),
                eq(
                  intakeQuestionSets.releaseVersion,
                  command.jurisdictionRelease.releaseVersion,
                ),
                eq(
                  intakeQuestionSets.questionSetId,
                  command.initialIntake.questionSetId,
                ),
                eq(
                  intakeQuestionSets.version,
                  command.initialIntake.questionSetVersion,
                ),
              ),
            )
            .limit(1);
          const questionSet = rows[0];
          if (
            !questionSet ||
            !questionSet.projectTypeIds.includes(command.projectTypeId)
          ) {
            throw dependencyUnavailable(
              'Configured intake question set is not seeded for this release and project type.',
            );
          }
          return questionSet.id;
        },
        insertInitialIntake: async (session, project, questionSetKey) => {
          await session.insert(projectIntakes).values({
            organizationId: command.organizationId,
            projectId: project.id,
            questionSetId: questionSetKey,
            completeness: command.initialIntake.completeness,
          });
        },
        insertLocation: async (session, project) => {
          if (!command.location) {
            return;
          }
          await session.insert(projectLocations).values({
            organizationId: command.organizationId,
            projectId: project.id,
            geometryKind:
              command.location.geometry.type === 'Point' ? 'point' : 'polygon',
            geometry: serializeGeometryToEwkt(command.location.geometry),
            source: command.location.source,
            description: command.location.description,
          });
        },
        writeAuditEvent: async (session, project) => {
          await insertAuditEvent(session, {
            ...command.audit,
            organizationId: command.organizationId,
            projectId: project.id,
            eventType: 'project.created',
            targetType: 'project',
            targetId: project.id,
          });
        },
      },
      Boolean(command.location),
    ).then((row) => mapProject(row, command.location));
  }

  async get(scope: OrganizationProjectScope): Promise<Project> {
    const rows = await buildProjectByIdQuery(this.database, scope);
    const row = rows[0];
    if (!row) {
      throw resourceNotFound('Project');
    }

    const location =
      row.geometryJson && row.locationSource
        ? {
            geometry: parseGeometryGeoJson(row.geometryJson),
            source: row.locationSource,
            ...(row.locationDescription
              ? { description: row.locationDescription }
              : {}),
          }
        : undefined;
    return mapProject(row.project, location);
  }

  async list(organizationId: string): Promise<readonly ProjectSummary[]> {
    const rows = await buildProjectListQuery(this.database, organizationId);
    return rows.map(mapProjectSummary);
  }
}

export class IntakeRepository {
  private readonly transactions: TransactionBoundary<DatabaseExecutor>;

  constructor(
    private readonly database: Database,
    transactions: TransactionBoundary<DatabaseExecutor> = new DrizzleTransactionBoundary(
      database,
    ),
  ) {
    this.transactions = transactions;
  }

  async initialize(command: InitializeIntakeCommand): Promise<void> {
    const project = await this.database
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, command.scope.projectId),
          eq(projects.organizationId, command.scope.organizationId),
        ),
      )
      .limit(1);
    if (!project[0]) {
      throw resourceNotFound('Project');
    }

    await this.database.insert(projectIntakes).values({
      organizationId: command.scope.organizationId,
      projectId: command.scope.projectId,
      questionSetId: command.questionSetKey,
      completeness: command.completeness,
    });
  }

  async get(scope: OrganizationProjectScope) {
    const rows = await buildIntakeQuery(this.database, scope);
    const first = rows[0];
    if (!first) {
      throw resourceNotFound('Project intake');
    }

    const questionSetRows = await this.database
      .select()
      .from(intakeQuestionSets)
      .where(eq(intakeQuestionSets.id, first.intake.questionSetId))
      .limit(1);
    const questionSet = questionSetRows[0];
    if (!questionSet) {
      throw resourceNotFound('Intake question set');
    }

    const answers: IntakeAnswer[] = rows.flatMap(({ answer }) => {
      if (!answer) {
        return [];
      }
      if (answer.state !== 'answered') {
        return [{ questionId: answer.questionId, state: answer.state }];
      }
      if (!answer.kind || answer.value === null) {
        throw new Error('Answered intake rows require a kind and value.');
      }
      return [
        {
          questionId: answer.questionId,
          state: 'answered',
          kind: answer.kind,
          value: answer.value,
        } as IntakeAnswer,
      ];
    });

    return ProjectIntakeSchema.parse({
      projectId: first.intake.projectId,
      questionSetId: questionSet.questionSetId,
      questionSetVersion: questionSet.version,
      answers,
      completeness: first.intake.completeness,
      version: first.intake.version,
      updatedAt: iso(first.intake.updatedAt),
      completedAt: first.intake.completedAt
        ? iso(first.intake.completedAt)
        : undefined,
    });
  }

  async saveProjectIntake(command: SaveProjectIntakeCommand): Promise<void> {
    const changedAt = new Date();
    await saveIntakeTransaction(this.transactions, {
      saveIntake: async (session) => {
        const updated = await session
          .update(projectIntakes)
          .set({
            completeness: command.completeness,
            version: sql`${projectIntakes.version} + 1`,
            updatedAt: changedAt,
            completedAt: command.completeness.isComplete ? changedAt : null,
          })
          .where(
            and(
              eq(projectIntakes.organizationId, command.scope.organizationId),
              eq(projectIntakes.projectId, command.scope.projectId),
              eq(projectIntakes.version, command.expectedVersion),
            ),
          )
          .returning({ id: projectIntakes.id });
        const intake = updated[0];
        if (!intake) {
          await this.throwIntakeVersionError(session, command.scope);
          throw new Error('Unreachable intake update state.');
        }

        await session
          .delete(intakeAnswers)
          .where(eq(intakeAnswers.projectIntakeId, intake.id));
        if (command.answers.length > 0) {
          await session.insert(intakeAnswers).values(
            command.answers.map((answer) => ({
              organizationId: command.scope.organizationId,
              projectId: command.scope.projectId,
              projectIntakeId: intake.id,
              questionId: answer.questionId,
              state: answer.state,
              kind: answer.state === 'answered' ? answer.kind : null,
              value: answer.state === 'answered' ? answer.value : null,
            })),
          );
        }
        return intake;
      },
      saveLocation: async (session) => {
        await session
          .insert(projectLocations)
          .values({
            organizationId: command.scope.organizationId,
            projectId: command.scope.projectId,
            geometryKind:
              command.location.geometry.type === 'Point' ? 'point' : 'polygon',
            geometry: serializeGeometryToEwkt(command.location.geometry),
            source: command.location.source,
            description: command.location.description,
          })
          .onConflictDoUpdate({
            target: [
              projectLocations.projectId,
              projectLocations.organizationId,
            ],
            set: {
              geometryKind:
                command.location.geometry.type === 'Point'
                  ? 'point'
                  : 'polygon',
              geometry: serializeGeometryToEwkt(command.location.geometry),
              source: command.location.source,
              description: command.location.description,
              updatedAt: changedAt,
            },
          });
      },
      updateProjectAndInvalidateReport: async (session) => {
        const updated = await session
          .update(projects)
          .set({
            status:
              command.completeness.missingRequiredQuestionIds.length === 0
                ? 'ready_for_review'
                : 'intake_in_progress',
            latestReadinessReportId: null,
            version: sql`${projects.version} + 1`,
            updatedAt: changedAt,
          })
          .where(
            and(
              eq(projects.id, command.scope.projectId),
              eq(projects.organizationId, command.scope.organizationId),
              eq(projects.version, command.expectedProjectVersion),
            ),
          )
          .returning({ id: projects.id });
        if (!updated[0]) {
          const exists = await session
            .select({ id: projects.id })
            .from(projects)
            .where(
              and(
                eq(projects.id, command.scope.projectId),
                eq(projects.organizationId, command.scope.organizationId),
              ),
            )
            .limit(1);
          if (!exists[0]) {
            throw resourceNotFound('Project');
          }
          throw conflict('Project was changed by another request.');
        }
      },
      invalidateReportTasks: async (session) => {
        await session
          .delete(projectTasks)
          .where(
            and(
              eq(projectTasks.organizationId, command.scope.organizationId),
              eq(projectTasks.projectId, command.scope.projectId),
              isNotNull(projectTasks.sourceReportId),
            ),
          );
      },
      writeAuditEvent: async (session) => {
        await insertAuditEvent(session, {
          ...command.audit,
          organizationId: command.scope.organizationId,
          projectId: command.scope.projectId,
          eventType: 'intake.saved',
          targetType: 'project_intake',
          targetId: command.scope.projectId,
          metadata: {
            complete: command.completeness.isComplete,
            reportInvalidated: true,
          },
        });
      },
    });
  }

  async save(command: SaveIntakeCommand): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const updated = await transaction
        .update(projectIntakes)
        .set({
          completeness: command.completeness,
          version: sql`${projectIntakes.version} + 1`,
          updatedAt: new Date(),
          completedAt: null,
        })
        .where(
          and(
            eq(projectIntakes.organizationId, command.scope.organizationId),
            eq(projectIntakes.projectId, command.scope.projectId),
            eq(projectIntakes.version, command.expectedVersion),
          ),
        )
        .returning({ id: projectIntakes.id });
      const intake = updated[0];
      if (!intake) {
        await this.throwIntakeVersionError(transaction, command.scope);
        throw new Error('Unreachable intake update state.');
      }

      const questionIds = command.answers.map((answer) => answer.questionId);
      if (questionIds.length > 0) {
        await transaction
          .delete(intakeAnswers)
          .where(
            and(
              eq(intakeAnswers.projectIntakeId, intake.id),
              inArray(intakeAnswers.questionId, questionIds),
            ),
          );
      }

      if (command.answers.length > 0) {
        await transaction.insert(intakeAnswers).values(
          command.answers.map((answer) => ({
            organizationId: command.scope.organizationId,
            projectId: command.scope.projectId,
            projectIntakeId: intake.id,
            questionId: answer.questionId,
            state: answer.state,
            kind: answer.state === 'answered' ? answer.kind : null,
            value: answer.state === 'answered' ? answer.value : null,
          })),
        );
      }
    });
  }

  async complete(command: CompleteIntakeCommand): Promise<void> {
    await completeIntakeTransaction(this.transactions, {
      lockAndCompleteIntake: async (session) => {
        const rows = await session
          .update(projectIntakes)
          .set({
            completedAt: command.completedAt,
            version: sql`${projectIntakes.version} + 1`,
            updatedAt: command.completedAt,
          })
          .where(
            and(
              eq(projectIntakes.organizationId, command.scope.organizationId),
              eq(projectIntakes.projectId, command.scope.projectId),
              eq(projectIntakes.version, command.expectedVersion),
              sql`${projectIntakes.completeness}->>'isComplete' = 'true'`,
            ),
          )
          .returning({ id: projectIntakes.id });
        const intake = rows[0];
        if (!intake) {
          await this.throwIntakeVersionError(session, command.scope);
          throw new Error('Unreachable intake completion state.');
        }
        return intake;
      },
      updateProjectStatus: async (session) => {
        const updated = await session
          .update(projects)
          .set({
            status: 'ready_for_review',
            version: sql`${projects.version} + 1`,
            updatedAt: command.completedAt,
          })
          .where(
            and(
              eq(projects.id, command.scope.projectId),
              eq(projects.organizationId, command.scope.organizationId),
            ),
          )
          .returning({ id: projects.id });
        if (!updated[0]) {
          throw resourceNotFound('Project');
        }
      },
      writeAuditEvent: async (session) => {
        await insertAuditEvent(session, {
          ...command.audit,
          organizationId: command.scope.organizationId,
          projectId: command.scope.projectId,
          eventType: 'intake.completed',
          targetType: 'project_intake',
          targetId: command.scope.projectId,
        });
      },
    });
  }

  private async throwIntakeVersionError(
    database: DatabaseExecutor,
    scope: OrganizationProjectScope,
  ): Promise<never> {
    const exists = await database
      .select({ id: projectIntakes.id })
      .from(projectIntakes)
      .where(
        and(
          eq(projectIntakes.organizationId, scope.organizationId),
          eq(projectIntakes.projectId, scope.projectId),
        ),
      )
      .limit(1);
    if (!exists[0]) {
      throw resourceNotFound('Project intake');
    }
    throw conflict('Project intake was changed by another request.');
  }
}

export class ReportRepository {
  private readonly transactions: TransactionBoundary<DatabaseExecutor>;

  constructor(
    private readonly database: Database,
    transactions: TransactionBoundary<DatabaseExecutor> = new DrizzleTransactionBoundary(
      database,
    ),
  ) {
    this.transactions = transactions;
  }

  async persist(command: PersistReportCommand): Promise<ReadinessReport> {
    const report = command.report;

    const reportId = await persistReportTransaction(this.transactions, {
      insertOrGetReport: async (session) => {
        const rows = await session
          .insert(readinessReports)
          .values({
            id: report.id,
            organizationId: command.organizationId,
            projectId: report.projectId,
            projectVersion: report.projectVersion,
            conversationId: report.conversationId,
            runId: report.runId,
            idempotencyKey: command.idempotencyKey,
            status: report.status,
            jurisdictionSchemaVersion: report.jurisdictionRelease.schemaVersion,
            jurisdictionId: report.jurisdictionRelease.jurisdictionId,
            jurisdictionReleaseVersion:
              report.jurisdictionRelease.releaseVersion,
            contentVersion: report.jurisdictionRelease.contentVersion,
            ruleVersion: report.jurisdictionRelease.ruleVersion,
            guidanceVersion: report.jurisdictionRelease.guidanceVersion,
            agentVersion: report.agentVersion,
            summary: report.summary,
            missingInformation: [...report.missingInformation],
            dependencies: [...report.dependencies],
            assumptions: [...report.assumptions],
            citations: [...report.citations],
            limitations: [...report.limitations],
            createdAt: new Date(report.createdAt),
          })
          .onConflictDoNothing()
          .returning({ id: readinessReports.id });
        if (rows[0]) {
          return { result: rows[0].id, created: true };
        }
        const existing = await session
          .select({ id: readinessReports.id })
          .from(readinessReports)
          .where(
            and(
              eq(readinessReports.organizationId, command.organizationId),
              eq(readinessReports.projectId, report.projectId),
              eq(readinessReports.idempotencyKey, command.idempotencyKey),
            ),
          )
          .limit(1);
        if (!existing[0]) {
          throw new Error('Idempotent readiness report could not be loaded.');
        }
        return { result: existing[0].id, created: false };
      },
      insertRecommendations: async (session, persistedReportId) => {
        if (report.recommendations.length === 0) {
          return;
        }
        await session.insert(readinessRecommendations).values(
          report.recommendations.map((recommendation, index) => ({
            organizationId: command.organizationId,
            projectId: report.projectId,
            reportId: persistedReportId,
            recommendationKey: `recommendation-${index + 1}`,
            permitTypeId: recommendation.permitTypeId,
            disposition: recommendation.disposition,
            title: recommendation.title,
            rationale: recommendation.rationale,
            ruleIds: [...recommendation.ruleIds],
            citationIds: [...recommendation.citationIds],
            nextActions: [...recommendation.nextActions],
          })),
        );
      },
      replaceTasks: async (session, persistedReportId) => {
        await session
          .delete(projectTasks)
          .where(
            and(
              eq(projectTasks.organizationId, command.organizationId),
              eq(projectTasks.projectId, report.projectId),
              isNotNull(projectTasks.sourceReportId),
            ),
          );
        if (command.tasks.length === 0) {
          return;
        }
        await session.insert(projectTasks).values(
          command.tasks.map((task) => ({
            id: task.id,
            organizationId: command.organizationId,
            projectId: report.projectId,
            sourceReportId: persistedReportId,
            kind: task.kind,
            title: task.title,
            description: task.description,
            permitTypeId: task.permitTypeId,
            sourceRecommendationId: task.recommendationKey,
            dueDate: task.dueDate,
          })),
        );
      },
      updateProject: async (session, persistedReportId) => {
        const updated = await session
          .update(projects)
          .set({
            status: 'report_ready',
            latestReadinessReportId: persistedReportId,
            version: sql`${projects.version} + 1`,
            updatedAt: new Date(report.createdAt),
          })
          .where(
            and(
              eq(projects.id, report.projectId),
              eq(projects.organizationId, command.organizationId),
              eq(projects.version, report.projectVersion),
            ),
          )
          .returning({ id: projects.id });
        if (!updated[0]) {
          const exists = await session
            .select({ id: projects.id })
            .from(projects)
            .where(
              and(
                eq(projects.id, report.projectId),
                eq(projects.organizationId, command.organizationId),
              ),
            )
            .limit(1);
          if (!exists[0]) {
            throw resourceNotFound('Project');
          }
          throw conflict('Project was changed before the report was saved.');
        }
      },
      writeAuditEvent: async (session, persistedReportId) => {
        await insertAuditEvent(session, {
          ...command.audit,
          organizationId: command.organizationId,
          projectId: report.projectId,
          eventType: 'readiness_report.persisted',
          targetType: 'readiness_report',
          targetId: persistedReportId,
          metadata: { status: report.status },
        });
      },
    });
    return this.get(
      {
        organizationId: command.organizationId,
        projectId: report.projectId,
      },
      reportId,
    );
  }

  async getByIdempotencyKey(
    scope: OrganizationProjectScope,
    idempotencyKey: string,
  ): Promise<ReadinessReport | undefined> {
    const rows = await this.database
      .select({ id: readinessReports.id })
      .from(readinessReports)
      .where(
        and(
          eq(readinessReports.organizationId, scope.organizationId),
          eq(readinessReports.projectId, scope.projectId),
          eq(readinessReports.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);
    return rows[0] ? this.get(scope, rows[0].id) : undefined;
  }

  async get(
    scope: OrganizationProjectScope,
    reportId: string,
  ): Promise<ReadinessReport> {
    const rows = await buildReportByIdQuery(this.database, scope, reportId);
    const first = rows[0];
    if (!first) {
      throw resourceNotFound('Readiness report');
    }

    return ReadinessReportSchema.parse({
      id: first.report.id,
      projectId: first.report.projectId,
      projectVersion: first.report.projectVersion,
      conversationId: first.report.conversationId ?? undefined,
      runId: first.report.runId ?? undefined,
      status: first.report.status,
      jurisdictionRelease: {
        schemaVersion: first.report.jurisdictionSchemaVersion,
        jurisdictionId: first.report.jurisdictionId,
        releaseVersion: first.report.jurisdictionReleaseVersion,
        contentVersion: first.report.contentVersion,
        ruleVersion: first.report.ruleVersion,
        guidanceVersion: first.report.guidanceVersion,
      },
      agentVersion: first.report.agentVersion ?? undefined,
      summary: first.report.summary,
      recommendations: rows.flatMap(({ recommendation }) =>
        recommendation
          ? [
              {
                permitTypeId: recommendation.permitTypeId,
                disposition: recommendation.disposition,
                title: recommendation.title,
                rationale: recommendation.rationale,
                ruleIds: recommendation.ruleIds,
                citationIds: recommendation.citationIds,
                nextActions: recommendation.nextActions,
              },
            ]
          : [],
      ),
      missingInformation: first.report.missingInformation,
      dependencies: first.report.dependencies,
      assumptions: first.report.assumptions,
      citations: first.report.citations,
      limitations: first.report.limitations,
      createdAt: iso(first.report.createdAt),
    });
  }
}

export class ConversationRepository {
  static readonly historyLimit = 100;

  constructor(private readonly database: Database) {}

  async getActive(
    scope: OrganizationProjectScope,
  ): Promise<Conversation | undefined> {
    const rows = await this.database
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.projectId, scope.projectId),
          eq(conversations.organizationId, scope.organizationId),
          eq(conversations.active, true),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row
      ? ConversationSchema.parse({
          id: row.id,
          projectId: row.projectId,
          title: row.title ?? undefined,
          version: row.version,
          createdAt: iso(row.createdAt),
          updatedAt: iso(row.updatedAt),
        })
      : undefined;
  }

  async getOrCreateActive(
    scope: OrganizationProjectScope,
    title?: string,
  ): Promise<Conversation> {
    const project = await this.database
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, scope.projectId),
          eq(projects.organizationId, scope.organizationId),
        ),
      )
      .limit(1);
    if (!project[0]) {
      throw resourceNotFound('Project');
    }

    await this.database
      .insert(conversations)
      .values({
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        title,
      })
      .onConflictDoNothing();
    const conversation = await this.getActive(scope);
    if (!conversation) {
      throw new Error('Active conversation could not be loaded.');
    }
    return conversation;
  }

  async create(
    scope: OrganizationProjectScope,
    title?: string,
  ): Promise<Conversation> {
    const project = await this.database
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, scope.projectId),
          eq(projects.organizationId, scope.organizationId),
        ),
      )
      .limit(1);
    if (!project[0]) {
      throw resourceNotFound('Project');
    }

    const rows = await this.database
      .insert(conversations)
      .values({
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        title,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error('Conversation insert returned no row.');
    }
    return ConversationSchema.parse({
      id: row.id,
      projectId: row.projectId,
      title: row.title ?? undefined,
      version: row.version,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    });
  }

  async get(
    scope: OrganizationProjectScope,
    conversationId: string,
  ): Promise<Conversation> {
    const rows = await buildConversationByIdQuery(
      this.database,
      scope,
      conversationId,
    );
    const row = rows[0];
    if (!row) {
      throw resourceNotFound('Conversation');
    }
    return ConversationSchema.parse({
      id: row.id,
      projectId: row.projectId,
      title: row.title ?? undefined,
      version: row.version,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    });
  }

  async appendMessage(
    scope: OrganizationProjectScope,
    conversationId: string,
    message: Omit<ConversationMessage, 'conversationId' | 'createdAt'> & {
      createdAt?: string;
    },
  ): Promise<ConversationMessage> {
    const conversation = await this.get(scope, conversationId);
    const messages = await this.appendMessages(
      scope,
      conversationId,
      conversation.version,
      [message],
    );
    const appended = messages[0];
    if (!appended) {
      throw new Error('Conversation message insert returned no row.');
    }
    return appended;
  }

  async appendMessages(
    scope: OrganizationProjectScope,
    conversationId: string,
    expectedVersion: number,
    messages: readonly (Omit<
      ConversationMessage,
      'conversationId' | 'createdAt'
    > & {
      createdAt?: string;
    })[],
  ): Promise<readonly ConversationMessage[]> {
    if (messages.length === 0) {
      return [];
    }
    return this.database.transaction(async (transaction) => {
      const changedAt = new Date();
      const updated = await transaction
        .update(conversations)
        .set({
          version: sql`${conversations.version} + 1`,
          updatedAt: changedAt,
        })
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.projectId, scope.projectId),
            eq(conversations.organizationId, scope.organizationId),
            eq(conversations.active, true),
            eq(conversations.version, expectedVersion),
          ),
        )
        .returning({ id: conversations.id });
      if (!updated[0]) {
        const exists = await transaction
          .select({ id: conversations.id })
          .from(conversations)
          .where(
            and(
              eq(conversations.id, conversationId),
              eq(conversations.projectId, scope.projectId),
              eq(conversations.organizationId, scope.organizationId),
              eq(conversations.active, true),
            ),
          )
          .limit(1);
        if (!exists[0]) {
          throw resourceNotFound('Conversation');
        }
        throw conflict('Conversation was changed by another request.');
      }

      const rows = await transaction
        .insert(conversationMessages)
        .values(
          messages.map((message, index) => ({
            id: message.id,
            organizationId: scope.organizationId,
            projectId: scope.projectId,
            conversationId,
            role: message.role,
            content: message.content,
            citations: message.citations,
            createdAt: message.createdAt
              ? new Date(message.createdAt)
              : new Date(changedAt.getTime() + index),
          })),
        )
        .returning();
      if (rows.length !== messages.length) {
        throw new Error('Conversation message insert was incomplete.');
      }
      return rows.map((row) =>
        ConversationMessageSchema.parse({
          id: row.id,
          conversationId: row.conversationId,
          role: row.role,
          content: row.content,
          citations: row.citations ?? undefined,
          createdAt: iso(row.createdAt),
        }),
      );
    });
  }

  async listMessages(
    scope: OrganizationProjectScope,
    conversationId: string,
  ): Promise<readonly ConversationMessage[]> {
    const rows = await this.database
      .select()
      .from(conversationMessages)
      .where(
        and(
          eq(conversationMessages.organizationId, scope.organizationId),
          eq(conversationMessages.projectId, scope.projectId),
          eq(conversationMessages.conversationId, conversationId),
        ),
      )
      .orderBy(desc(conversationMessages.createdAt))
      .limit(ConversationRepository.historyLimit);
    if (rows.length === 0) {
      await this.get(scope, conversationId);
    }
    return rows.reverse().map((row) =>
      ConversationMessageSchema.parse({
        id: row.id,
        conversationId: row.conversationId,
        role: row.role,
        content: row.content,
        citations: row.citations ?? undefined,
        createdAt: iso(row.createdAt),
      }),
    );
  }

  async recordRun(organizationId: string, run: AgentRun): Promise<void> {
    const conversation = await this.database
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.id, run.conversationId),
          eq(conversations.projectId, run.projectId),
          eq(conversations.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (!conversation[0]) {
      throw resourceNotFound('Conversation');
    }

    await this.database.insert(agentRuns).values({
      id: run.id,
      organizationId,
      projectId: run.projectId,
      conversationId: run.conversationId,
      status: run.status,
      agentVersion: run.agentVersion,
      idempotencyKey: run.idempotencyKey,
      assistantMessageId: run.assistantMessage?.id,
      failure: run.failure,
      startedAt: run.startedAt ? new Date(run.startedAt) : undefined,
      completedAt: run.completedAt ? new Date(run.completedAt) : undefined,
    });
  }
}

export class TaskRepository {
  constructor(private readonly database: Database) {}

  async list(scope: OrganizationProjectScope): Promise<readonly ProjectTask[]> {
    const rows = await buildTaskListQuery(this.database, scope);
    if (rows.length === 0) {
      const project = await this.database
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.id, scope.projectId),
            eq(projects.organizationId, scope.organizationId),
          ),
        )
        .limit(1);
      if (!project[0]) {
        throw resourceNotFound('Project');
      }
    }
    return rows.map((row) => this.mapTask(row));
  }

  async updateStatus(
    scope: OrganizationProjectScope,
    taskId: string,
    expectedVersion: number,
    status: ProjectTaskStatus,
  ): Promise<ProjectTask> {
    const completedAt = status === 'completed' ? new Date() : null;
    const rows = await this.database
      .update(projectTasks)
      .set({
        status,
        completedAt,
        version: sql`${projectTasks.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projectTasks.id, taskId),
          eq(projectTasks.projectId, scope.projectId),
          eq(projectTasks.organizationId, scope.organizationId),
          eq(projectTasks.version, expectedVersion),
        ),
      )
      .returning();
    const row = rows[0];
    if (row) {
      return this.mapTask(row);
    }

    const exists = await this.database
      .select({ id: projectTasks.id })
      .from(projectTasks)
      .where(
        and(
          eq(projectTasks.id, taskId),
          eq(projectTasks.projectId, scope.projectId),
          eq(projectTasks.organizationId, scope.organizationId),
        ),
      )
      .limit(1);
    if (!exists[0]) {
      throw resourceNotFound('Project task');
    }
    throw conflict('Project task was changed by another request.');
  }

  private mapTask(row: typeof projectTasks.$inferSelect): ProjectTask {
    return ProjectTaskSchema.parse({
      id: row.id,
      projectId: row.projectId,
      kind: row.kind,
      status: row.status,
      title: row.title,
      description: row.description,
      permitTypeId: row.permitTypeId ?? undefined,
      sourceRecommendationId: row.sourceRecommendationId ?? undefined,
      dueDate: row.dueDate ?? undefined,
      completedAt: row.completedAt ? iso(row.completedAt) : undefined,
      version: row.version,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    });
  }
}
