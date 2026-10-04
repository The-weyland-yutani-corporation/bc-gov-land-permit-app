import type {
  Citation,
  IntakeAnswer,
  IntakeQuestion,
  MissingInformation,
  PermitCondition,
  PermitDependency,
} from '@permit-readiness/contracts';
import { IntakeCompletenessSchema } from '@permit-readiness/contracts';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import { geometry4326 } from './geometry.js';

type IntakeCompleteness = z.infer<typeof IntakeCompletenessSchema>;

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const identityProviderEnum = pgEnum('identity_provider', [
  'entra_external_id',
  'local_demo',
]);
export const membershipRoleEnum = pgEnum('membership_role', [
  'applicant',
  'organization_admin',
  'demo_admin',
]);
export const projectStatusEnum = pgEnum('project_status', [
  'draft',
  'intake_in_progress',
  'ready_for_review',
  'assessment_in_progress',
  'report_ready',
  'archived',
]);
export const locationSourceEnum = pgEnum('location_source', [
  'map',
  'coordinates',
  'address_approximation',
]);
export const geometryKindEnum = pgEnum('geometry_kind', ['point', 'polygon']);
export const intakeAnswerStateEnum = pgEnum('intake_answer_state', [
  'answered',
  'unknown',
  'deferred',
]);
export const intakeQuestionKindEnum = pgEnum('intake_question_kind', [
  'short_text',
  'long_text',
  'boolean',
  'single_select',
  'multi_select',
  'number',
  'date',
]);
export const permitKindEnum = pgEnum('permit_kind', [
  'permit',
  'authorization',
  'notification',
  'review',
]);
export const ruleOutcomeEnum = pgEnum('rule_outcome', [
  'likely',
  'may_apply',
  'not_indicated',
]);
export const dependencyRelationshipEnum = pgEnum('dependency_relationship', [
  'before',
  'confirm_first',
  'parallel',
]);
export const reportStatusEnum = pgEnum('report_status', [
  'completed',
  'degraded',
]);
export const recommendationDispositionEnum = pgEnum(
  'recommendation_disposition',
  ['likely', 'may_apply', 'not_indicated', 'needs_information'],
);
export const conversationMessageRoleEnum = pgEnum('conversation_message_role', [
  'user',
  'assistant',
]);
export const agentRunStatusEnum = pgEnum('agent_run_status', [
  'queued',
  'running',
  'needs_input',
  'completed',
  'failed',
  'cancelled',
]);
export const taskKindEnum = pgEnum('project_task_kind', [
  'answer_question',
  'contact_authority',
  'review_guidance',
  'prepare_information',
  'other',
]);
export const taskStatusEnum = pgEnum('project_task_status', [
  'todo',
  'in_progress',
  'completed',
  'dismissed',
]);
export const auditActorTypeEnum = pgEnum('audit_actor_type', [
  'user',
  'service',
  'agent',
  'system',
]);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subjectId: varchar('subject_id', { length: 255 }).notNull(),
    provider: identityProviderEnum('provider').notNull(),
    displayName: varchar('display_name', { length: 160 }).notNull(),
    email: varchar('email', { length: 320 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('users_provider_subject_uidx').on(
      table.provider,
      table.subjectId,
    ),
  ],
);

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 80 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('organizations_slug_uidx').on(table.slug)],
);

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: membershipRoleEnum('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('memberships_organization_user_uidx').on(
      table.organizationId,
      table.userId,
    ),
    index('memberships_user_idx').on(table.userId),
  ],
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 160 }).notNull(),
    description: text('description'),
    projectTypeId: varchar('project_type_id', { length: 80 }).notNull(),
    status: projectStatusEnum('status').notNull().default('draft'),
    jurisdictionSchemaVersion: varchar('jurisdiction_schema_version', {
      length: 64,
    }).notNull(),
    jurisdictionId: varchar('jurisdiction_id', { length: 80 }).notNull(),
    jurisdictionReleaseVersion: varchar('jurisdiction_release_version', {
      length: 64,
    }).notNull(),
    contentVersion: varchar('content_version', { length: 64 }).notNull(),
    ruleVersion: varchar('rule_version', { length: 64 }).notNull(),
    guidanceVersion: varchar('guidance_version', { length: 64 }).notNull(),
    latestReadinessReportId: uuid('latest_readiness_report_id'),
    version: integer('version').notNull().default(1),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('projects_id_organization_uidx').on(
      table.id,
      table.organizationId,
    ),
    index('projects_organization_status_idx').on(
      table.organizationId,
      table.status,
      table.updatedAt,
    ),
    check('projects_version_positive', sql`${table.version} > 0`),
    check(
      'projects_archive_state_ck',
      sql`(${table.status} = 'archived' AND ${table.archivedAt} IS NOT NULL) OR (${table.status} <> 'archived' AND ${table.archivedAt} IS NULL)`,
    ),
  ],
);

export const projectLocations = pgTable(
  'project_locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    projectId: uuid('project_id').notNull(),
    geometryKind: geometryKindEnum('geometry_kind').notNull(),
    geometry: geometry4326('geometry', 'Geometry').notNull(),
    source: locationSourceEnum('source').notNull(),
    description: varchar('description', { length: 500 }),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      name: 'project_locations_project_organization_fk',
      columns: [table.projectId, table.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }).onDelete('cascade'),
    uniqueIndex('project_locations_project_uidx').on(
      table.projectId,
      table.organizationId,
    ),
    index('project_locations_geometry_gix').using('gist', table.geometry),
    check(
      'project_locations_geometry_type_ck',
      sql`(${table.geometryKind} = 'point' AND GeometryType(${table.geometry}) = 'POINT') OR (${table.geometryKind} = 'polygon' AND GeometryType(${table.geometry}) = 'POLYGON')`,
    ),
    check(
      'project_locations_geometry_valid_ck',
      sql`ST_IsValid(${table.geometry})`,
    ),
  ],
);

export const intakeQuestionSets = pgTable(
  'intake_question_sets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jurisdictionId: varchar('jurisdiction_id', { length: 80 }).notNull(),
    releaseVersion: varchar('release_version', { length: 64 }).notNull(),
    questionSetId: varchar('question_set_id', { length: 80 }).notNull(),
    version: varchar('version', { length: 64 }).notNull(),
    title: varchar('title', { length: 160 }).notNull(),
    description: text('description'),
    projectTypeIds: jsonb('project_type_ids').$type<string[]>().notNull(),
    questions: jsonb('questions').$type<IntakeQuestion[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('intake_question_sets_release_uidx').on(
      table.jurisdictionId,
      table.releaseVersion,
      table.questionSetId,
      table.version,
    ),
  ],
);

export const projectIntakes = pgTable(
  'project_intakes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    projectId: uuid('project_id').notNull(),
    questionSetId: uuid('question_set_id')
      .notNull()
      .references(() => intakeQuestionSets.id, { onDelete: 'restrict' }),
    completeness: jsonb('completeness').$type<IntakeCompleteness>().notNull(),
    version: integer('version').notNull().default(1),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      name: 'project_intakes_project_organization_fk',
      columns: [table.projectId, table.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }).onDelete('cascade'),
    uniqueIndex('project_intakes_project_uidx').on(
      table.projectId,
      table.organizationId,
    ),
    uniqueIndex('project_intakes_id_organization_project_uidx').on(
      table.id,
      table.organizationId,
      table.projectId,
    ),
    check('project_intakes_version_positive', sql`${table.version} > 0`),
  ],
);

export const intakeAnswers = pgTable(
  'intake_answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    projectId: uuid('project_id').notNull(),
    projectIntakeId: uuid('project_intake_id').notNull(),
    questionId: varchar('question_id', { length: 80 }).notNull(),
    kind: intakeQuestionKindEnum('kind'),
    state: intakeAnswerStateEnum('state').notNull(),
    value: jsonb('value').$type<string | number | boolean | string[]>(),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      name: 'intake_answers_intake_scope_fk',
      columns: [table.projectIntakeId, table.organizationId, table.projectId],
      foreignColumns: [
        projectIntakes.id,
        projectIntakes.organizationId,
        projectIntakes.projectId,
      ],
    }).onDelete('cascade'),
    uniqueIndex('intake_answers_intake_question_uidx').on(
      table.projectIntakeId,
      table.questionId,
    ),
    index('intake_answers_project_idx').on(
      table.organizationId,
      table.projectId,
    ),
    check(
      'intake_answers_state_value_ck',
      sql`(${table.state} = 'answered' AND ${table.kind} IS NOT NULL AND ${table.value} IS NOT NULL) OR (${table.state} IN ('unknown', 'deferred') AND ${table.kind} IS NULL AND ${table.value} IS NULL)`,
    ),
  ],
);

export const permitTypes = pgTable(
  'permit_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jurisdictionId: varchar('jurisdiction_id', { length: 80 }).notNull(),
    releaseVersion: varchar('release_version', { length: 64 }).notNull(),
    permitTypeId: varchar('permit_type_id', { length: 80 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    kind: permitKindEnum('kind').notNull(),
    authorityName: varchar('authority_name', { length: 200 }).notNull(),
    authorityUrl: text('authority_url'),
    summary: text('summary').notNull(),
    guidanceSourceIds: jsonb('guidance_source_ids').$type<string[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('permit_types_release_uidx').on(
      table.jurisdictionId,
      table.releaseVersion,
      table.permitTypeId,
    ),
  ],
);

export const permitRules = pgTable(
  'permit_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jurisdictionId: varchar('jurisdiction_id', { length: 80 }).notNull(),
    releaseVersion: varchar('release_version', { length: 64 }).notNull(),
    ruleVersion: varchar('rule_version', { length: 64 }).notNull(),
    ruleId: varchar('rule_id', { length: 80 }).notNull(),
    permitTypeKey: uuid('permit_type_key')
      .notNull()
      .references(() => permitTypes.id, { onDelete: 'cascade' }),
    outcome: ruleOutcomeEnum('outcome').notNull(),
    explanation: text('explanation').notNull(),
    condition: jsonb('condition').$type<PermitCondition>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('permit_rules_release_uidx').on(
      table.jurisdictionId,
      table.releaseVersion,
      table.ruleId,
    ),
    index('permit_rules_permit_idx').on(table.permitTypeKey),
  ],
);

export const permitDependencies = pgTable(
  'permit_dependencies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jurisdictionId: varchar('jurisdiction_id', { length: 80 }).notNull(),
    releaseVersion: varchar('release_version', { length: 64 }).notNull(),
    permitTypeKey: uuid('permit_type_key')
      .notNull()
      .references(() => permitTypes.id, { onDelete: 'cascade' }),
    dependsOnPermitTypeKey: uuid('depends_on_permit_type_key')
      .notNull()
      .references(() => permitTypes.id, { onDelete: 'cascade' }),
    relationship: dependencyRelationshipEnum('relationship').notNull(),
    explanation: text('explanation').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('permit_dependencies_release_uidx').on(
      table.jurisdictionId,
      table.releaseVersion,
      table.permitTypeKey,
      table.dependsOnPermitTypeKey,
    ),
    check(
      'permit_dependencies_not_self_ck',
      sql`${table.permitTypeKey} <> ${table.dependsOnPermitTypeKey}`,
    ),
  ],
);

export const guidanceSources = pgTable(
  'guidance_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jurisdictionId: varchar('jurisdiction_id', { length: 80 }).notNull(),
    releaseVersion: varchar('release_version', { length: 64 }).notNull(),
    guidanceVersion: varchar('guidance_version', { length: 64 }).notNull(),
    sourceId: varchar('source_id', { length: 80 }).notNull(),
    title: varchar('title', { length: 300 }).notNull(),
    publisher: varchar('publisher', { length: 200 }).notNull(),
    url: text('url').notNull(),
    publishedAt: date('published_at'),
    reviewedAt: date('reviewed_at').notNull(),
    expiresAt: date('expires_at'),
    license: varchar('license', { length: 200 }),
    synthetic: boolean('synthetic').notNull(),
    contentHash: varchar('content_hash', { length: 71 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('guidance_sources_release_uidx').on(
      table.jurisdictionId,
      table.releaseVersion,
      table.sourceId,
      table.guidanceVersion,
    ),
    check(
      'guidance_sources_license_ck',
      sql`${table.synthetic} OR ${table.license} IS NOT NULL`,
    ),
    check(
      'guidance_sources_dates_ck',
      sql`${table.expiresAt} IS NULL OR ${table.expiresAt} >= ${table.reviewedAt}`,
    ),
  ],
);

export const demoZones = pgTable(
  'demo_zones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jurisdictionId: varchar('jurisdiction_id', { length: 80 }).notNull(),
    releaseVersion: varchar('release_version', { length: 64 }).notNull(),
    zoneId: varchar('zone_id', { length: 80 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description').notNull(),
    geometry: geometry4326('geometry', 'Polygon').notNull(),
    synthetic: boolean('synthetic').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('demo_zones_release_uidx').on(
      table.jurisdictionId,
      table.releaseVersion,
      table.zoneId,
    ),
    index('demo_zones_geometry_gix').using('gist', table.geometry),
    check('demo_zones_synthetic_ck', sql`${table.synthetic}`),
    check('demo_zones_geometry_valid_ck', sql`ST_IsValid(${table.geometry})`),
  ],
);

export const readinessReports = pgTable(
  'readiness_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    projectId: uuid('project_id').notNull(),
    projectVersion: integer('project_version').notNull(),
    conversationId: uuid('conversation_id'),
    runId: uuid('run_id'),
    idempotencyKey: uuid('idempotency_key').notNull(),
    status: reportStatusEnum('status').notNull(),
    jurisdictionSchemaVersion: varchar('jurisdiction_schema_version', {
      length: 64,
    }).notNull(),
    jurisdictionId: varchar('jurisdiction_id', { length: 80 }).notNull(),
    jurisdictionReleaseVersion: varchar('jurisdiction_release_version', {
      length: 64,
    }).notNull(),
    contentVersion: varchar('content_version', { length: 64 }).notNull(),
    ruleVersion: varchar('rule_version', { length: 64 }).notNull(),
    guidanceVersion: varchar('guidance_version', { length: 64 }).notNull(),
    agentVersion: varchar('agent_version', { length: 64 }),
    summary: text('summary').notNull(),
    missingInformation: jsonb('missing_information')
      .$type<MissingInformation[]>()
      .notNull(),
    dependencies: jsonb('dependencies').$type<PermitDependency[]>().notNull(),
    assumptions: jsonb('assumptions').$type<string[]>().notNull(),
    citations: jsonb('citations').$type<Citation[]>().notNull(),
    limitations: jsonb('limitations').$type<string[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'readiness_reports_project_organization_fk',
      columns: [table.projectId, table.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }).onDelete('cascade'),
    uniqueIndex('readiness_reports_id_organization_project_uidx').on(
      table.id,
      table.organizationId,
      table.projectId,
    ),
    uniqueIndex('readiness_reports_idempotency_uidx').on(
      table.organizationId,
      table.projectId,
      table.idempotencyKey,
    ),
    index('readiness_reports_project_created_idx').on(
      table.organizationId,
      table.projectId,
      table.createdAt,
    ),
    check(
      'readiness_reports_project_version_positive',
      sql`${table.projectVersion} > 0`,
    ),
  ],
);

export const readinessRecommendations = pgTable(
  'readiness_recommendations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    projectId: uuid('project_id').notNull(),
    reportId: uuid('report_id').notNull(),
    recommendationKey: varchar('recommendation_key', { length: 80 }).notNull(),
    permitTypeId: varchar('permit_type_id', { length: 80 }).notNull(),
    disposition: recommendationDispositionEnum('disposition').notNull(),
    title: varchar('title', { length: 300 }).notNull(),
    rationale: text('rationale').notNull(),
    ruleIds: jsonb('rule_ids').$type<string[]>().notNull(),
    citationIds: jsonb('citation_ids').$type<string[]>().notNull(),
    nextActions: jsonb('next_actions').$type<string[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'readiness_recommendations_report_scope_fk',
      columns: [table.reportId, table.organizationId, table.projectId],
      foreignColumns: [
        readinessReports.id,
        readinessReports.organizationId,
        readinessReports.projectId,
      ],
    }).onDelete('cascade'),
    uniqueIndex('readiness_recommendations_report_key_uidx').on(
      table.reportId,
      table.recommendationKey,
    ),
  ],
);

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    projectId: uuid('project_id').notNull(),
    title: varchar('title', { length: 160 }),
    active: boolean('active').notNull().default(true),
    version: integer('version').notNull().default(1),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      name: 'conversations_project_organization_fk',
      columns: [table.projectId, table.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }).onDelete('cascade'),
    uniqueIndex('conversations_id_scope_uidx').on(
      table.id,
      table.organizationId,
      table.projectId,
    ),
    index('conversations_project_idx').on(
      table.organizationId,
      table.projectId,
      table.updatedAt,
    ),
    uniqueIndex('conversations_project_active_uidx')
      .on(table.organizationId, table.projectId)
      .where(sql`${table.active}`),
    check('conversations_version_positive', sql`${table.version} > 0`),
  ],
);

export const conversationMessages = pgTable(
  'conversation_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    projectId: uuid('project_id').notNull(),
    conversationId: uuid('conversation_id').notNull(),
    role: conversationMessageRoleEnum('role').notNull(),
    content: text('content').notNull(),
    citations: jsonb('citations').$type<Citation[]>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'conversation_messages_conversation_scope_fk',
      columns: [table.conversationId, table.organizationId, table.projectId],
      foreignColumns: [
        conversations.id,
        conversations.organizationId,
        conversations.projectId,
      ],
    }).onDelete('cascade'),
    index('conversation_messages_history_idx').on(
      table.organizationId,
      table.projectId,
      table.conversationId,
      table.createdAt,
    ),
    check(
      'conversation_messages_user_citations_ck',
      sql`${table.role} <> 'user' OR ${table.citations} IS NULL OR ${table.citations} = '[]'::jsonb`,
    ),
  ],
);

export const agentRuns = pgTable(
  'agent_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    projectId: uuid('project_id').notNull(),
    conversationId: uuid('conversation_id').notNull(),
    status: agentRunStatusEnum('status').notNull(),
    agentVersion: varchar('agent_version', { length: 64 }).notNull(),
    idempotencyKey: uuid('idempotency_key').notNull(),
    assistantMessageId: uuid('assistant_message_id').references(
      () => conversationMessages.id,
      { onDelete: 'set null' },
    ),
    failure: jsonb('failure').$type<{
      code: string;
      message: string;
      retryable: boolean;
    }>(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'agent_runs_conversation_scope_fk',
      columns: [table.conversationId, table.organizationId, table.projectId],
      foreignColumns: [
        conversations.id,
        conversations.organizationId,
        conversations.projectId,
      ],
    }).onDelete('cascade'),
    uniqueIndex('agent_runs_idempotency_uidx').on(
      table.organizationId,
      table.projectId,
      table.idempotencyKey,
    ),
    index('agent_runs_project_status_idx').on(
      table.organizationId,
      table.projectId,
      table.status,
    ),
    check(
      'agent_runs_terminal_completed_ck',
      sql`${table.status} NOT IN ('completed', 'failed', 'cancelled') OR ${table.completedAt} IS NOT NULL`,
    ),
    check(
      'agent_runs_failure_ck',
      sql`(${table.status} = 'failed' AND ${table.failure} IS NOT NULL) OR (${table.status} <> 'failed' AND ${table.failure} IS NULL)`,
    ),
  ],
);

export const projectTasks = pgTable(
  'project_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    projectId: uuid('project_id').notNull(),
    kind: taskKindEnum('kind').notNull(),
    status: taskStatusEnum('status').notNull().default('todo'),
    title: varchar('title', { length: 300 }).notNull(),
    description: text('description').notNull(),
    permitTypeId: varchar('permit_type_id', { length: 80 }),
    sourceReportId: uuid('source_report_id'),
    sourceRecommendationId: varchar('source_recommendation_id', {
      length: 80,
    }),
    dueDate: date('due_date'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      name: 'project_tasks_project_organization_fk',
      columns: [table.projectId, table.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }).onDelete('cascade'),
    foreignKey({
      name: 'project_tasks_report_scope_fk',
      columns: [table.sourceReportId, table.organizationId, table.projectId],
      foreignColumns: [
        readinessReports.id,
        readinessReports.organizationId,
        readinessReports.projectId,
      ],
    }).onDelete('cascade'),
    index('project_tasks_project_status_idx').on(
      table.organizationId,
      table.projectId,
      table.status,
      table.updatedAt,
    ),
    index('project_tasks_source_report_idx').on(
      table.organizationId,
      table.projectId,
      table.sourceReportId,
    ),
    check('project_tasks_version_positive', sql`${table.version} > 0`),
    check(
      'project_tasks_completed_ck',
      sql`(${table.status} = 'completed' AND ${table.completedAt} IS NOT NULL) OR (${table.status} <> 'completed' AND ${table.completedAt} IS NULL)`,
    ),
  ],
);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'restrict',
    }),
    projectId: uuid('project_id'),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    actorType: auditActorTypeEnum('actor_type').notNull(),
    actorId: varchar('actor_id', { length: 255 }).notNull(),
    eventType: varchar('event_type', { length: 120 }).notNull(),
    targetType: varchar('target_type', { length: 120 }).notNull(),
    targetId: varchar('target_id', { length: 255 }).notNull(),
    correlationId: varchar('correlation_id', { length: 128 }).notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default({}),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'audit_events_project_organization_fk',
      columns: [table.projectId, table.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }).onDelete('restrict'),
    index('audit_events_organization_occurred_idx').on(
      table.organizationId,
      table.occurredAt,
    ),
    index('audit_events_project_occurred_idx').on(
      table.organizationId,
      table.projectId,
      table.occurredAt,
    ),
    uniqueIndex('audit_events_id_organization_uidx').on(
      table.id,
      table.organizationId,
    ),
  ],
);

export const schema = {
  agentRuns,
  auditEvents,
  conversationMessages,
  conversations,
  demoZones,
  guidanceSources,
  intakeAnswers,
  intakeQuestionSets,
  memberships,
  organizations,
  permitDependencies,
  permitRules,
  permitTypes,
  projectIntakes,
  projectLocations,
  projectTasks,
  projects,
  readinessRecommendations,
  readinessReports,
  users,
};

export type DatabaseSchema = typeof schema;
