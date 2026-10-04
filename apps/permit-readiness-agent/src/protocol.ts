import {
  AgentInvocationEnvelopeSchema,
  type AgentStructuredOutput,
} from '@permit-readiness/contracts';
import { z } from 'zod';
import { AgentError } from './errors.js';

export const RESPONSES_PROTOCOL_VERSION = '2.0.0';

export const CreateResponseRequestSchema = z
  .object({
    input: z.union([z.string().min(1), z.array(z.unknown()).min(1)]),
    model: z.string().optional(),
    stream: z.boolean().default(false),
    metadata: z.record(z.string()).optional(),
  })
  .passthrough();

export type CreateResponseRequest = z.infer<typeof CreateResponseRequestSchema>;

function extractText(input: CreateResponseRequest['input']): string {
  if (typeof input === 'string') return input;
  const texts: string[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const value = item as Record<string, unknown>;
    if (typeof value.content === 'string') {
      texts.push(value.content);
      continue;
    }
    if (!Array.isArray(value.content)) continue;
    for (const content of value.content) {
      if (!content || typeof content !== 'object') continue;
      const part = content as Record<string, unknown>;
      if (
        (part.type === 'input_text' || part.type === 'text') &&
        typeof part.text === 'string'
      ) {
        texts.push(part.text);
      }
    }
  }
  return texts.at(-1) ?? '';
}

export function parseInvocationEnvelope(request: CreateResponseRequest) {
  const text = extractText(request.input);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new AgentError(
      'invalid_request',
      'Input must contain a valid permit readiness request envelope.',
      400,
      false,
      { cause: error },
    );
  }
  const result = AgentInvocationEnvelopeSchema.safeParse(raw);
  if (!result.success) {
    throw new AgentError(
      'invalid_request',
      'The permit readiness request envelope failed validation.',
      400,
      false,
      { cause: result.error },
    );
  }
  return result.data;
}

export function createResponseObject(
  id: string,
  model: string,
  output: AgentStructuredOutput,
) {
  const text = JSON.stringify(output);
  return {
    id,
    object: 'response',
    created_at: Math.floor(Date.now() / 1000),
    status: 'completed',
    background: false,
    error: null,
    incomplete_details: null,
    instructions: null,
    max_output_tokens: null,
    model,
    output: [
      {
        id: `msg_${crypto.randomUUID().replaceAll('-', '')}`,
        type: 'message',
        status: 'completed',
        role: 'assistant',
        content: [{ type: 'output_text', text, annotations: [] }],
      },
    ],
    output_text: text,
    parallel_tool_calls: false,
    previous_response_id: null,
    reasoning: { effort: null, summary: null },
    store: false,
    temperature: null,
    text: { format: { type: 'json_schema' }, verbosity: 'medium' },
    tool_choice: 'auto',
    tools: [],
    top_p: null,
    truncation: 'disabled',
    usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    user: null,
    metadata: {
      protocol_version: RESPONSES_PROTOCOL_VERSION,
    },
  };
}

export function createStreamEvents(
  response: ReturnType<typeof createResponseObject>,
) {
  const item = response.output[0]!;
  const part = item.content[0]!;
  return [
    {
      type: 'response.created',
      sequence_number: 0,
      response: { ...response, status: 'in_progress', output: [] },
    },
    {
      type: 'response.in_progress',
      sequence_number: 1,
      response: { ...response, status: 'in_progress', output: [] },
    },
    {
      type: 'response.output_item.added',
      sequence_number: 2,
      output_index: 0,
      item: { ...item, status: 'in_progress', content: [] },
    },
    {
      type: 'response.content_part.added',
      sequence_number: 3,
      item_id: item.id,
      output_index: 0,
      content_index: 0,
      part: { ...part, text: '' },
    },
    {
      type: 'response.output_text.delta',
      sequence_number: 4,
      item_id: item.id,
      output_index: 0,
      content_index: 0,
      delta: part.text,
    },
    {
      type: 'response.output_text.done',
      sequence_number: 5,
      item_id: item.id,
      output_index: 0,
      content_index: 0,
      text: part.text,
    },
    {
      type: 'response.content_part.done',
      sequence_number: 6,
      item_id: item.id,
      output_index: 0,
      content_index: 0,
      part,
    },
    {
      type: 'response.output_item.done',
      sequence_number: 7,
      output_index: 0,
      item,
    },
    { type: 'response.completed', sequence_number: 8, response },
  ];
}
