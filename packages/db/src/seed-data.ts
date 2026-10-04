import type {
  GeoJsonPolygon,
  GuidanceSource,
  IntakeQuestionSet,
  PermitDependency,
  PermitRule,
  PermitType,
} from '@permit-readiness/contracts';

export interface DatabaseSeedPack {
  readonly jurisdictionId: string;
  readonly releaseVersion: string;
  readonly questionSets: readonly IntakeQuestionSet[];
  readonly permits: readonly PermitType[];
  readonly rules: readonly PermitRule[];
  readonly dependencies: readonly PermitDependency[];
  readonly zones: readonly {
    id: string;
    name: string;
    description: string;
    geometry: GeoJsonPolygon;
  }[];
  readonly guidanceSources: readonly GuidanceSource[];
}

export const REFERENCE_DATA_INITIALIZATION_VERSION = '1.0.0';

export const referenceDataPacks: readonly DatabaseSeedPack[] = [
  {
    jurisdictionId: 'generic-public-sector',
    releaseVersion: '1.0.0',
    questionSets: [
      {
        id: 'generic-site-intake',
        version: '1.0.0',
        title: 'Site work details',
        description:
          'Original synthetic questions for demonstrating early project readiness.',
        projectTypeIds: ['community-site-work'],
        questions: [
          {
            id: 'disturbs-ground',
            kind: 'boolean',
            label: 'Will the work disturb soil or existing ground cover?',
            required: true,
          },
          {
            id: 'changes-access',
            kind: 'boolean',
            label: 'Will the work create or materially change vehicle access?',
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
          'A synthetic review used to demonstrate early planning for ground disturbance.',
        guidanceSourceIds: ['generic-site-guidance'],
      },
      {
        id: 'access-coordination',
        name: 'Illustrative access coordination',
        kind: 'authorization',
        authorityName: 'Example Transportation Office',
        authorityUrl: 'https://example.org/permits/access',
        summary:
          'A synthetic authorization used to demonstrate access coordination.',
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
          'Changed vehicle access is treated as a likely coordination need in this demonstration.',
        condition: {
          type: 'answer',
          questionId: 'changes-access',
          operator: 'equals',
          value: true,
        },
      },
    ],
    dependencies: [
      {
        permitTypeId: 'site-disturbance-review',
        dependsOnPermitTypeId: 'access-coordination',
        relationship: 'confirm_first',
        explanation:
          'Confirm access constraints before finalizing the illustrative site layout.',
      },
    ],
    zones: [
      {
        id: 'illustrative-review-area',
        name: 'Illustrative review area',
        description:
          'An invented polygon used only to exercise spatial query behavior.',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-123.2, 49.2],
              [-123, 49.2],
              [-123, 49.35],
              [-123.2, 49.35],
              [-123.2, 49.2],
            ],
          ],
        },
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
  },
  {
    jurisdictionId: 'bc-inspired-synthetic',
    releaseVersion: '1.0.0',
    questionSets: [
      {
        id: 'bc-demo-land-intake',
        version: '1.0.0',
        title: 'Land and corridor details',
        description:
          'Original synthetic questions for housing, power, and connectivity examples.',
        projectTypeIds: [
          'housing-site',
          'clean-power-connection',
          'community-connectivity',
        ],
        questions: [
          {
            id: 'public-land-involved',
            kind: 'boolean',
            label:
              'Could any part of the project use provincially managed land?',
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
              'Does the project include a utility or communications corridor?',
            required: true,
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
    dependencies: [
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
    zones: [
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
              [-123.6, 49],
              [-124.4, 49],
              [-124.4, 48.4],
            ],
          ],
        },
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
              [-121, 49.7],
              [-119.8, 49.7],
              [-119.8, 50.5],
              [-121, 50.5],
              [-121, 49.7],
            ],
          ],
        },
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
  },
] as const;

/**
 * Backward-compatible export for consumers that previously treated required
 * reference data as a generic seed.
 */
export const databaseSeedPacks = referenceDataPacks;
