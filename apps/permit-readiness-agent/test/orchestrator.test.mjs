import assert from 'node:assert/strict';
import test from 'node:test';
import { MODEL_OUTPUT_JSON_SCHEMA } from '../dist/model.js';
import { PermitReadinessOrchestrator } from '../dist/orchestrator.js';
import { configuration, createEnvelope } from './fixture.mjs';

const citation = {
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

function functionCall(name, callId, argumentsValue) {
  const argumentsJson = JSON.stringify(argumentsValue);
  return {
    id: `response-${callId}`,
    outputText: '',
    output: [
      {
        type: 'function_call',
        call_id: callId,
        name,
        arguments: argumentsJson,
      },
    ],
    functionCalls: [
      {
        type: 'function_call',
        callId,
        name,
        arguments: argumentsJson,
        raw: {},
      },
    ],
  };
}

test('strict model schema references server-owned reports and citations', () => {
  assert.equal(
    Object.hasOwn(MODEL_OUTPUT_JSON_SCHEMA.properties, 'readinessReportId'),
    true,
  );
  assert.equal(
    Object.hasOwn(MODEL_OUTPUT_JSON_SCHEMA.properties, 'readinessReport'),
    false,
  );
  assert.equal(
    Object.hasOwn(MODEL_OUTPUT_JSON_SCHEMA.properties, 'citationIds'),
    true,
  );
  assert.equal(
    Object.hasOwn(MODEL_OUTPUT_JSON_SCHEMA.properties, 'citations'),
    false,
  );
});

test('orchestrator attaches the validated report and reconstructs grounded citation metadata', async () => {
  const envelope = createEnvelope();
  const scope = {
    organizationId: envelope.context.scope.organizationId,
    projectId: envelope.context.scope.projectId,
    runId: envelope.context.scope.runId,
  };
  let call = 0;
  const model = {
    async createResponse(request) {
      call += 1;
      if (call === 1) {
        return functionCall('search_permit_guidance', 'call-search', {
          ...scope,
          query: 'managed land',
          sourceIds: ['bc-demo-land-guide'],
          projectTypeIds: ['community-connectivity'],
          maxResults: 5,
        });
      }
      if (call === 2) {
        return functionCall('compose_readiness_report', 'call-report', {
          ...scope,
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
          citationIds: [citation.id],
          assumptions: [],
        });
      }
      const reportOutput = request.input
        .filter((item) => item?.type === 'function_call_output')
        .find((item) => item.call_id === 'call-report');
      const report = JSON.parse(reportOutput.output);
      return {
        id: 'response-final',
        outputText: JSON.stringify({
          content:
            'This is preparation guidance only. Confirm current obligations with the responsible authority.',
          citationIds: [citation.id],
          uncertainty: [
            'Potential instruction-like text was removed from retrieved evidence.',
          ],
          escalationRequired: true,
          readinessReportId: report.id,
        }),
        output: [],
        functionCalls: [],
      };
    },
  };
  const guidanceSearch = {
    async search() {
      return {
        available: true,
        citations: [citation],
        warning:
          'Potential instruction-like text was removed from retrieved evidence.',
        safetyFlag: true,
      };
    },
  };
  const orchestrator = new PermitReadinessOrchestrator(
    configuration,
    model,
    guidanceSearch,
  );

  const output = await orchestrator.invoke({
    envelope,
    signal: new AbortController().signal,
  });

  assert.equal(call, 3);
  assert.equal(output.readinessReport.agentVersion, '1');
  assert.equal(output.readinessReport.id.length, 36);
  assert.deepEqual(output.citations, [citation]);
  assert.deepEqual(output.readinessReport.citations, [citation]);
});
