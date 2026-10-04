import { and, desc, eq, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from './client.js';
import {
  conversations,
  intakeAnswers,
  projectIntakes,
  projectLocations,
  projectTasks,
  projects,
  readinessRecommendations,
  readinessReports,
} from './schema.js';

export interface OrganizationProjectScope {
  readonly organizationId: string;
  readonly projectId: string;
}

export function buildProjectByIdQuery(
  database: DatabaseExecutor,
  scope: OrganizationProjectScope,
) {
  return database
    .select({
      project: projects,
      locationSource: projectLocations.source,
      locationDescription: projectLocations.description,
      geometryJson: sql<
        string | null
      >`CASE WHEN ${projectLocations.id} IS NULL THEN NULL ELSE ST_AsGeoJSON(${projectLocations.geometry}) END`,
    })
    .from(projects)
    .leftJoin(
      projectLocations,
      and(
        eq(projectLocations.projectId, projects.id),
        eq(projectLocations.organizationId, projects.organizationId),
      ),
    )
    .where(
      and(
        eq(projects.id, scope.projectId),
        eq(projects.organizationId, scope.organizationId),
      ),
    )
    .limit(1);
}

export function buildProjectListQuery(
  database: DatabaseExecutor,
  organizationId: string,
) {
  return database
    .select()
    .from(projects)
    .where(eq(projects.organizationId, organizationId))
    .orderBy(desc(projects.updatedAt));
}

export function buildIntakeQuery(
  database: DatabaseExecutor,
  scope: OrganizationProjectScope,
) {
  return database
    .select({
      intake: projectIntakes,
      answer: intakeAnswers,
    })
    .from(projectIntakes)
    .leftJoin(
      intakeAnswers,
      and(
        eq(intakeAnswers.projectIntakeId, projectIntakes.id),
        eq(intakeAnswers.organizationId, projectIntakes.organizationId),
        eq(intakeAnswers.projectId, projectIntakes.projectId),
      ),
    )
    .where(
      and(
        eq(projectIntakes.projectId, scope.projectId),
        eq(projectIntakes.organizationId, scope.organizationId),
      ),
    );
}

export function buildReportByIdQuery(
  database: DatabaseExecutor,
  scope: OrganizationProjectScope,
  reportId: string,
) {
  return database
    .select({
      report: readinessReports,
      recommendation: readinessRecommendations,
    })
    .from(readinessReports)
    .leftJoin(
      readinessRecommendations,
      and(
        eq(readinessRecommendations.reportId, readinessReports.id),
        eq(
          readinessRecommendations.organizationId,
          readinessReports.organizationId,
        ),
        eq(readinessRecommendations.projectId, readinessReports.projectId),
      ),
    )
    .where(
      and(
        eq(readinessReports.id, reportId),
        eq(readinessReports.projectId, scope.projectId),
        eq(readinessReports.organizationId, scope.organizationId),
      ),
    );
}

export function buildConversationByIdQuery(
  database: DatabaseExecutor,
  scope: OrganizationProjectScope,
  conversationId: string,
) {
  return database
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.projectId, scope.projectId),
        eq(conversations.organizationId, scope.organizationId),
      ),
    )
    .limit(1);
}

export function buildTaskListQuery(
  database: DatabaseExecutor,
  scope: OrganizationProjectScope,
) {
  return database
    .select()
    .from(projectTasks)
    .where(
      and(
        eq(projectTasks.projectId, scope.projectId),
        eq(projectTasks.organizationId, scope.organizationId),
      ),
    )
    .orderBy(desc(projectTasks.updatedAt));
}
