export const configuration = {
  FOUNDRY_PROJECT_ENDPOINT:
    'https://example.services.ai.azure.com/api/projects/example',
  FOUNDRY_MODEL_NAME: 'fake-model',
  FOUNDRY_AGENT_NAME: 'permit-readiness-agent',
  FOUNDRY_AGENT_VERSION: '1',
  PORT: 8088,
  AGENT_REQUEST_TIMEOUT_MS: 100,
  AGENT_MAX_TOOL_ROUNDS: 6,
  AGENT_MAX_OUTPUT_RETRIES: 2,
  LOG_LEVEL: 'error',
};

export function createContext() {
  const updatedAt = '2026-10-03T20:00:00.000Z';
  return {
    scope: {
      organizationId: '22222222-2222-4222-8222-222222222222',
      projectId: '33333333-3333-4333-8333-333333333333',
      runId: '44444444-4444-4444-8444-444444444444',
      correlationId: '55555555-5555-4555-8555-555555555555',
    },
    project: {
      id: '33333333-3333-4333-8333-333333333333',
      organizationId: '22222222-2222-4222-8222-222222222222',
      name: 'Synthetic corridor',
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
      version: 2,
      createdAt: updatedAt,
      updatedAt,
    },
    intake: {
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
      ],
      completeness: {
        requiredCount: 1,
        answeredRequiredCount: 1,
        missingRequiredQuestionIds: [],
        unknownRequiredQuestionIds: [],
        isComplete: true,
      },
      version: 2,
      updatedAt,
      completedAt: updatedAt,
    },
    questionSet: {
      id: 'bc-demo-land-intake',
      version: '1.0.0',
      title: 'Land details',
      projectTypeIds: ['community-connectivity'],
      questions: [
        {
          id: 'public-land-involved',
          kind: 'boolean',
          label: 'Could the project use managed land?',
          required: true,
        },
      ],
    },
    permitTypes: [
      {
        id: 'land-tenure-coordination',
        name: 'Illustrative land tenure coordination',
        kind: 'authorization',
        authorityName: 'Synthetic Land Office',
        summary: 'Synthetic coordination for managed land.',
        guidanceSourceIds: ['bc-demo-land-guide'],
      },
    ],
    rules: [
      {
        id: 'bc-land-trigger',
        version: '1.0.0',
        permitTypeId: 'land-tenure-coordination',
        outcome: 'likely',
        explanation: 'Potential managed-land use indicates coordination.',
        sourceIds: ['bc-demo-land-guide'],
        condition: {
          type: 'answer',
          questionId: 'public-land-involved',
          operator: 'equals',
          value: true,
        },
      },
    ],
    permitDependencies: [],
    guidanceSources: [
      {
        id: 'bc-demo-land-guide',
        version: '1.0.0',
        title: 'Synthetic land planning guide',
        publisher: 'Synthetic Land Office',
        url: 'https://example.org/guidance/land',
        jurisdictionId: 'bc-inspired-synthetic',
        reviewedAt: '2026-10-03',
        synthetic: true,
        contentHash:
          'sha256:1111111111111111111111111111111111111111111111111111111111111111',
      },
    ],
    evaluationDate: '2026-10-03',
  };
}

export function createEnvelope() {
  return {
    kind: 'permit_readiness_request',
    version: '1.0.0',
    context: createContext(),
    message: 'What should I prepare?',
  };
}

export function safeOutput(
  content = 'This is preparation guidance only. Confirm current obligations with the responsible authority.',
) {
  return {
    content,
    citations: [],
    uncertainty: ['Approved guidance search is not configured.'],
    escalationRequired: true,
  };
}

export function safeModelOutput(
  content = 'This is preparation guidance only. Confirm current obligations with the responsible authority.',
) {
  return {
    content,
    citationIds: [],
    uncertainty: ['Approved guidance search is not configured.'],
    escalationRequired: true,
    readinessReportId: null,
  };
}
