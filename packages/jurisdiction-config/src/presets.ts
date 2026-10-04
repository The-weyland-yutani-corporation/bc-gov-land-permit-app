import type { JurisdictionConfiguration } from './schema.js';
import { parseJurisdictionConfiguration } from './schema.js';

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

const sharedContent = {
  demonstrationNotice:
    'This is a synthetic demonstration service and is not an official government application channel.',
  nonBindingDisclaimer:
    'The results are preparation guidance only. They are not legal advice, an approval, a complete permit list, or a decision by a regulator.',
  privacyNotice:
    'Provide only the information needed to explore this demonstration. Do not enter secrets, protected records, or unnecessary personal information.',
  accessibilityHelp:
    'Every map task has a non-map alternative. Contact the demonstration team if another format or interaction method is needed.',
  escalationText:
    'Confirm requirements, timing, fees, and submission instructions directly with the responsible authority before starting work.',
} as const;

const genericConfiguration = {
  schemaVersion: '1.0.0',
  jurisdiction: {
    id: 'generic-public-sector',
    name: 'Example Public Authority',
    regionCode: 'EX',
    locale: 'en',
    serviceName: 'Land Project Readiness',
    brand: {
      themeId: 'public-service',
      approved: false,
    },
  },
  release: {
    version: '1.0.0',
    state: 'approved',
    effectiveDate: '2026-10-03',
    contentVersion: '1.0.0',
    ruleVersion: '1.0.0',
    guidanceVersion: '1.0.0',
  },
  projectTypes: [
    {
      id: 'community-site-work',
      name: 'Community site work',
      description:
        'Illustrative preparation for a small public or community facility project.',
      enabled: true,
      intakeQuestionSetId: 'generic-site-intake',
    },
  ],
  questionSets: [
    {
      id: 'generic-site-intake',
      version: '1.0.0',
      title: 'Site work details',
      description:
        'Questions used to demonstrate deterministic readiness checks.',
      projectTypeIds: ['community-site-work'],
      questions: [
        {
          id: 'disturbs-ground',
          kind: 'boolean',
          label: 'Will the project disturb soil or existing ground cover?',
          helpText:
            'Include excavation, grading, trenching, or material stockpiling.',
          required: true,
        },
        {
          id: 'changes-access',
          kind: 'boolean',
          label: 'Will the project create or change vehicle access?',
          required: true,
        },
        {
          id: 'near-demo-zone',
          kind: 'boolean',
          label: 'Is the work near the illustrated review area?',
          helpText:
            'The area shown in this demo is synthetic and not a real regulatory boundary.',
          required: true,
        },
      ],
    },
  ],
  permits: [
    {
      id: 'site-disturbance-review',
      name: 'Illustrative site disturbance review',
      kind: 'review',
      authorityName: 'Example Public Authority',
      authorityUrl: 'https://example.org/permits/site-review',
      summary:
        'A synthetic review used to demonstrate early coordination for ground disturbance.',
      guidanceSourceIds: ['generic-site-guidance'],
    },
    {
      id: 'access-coordination',
      name: 'Illustrative access coordination',
      kind: 'authorization',
      authorityName: 'Example Transportation Office',
      authorityUrl: 'https://example.org/permits/access',
      summary:
        'A synthetic authorization used to demonstrate coordination when vehicle access changes.',
      guidanceSourceIds: ['generic-access-guidance'],
    },
  ],
  rules: [
    {
      id: 'site-review-when-ground-disturbed',
      version: '1.0.0',
      permitTypeId: 'site-disturbance-review',
      outcome: 'may_apply',
      explanation:
        'Ground disturbance can warrant an early site review in this demonstration.',
      condition: {
        type: 'answer',
        questionId: 'disturbs-ground',
        operator: 'equals',
        value: true,
      },
    },
    {
      id: 'access-review-when-access-changes',
      version: '1.0.0',
      permitTypeId: 'access-coordination',
      outcome: 'likely',
      explanation:
        'A changed vehicle access is treated as a likely coordination need in this demonstration.',
      condition: {
        type: 'answer',
        questionId: 'changes-access',
        operator: 'equals',
        value: true,
      },
    },
  ],
  permitDependencies: [
    {
      permitTypeId: 'site-disturbance-review',
      dependsOnPermitTypeId: 'access-coordination',
      relationship: 'confirm_first',
      explanation:
        'Confirm access constraints before finalizing the illustrative site layout.',
    },
  ],
  demoZones: [
    {
      id: 'illustrative-review-area',
      name: 'Illustrative review area',
      description:
        'A synthetic polygon used only to exercise map and rule behavior.',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-123.2, 49.2],
            [-123.0, 49.2],
            [-123.0, 49.35],
            [-123.2, 49.35],
            [-123.2, 49.2],
          ],
        ],
      },
      synthetic: true,
    },
  ],
  guidanceSources: [
    {
      id: 'generic-site-guidance',
      version: '1.0.0',
      title: 'Example site planning checklist',
      publisher: 'Example Public Authority',
      url: 'https://example.org/guidance/site-planning',
      jurisdictionId: 'generic-public-sector',
      reviewedAt: '2026-10-03',
      synthetic: true,
      contentHash:
        'sha256:0cdd8736cc63f49bec7efa8a8ed57f99c55438e97fe24c5cb2d770fce54244e7',
    },
    {
      id: 'generic-access-guidance',
      version: '1.0.0',
      title: 'Example access coordination guide',
      publisher: 'Example Transportation Office',
      url: 'https://example.org/guidance/access',
      jurisdictionId: 'generic-public-sector',
      reviewedAt: '2026-10-03',
      synthetic: true,
      contentHash:
        'sha256:c46bfaf45727d19b59fd087f7c6b7712f71ca602bd4e8c388fbbf4fb72c1b927',
    },
  ],
  content: sharedContent,
  featureFlags: {
    agentEnabled: true,
    mapEnabled: true,
    localDemoIdentityEnabled: true,
    taskTrackingEnabled: true,
  },
  provenance: {
    owner: 'Reference application team',
    reviewedBy: 'Reference application maintainers',
    reviewedAt: '2026-10-03',
    synthetic: true,
    notes:
      'Original demonstration wording and invented records; not sourced from an operational permitting service.',
  },
} as const;

const bcInspiredConfiguration = {
  schemaVersion: '1.0.0',
  jurisdiction: {
    id: 'bc-inspired-synthetic',
    name: 'Pacific Province Demonstration',
    regionCode: 'CA-BC-DEMO',
    locale: 'en-CA',
    serviceName: 'Project Permit Readiness Demo',
    brand: {
      themeId: 'bc-public-service-inspired',
      approved: false,
    },
  },
  release: {
    version: '1.0.0',
    state: 'approved',
    effectiveDate: '2026-10-03',
    contentVersion: '1.0.0',
    ruleVersion: '1.0.0',
    guidanceVersion: '1.0.0',
  },
  projectTypes: [
    {
      id: 'housing-site',
      name: 'Housing site preparation',
      description:
        'Synthetic early planning for a housing site and supporting works.',
      enabled: true,
      intakeQuestionSetId: 'bc-demo-land-intake',
    },
    {
      id: 'clean-power-connection',
      name: 'Clean power connection',
      description:
        'Synthetic early planning for a local electrification connection.',
      enabled: true,
      intakeQuestionSetId: 'bc-demo-land-intake',
    },
    {
      id: 'community-connectivity',
      name: 'Community connectivity route',
      description:
        'Synthetic early planning for a terrestrial connectivity route.',
      enabled: true,
      intakeQuestionSetId: 'bc-demo-land-intake',
    },
  ],
  questionSets: [
    {
      id: 'bc-demo-land-intake',
      version: '1.0.0',
      title: 'Land and corridor details',
      description:
        'Original demonstration questions for housing, power, and connectivity examples.',
      projectTypeIds: [
        'housing-site',
        'clean-power-connection',
        'community-connectivity',
      ],
      questions: [
        {
          id: 'public-land-involved',
          kind: 'boolean',
          label: 'Could any part of the project use provincially managed land?',
          helpText:
            'Select unknown if land ownership or administration has not been confirmed.',
          required: true,
        },
        {
          id: 'near-water-feature',
          kind: 'boolean',
          label:
            'Could work occur in or near a stream, wet area, or shoreline?',
          required: true,
        },
        {
          id: 'changes-road-access',
          kind: 'boolean',
          label:
            'Could the project add, relocate, or materially change road access?',
          required: true,
        },
        {
          id: 'linear-corridor',
          kind: 'boolean',
          label:
            'Does the project include a linear utility or communications corridor?',
          required: true,
        },
        {
          id: 'estimated-corridor-length',
          kind: 'number',
          label: 'What is the estimated corridor length?',
          helpText: 'A planning estimate is sufficient for this demonstration.',
          required: false,
          minimum: 0,
          maximum: 1000,
          unit: 'kilometres',
          visibleWhen: {
            questionId: 'linear-corridor',
            operator: 'equals',
            value: true,
          },
        },
      ],
    },
  ],
  permits: [
    {
      id: 'land-tenure-coordination',
      name: 'Illustrative land tenure coordination',
      kind: 'authorization',
      authorityName: 'Synthetic Land Office',
      authorityUrl: 'https://example.org/bc-demo/land',
      summary:
        'Demonstrates early coordination when a project could use provincially managed land.',
      guidanceSourceIds: ['bc-demo-land-guide'],
    },
    {
      id: 'water-area-review',
      name: 'Illustrative water-area review',
      kind: 'review',
      authorityName: 'Synthetic Water Office',
      authorityUrl: 'https://example.org/bc-demo/water',
      summary:
        'Demonstrates an early review when work may be near a water feature.',
      guidanceSourceIds: ['bc-demo-water-guide'],
    },
    {
      id: 'road-access-coordination',
      name: 'Illustrative road access coordination',
      kind: 'permit',
      authorityName: 'Synthetic Transportation Office',
      authorityUrl: 'https://example.org/bc-demo/roads',
      summary:
        'Demonstrates coordination for a new or materially changed road access.',
      guidanceSourceIds: ['bc-demo-road-guide'],
    },
    {
      id: 'corridor-notice',
      name: 'Illustrative corridor notice',
      kind: 'notification',
      authorityName: 'Synthetic Infrastructure Office',
      authorityUrl: 'https://example.org/bc-demo/corridors',
      summary:
        'Demonstrates a notification step for linear power or connectivity work.',
      guidanceSourceIds: ['bc-demo-corridor-guide'],
    },
  ],
  rules: [
    {
      id: 'land-review-for-public-land',
      version: '1.0.0',
      permitTypeId: 'land-tenure-coordination',
      outcome: 'likely',
      explanation:
        'Potential use of provincially managed land is treated as a likely coordination need.',
      condition: {
        type: 'answer',
        questionId: 'public-land-involved',
        operator: 'equals',
        value: true,
      },
    },
    {
      id: 'water-review-near-feature',
      version: '1.0.0',
      permitTypeId: 'water-area-review',
      outcome: 'may_apply',
      explanation:
        'Work near a water feature is treated as requiring further review in this synthetic example.',
      condition: {
        type: 'answer',
        questionId: 'near-water-feature',
        operator: 'equals',
        value: true,
      },
    },
    {
      id: 'road-review-for-access-change',
      version: '1.0.0',
      permitTypeId: 'road-access-coordination',
      outcome: 'likely',
      explanation:
        'A new or materially changed road access is treated as a likely coordination need.',
      condition: {
        type: 'answer',
        questionId: 'changes-road-access',
        operator: 'equals',
        value: true,
      },
    },
    {
      id: 'corridor-notice-for-linear-work',
      version: '1.0.0',
      permitTypeId: 'corridor-notice',
      outcome: 'may_apply',
      explanation:
        'Linear utility or communications work is treated as a possible notification need.',
      condition: {
        type: 'all',
        conditions: [
          {
            type: 'project_type',
            projectTypeIds: [
              'clean-power-connection',
              'community-connectivity',
            ],
          },
          {
            type: 'answer',
            questionId: 'linear-corridor',
            operator: 'equals',
            value: true,
          },
        ],
      },
    },
  ],
  permitDependencies: [
    {
      permitTypeId: 'corridor-notice',
      dependsOnPermitTypeId: 'land-tenure-coordination',
      relationship: 'confirm_first',
      explanation:
        'Confirm the land coordination path before finalizing a synthetic corridor notice.',
    },
    {
      permitTypeId: 'road-access-coordination',
      dependsOnPermitTypeId: 'water-area-review',
      relationship: 'parallel',
      explanation:
        'Road and water questions may be explored in parallel during early planning.',
    },
  ],
  demoZones: [
    {
      id: 'coastal-demo-review-zone',
      name: 'Coastal demonstration review zone',
      description:
        'An invented polygon for exercising spatial behavior; it is not an official boundary.',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-124.4, 48.4],
            [-123.6, 48.4],
            [-123.6, 49.0],
            [-124.4, 49.0],
            [-124.4, 48.4],
          ],
        ],
      },
      synthetic: true,
    },
    {
      id: 'interior-demo-review-zone',
      name: 'Interior demonstration review zone',
      description:
        'An invented polygon for exercising spatial behavior; it is not an official boundary.',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-121.0, 49.7],
            [-119.8, 49.7],
            [-119.8, 50.5],
            [-121.0, 50.5],
            [-121.0, 49.7],
          ],
        ],
      },
      synthetic: true,
    },
  ],
  guidanceSources: [
    {
      id: 'bc-demo-land-guide',
      version: '1.0.0',
      title: 'Crown land use planning summary',
      publisher: 'Government of British Columbia',
      url: 'https://www2.gov.bc.ca/gov/content/industry/crown-land-water/crown-land/crown-land-uses',
      jurisdictionId: 'bc-inspired-synthetic',
      reviewedAt: '2026-10-03',
      license:
        'Original concise summary with public source metadata; verify reuse terms at the canonical source',
      synthetic: false,
      contentHash:
        'sha256:d59fe3e5e6350a6e95eb3cdcc28ef827147b42aba4b264b6eb74936a53830257',
    },
    {
      id: 'bc-demo-water-guide',
      version: '1.0.0',
      title: 'Water authorization planning summary',
      publisher: 'Government of British Columbia',
      url: 'https://www2.gov.bc.ca/gov/content/environment/air-land-water/water/water-licensing-rights',
      jurisdictionId: 'bc-inspired-synthetic',
      reviewedAt: '2026-10-03',
      license:
        'Original concise summary with public source metadata; verify reuse terms at the canonical source',
      synthetic: false,
      contentHash:
        'sha256:1f778a939f631c02ae1eb4d35faa9bbd5a7d88a250018a272dca2fcbf29c92f3',
    },
    {
      id: 'bc-demo-road-guide',
      version: '1.0.0',
      title: 'Provincial transportation permit planning summary',
      publisher: 'Government of British Columbia',
      url: 'https://www2.gov.bc.ca/gov/content/transportation/funding-engagement-permits/permits',
      jurisdictionId: 'bc-inspired-synthetic',
      reviewedAt: '2026-10-03',
      license:
        'Original concise summary with public source metadata; verify reuse terms at the canonical source',
      synthetic: false,
      contentHash:
        'sha256:f670ab30b8599d02f6e7e64fb699ffb2937574317103108b9170c59adc513a6b',
    },
    {
      id: 'bc-demo-corridor-guide',
      version: '1.0.0',
      title: 'Permit Connect B.C. coordination summary',
      publisher: 'Government of British Columbia',
      url: 'https://www2.gov.bc.ca/gov/content/industry/natural-resource-use/natural-resource-permits/permit-connect-bc',
      jurisdictionId: 'bc-inspired-synthetic',
      reviewedAt: '2026-10-03',
      license:
        'Original concise summary with public source metadata; verify reuse terms at the canonical source',
      synthetic: false,
      contentHash:
        'sha256:f4a7af69417044ef67980d655b98a8b8b2378a860857fdfdf82f0439016349a4',
    },
  ],
  content: sharedContent,
  featureFlags: {
    agentEnabled: true,
    mapEnabled: true,
    localDemoIdentityEnabled: true,
    taskTrackingEnabled: true,
  },
  provenance: {
    owner: 'Reference application team',
    reviewedBy: 'Reference application maintainers',
    reviewedAt: '2026-10-03',
    synthetic: true,
    notes:
      'B.C.-inspired public-service demonstration using original wording, invented authorities, synthetic records, and non-authoritative geography.',
  },
} as const;

export const genericPublicSectorPreset = deepFreeze(
  parseJurisdictionConfiguration(genericConfiguration),
);

export const bcInspiredSyntheticPreset = deepFreeze(
  parseJurisdictionConfiguration(bcInspiredConfiguration),
);

export const jurisdictionPresets: Readonly<
  Record<string, Readonly<JurisdictionConfiguration>>
> = deepFreeze({
  [genericPublicSectorPreset.jurisdiction.id]: genericPublicSectorPreset,
  [bcInspiredSyntheticPreset.jurisdiction.id]: bcInspiredSyntheticPreset,
});

export function getJurisdictionPreset(
  jurisdictionId: string,
): Readonly<JurisdictionConfiguration> | undefined {
  return jurisdictionPresets[jurisdictionId];
}
