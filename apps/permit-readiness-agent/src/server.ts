import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { AgentError } from './errors.js';
import type { PermitReadinessOrchestrator } from './orchestrator.js';
import {
  CreateResponseRequestSchema,
  createResponseObject,
  createStreamEvents,
  parseInvocationEnvelope,
} from './protocol.js';
import type { AgentConfiguration } from './config.js';
import { createLogger, inSpan } from './telemetry.js';

const MAX_BODY_BYTES = 1_048_576;

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new AgentError(
        'invalid_request',
        'The request body exceeds the one-megabyte limit.',
        413,
        false,
      );
    }
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    throw new AgentError(
      'invalid_request',
      'The request body is not valid JSON.',
      400,
      false,
      { cause: error },
    );
  }
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  const data = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(data),
    'cache-control': 'no-store',
  });
  response.end(data);
}

function sendError(response: ServerResponse, error: unknown): void {
  const known =
    error instanceof AgentError
      ? error
      : new AgentError(
          'model_error',
          'The agent could not complete the request.',
          500,
          true,
          { cause: error },
        );
  sendJson(response, known.status, {
    error: {
      message: known.message,
      type: 'agent_error',
      code: known.code,
      param: null,
      retryable: known.retryable,
    },
  });
}

export interface AgentServerOptions {
  readonly configuration: AgentConfiguration;
  readonly orchestrator: PermitReadinessOrchestrator;
}

export function createAgentServer(options: AgentServerOptions): Server {
  const log = createLogger(options.configuration.LOG_LEVEL);
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, { status: 'live' });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/readiness') {
      sendJson(response, 200, {
        status: 'ready',
        protocol: 'responses',
        protocolVersion: '2.0.0',
      });
      return;
    }
    if (request.method !== 'POST' || url.pathname !== '/responses') {
      sendJson(response, 404, {
        error: {
          message: 'Route not found.',
          type: 'invalid_request_error',
          code: 'not_found',
          param: null,
        },
      });
      return;
    }

    const requestController = new AbortController();
    const timeout = setTimeout(() => {
      requestController.abort(
        new DOMException('Agent request timed out.', 'TimeoutError'),
      );
    }, options.configuration.AGENT_REQUEST_TIMEOUT_MS);
    const cancel = () => {
      if (!response.writableEnded) {
        requestController.abort(
          new DOMException('Client disconnected.', 'AbortError'),
        );
      }
    };
    request.once('aborted', cancel);
    response.once('close', cancel);

    const correlationId =
      request.headers['x-client-correlation-id']?.toString() ??
      crypto.randomUUID();
    try {
      await inSpan(
        'http.responses',
        {
          'http.request.method': 'POST',
          'url.path': '/responses',
          'agent.correlation_id': correlationId,
        },
        async () => {
          const parsed = CreateResponseRequestSchema.parse(
            await readJson(request),
          );
          const envelope = parseInvocationEnvelope(parsed);
          if (envelope.context.scope.correlationId !== correlationId) {
            throw new AgentError(
              'scope_violation',
              'The correlation identifier does not match the request scope.',
              403,
              false,
            );
          }
          const headerScope = {
            organizationId:
              request.headers['x-client-organization-id']?.toString(),
            projectId: request.headers['x-client-project-id']?.toString(),
            runId: request.headers['x-client-run-id']?.toString(),
          };
          if (
            headerScope.organizationId !==
              envelope.context.scope.organizationId ||
            headerScope.projectId !== envelope.context.scope.projectId ||
            headerScope.runId !== envelope.context.scope.runId
          ) {
            throw new AgentError(
              'scope_violation',
              'The forwarded request scope does not match the input envelope.',
              403,
              false,
            );
          }
          const output = await options.orchestrator.invoke({
            envelope,
            foundryCallId:
              request.headers['x-agent-foundry-call-id']?.toString(),
            agentUserId: request.headers['x-agent-user-id']?.toString(),
            signal: requestController.signal,
          });
          const protocolResponse = createResponseObject(
            `resp_${crypto.randomUUID().replaceAll('-', '')}`,
            options.configuration.FOUNDRY_MODEL_NAME,
            output,
          );
          if (!parsed.stream) {
            sendJson(response, 200, protocolResponse);
            return;
          }
          response.writeHead(200, {
            'content-type': 'text/event-stream; charset=utf-8',
            'cache-control': 'no-cache, no-store',
            connection: 'keep-alive',
            'x-accel-buffering': 'no',
          });
          for (const event of createStreamEvents(protocolResponse)) {
            response.write(`event: ${event.type}\n`);
            response.write(`data: ${JSON.stringify(event)}\n\n`);
          }
          response.end();
        },
      );
      log('info', 'agent_request_completed', { correlationId });
    } catch (error) {
      log('error', 'agent_request_failed', {
        correlationId,
        code: error instanceof AgentError ? error.code : 'unexpected',
      });
      if (!response.headersSent) sendError(response, error);
      else response.destroy(error instanceof Error ? error : undefined);
    } finally {
      clearTimeout(timeout);
      request.removeListener('aborted', cancel);
      response.removeListener('close', cancel);
    }
  });
}
