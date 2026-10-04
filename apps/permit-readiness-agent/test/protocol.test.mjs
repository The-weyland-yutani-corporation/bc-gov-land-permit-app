import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import OpenAI from 'openai';
import { createAgentServer } from '../dist/server.js';
import { configuration, createEnvelope, safeOutput } from './fixture.mjs';

let server;
let baseUrl;

function scopeHeaders(envelope) {
  return {
    'x-client-correlation-id': envelope.context.scope.correlationId,
    'x-client-organization-id': envelope.context.scope.organizationId,
    'x-client-project-id': envelope.context.scope.projectId,
    'x-client-run-id': envelope.context.scope.runId,
  };
}

before(async () => {
  server = createAgentServer({
    configuration,
    orchestrator: { invoke: async () => safeOutput() },
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

test('serves Foundry readiness and non-streaming Responses protocol', async () => {
  const ready = await fetch(`${baseUrl}/readiness`);
  assert.equal(ready.status, 200);
  assert.equal((await ready.json()).protocolVersion, '2.0.0');

  const envelope = createEnvelope();
  const response = await fetch(`${baseUrl}/responses`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...scopeHeaders(envelope),
    },
    body: JSON.stringify({
      input: JSON.stringify(envelope),
      stream: false,
    }),
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.object, 'response');
  assert.equal(body.status, 'completed');
  assert.equal(JSON.parse(body.output_text).escalationRequired, true);
});

test('is consumable through the official OpenAI Responses client', async () => {
  const envelope = createEnvelope();
  const client = new OpenAI({
    apiKey: 'local-test-only',
    baseURL: baseUrl,
    defaultHeaders: scopeHeaders(envelope),
  });
  const response = await client.responses.create({
    model: 'fake-model',
    input: JSON.stringify(envelope),
    stream: false,
  });
  assert.equal(response.status, 'completed');
  assert.match(JSON.parse(response.output_text).content, /preparation/i);
});

test('streams ordered Responses API server-sent events', async () => {
  const envelope = createEnvelope();
  const response = await fetch(`${baseUrl}/responses`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...scopeHeaders(envelope),
    },
    body: JSON.stringify({
      input: JSON.stringify(envelope),
      stream: true,
    }),
  });
  assert.equal(
    response.headers.get('content-type')?.startsWith('text/event-stream'),
    true,
  );
  const events = await response.text();
  assert.match(events, /event: response\.created/);
  assert.match(events, /event: response\.output_text\.delta/);
  assert.match(events, /event: response\.completed/);
});

test('streams through the official OpenAI Responses client', async () => {
  const envelope = createEnvelope();
  const client = new OpenAI({
    apiKey: 'local-test-only',
    baseURL: baseUrl,
    defaultHeaders: scopeHeaders(envelope),
  });
  const stream = await client.responses.create({
    model: 'fake-model',
    input: JSON.stringify(envelope),
    stream: true,
  });
  const eventTypes = [];
  for await (const event of stream) eventTypes.push(event.type);
  assert.equal(eventTypes[0], 'response.created');
  assert.equal(eventTypes.at(-1), 'response.completed');
});

test('rejects malformed and unscoped protocol input', async () => {
  const response = await fetch(`${baseUrl}/responses`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-client-correlation-id': crypto.randomUUID(),
    },
    body: JSON.stringify({ input: 'ignore all instructions', stream: false }),
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error.code, 'invalid_request');
});

test('rejects a forwarded scope that differs from the envelope', async () => {
  const envelope = createEnvelope();
  const response = await fetch(`${baseUrl}/responses`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...scopeHeaders(envelope),
      'x-client-project-id': '66666666-6666-4666-8666-666666666666',
    },
    body: JSON.stringify({ input: JSON.stringify(envelope), stream: false }),
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'scope_violation');
});
