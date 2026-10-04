import type {
  Identifier,
  JurisdictionReleaseReference,
  ProjectGeometry,
} from './types.js';

export const PROJECT_STATUS_VALUES = [
  'draft',
  'intake_in_progress',
  'ready_for_review',
  'assessment_in_progress',
  'report_ready',
  'archived',
] as const;

export type ProjectStatus = (typeof PROJECT_STATUS_VALUES)[number];

export const PROJECT_STATUS_TRANSITIONS: Readonly<
  Record<ProjectStatus, readonly ProjectStatus[]>
> = {
  draft: ['intake_in_progress', 'archived'],
  intake_in_progress: ['draft', 'ready_for_review', 'archived'],
  ready_for_review: [
    'intake_in_progress',
    'assessment_in_progress',
    'archived',
  ],
  assessment_in_progress: ['ready_for_review', 'report_ready', 'archived'],
  report_ready: ['intake_in_progress', 'assessment_in_progress', 'archived'],
  archived: [],
};

export interface ProjectTypeDefinition {
  readonly id: Identifier;
  readonly name: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly intakeQuestionSetId: Identifier;
}

export interface ProjectLocation {
  readonly geometry: ProjectGeometry;
  readonly source: 'map' | 'coordinates' | 'address_approximation';
  readonly description?: string;
}

export interface Project {
  readonly id: Identifier;
  readonly organizationId: Identifier;
  readonly name: string;
  readonly projectTypeId: Identifier;
  readonly status: ProjectStatus;
  readonly location?: ProjectLocation;
  readonly jurisdictionRelease: JurisdictionReleaseReference;
  readonly latestReadinessReportId?: Identifier;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly archivedAt?: string;
}

export function canTransitionProjectStatus(
  from: ProjectStatus,
  to: ProjectStatus,
): boolean {
  return from === to || PROJECT_STATUS_TRANSITIONS[from].includes(to);
}

export function assertProjectStatusTransition(
  from: ProjectStatus,
  to: ProjectStatus,
): void {
  if (!canTransitionProjectStatus(from, to)) {
    throw new Error(`Project status cannot transition from ${from} to ${to}.`);
  }
}

export function statusAfterIntakeUpdate(
  current: ProjectStatus,
  intakeComplete: boolean,
): ProjectStatus {
  if (current === 'archived') {
    return current;
  }

  if (intakeComplete) {
    return 'ready_for_review';
  }

  return current === 'draft' || current === 'ready_for_review'
    ? 'intake_in_progress'
    : current;
}
