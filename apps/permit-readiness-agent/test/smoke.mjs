import assert from 'node:assert/strict';
import { PermitReadinessOrchestrator } from '../dist/orchestrator.js';
import { createAgentServer } from '../dist/server.js';
import { configuration, createEnvelope, safeOutput } from './fixture.mjs';

const fakeModel = {
  async createResponse() {
    return {
      id: 'resp_fake',
      outputText: JSON.stringify(
        safeOutput(
          'This is preparation guidance only. Confirm the managed-land question and current obligations with the responsible authority.',
        ),
      ),
      output: [],
      functionCalls: [],
    };
  },
};

const orchestrator = new PermitReadinessOrchestrator(configuration, fakeModel);
const server = createAgentServer({ configuration, orchestrator });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

try {
  const address = server.address();
  const envelope = createEnvelope();
  const response = await fetch(`http://127.0.0.1:${address.port}/responses`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-client-correlation-id': envelope.context.scope.correlationId,
      'x-client-organization-id': envelope.context.scope.organizationId,
      'x-client-project-id': envelope.context.scope.projectId,
      'x-client-run-id': envelope.context.scope.runId,
    },
    body: JSON.stringify({
      input: JSON.stringify(envelope),
      stream: false,
    }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  const output = JSON.parse(body.output_text);
  assert.match(output.content, /preparation guidance only/i);
  console.log(
    JSON.stringify({
      smoke: 'passed',
      protocol: body.metadata.protocol_version,
      responseId: body.id,
    }),
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
}
