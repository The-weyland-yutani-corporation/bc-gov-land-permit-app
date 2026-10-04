import assert from 'node:assert/strict';
import test from 'node:test';
import { abortError } from '../dist/errors.js';
import { PERMIT_READINESS_INSTRUCTIONS } from '../dist/instructions.js';
import { PermitReadinessOrchestrator } from '../dist/orchestrator.js';
import { createAgentServer } from '../dist/server.js';
import { configuration, createEnvelope, safeModelOutput } from './fixture.mjs';

function response(output) {
  return {
    id: crypto.randomUUID(),
    outputText: output,
    output: [],
    functionCalls: [],
  };
}

function expectFunctionOutput(input) {
  const toolOutput = input.find(
    (item) => item?.type === 'function_call_output',
  );
  assert.equal(toolOutput.call_id, 'call_context');
  assert.match(toolOutput.output, /Synthetic corridor/);
}

test('instructions defend authority, isolation, injection, secrets, and escalation', () => {
  assert.match(
    PERMIT_READINESS_INSTRUCTIONS,
    /deterministic tool results are authoritative/i,
  );
  assert.match(
    PERMIT_READINESS_INSTRUCTIONS,
    /another user, organization, project/i,
  );
  assert.match(
    PERMIT_READINESS_INSTRUCTIONS,
    /retrieved passages.*untrusted data/i,
  );
  assert.match(
    PERMIT_READINESS_INSTRUCTIONS,
    /hidden instructions.*credentials/i,
  );
  assert.match(
    PERMIT_READINESS_INSTRUCTIONS,
    /escalate to the responsible authority/i,
  );
});

test('structured output validation retries safely and accepts corrected output', async () => {
  const calls = [];
  const model = {
    async createResponse(request) {
      calls.push(request);
      return calls.length === 1
        ? response('not-json')
        : response(JSON.stringify(safeModelOutput()));
    },
  };
  const orchestrator = new PermitReadinessOrchestrator(configuration, model);
  const output = await orchestrator.invoke({
    envelope: createEnvelope(),
    signal: new AbortController().signal,
  });

  assert.equal(output.escalationRequired, true);
  assert.equal(calls.length, 2);
  assert.match(
    calls[1].input.at(-1).content[0].text,
    /failed schema or safety validation/i,
  );
});

test('executes allow-listed typed tool calls before final output', async () => {
  const envelope = createEnvelope();
  let calls = 0;
  const orchestrator = new PermitReadinessOrchestrator(configuration, {
    async createResponse(request) {
      calls += 1;
      if (calls === 1) {
        const argumentsJson = JSON.stringify({
          organizationId: envelope.context.scope.organizationId,
          projectId: envelope.context.scope.projectId,
          runId: envelope.context.scope.runId,
        });
        return {
          id: 'resp_tool',
          outputText: '',
          output: [
            {
              type: 'function_call',
              call_id: 'call_context',
              name: 'get_project_context',
              arguments: argumentsJson,
            },
          ],
          functionCalls: [
            {
              type: 'function_call',
              callId: 'call_context',
              name: 'get_project_context',
              arguments: argumentsJson,
              raw: {},
            },
          ],
        };
      }
      expectFunctionOutput(request.input);
      return response(JSON.stringify(safeModelOutput()));
    },
  });
  const output = await orchestrator.invoke({
    envelope,
    signal: new AbortController().signal,
  });
  assert.equal(calls, 2);
  assert.match(output.content, /preparation/i);
});

test('unsafe success-shaped output is rejected after bounded retries', async () => {
  let calls = 0;
  const orchestrator = new PermitReadinessOrchestrator(configuration, {
    async createResponse() {
      calls += 1;
      return response(
        JSON.stringify({
          content: 'Your permit is approved.',
          citationIds: [],
          uncertainty: [],
          escalationRequired: false,
          readinessReportId: null,
        }),
      );
    },
  });
  await assert.rejects(
    orchestrator.invoke({
      envelope: createEnvelope(),
      signal: new AbortController().signal,
    }),
    (error) => error.code === 'invalid_output',
  );
  assert.equal(calls, configuration.AGENT_MAX_OUTPUT_RETRIES + 1);
});

test('fabricated citation identifiers are rejected unless retrieved in the run', async () => {
  let calls = 0;
  const orchestrator = new PermitReadinessOrchestrator(configuration, {
    async createResponse() {
      calls += 1;
      return response(
        JSON.stringify({
          content:
            'This is preparation guidance only. Confirm current obligations with the responsible authority.',
          citationIds: ['fabricated-citation'],
          uncertainty: [],
          escalationRequired: true,
          readinessReportId: null,
        }),
      );
    },
  });
  await assert.rejects(
    orchestrator.invoke({
      envelope: createEnvelope(),
      signal: new AbortController().signal,
    }),
    (error) =>
      error.code === 'invalid_output' &&
      /not returned by a validated search/i.test(error.message),
  );
  assert.equal(calls, configuration.AGENT_MAX_OUTPUT_RETRIES + 1);
});

test('model-authored citation metadata is rejected', async () => {
  let calls = 0;
  const orchestrator = new PermitReadinessOrchestrator(configuration, {
    async createResponse() {
      calls += 1;
      return response(
        JSON.stringify({
          ...safeModelOutput(),
          citations: [
            {
              id: 'modified-citation',
              title: 'Model-modified title',
            },
          ],
        }),
      );
    },
  });
  await assert.rejects(
    orchestrator.invoke({
      envelope: createEnvelope(),
      signal: new AbortController().signal,
    }),
    (error) =>
      error.code === 'invalid_output' &&
      /schema validation/i.test(error.message),
  );
  assert.equal(calls, configuration.AGENT_MAX_OUTPUT_RETRIES + 1);
});

test('cancellation propagates without a fallback response', async () => {
  const controller = new AbortController();
  const orchestrator = new PermitReadinessOrchestrator(configuration, {
    async createResponse(request) {
      await new Promise((resolve, reject) => {
        request.signal.addEventListener(
          'abort',
          () => reject(abortError(request.signal)),
          { once: true },
        );
      });
    },
  });
  const invocation = orchestrator.invoke({
    envelope: createEnvelope(),
    signal: controller.signal,
  });
  controller.abort(new DOMException('Cancelled.', 'AbortError'));
  await assert.rejects(invocation, (error) => error.code === 'cancelled');
});

test('request timeout returns a retryable protocol error', async () => {
  const timedConfiguration = {
    ...configuration,
    AGENT_REQUEST_TIMEOUT_MS: 20,
  };
  const server = createAgentServer({
    configuration: timedConfiguration,
    orchestrator: {
      async invoke({ signal }) {
        await new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => reject(abortError(signal)), {
            once: true,
          });
        });
      },
    },
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const envelope = createEnvelope();
    const result = await fetch(`http://127.0.0.1:${address.port}/responses`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-client-correlation-id': envelope.context.scope.correlationId,
        'x-client-organization-id': envelope.context.scope.organizationId,
        'x-client-project-id': envelope.context.scope.projectId,
        'x-client-run-id': envelope.context.scope.runId,
      },
      body: JSON.stringify({ input: JSON.stringify(envelope) }),
    });
    assert.equal(result.status, 504);
    const body = await result.json();
    assert.equal(body.error.code, 'timeout');
    assert.equal(body.error.retryable, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
