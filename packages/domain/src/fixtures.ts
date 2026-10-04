import type { PermitRule, PermitTypeDefinition } from './permits.js';
import type { PermitRuleRelease, RuleEngineInput } from './rule-engine.js';
import type { SpatialZone } from './spatial.js';

const genericPermits: readonly PermitTypeDefinition[] = [
  {
    id: 'site-disturbance-review',
    name: 'Illustrative site disturbance review',
    kind: 'review',
    authorityName: 'Example Public Authority',
    summary: 'Synthetic review for ground disturbance.',
    guidanceSourceIds: ['generic-site-guidance'],
  },
  {
    id: 'access-coordination',
    name: 'Illustrative access coordination',
    kind: 'authorization',
    authorityName: 'Example Transportation Office',
    summary: 'Synthetic coordination for changed vehicle access.',
    guidanceSourceIds: ['generic-access-guidance'],
  },
];

const genericRules: readonly PermitRule[] = [
  {
    id: 'generic-ground-disturbance',
    version: '1.0.0',
    permitTypeId: 'site-disturbance-review',
    outcome: 'likely',
    priority: 100,
    explanation: 'Ground disturbance indicates an illustrative site review.',
    sourceIds: ['generic-site-guidance'],
    condition: {
      type: 'answer',
      questionId: 'disturbs-ground',
      operator: 'equals',
      value: true,
    },
  },
  {
    id: 'generic-access-change',
    version: '1.0.0',
    permitTypeId: 'access-coordination',
    outcome: 'likely',
    priority: 100,
    explanation: 'Changed vehicle access indicates early coordination.',
    sourceIds: ['generic-access-guidance'],
    condition: {
      type: 'answer',
      questionId: 'changes-access',
      operator: 'equals',
      value: true,
    },
  },
];

const genericRelease = {
  id: 'generic-rules',
  version: '1.0.0',
  state: 'approved',
  effectiveFrom: '2026-01-01',
  rules: genericRules,
} satisfies PermitRuleRelease;

export const genericSyntheticRuleFixture = {
  permitTypes: genericPermits,
  release: genericRelease,
  input: {
    projectTypeId: 'community-site-work',
    answers: [
      {
        questionId: 'disturbs-ground',
        state: 'answered',
        value: true,
      },
      {
        questionId: 'changes-access',
        state: 'answered',
        value: false,
      },
    ],
    permitTypes: genericPermits,
    ruleReleases: [genericRelease],
    selectedRuleRelease: { id: 'generic-rules', version: '1.0.0' },
    evaluationDate: '2026-10-03',
  } satisfies RuleEngineInput,
} as const;

const bcPermits: readonly PermitTypeDefinition[] = [
  {
    id: 'land-tenure-coordination',
    name: 'Illustrative land tenure coordination',
    kind: 'authorization',
    authorityName: 'Synthetic Land Office',
    summary: 'Synthetic coordination for provincially managed land.',
    guidanceSourceIds: ['bc-demo-land-guide'],
  },
  {
    id: 'water-area-review',
    name: 'Illustrative water-area review',
    kind: 'review',
    authorityName: 'Synthetic Water Office',
    summary: 'Synthetic review for work in or near water.',
    guidanceSourceIds: ['bc-demo-water-guide'],
  },
  {
    id: 'riparian-setback-review',
    name: 'Illustrative riparian setback review',
    kind: 'review',
    authorityName: 'Synthetic Environmental Office',
    summary: 'Synthetic review for overlap with a riparian planning area.',
    guidanceSourceIds: ['bc-demo-riparian-guide'],
  },
  {
    id: 'wildlife-habitat-review',
    name: 'Illustrative wildlife habitat review',
    kind: 'review',
    authorityName: 'Synthetic Wildlife Office',
    summary: 'Synthetic review for overlap with a wildlife planning area.',
    guidanceSourceIds: ['bc-demo-wildlife-guide'],
  },
  {
    id: 'corridor-notice',
    name: 'Illustrative corridor notice',
    kind: 'notification',
    authorityName: 'Synthetic Infrastructure Office',
    summary: 'Synthetic notice for electrification or connectivity corridors.',
    guidanceSourceIds: ['bc-demo-corridor-guide'],
  },
];

const bcRules: readonly PermitRule[] = [
  {
    id: 'bc-land-trigger',
    version: '1.0.0',
    permitTypeId: 'land-tenure-coordination',
    outcome: 'likely',
    priority: 100,
    explanation: 'Potential public-land use indicates land coordination.',
    sourceIds: ['bc-demo-land-guide'],
    condition: {
      type: 'answer',
      questionId: 'public-land-involved',
      operator: 'equals',
      value: true,
    },
  },
  {
    id: 'bc-water-trigger',
    version: '1.0.0',
    permitTypeId: 'water-area-review',
    outcome: 'likely',
    priority: 100,
    explanation: 'Work near water indicates an early water-area review.',
    sourceIds: ['bc-demo-water-guide'],
    condition: {
      type: 'answer',
      questionId: 'near-water-feature',
      operator: 'equals',
      value: true,
    },
  },
  {
    id: 'bc-riparian-spatial-trigger',
    version: '1.0.0',
    permitTypeId: 'riparian-setback-review',
    outcome: 'likely',
    priority: 120,
    explanation: 'Overlap with the synthetic riparian zone indicates review.',
    sourceIds: ['bc-demo-riparian-guide'],
    followUpQuestionIds: ['confirm-riparian-distance'],
    condition: {
      type: 'location_intersects_zone',
      zoneIds: ['synthetic-riparian-zone'],
    },
  },
  {
    id: 'bc-wildlife-spatial-trigger',
    version: '1.0.0',
    permitTypeId: 'wildlife-habitat-review',
    outcome: 'likely',
    priority: 120,
    explanation: 'Overlap with the synthetic wildlife zone indicates review.',
    sourceIds: ['bc-demo-wildlife-guide'],
    followUpQuestionIds: ['confirm-wildlife-survey'],
    requiresEscalation: true,
    condition: {
      type: 'location_intersects_zone',
      zoneIds: ['synthetic-wildlife-zone'],
    },
  },
  {
    id: 'bc-corridor-trigger',
    version: '1.0.0',
    permitTypeId: 'corridor-notice',
    outcome: 'likely',
    priority: 100,
    explanation:
      'Linear electrification or connectivity work indicates a corridor notice.',
    sourceIds: ['bc-demo-corridor-guide'],
    condition: {
      type: 'all',
      conditions: [
        {
          type: 'project_type',
          projectTypeIds: ['electrification', 'connectivity'],
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
];

export const bcSyntheticSpatialZones: readonly SpatialZone[] = [
  {
    id: 'synthetic-riparian-zone',
    sourceId: 'bc-demo-riparian-map',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-123.2, 49.1],
          [-122.9, 49.1],
          [-122.9, 49.4],
          [-123.2, 49.4],
          [-123.2, 49.1],
        ],
      ],
    },
  },
  {
    id: 'synthetic-wildlife-zone',
    sourceId: 'bc-demo-wildlife-map',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-121.1, 49.7],
          [-119.8, 49.7],
          [-119.8, 50.6],
          [-121.1, 50.6],
          [-121.1, 49.7],
        ],
      ],
    },
  },
];

export const bcInspiredSyntheticRuleFixture = {
  projectTypeIds: ['housing', 'electrification', 'connectivity'],
  permitTypes: bcPermits,
  release: {
    id: 'bc-inspired-rules',
    version: '1.0.0',
    state: 'approved',
    effectiveFrom: '2026-01-01',
    rules: bcRules,
  } satisfies PermitRuleRelease,
  zones: bcSyntheticSpatialZones,
  dependencies: [
    {
      permitTypeId: 'corridor-notice',
      dependsOnPermitTypeId: 'land-tenure-coordination',
      relationship: 'confirm_first',
      explanation: 'Confirm the land path before finalizing corridor notice.',
    },
    {
      permitTypeId: 'wildlife-habitat-review',
      dependsOnPermitTypeId: 'riparian-setback-review',
      relationship: 'parallel',
      explanation: 'Wildlife and riparian reviews can proceed in parallel.',
    },
  ],
} as const;
