import assert from 'node:assert/strict';
import test from 'node:test';
import { PermitReadinessToolRegistry } from '../dist/tools.js';
import { createContext } from './fixture.mjs';

const signal = new AbortController().signal;

const groundedCitation = {
  id: 'land-planning-citation',
  sourceId: 'bc-demo-land-guide',
  sourceVersion: '1.0.0',
  title: 'Synthetic land planning guide',
  publisher: 'Synthetic Land Office',
  url: 'https://example.org/guidance/land',
  locator: { heading: 'Planning summary' },
  excerpt: 'Prepare a site map and confirm current requirements.',
  accessedAt: '2026-10-03T20:00:00.000Z',
  safety: {
    flagged: true,
    reasons: ['instruction_like_text_removed'],
  },
  evidenceStatus: 'current',
};

function scope(context) {
  return {
    organizationId: context.scope.organizationId,
    projectId: context.scope.projectId,
    runId: context.scope.runId,
  };
}

test('typed tools preserve deterministic rule authority', async () => {
  const context = createContext();
  const registry = new PermitReadinessToolRegistry(context);
  const result = await registry.execute(
    'evaluate_permit_triggers',
    {
      ...scope(context),
      ruleReleaseId: 'rules-bc-inspired-synthetic',
      ruleReleaseVersion: '1.0.0',
    },
    signal,
  );
  assert.equal(result.evaluations[0].outcome, 'triggered');
  assert.deepEqual(result.evaluations[0].matchedRuleIds, ['bc-land-trigger']);
});

test('tool scope prevents cross-project and cross-organization access', async () => {
  const context = createContext();
  const registry = new PermitReadinessToolRegistry(context);
  await assert.rejects(
    registry.execute(
      'get_project_context',
      {
        ...scope(context),
        projectId: '66666666-6666-4666-8666-666666666666',
      },
      signal,
    ),
    (error) => error.code === 'scope_violation',
  );
});

test('malformed tool arguments fail closed', async () => {
  const registry = new PermitReadinessToolRegistry(createContext());
  await assert.rejects(
    registry.execute('get_project_context', '{"projectId":', signal),
    (error) => error.code === 'tool_error',
  );
});

test('guidance search rejects sources outside the approved release', async () => {
  const context = createContext();
  const registry = new PermitReadinessToolRegistry(context);
  await assert.rejects(
    registry.execute(
      'search_permit_guidance',
      {
        ...scope(context),
        query: 'land',
        sourceIds: ['unapproved-source'],
        maxResults: 5,
      },
      signal,
    ),
    (error) => error.code === 'scope_violation',
  );
});

test('guidance search rejects project-type filters outside the authorized project', async () => {
  const context = createContext();
  const registry = new PermitReadinessToolRegistry(context);
  await assert.rejects(
    registry.execute(
      'search_permit_guidance',
      {
        ...scope(context),
        query: 'land',
        sourceIds: ['bc-demo-land-guide'],
        projectTypeIds: ['housing-site'],
        maxResults: 5,
      },
      signal,
    ),
    (error) => error.code === 'scope_violation',
  );
});

test('report composition requires citations for positive results', async () => {
  const context = createContext();
  const registry = new PermitReadinessToolRegistry(context);
  await assert.rejects(
    registry.execute(
      'compose_readiness_report',
      {
        ...scope(context),
        summary: 'A deterministic readiness summary for preparation.',
        evaluations: [
          {
            permitTypeId: 'land-tenure-coordination',
            outcome: 'triggered',
            recommendation: 'likely',
            matchedRuleIds: ['bc-land-trigger'],
            missingInformation: [],
            assumptions: [],
            ruleVersion: '1.0.0',
          },
        ],
        missingInformation: [],
        citationIds: [],
        assumptions: [],
      },
      signal,
    ),
    (error) => error.code === 'tool_error',
  );
});

test('report composition rejects approved-looking citations not returned by search', async () => {
  const context = createContext();
  const registry = new PermitReadinessToolRegistry(context);
  await assert.rejects(
    registry.execute(
      'compose_readiness_report',
      {
        ...scope(context),
        summary: 'A deterministic readiness summary for preparation.',
        evaluations: [
          {
            permitTypeId: 'land-tenure-coordination',
            outcome: 'triggered',
            recommendation: 'likely',
            matchedRuleIds: ['bc-land-trigger'],
            missingInformation: [],
            assumptions: [],
            ruleVersion: '1.0.0',
          },
        ],
        missingInformation: [],
        citationIds: ['fabricated-citation'],
        assumptions: [],
      },
      signal,
    ),
    (error) =>
      error.code === 'tool_error' &&
      /reference evidence returned by guidance search/i.test(error.message),
  );
});

test('report composition resolves authoritative citations and numeric agent versions', async () => {
  const context = createContext();
  const registry = new PermitReadinessToolRegistry(
    context,
    {
      async search() {
        return {
          available: true,
          citations: [groundedCitation],
          safetyFlag: true,
          warning:
            'Potential instruction-like text was removed from retrieved evidence.',
        };
      },
    },
    '1',
  );
  await registry.execute(
    'search_permit_guidance',
    {
      ...scope(context),
      query: 'managed land',
      sourceIds: ['bc-demo-land-guide'],
      projectTypeIds: ['community-connectivity'],
      maxResults: 5,
    },
    signal,
  );
  const report = await registry.execute(
    'compose_readiness_report',
    {
      ...scope(context),
      summary: 'A deterministic readiness summary for preparation.',
      evaluations: [
        {
          permitTypeId: 'land-tenure-coordination',
          outcome: 'triggered',
          recommendation: 'likely',
          matchedRuleIds: ['bc-land-trigger'],
          missingInformation: [],
          assumptions: [],
          ruleVersion: '1.0.0',
        },
      ],
      missingInformation: [],
      citationIds: [groundedCitation.id],
      assumptions: [],
    },
    signal,
  );
  assert.equal(report.agentVersion, '1');
  assert.deepEqual(report.citations, [groundedCitation]);
});

test('report composition rejects model-authored citation metadata', async () => {
  const context = createContext();
  const registry = new PermitReadinessToolRegistry(context, {
    async search() {
      return {
        available: true,
        citations: [groundedCitation],
        safetyFlag: true,
      };
    },
  });
  await registry.execute(
    'search_permit_guidance',
    {
      ...scope(context),
      query: 'managed land',
      sourceIds: ['bc-demo-land-guide'],
      projectTypeIds: ['community-connectivity'],
      maxResults: 5,
    },
    signal,
  );
  await assert.rejects(
    registry.execute(
      'compose_readiness_report',
      {
        ...scope(context),
        summary: 'A deterministic readiness summary for preparation.',
        evaluations: [],
        missingInformation: [],
        citationIds: [groundedCitation.id],
        citations: [
          {
            ...groundedCitation,
            title: 'Model-modified title',
          },
        ],
        assumptions: [],
      },
      signal,
    ),
    (error) => error.code === 'tool_error',
  );
});
