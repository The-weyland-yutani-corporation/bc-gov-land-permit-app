import type {
  Conversation,
  ConversationMessage,
  CreateProjectBodySchema,
  IntakeAnswer,
  Project,
  ProjectIntake,
  ProjectLocation,
  ProjectSummary,
  ProjectTask,
  ReadinessReport,
} from '@permit-readiness/contracts';
import type { z } from 'zod';
import type { AuthSession } from './auth';

export type CreateProjectInput = z.infer<typeof CreateProjectBodySchema>;

export interface ProjectWorkspace {
  project: Project;
  intake: ProjectIntake;
  report?: ReadinessReport;
  tasks: ProjectTask[];
  conversation?: Conversation;
  messages: ConversationMessage[];
}

export interface SaveIntakeInput {
  expectedVersion: number;
  expectedProjectVersion: number;
  answers: IntakeAnswer[];
  location: ProjectLocation;
}

export interface GenerateReportInput {
  expectedProjectVersion: number;
  idempotencyKey: string;
}

export interface PermitAppRepository {
  readonly adapterName: string;
  listProjects(session: AuthSession): Promise<ProjectSummary[]>;
  createProject(
    session: AuthSession,
    input: CreateProjectInput,
  ): Promise<Project>;
  getWorkspace(
    session: AuthSession,
    projectId: string,
  ): Promise<ProjectWorkspace>;
  saveIntake(
    session: AuthSession,
    projectId: string,
    input: SaveIntakeInput,
  ): Promise<ProjectWorkspace>;
  invokeNavigator(
    session: AuthSession,
    projectId: string,
    message: string,
  ): Promise<ProjectWorkspace>;
  generateReport(
    session: AuthSession,
    projectId: string,
    input: GenerateReportInput,
  ): Promise<ProjectWorkspace>;
  updateTask(
    session: AuthSession,
    projectId: string,
    taskId: string,
    status: ProjectTask['status'],
  ): Promise<ProjectTask>;
}

export class ResourceNotFoundError extends Error {}
export class VersionConflictError extends Error {}
export class DependencyUnavailableError extends Error {}
