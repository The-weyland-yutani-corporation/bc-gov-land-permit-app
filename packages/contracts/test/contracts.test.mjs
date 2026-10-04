import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTHORIZATION_CONVENTIONS,
  AgentRunSchema,
  AuthenticatedIdentitySchema,
  CitationSchema,
  CONTRACT_VERSION,
  GeoJsonPointSchema,
  GeoJsonPolygonSchema,
  IntakeCompletenessSchema,
  PermitRuleSchema,
  PlatformAgentVersionSchema,
  ProjectSchema,
  TriggerEvaluationSchema,
  VersionSchema,
  apiContract,
} from '../dist/index.js';

const ids = {
  user: '11111111-1111-4111-8111-111111111111',
  membership: '22222222-2222-4222-8222-222222222222',
  organization: '33333333-3333-4333-8333-333333333333',
  otherOrganization: '44444444-4444-4444-8444-444444444444',
  project: '55555555-5555-4555-8555-555555555555',
  report: '66666666-6666-4666-8666-666666666666',
  conversation: '77777777-7777-4777-8777-777777777777',
  run: '88888888-8888-4888-8888-888888888888',
};

const release = {
  schemaVersion: '1.0.0',
  jurisdictionId: 'generic-public-sector',
  releaseVersion: '1.0.0',
  contentVersion: '1.0.0',
  ruleVersion: '1.0.0',
  guidanceVersion: '1.0.0',
};

test('valid point and polygon GeoJSON parse', () => {
  assert.deepEqual(
    GeoJsonPointSchema.parse({ type: 'Point', coordinates: [-123.1, 49.2] }),
    { type: 'Point', coordinates: [-123.1, 49.2] },
  );
  assert.equal(
    GeoJsonPolygonSchema.safeParse({
      type: 'Polygon',
      coordinates: [
        [
          [-123.2, 49.2],
          [-123.0, 49.2],
          [-123.0, 49.4],
          [-123.2, 49.4],
          [-123.2, 49.2],
        ],
      ],
    }).success,
    true,
  );
});

test('invalid coordinates, open rings, and self-intersections are rejected', () => {
  assert.equal(
    GeoJsonPointSchema.safeParse({
      type: 'Point',
      coordinates: [-181, 49],
    }).success,
    false,
  );
  assert.equal(
    GeoJsonPolygonSchema.safeParse({
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
      ],
    }).success,
    false,
  );
  assert.equal(
    GeoJsonPolygonSchema.safeParse({
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 1],
          [0, 1],
          [1, 0],
          [0, 0],
        ],
      ],
    }).success,
    false,
  );
});

test('ownership IDs and active organization membership are validated', () => {
  const identity = {
    user: {
      id: ids.user,
      subjectId: 'external-subject',
      displayName: 'Demo Applicant',
      email: 'applicant@example.org',
      provider: 'local_demo',
    },
    memberships: [
      {
        id: ids.membership,
        organization: {
          id: ids.organization,
          slug: 'demo-organization',
          name: 'Demo Organization',
        },
        user: {
          id: ids.user,
          subjectId: 'external-subject',
          displayName: 'Demo Applicant',
          provider: 'local_demo',
        },
        role: 'applicant',
        createdAt: '2026-10-03T16:00:00Z',
      },
    ],
    activeOrganizationId: ids.organization,
  };

  assert.equal(AuthenticatedIdentitySchema.safeParse(identity).success, true);
  assert.equal(
    AuthenticatedIdentitySchema.safeParse({
      ...identity,
      activeOrganizationId: ids.otherOrganization,
    }).success,
    false,
  );
  assert.equal(
    AuthenticatedIdentitySchema.safeParse({
      ...identity,
      user: { ...identity.user, id: 'user-1' },
    }).success,
    false,
  );
});

test('project schema rejects incompatible lifecycle fields', () => {
  const project = {
    id: ids.project,
    organizationId: ids.organization,
    name: 'Community site',
    projectTypeId: 'community-site-work',
    status: 'draft',
    jurisdictionRelease: release,
    version: 1,
    createdAt: '2026-10-03T16:00:00Z',
    updatedAt: '2026-10-03T16:00:00Z',
  };

  assert.equal(ProjectSchema.safeParse(project).success, true);
  assert.equal(
    ProjectSchema.safeParse({
      ...project,
      status: 'archived',
    }).success,
    false,
  );
  assert.equal(
    ProjectSchema.safeParse({
      ...project,
      status: 'report_ready',
    }).success,
    false,
  );
  assert.equal(
    ProjectSchema.safeParse({
      ...project,
      latestReadinessReportId: ids.report,
    }).success,
    false,
  );
});

test('malformed or unlocatable citations are rejected', () => {
  const citation = {
    id: 'site-guidance-citation',
    sourceId: 'generic-site-guidance',
    sourceVersion: '1.0.0',
    title: 'Example site guide',
    publisher: 'Example Public Authority',
    url: 'https://example.org/guide',
    locator: { heading: 'Before work starts' },
    accessedAt: '2026-10-03T16:00:00Z',
  };
  assert.equal(CitationSchema.safeParse(citation).success, true);
  assert.equal(
    CitationSchema.safeParse({ ...citation, url: 'http://example.org/guide' })
      .success,
    false,
  );
  assert.equal(
    CitationSchema.safeParse({ ...citation, locator: {} }).success,
    false,
  );
  assert.equal(
    CitationSchema.safeParse({ ...citation, sourceId: '../source' }).success,
    false,
  );
});

test('deterministic result and completeness invariants are enforced', () => {
  assert.equal(
    TriggerEvaluationSchema.safeParse({
      permitTypeId: 'site-review',
      outcome: 'indeterminate',
      recommendation: 'may_apply',
      matchedRuleIds: [],
      missingInformation: [],
      assumptions: [],
      ruleVersion: '1.0.0',
    }).success,
    false,
  );
  assert.equal(
    IntakeCompletenessSchema.safeParse({
      requiredCount: 2,
      answeredRequiredCount: 1,
      missingRequiredQuestionIds: [],
      unknownRequiredQuestionIds: [],
      isComplete: true,
    }).success,
    false,
  );
});

test('permit rule metadata supports deterministic priority and effective dates', () => {
  const rule = {
    id: 'site-review-rule',
    version: '1.0.0',
    permitTypeId: 'site-review',
    outcome: 'likely',
    explanation: 'Synthetic evidence indicates an illustrative site review.',
    priority: 100,
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    sourceIds: ['site-guidance'],
    followUpQuestionIds: ['confirm-site-condition'],
    requiresEscalation: true,
    condition: {
      type: 'answer',
      questionId: 'disturbs-ground',
      operator: 'equals',
      value: true,
    },
  };
  assert.equal(PermitRuleSchema.safeParse(rule).success, true);
  assert.equal(
    PermitRuleSchema.safeParse({
      ...rule,
      effectiveFrom: '2027-01-01',
    }).success,
    false,
  );
});

test('agent run terminal states require matching output and timing', () => {
  const base = {
    id: ids.run,
    conversationId: ids.conversation,
    projectId: ids.project,
    agentVersion: '1.0.0',
    idempotencyKey: '99999999-9999-4999-8999-999999999999',
  };

  assert.equal(
    AgentRunSchema.safeParse({ ...base, status: 'completed' }).success,
    false,
  );
  assert.equal(
    AgentRunSchema.safeParse({
      ...base,
      status: 'failed',
      completedAt: '2026-10-03T16:00:00Z',
    }).success,
    false,
  );
});

test('platform agent versions accept Foundry identifiers without weakening semantic versions', () => {
  assert.equal(PlatformAgentVersionSchema.safeParse('1').success, true);
  assert.equal(
    PlatformAgentVersionSchema.safeParse('1.0.0-test').success,
    true,
  );
  assert.equal(VersionSchema.safeParse('1').success, false);
  assert.equal(VersionSchema.safeParse('1.0.0').success, true);
});

test('API contract remains versioned and exposes required route groups', () => {
  assert.equal(CONTRACT_VERSION, '1.0.0');
  assert.equal(apiContract.health.liveness.path, '/api/v1/health/live');
  assert.equal(apiContract.health.readiness.path, '/api/v1/health/ready');
  assert.equal(apiContract.projects.list.method, 'GET');
  assert.equal(apiContract.projects.create.method, 'POST');
  assert.equal(apiContract.projects.getIntake.method, 'GET');
  assert.equal(apiContract.projects.completeIntake.method, 'POST');
  assert.equal(apiContract.projects.previewReadiness.method, 'POST');
  assert.equal(apiContract.projects.generateReadinessReport.method, 'POST');
  assert.equal(apiContract.projects.invokeConversation.method, 'POST');
  assert.equal(apiContract.projects.getConversationHistory.method, 'GET');
  assert.equal(apiContract.projects.listTasks.method, 'GET');
  assert.match(AUTHORIZATION_CONVENTIONS.ownership, /never grant access/);
});
