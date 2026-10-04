import { AIProjectClient } from '@azure/ai-projects';
import { DefaultAzureCredential } from '@azure/identity';
import type { AgentConfiguration } from './config.js';
import { AgentError, throwIfAborted } from './errors.js';

export interface ModelFunctionCall {
  readonly type: 'function_call';
  readonly callId: string;
  readonly name: string;
  readonly arguments: string;
  readonly raw: unknown;
}

export interface ModelResponse {
  readonly id: string;
  readonly outputText: string;
  readonly output: readonly unknown[];
  readonly functionCalls: readonly ModelFunctionCall[];
  readonly usage?: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly totalTokens: number;
  };
}

export interface ModelRequest {
  readonly model: string;
  readonly instructions: string;
  readonly input: readonly unknown[];
  readonly tools: readonly unknown[];
  readonly signal: AbortSignal;
  readonly foundryCallId?: string;
}

export interface ModelClient {
  createResponse(request: ModelRequest): Promise<ModelResponse>;
}

export const MODEL_OUTPUT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    content: { type: 'string' },
    citationIds: {
      type: 'array',
      items: {
        type: 'string',
        pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
      },
    },
    uncertainty: {
      type: 'array',
      items: { type: 'string' },
    },
    escalationRequired: { type: 'boolean' },
    readinessReportId: {
      type: ['string', 'null'],
      format: 'uuid',
    },
  },
  required: [
    'content',
    'citationIds',
    'uncertainty',
    'escalationRequired',
    'readinessReportId',
  ],
} as const;

function normalizeResponse(raw: unknown): ModelResponse {
  const response = raw as {
    id?: unknown;
    output_text?: unknown;
    output?: unknown;
    usage?: {
      input_tokens?: unknown;
      output_tokens?: unknown;
      total_tokens?: unknown;
    };
  };
  if (typeof response.id !== 'string' || !Array.isArray(response.output)) {
    throw new AgentError(
      'model_error',
      'The model returned an invalid Responses API payload.',
      502,
      true,
    );
  }
  const functionCalls = response.output.flatMap((item) => {
    const value = item as Record<string, unknown>;
    if (
      value.type !== 'function_call' ||
      typeof value.call_id !== 'string' ||
      typeof value.name !== 'string' ||
      typeof value.arguments !== 'string'
    ) {
      return [];
    }
    return [
      {
        type: 'function_call' as const,
        callId: value.call_id,
        name: value.name,
        arguments: value.arguments,
        raw: item,
      },
    ];
  });
  const usage = response.usage;
  return {
    id: response.id,
    outputText:
      typeof response.output_text === 'string' ? response.output_text : '',
    output: response.output,
    functionCalls,
    usage:
      usage &&
      typeof usage.input_tokens === 'number' &&
      typeof usage.output_tokens === 'number' &&
      typeof usage.total_tokens === 'number'
        ? {
            inputTokens: usage.input_tokens,
            outputTokens: usage.output_tokens,
            totalTokens: usage.total_tokens,
          }
        : undefined,
  };
}

export class AzureFoundryModelClient implements ModelClient {
  private readonly openAI: ReturnType<AIProjectClient['getOpenAIClient']>;

  constructor(endpoint: string) {
    const project = new AIProjectClient(endpoint, new DefaultAzureCredential());
    this.openAI = project.getOpenAIClient();
  }

  async createResponse(request: ModelRequest): Promise<ModelResponse> {
    throwIfAborted(request.signal);
    try {
      const raw = await this.openAI.responses.create(
        {
          model: request.model,
          instructions: request.instructions,
          input: request.input as never,
          tools: request.tools as never,
          store: false,
          parallel_tool_calls: false,
          text: {
            format: {
              type: 'json_schema',
              name: 'permit_readiness_output',
              strict: true,
              schema: MODEL_OUTPUT_JSON_SCHEMA,
            },
          },
        },
        {
          signal: request.signal,
          headers: request.foundryCallId
            ? { 'x-agent-foundry-call-id': request.foundryCallId }
            : undefined,
        },
      );
      return normalizeResponse(raw);
    } catch (error) {
      throwIfAborted(request.signal);
      if (error instanceof AgentError) throw error;
      throw new AgentError(
        'model_error',
        'The Foundry model request failed.',
        502,
        true,
        { cause: error },
      );
    }
  }
}

export function createAzureModelClient(
  configuration: AgentConfiguration,
): ModelClient {
  return new AzureFoundryModelClient(configuration.FOUNDRY_PROJECT_ENDPOINT);
}
