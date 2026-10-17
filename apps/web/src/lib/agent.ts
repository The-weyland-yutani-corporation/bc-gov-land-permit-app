import 'server-only';

import { DefaultAzureCredential } from '@azure/identity';
import {
  AgentInvocationEnvelopeSchema,
  AgentStructuredOutputSchema,
  type ConversationMessage,
  type Project,
  type ProjectIntake,
} from '@permit-readiness/contracts';
import { z } from 'zod';
import { demoConfiguration, getDemoQuestionSet } from './demo-config';

export interface NavigatorContext {
  readonly project: Project;
  readonly intake: ProjectIntake;
  readonly message: string;
}

export interface PermitReadinessAgent {
  readonly adapterName: string;
  respond(
    context: NavigatorContext,
  ): Promise<Omit<ConversationMessage, 'id' | 'conversationId' | 'createdAt'>>;
}

export interface HostedAgentConfiguration {
  readonly endpoint: string;
  readonly agentName: string;
  readonly apiVersion: string;
  readonly tokenScope: string;
  readonly timeoutMs: number;
}

export interface HostedPermitReadinessAgent extends PermitReadinessAgent {
  readonly configuration: HostedAgentConfiguration;
}

interface TokenCredential {
  getToken(scope: string): Promise<{ token: string } | null>;
}

type AzureCredentialEnvironment = Readonly<{
  AZURE_CLIENT_ID?: string;
}>;

export function defaultAzureCredentialOptions(
  environment: AzureCredentialEnvironment = {
    AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
  },
): { managedIdentityClientId?: string } {
  const clientId = environment.AZURE_CLIENT_ID?.trim();
  if (!clientId) return {};

  return {
    managedIdentityClientId: z.string().uuid().parse(clientId),
  };
}

export function createHostedAgentCredential(
  environment: AzureCredentialEnvironment = {
    AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
  },
): TokenCredential {
  return new DefaultAzureCredential(defaultAzureCredentialOptions(environment));
}

export class DeterministicDemoAgent implements PermitReadinessAgent {
  readonly adapterName = 'local-deterministic-demo';

  async respond({ project, intake, message }: NavigatorContext) {
    const normalized = message.toLowerCase();
    const missing = intake.completeness.missingRequiredQuestionIds.length;
    const unknown = intake.completeness.unknownRequiredQuestionIds.length;
    let content = `I can explain the saved information for “${project.name}”, but I cannot decide which permits legally apply. `;

    if (normalized.includes('water')) {
      content +=
        'The intake asks whether work could occur near a stream, wet area, or shoreline. Answer what you know, or choose “Unknown” so the gap remains visible.';
    } else if (normalized.includes('location') || normalized.includes('map')) {
      content += project.location
        ? 'A demonstration location is saved. It is not a survey, parcel analysis, or authoritative boundary check.'
        : 'No location is saved. You can enter coordinates or valid GeoJSON without using the map.';
    } else if (missing > 0 || unknown > 0) {
      content += `There are ${missing} unanswered and ${unknown} unknown required items. Review those items before relying on a report.`;
    } else {
      content +=
        'The required structured information is complete. Review the project summary, then generate a deterministic demonstration report.';
    }

    return { role: 'assistant' as const, content };
  }
}

export class FoundryResponsesPermitReadinessAgent
  implements HostedPermitReadinessAgent
{
  readonly adapterName = 'foundry-responses-2.0.0';

  constructor(
    readonly configuration: HostedAgentConfiguration,
    private readonly credential: TokenCredential = createHostedAgentCredential(),
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async respond(context: NavigatorContext) {
    const correlationId = crypto.randomUUID();
    const envelope = AgentInvocationEnvelopeSchema.parse({
      kind: 'permit_readiness_request',
      version: '1.0.0',
      context: {
        scope: {
          organizationId: context.project.organizationId,
          projectId: context.project.id,
          runId: crypto.randomUUID(),
          correlationId,
        },
        project: context.project,
        intake: context.intake,
        questionSet: getDemoQuestionSet(context.project.projectTypeId),
        permitTypes: demoConfiguration.permits,
        rules: demoConfiguration.rules,
        permitDependencies: demoConfiguration.permitDependencies,
        guidanceSources: demoConfiguration.guidanceSources,
        evaluationDate: new Date().toISOString().slice(0, 10),
      },
      message: context.message,
    });
    const token = await this.credential.getToken(this.configuration.tokenScope);
    if (!token) throw new Error('Managed identity token acquisition failed.');
    const controller = new AbortController();
    const timeout = setTimeout(
      () =>
        controller.abort(
          new DOMException('Hosted agent request timed out.', 'TimeoutError'),
        ),
      this.configuration.timeoutMs,
    );
    try {
      const url = new URL(this.configuration.endpoint);
      if (!url.pathname.endsWith('/responses')) {
        url.pathname = `${url.pathname.replace(/\/$/, '')}/responses`;
      }
      if (this.configuration.apiVersion) {
        url.searchParams.set('api-version', this.configuration.apiVersion);
      }
      const response = await this.fetchImplementation(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token.token}`,
          'content-type': 'application/json',
          'x-client-correlation-id': correlationId,
          'x-client-organization-id': envelope.context.scope.organizationId,
          'x-client-project-id': envelope.context.scope.projectId,
          'x-client-run-id': envelope.context.scope.runId,
        },
        body: JSON.stringify({
          model: this.configuration.agentName,
          input: JSON.stringify(envelope),
          stream: false,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Hosted agent returned HTTP ${response.status}.`);
      }
      const raw = (await response.json()) as { output_text?: unknown };
      if (typeof raw.output_text !== 'string') {
        throw new Error('Hosted agent response did not contain output text.');
      }
      const output = AgentStructuredOutputSchema.parse(
        JSON.parse(raw.output_text),
      );
      return {
        role: 'assistant' as const,
        content: output.content,
        citations: output.citations.length ? output.citations : undefined,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function hostedConfiguration(): HostedAgentConfiguration | undefined {
  const endpoint = process.env.PERMIT_AGENT_ENDPOINT;
  if (!endpoint) return undefined;
  return {
    endpoint,
    agentName: process.env.PERMIT_AGENT_NAME ?? 'permit-readiness-agent',
    apiVersion: process.env.PERMIT_AGENT_API_VERSION ?? '',
    tokenScope:
      process.env.PERMIT_AGENT_TOKEN_SCOPE ?? 'https://ai.azure.com/.default',
    timeoutMs: Number(process.env.PERMIT_AGENT_TIMEOUT_MS ?? 45_000),
  };
}

export function getPermitReadinessAgent(): PermitReadinessAgent {
  if ((process.env.PERMIT_AGENT_MODE ?? 'local') === 'remote') {
    const configuration = hostedConfiguration();
    if (!configuration) {
      throw new Error(
        'PERMIT_AGENT_ENDPOINT is required when PERMIT_AGENT_MODE=remote.',
      );
    }
    return new FoundryResponsesPermitReadinessAgent(configuration);
  }
  return new DeterministicDemoAgent();
}
