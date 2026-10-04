import {
  AgentInvocationEnvelopeSchema,
  AgentModelOutputSchema,
  AgentStructuredOutputSchema,
  type AgentInvocationEnvelope,
  type AgentStructuredOutput,
  type Citation,
  type ReadinessReport,
} from '@permit-readiness/contracts';
import type { AgentConfiguration } from './config.js';
import { AgentError, throwIfAborted } from './errors.js';
import { PERMIT_READINESS_INSTRUCTIONS } from './instructions.js';
import type { ModelClient, ModelResponse } from './model.js';
import { OPENAI_TOOL_DEFINITIONS } from './tool-definitions.js';
import { PermitReadinessToolRegistry, type GuidanceSearch } from './tools.js';
import { inSpan } from './telemetry.js';

export interface AgentInvocation {
  readonly envelope: AgentInvocationEnvelope;
  readonly foundryCallId?: string;
  readonly agentUserId?: string;
  readonly signal: AbortSignal;
}

function parseStructuredOutput(
  response: ModelResponse,
  envelope: AgentInvocationEnvelope,
  resolveCitations: (
    citationIds: readonly string[],
  ) => readonly Citation[] | undefined,
  validatedReport?: ReadinessReport,
): AgentStructuredOutput {
  let raw: unknown;
  try {
    raw = JSON.parse(response.outputText);
  } catch (error) {
    throw new AgentError(
      'invalid_output',
      'The model returned malformed structured output.',
      502,
      true,
      { cause: error },
    );
  }
  const parsed = AgentModelOutputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AgentError(
      'invalid_output',
      'The model output failed readiness schema validation.',
      502,
      true,
      { cause: parsed.error },
    );
  }
  const resolvedCitations = resolveCitations(parsed.data.citationIds);
  if (!resolvedCitations) {
    throw new AgentError(
      'invalid_output',
      'The model output referenced guidance that was not returned by a validated search for this run.',
      502,
      true,
    );
  }
  const citationsAreApproved = resolvedCitations.every((citation) => {
    const source = envelope.context.guidanceSources.find(
      (candidate) => candidate.id === citation.sourceId,
    );
    return (
      source !== undefined &&
      source.version === citation.sourceVersion &&
      source.title === citation.title &&
      source.publisher === citation.publisher &&
      source.url === citation.url
    );
  });
  if (!citationsAreApproved) {
    throw new AgentError(
      'invalid_output',
      'The model output referenced an unapproved guidance source.',
      502,
      false,
    );
  }
  if (parsed.data.readinessReportId !== (validatedReport?.id ?? null)) {
    throw new AgentError(
      'invalid_output',
      'The model output report identifier did not match the validated report tool output.',
      502,
      true,
    );
  }
  let citations = resolvedCitations;
  if (validatedReport) {
    const requestedIds = [...parsed.data.citationIds].sort();
    const reportIds = validatedReport.citations
      .map((citation) => citation.id)
      .sort();
    if (JSON.stringify(requestedIds) !== JSON.stringify(reportIds)) {
      throw new AgentError(
        'invalid_output',
        'The model output citation identifiers did not match the validated report tool output.',
        502,
        true,
      );
    }
    citations = validatedReport.citations;
  }
  if (
    !/preparation|not (?:an )?(?:application|approval|legal)|confirm/i.test(
      parsed.data.content,
    )
  ) {
    throw new AgentError(
      'invalid_output',
      'The model output omitted required non-binding safety language.',
      502,
      true,
    );
  }
  return AgentStructuredOutputSchema.parse({
    content: parsed.data.content,
    citations,
    uncertainty: parsed.data.uncertainty,
    escalationRequired: parsed.data.escalationRequired,
    ...(validatedReport ? { readinessReport: validatedReport } : {}),
  });
}

export class PermitReadinessOrchestrator {
  constructor(
    private readonly configuration: AgentConfiguration,
    private readonly model: ModelClient,
    private readonly guidanceSearch?: GuidanceSearch,
  ) {}

  async invoke(invocation: AgentInvocation): Promise<AgentStructuredOutput> {
    const envelope = AgentInvocationEnvelopeSchema.parse(invocation.envelope);
    const tools = new PermitReadinessToolRegistry(
      envelope.context,
      this.guidanceSearch,
      this.configuration.FOUNDRY_AGENT_VERSION,
    );
    const modelInput: unknown[] = [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: JSON.stringify({
              message: envelope.message,
              scope: envelope.context.scope,
              ruleRelease: {
                id: `rules-${envelope.context.project.jurisdictionRelease.jurisdictionId}`,
                version:
                  envelope.context.project.jurisdictionRelease.ruleVersion,
              },
              approvedGuidanceSourceIds: envelope.context.guidanceSources.map(
                (source) => source.id,
              ),
            }),
          },
        ],
      },
    ];

    return inSpan(
      'agent.invoke',
      {
        'agent.name': this.configuration.FOUNDRY_AGENT_NAME,
        'agent.version': this.configuration.FOUNDRY_AGENT_VERSION,
        'agent.project.id': envelope.context.scope.projectId,
        'agent.run.id': envelope.context.scope.runId,
      },
      async () => {
        let outputRetry = 0;
        let validatedReport: ReadinessReport | undefined;
        for (
          let round = 0;
          round < this.configuration.AGENT_MAX_TOOL_ROUNDS;
          round += 1
        ) {
          throwIfAborted(invocation.signal);
          const response = await this.model.createResponse({
            model: this.configuration.FOUNDRY_MODEL_NAME,
            instructions: PERMIT_READINESS_INSTRUCTIONS,
            input: modelInput,
            tools: OPENAI_TOOL_DEFINITIONS,
            signal: invocation.signal,
            foundryCallId: invocation.foundryCallId,
          });
          if (response.functionCalls.length > 0) {
            modelInput.push(...response.output);
            for (const call of response.functionCalls) {
              const result = await tools.execute(
                call.name,
                call.arguments,
                invocation.signal,
              );
              if (call.name === 'compose_readiness_report') {
                validatedReport = result as ReadinessReport;
              }
              modelInput.push({
                type: 'function_call_output',
                call_id: call.callId,
                output: JSON.stringify(result),
              });
            }
            continue;
          }
          try {
            return parseStructuredOutput(
              response,
              envelope,
              (citationIds) => tools.getGroundedCitations(citationIds),
              validatedReport,
            );
          } catch (error) {
            if (
              !(error instanceof AgentError) ||
              error.code !== 'invalid_output' ||
              !error.retryable ||
              outputRetry >= this.configuration.AGENT_MAX_OUTPUT_RETRIES
            ) {
              throw error;
            }
            outputRetry += 1;
            modelInput.push({
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: 'The previous response failed schema or safety validation. Return only corrected JSON using validated tool results.',
                },
              ],
            });
          }
        }
        throw new AgentError(
          'invalid_output',
          'The agent exceeded the maximum tool or validation rounds.',
          502,
          true,
        );
      },
    );
  }
}
