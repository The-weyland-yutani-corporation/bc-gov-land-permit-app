import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { drizzle } from 'drizzle-orm/postgres-js';
import {
  buildConversationByIdQuery,
  buildIntakeQuery,
  buildProjectByIdQuery,
  buildReportByIdQuery,
  buildTaskListQuery,
  completeIntakeTransaction,
  createProjectTransaction,
  databaseSeedPacks,
  DEMO_DATA_INITIALIZATION_VERSION,
  deriveProjectCreationId,
  forbidden,
  parseDatabaseConfig,
  parseGeometryGeoJson,
  persistReportTransaction,
  projectLocations,
  REFERENCE_DATA_INITIALIZATION_VERSION,
  requireDemoDataApproval,
  resourceNotFound,
  saveIntakeTransaction,
  schema,
  serializeGeometryToEwkt,
} from '../dist/index.js';

const organizationId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const scope = { organizationId, projectId };

test('geometry serialization preserves SRID and GeoJSON shape', () => {
  assert.equal(
    serializeGeometryToEwkt({
      type: 'Point',
      coordinates: [-123.12, 49.28],
    }),
    'SRID=4326;POINT(-123.12 49.28)',
  );
  assert.equal(
    serializeGeometryToEwkt({
      type: 'Polygon',
      coordinates: [
        [
          [-124, 49],
          [-123, 49],
          [-123, 50],
          [-124, 50],
          [-124, 49],
        ],
      ],
    }),
    'SRID=4326;POLYGON((-124 49,-123 49,-123 50,-124 50,-124 49))',
  );
  assert.deepEqual(
    parseGeometryGeoJson('{"type":"Point","coordinates":[-123.12,49.28]}'),
    { type: 'Point', coordinates: [-123.12, 49.28] },
  );
  assert.throws(
    () =>
      serializeGeometryToEwkt({
        type: 'Polygon',
        coordinates: [
          [
            [-124, 49],
            [-123, 50],
            [-124, 50],
            [-123, 49],
            [-124, 49],
          ],
        ],
      }),
    /self-intersect/i,
  );
});

test('geometry custom type produces typed PostGIS insert SQL', () => {
  const database = drizzle.mock({ schema });
  const query = database
    .insert(projectLocations)
    .values({
      organizationId,
      projectId,
      geometryKind: 'point',
      geometry: serializeGeometryToEwkt({
        type: 'Point',
        coordinates: [-123.12, 49.28],
      }),
      source: 'coordinates',
    })
    .toSQL();

  assert.match(query.sql, /insert into "project_locations"/);
  assert.ok(query.params.includes('SRID=4326;POINT(-123.12 49.28)'));
});

test('all user-data read queries include organization and project filters', () => {
  const database = drizzle.mock({ schema });
  const queries = [
    buildProjectByIdQuery(database, scope),
    buildIntakeQuery(database, scope),
    buildReportByIdQuery(
      database,
      scope,
      '33333333-3333-4333-8333-333333333333',
    ),
    buildConversationByIdQuery(
      database,
      scope,
      '44444444-4444-4444-8444-444444444444',
    ),
    buildTaskListQuery(database, scope),
  ];

  for (const query of queries) {
    const generated = query.toSQL();
    assert.match(generated.sql, /organization_id/);
    assert.match(generated.sql, /project_id|"projects"\."id"/);
    assert.ok(generated.params.includes(organizationId));
    assert.ok(generated.params.includes(projectId));
  }
});

test('authorization errors distinguish membership denial without leaking resources', () => {
  assert.equal(forbidden().code, 'FORBIDDEN');
  const hiddenResource = resourceNotFound('Project');
  assert.equal(hiddenResource.code, 'NOT_FOUND');
  assert.equal(hiddenResource.message, 'Project was not found.');
});

class StagedTransactionBoundary {
  committed = [];
  runs = 0;

  async run(work) {
    this.runs += 1;
    const staged = [];
    const result = await work({
      record(value) {
        staged.push(value);
      },
    });
    this.committed.push(...staged);
    return result;
  }
}

test('project, intake, and report workflows use one atomic boundary', async () => {
  const projectBoundary = new StagedTransactionBoundary();
  const project = await createProjectTransaction(
    projectBoundary,
    {
      async insertOrGetProject(session) {
        session.record('project');
        return { result: { id: projectId }, created: true };
      },
      async resolveQuestionSet(session) {
        session.record('question-set');
        return 'question-set';
      },
      async insertInitialIntake(session) {
        session.record('intake');
      },
      async insertLocation(session) {
        session.record('location');
      },
      async writeAuditEvent(session) {
        session.record('project-audit');
      },
    },
    true,
  );
  assert.equal(project.id, projectId);
  assert.equal(projectBoundary.runs, 1);
  assert.deepEqual(projectBoundary.committed, [
    'project',
    'question-set',
    'intake',
    'location',
    'project-audit',
  ]);

  const intakeBoundary = new StagedTransactionBoundary();
  await completeIntakeTransaction(intakeBoundary, {
    async lockAndCompleteIntake(session) {
      session.record('intake');
      return { id: 'intake' };
    },
    async updateProjectStatus(session) {
      session.record('project-status');
    },
    async writeAuditEvent(session) {
      session.record('intake-audit');
    },
  });
  assert.equal(intakeBoundary.runs, 1);
  assert.deepEqual(intakeBoundary.committed, [
    'intake',
    'project-status',
    'intake-audit',
  ]);

  const intakeEditBoundary = new StagedTransactionBoundary();
  await saveIntakeTransaction(intakeEditBoundary, {
    async saveIntake(session) {
      session.record('intake-version-and-answers');
      return { id: 'intake' };
    },
    async saveLocation(session) {
      session.record('location');
    },
    async updateProjectAndInvalidateReport(session) {
      session.record('project-version-and-report');
    },
    async invalidateReportTasks(session) {
      session.record('report-tasks');
    },
    async writeAuditEvent(session) {
      session.record('intake-edit-audit');
    },
  });
  assert.equal(intakeEditBoundary.runs, 1);
  assert.deepEqual(intakeEditBoundary.committed, [
    'intake-version-and-answers',
    'location',
    'project-version-and-report',
    'report-tasks',
    'intake-edit-audit',
  ]);

  const reportBoundary = new StagedTransactionBoundary();
  await persistReportTransaction(reportBoundary, {
    async insertOrGetReport(session) {
      session.record('report');
      return { result: { id: 'report' }, created: true };
    },
    async insertRecommendations(session) {
      session.record('recommendations');
    },
    async replaceTasks(session) {
      session.record('tasks');
    },
    async updateProject(session) {
      session.record('project-report');
    },
    async writeAuditEvent(session) {
      session.record('report-audit');
    },
  });
  assert.equal(reportBoundary.runs, 1);
  assert.deepEqual(reportBoundary.committed, [
    'report',
    'recommendations',
    'tasks',
    'project-report',
    'report-audit',
  ]);
});

test('stale intake or project versions roll back location and invalidation', async () => {
  for (const staleStep of ['intake', 'project']) {
    const boundary = new StagedTransactionBoundary();
    await assert.rejects(
      saveIntakeTransaction(boundary, {
        async saveIntake(session) {
          if (staleStep === 'intake') {
            throw new Error('stale intake version');
          }
          session.record('intake');
          return { id: 'intake' };
        },
        async saveLocation(session) {
          session.record('location');
        },
        async updateProjectAndInvalidateReport(session) {
          if (staleStep === 'project') {
            throw new Error('stale project version');
          }
          session.record('project');
        },
        async invalidateReportTasks(session) {
          session.record('tasks');
        },
        async writeAuditEvent(session) {
          session.record('audit');
        },
      }),
      /stale/,
    );
    assert.deepEqual(boundary.committed, []);
  }
});

test('idempotent report retries do not replace tasks twice', async () => {
  const boundary = new StagedTransactionBoundary();
  const report = await persistReportTransaction(boundary, {
    async insertOrGetReport(session) {
      session.record('existing-report-read');
      return { result: { id: 'report' }, created: false };
    },
    async insertRecommendations(session) {
      session.record('recommendations');
    },
    async replaceTasks(session) {
      session.record('tasks');
    },
    async updateProject(session) {
      session.record('project');
    },
    async writeAuditEvent(session) {
      session.record('audit');
    },
  });
  assert.equal(report.id, 'report');
  assert.deepEqual(boundary.committed, ['existing-report-read']);
});

test('failed transactional workflow does not publish staged changes', async () => {
  const boundary = new StagedTransactionBoundary();
  await assert.rejects(
    createProjectTransaction(
      boundary,
      {
        async insertOrGetProject(session) {
          session.record('project');
          return { result: { id: projectId }, created: true };
        },
        async resolveQuestionSet(session) {
          session.record('question-set');
          return 'question-set';
        },
        async insertInitialIntake(session) {
          session.record('intake');
        },
        async insertLocation() {
          throw new Error('location failed');
        },
        async writeAuditEvent(session) {
          session.record('audit');
        },
      },
      true,
    ),
    /location failed/,
  );
  assert.deepEqual(boundary.committed, []);
});

test('missing question-set seed rolls back project creation', async () => {
  const boundary = new StagedTransactionBoundary();
  await assert.rejects(
    createProjectTransaction(
      boundary,
      {
        async insertOrGetProject(session) {
          session.record('project');
          return { result: { id: projectId }, created: true };
        },
        async resolveQuestionSet() {
          throw new Error('Configured intake question set is not seeded.');
        },
        async insertInitialIntake(session) {
          session.record('intake');
        },
        async insertLocation(session) {
          session.record('location');
        },
        async writeAuditEvent(session) {
          session.record('audit');
        },
      },
      false,
    ),
    /not seeded/,
  );
  assert.deepEqual(boundary.committed, []);
});

test('initial intake insert failure rolls back the project row', async () => {
  const boundary = new StagedTransactionBoundary();
  await assert.rejects(
    createProjectTransaction(
      boundary,
      {
        async insertOrGetProject(session) {
          session.record('project');
          return { result: { id: projectId }, created: true };
        },
        async resolveQuestionSet(session) {
          session.record('question-set');
          return 'question-set';
        },
        async insertInitialIntake() {
          throw new Error('intake insert failed');
        },
        async insertLocation(session) {
          session.record('location');
        },
        async writeAuditEvent(session) {
          session.record('audit');
        },
      },
      false,
    ),
    /intake insert failed/,
  );
  assert.deepEqual(boundary.committed, []);
});

test('idempotent project retry returns the committed project without duplicate writes', async () => {
  const boundary = new StagedTransactionBoundary();
  const project = await createProjectTransaction(
    boundary,
    {
      async insertOrGetProject(session) {
        session.record('existing-project-read');
        return { result: { id: projectId }, created: false };
      },
      async resolveQuestionSet(session) {
        session.record('question-set');
        return 'question-set';
      },
      async insertInitialIntake(session) {
        session.record('intake');
      },
      async insertLocation(session) {
        session.record('location');
      },
      async writeAuditEvent(session) {
        session.record('audit');
      },
    },
    true,
  );
  assert.equal(project.id, projectId);
  assert.deepEqual(boundary.committed, ['existing-project-read']);
});

test('project creation ids are stable and organization scoped', () => {
  const key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  assert.equal(
    deriveProjectCreationId(organizationId, key),
    deriveProjectCreationId(organizationId, key),
  );
  assert.notEqual(
    deriveProjectCreationId(organizationId, key),
    deriveProjectCreationId('33333333-3333-4333-8333-333333333333', key),
  );
});

test('migrations cover required tables, PostGIS, indexes, and audit immutability', async () => {
  const migrationsDirectory = path.resolve('migrations');
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith('.sql'))
    .sort();
  const migrationSql = (
    await Promise.all(
      migrationFiles.map((file) =>
        readFile(path.join(migrationsDirectory, file), 'utf8'),
      ),
    )
  ).join('\n');

  const requiredTables = [
    'users',
    'organizations',
    'memberships',
    'projects',
    'project_locations',
    'intake_question_sets',
    'project_intakes',
    'intake_answers',
    'permit_types',
    'permit_rules',
    'permit_dependencies',
    'guidance_sources',
    'demo_zones',
    'readiness_reports',
    'readiness_recommendations',
    'conversations',
    'conversation_messages',
    'agent_runs',
    'project_tasks',
    'audit_events',
  ];
  for (const table of requiredTables) {
    assert.match(migrationSql, new RegExp(`CREATE TABLE "${table}"`));
  }

  assert.match(migrationSql, /CREATE EXTENSION IF NOT EXISTS postgis/);
  assert.match(migrationSql, /geometry\(Geometry,4326\)/);
  assert.match(migrationSql, /geometry\(Polygon,4326\)/);
  assert.match(migrationSql, /USING gist \("geometry"\)/);
  assert.match(migrationSql, /audit_events_immutable/);
  assert.match(migrationSql, /audit_events_project_organization_fk/);
  assert.match(migrationSql, /conversations_project_active_uidx/);
  assert.match(migrationSql, /conversation_merge_map/);
  assert.match(migrationSql, /UPDATE \"conversation_messages\"/);
  assert.match(migrationSql, /project_tasks_report_scope_fk/);
  assert.match(migrationSql, /source_report_id/);
});

test('database environment validation rejects unsafe or incomplete values', () => {
  assert.throws(() => parseDatabaseConfig({}), /DATABASE_URL/);
  assert.throws(
    () => parseDatabaseConfig({ DATABASE_URL: 'https://example.org' }),
    /postgres/,
  );
  assert.deepEqual(
    parseDatabaseConfig({
      DATABASE_URL:
        'postgresql://permit_readiness:permit_readiness@localhost:5432/permit_readiness',
      DATABASE_SSL_MODE: 'disable',
      DATABASE_MAX_CONNECTIONS: '4',
    }),
    {
      url: 'postgresql://permit_readiness:permit_readiness@localhost:5432/permit_readiness',
      ssl: false,
      maxConnections: 4,
    },
  );
});

test('seed packs are versioned, spatial, source-labelled, and dependency-complete', () => {
  assert.equal(REFERENCE_DATA_INITIALIZATION_VERSION, '1.0.0');
  assert.equal(DEMO_DATA_INITIALIZATION_VERSION, '1.0.0');
  assert.deepEqual(
    databaseSeedPacks.map((pack) => pack.jurisdictionId),
    ['generic-public-sector', 'bc-inspired-synthetic'],
  );
  for (const pack of databaseSeedPacks) {
    assert.match(pack.releaseVersion, /^\d+\.\d+\.\d+$/);
    assert.ok(pack.permits.length > 0);
    assert.ok(pack.rules.length > 0);
    assert.ok(pack.zones.length > 0);
    assert.ok(
      pack.guidanceSources.every(
        (source) =>
          source.synthetic ||
          (source.license && source.url.startsWith('https://')),
      ),
    );
    const permitIds = new Set(pack.permits.map((permit) => permit.id));
    assert.ok(
      pack.dependencies.every(
        (dependency) =>
          permitIds.has(dependency.permitTypeId) &&
          permitIds.has(dependency.dependsOnPermitTypeId),
      ),
    );
  }
});

test('optional demo data requires explicit deployment approval', () => {
  assert.throws(() => requireDemoDataApproval({}), /ALLOW_DEMO_DATA=true/);
  assert.doesNotThrow(() =>
    requireDemoDataApproval({ ALLOW_DEMO_DATA: 'true' }),
  );
});
