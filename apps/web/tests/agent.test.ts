import {
  defaultAzureCredentialOptions,
  DeterministicDemoAgent,
  FoundryResponsesPermitReadinessAgent,
  type NavigatorContext,
} from '../src/lib/agent';
import {
  ProjectIntakeSchema,
  ProjectSchema,
} from '@permit-readiness/contracts';
import { describe, expect, it, vi } from 'vitest';

function context(): NavigatorContext {
  const timestamp = '2026-10-03T20:00:00.000Z';
  return {
    project: ProjectSchema.parse({
      id: '33333333-3333-4333-8333-333333333333',
      organizationId: '22222222-2222-4222-8222-222222222222',
      name: 'Synthetic route',
      projectTypeId: 'community-connectivity',
      status: 'ready_for_review',
      jurisdictionRelease: {
        schemaVersion: '1.0.0',
        jurisdictionId: 'bc-inspired-synthetic',
        releaseVersion: '1.0.0',
        contentVersion: '1.0.0',
        ruleVersion: '1.0.0',
        guidanceVersion: '1.0.0',
      },
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
    intake: ProjectIntakeSchema.parse({
      projectId: '33333333-3333-4333-8333-333333333333',
      questionSetId: 'bc-demo-land-intake',
      questionSetVersion: '1.0.0',
      answers: [
        {
          questionId: 'public-land-involved',
          state: 'answered',
          kind: 'boolean',
          value: true,
        },
        {
          questionId: 'near-water-feature',
          state: 'answered',
          kind: 'boolean',
          value: false,
        },
        {
          questionId: 'changes-road-access',
          state: 'answered',
          kind: 'boolean',
          value: false,
        },
        {
          questionId: 'linear-corridor',
          state: 'answered',
          kind: 'boolean',
          value: true,
        },
      ],
      completeness: {
        requiredCount: 4,
        answeredRequiredCount: 4,
        missingRequiredQuestionIds: [],
        unknownRequiredQuestionIds: [],
        isComplete: true,
      },
      version: 1,
      updatedAt: timestamp,
      completedAt: timestamp,
    }),
    message: 'What should I prepare?',
  };
}

describe('permit readiness agent adapters', () => {
  it('selects the deployed web user-assigned managed identity', () => {
    expect(
      defaultAzureCredentialOptions({
        AZURE_CLIENT_ID: '11111111-1111-4111-8111-111111111111',
      }),
    ).toEqual({
      managedIdentityClientId: '11111111-1111-4111-8111-111111111111',
    });
    expect(defaultAzureCredentialOptions({})).toEqual({});
    expect(() =>
      defaultAzureCredentialOptions({ AZURE_CLIENT_ID: 'not-a-client-id' }),
    ).toThrow();
  });

  it('preserves the deterministic local demo adapter', async () => {
    const result = await new DeterministicDemoAgent().respond(context());
    expect(result.content).toMatch(
      /cannot decide which permits legally apply/i,
    );
  });

  it('invokes the hosted Responses endpoint only from the server adapter', async () => {
    const fetchMock = vi.fn(async (_url: URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      const envelope = JSON.parse(request.input);
      expect(envelope.context.scope.organizationId).toBe(
        context().project.organizationId,
      );
      return new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            content:
              'This is preparation guidance only. Confirm current obligations with the responsible authority.',
            citations: [],
            uncertainty: [],
            escalationRequired: true,
          }),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    const adapter = new FoundryResponsesPermitReadinessAgent(
      {
        endpoint: 'https://agent.example.test',
        agentName: 'permit-readiness-agent',
        apiVersion: '',
        tokenScope: 'https://ai.azure.com/.default',
        timeoutMs: 1_000,
      },
      { getToken: async () => ({ token: 'managed-identity-token' }) },
      fetchMock as typeof fetch,
    );
    const result = await adapter.respond(context());
    expect(result.content).toMatch(/preparation guidance only/i);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://agent.example.test/responses',
    );
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      authorization: 'Bearer managed-identity-token',
    });
  });
});
