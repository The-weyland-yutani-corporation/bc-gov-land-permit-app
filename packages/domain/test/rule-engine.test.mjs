import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bcInspiredSyntheticRuleFixture,
  evaluatePermitReadiness,
  genericSyntheticRuleFixture,
  geometryIntersectsPolygon,
  selectPermitRuleRelease,
  sequencePermits,
} from '../dist/index.js';

function evaluation(result, permitTypeId) {
  assert.equal(result.status, 'evaluated');
  const value = result.evaluations.find(
    (item) => item.permitTypeId === permitTypeId,
  );
  assert.ok(value, `Missing evaluation for ${permitTypeId}`);
  return value;
}

function basicPermit(id = 'test-permit') {
  return {
    id,
    name: `Test ${id}`,
    kind: 'review',
    authorityName: 'Synthetic Authority',
    summary: 'Synthetic permit used only by deterministic unit tests.',
    guidanceSourceIds: [`${id}-guide`],
  };
}

function basicInput(rules, answers = []) {
  return {
    projectTypeId: 'housing',
    answers,
    permitTypes: [basicPermit()],
    ruleReleases: [
      {
        id: 'test-rules',
        version: '1.0.0',
        state: 'approved',
        effectiveFrom: '2026-01-01',
        rules,
      },
    ],
    selectedRuleRelease: { id: 'test-rules', version: '1.0.0' },
    evaluationDate: '2026-10-03',
  };
}

test('generic fixture produces deterministic likely and not-indicated results', () => {
  const result = evaluatePermitReadiness(genericSyntheticRuleFixture.input);
  const site = evaluation(result, 'site-disturbance-review');
  const access = evaluation(result, 'access-coordination');

  assert.equal(site.disposition, 'likely');
  assert.equal(site.confidence.level, 'complete');
  assert.deepEqual(site.matchedRuleIds, ['generic-ground-disturbance']);
  assert.deepEqual(site.sourceIds, ['generic-site-guidance']);
  assert.equal(access.disposition, 'not_indicated');
  assert.equal(access.confidence.completenessRatio, 1);
});

test('unknown answers yield targeted needs-information results', () => {
  const input = structuredClone(genericSyntheticRuleFixture.input);
  input.answers = [
    { questionId: 'disturbs-ground', state: 'unknown' },
    { questionId: 'changes-access', state: 'answered', value: false },
  ];

  const site = evaluation(
    evaluatePermitReadiness(input),
    'site-disturbance-review',
  );
  assert.equal(site.disposition, 'needs_information');
  assert.equal(site.confidence.level, 'insufficient');
  assert.deepEqual(site.missingFields, ['disturbs-ground']);
  assert.deepEqual(site.followUpQuestionIds, ['disturbs-ground']);
  assert.ok(site.escalationFlags.includes('missing_required_information'));
});

test('polygon overlap and point signals trigger synthetic riparian rules', () => {
  const fixture = bcInspiredSyntheticRuleFixture;
  const result = evaluatePermitReadiness({
    projectTypeId: 'housing',
    answers: [
      {
        questionId: 'public-land-involved',
        state: 'answered',
        value: false,
      },
      {
        questionId: 'near-water-feature',
        state: 'answered',
        value: false,
      },
      { questionId: 'linear-corridor', state: 'answered', value: false },
    ],
    spatial: {
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-123.05, 49.2],
            [-122.8, 49.2],
            [-122.8, 49.5],
            [-123.05, 49.5],
            [-123.05, 49.2],
          ],
        ],
      },
      zones: fixture.zones,
    },
    permitTypes: fixture.permitTypes,
    ruleReleases: [fixture.release],
    selectedRuleRelease: {
      id: fixture.release.id,
      version: fixture.release.version,
    },
    dependencies: fixture.dependencies,
    evaluationDate: '2026-10-03',
  });
  const riparian = evaluation(result, 'riparian-setback-review');
  assert.equal(riparian.disposition, 'likely');
  assert.ok(riparian.sourceIds.includes('bc-demo-riparian-map'));
  assert.equal(
    geometryIntersectsPolygon(
      { type: 'Point', coordinates: [-123, 49.25] },
      fixture.zones[0].geometry,
    ),
    true,
  );
});

test('absent spatial evidence is not interpreted as no intersection', () => {
  const fixture = bcInspiredSyntheticRuleFixture;
  const result = evaluatePermitReadiness({
    projectTypeId: 'housing',
    answers: [],
    permitTypes: [fixture.permitTypes[2]],
    ruleReleases: [{ ...fixture.release, rules: [fixture.release.rules[2]] }],
    selectedRuleRelease: {
      id: fixture.release.id,
      version: fixture.release.version,
    },
    evaluationDate: '2026-10-03',
  });
  const riparian = evaluation(result, 'riparian-setback-review');
  assert.equal(riparian.disposition, 'needs_information');
  assert.deepEqual(riparian.missingFields, ['location']);
  assert.deepEqual(riparian.followUpQuestionIds, ['confirm-riparian-distance']);
});

test('equal-priority conflict escalates and higher priority resolves', () => {
  const positive = {
    id: 'positive',
    version: '1.0.0',
    permitTypeId: 'test-permit',
    outcome: 'likely',
    priority: 100,
    explanation: 'A positive synthetic rule matched the supplied answer.',
    condition: {
      type: 'answer',
      questionId: 'trigger',
      operator: 'equals',
      value: true,
    },
  };
  const negative = {
    ...positive,
    id: 'negative',
    outcome: 'not_indicated',
    explanation: 'A negative synthetic rule matched the supplied answer.',
  };
  const answers = [{ questionId: 'trigger', state: 'answered', value: true }];
  const conflicted = evaluation(
    evaluatePermitReadiness(basicInput([positive, negative], answers)),
    'test-permit',
  );
  assert.equal(conflicted.disposition, 'needs_information');
  assert.ok(conflicted.escalationFlags.includes('conflicting_rules'));

  const resolved = evaluation(
    evaluatePermitReadiness(
      basicInput([{ ...positive, priority: 200 }, negative], answers),
    ),
    'test-permit',
  );
  assert.equal(resolved.disposition, 'likely');
});

test('contradictory answer and spatial evidence are explicit', () => {
  const answerRule = {
    id: 'answer-rule',
    version: '1.0.0',
    permitTypeId: 'test-permit',
    outcome: 'likely',
    explanation: 'A synthetic answer rule checks contradictory evidence.',
    condition: {
      type: 'answer',
      questionId: 'trigger',
      operator: 'equals',
      value: true,
    },
  };
  const answerResult = evaluation(
    evaluatePermitReadiness(
      basicInput(
        [answerRule],
        [
          {
            questionId: 'trigger',
            state: 'answered',
            value: true,
            sourceId: 'source-a',
          },
          {
            questionId: 'trigger',
            state: 'answered',
            value: false,
            sourceId: 'source-b',
          },
        ],
      ),
    ),
    'test-permit',
  );
  assert.equal(answerResult.disposition, 'needs_information');
  assert.ok(answerResult.escalationFlags.includes('contradictory_evidence'));

  const spatialRule = {
    ...answerRule,
    id: 'spatial-rule',
    condition: { type: 'location_intersects_zone', zoneIds: ['zone-a'] },
  };
  const spatialInput = basicInput([spatialRule]);
  spatialInput.spatial = {
    signals: [
      {
        zoneId: 'zone-a',
        relation: 'intersects',
        sourceId: 'map-a',
        geometryType: 'Polygon',
      },
      {
        zoneId: 'zone-a',
        relation: 'does_not_intersect',
        sourceId: 'map-b',
        geometryType: 'Polygon',
      },
    ],
  };
  const spatialResult = evaluation(
    evaluatePermitReadiness(spatialInput),
    'test-permit',
  );
  assert.ok(spatialResult.escalationFlags.includes('contradictory_evidence'));
});

test('boolean composition and explicit comparison operators use three-valued logic', () => {
  const rule = {
    id: 'composed',
    version: '1.0.0',
    permitTypeId: 'test-permit',
    outcome: 'likely',
    explanation: 'A composed synthetic rule exercises supported operators.',
    condition: {
      type: 'all',
      conditions: [
        {
          type: 'answer',
          questionId: 'length',
          operator: 'greater_than_or_equal',
          value: 10,
        },
        {
          type: 'any',
          conditions: [
            {
              type: 'answer',
              questionId: 'features',
              operator: 'includes',
              value: 'bridge',
            },
            {
              type: 'not',
              condition: {
                type: 'project_type',
                projectTypeIds: ['housing'],
              },
            },
          ],
        },
      ],
    },
  };
  const result = evaluation(
    evaluatePermitReadiness(
      basicInput(
        [rule],
        [
          { questionId: 'length', state: 'answered', value: 12 },
          {
            questionId: 'features',
            state: 'answered',
            value: ['bridge', 'road'],
          },
        ],
      ),
    ),
    'test-permit',
  );
  assert.equal(result.disposition, 'likely');
  assert.equal(result.confidence.level, 'complete');
});

test('release selection chooses the latest effective version and rejects stale pins', () => {
  const releases = [
    {
      id: 'rules',
      version: '1.0.0',
      state: 'approved',
      effectiveFrom: '2025-01-01',
      effectiveTo: '2025-12-31',
      rules: [],
    },
    {
      id: 'rules',
      version: '2.0.0',
      state: 'approved',
      effectiveFrom: '2026-01-01',
      rules: [],
    },
  ];
  const latest = selectPermitRuleRelease(
    releases,
    { id: 'rules' },
    '2026-10-03',
  );
  assert.equal(latest.issues.length, 0);
  assert.equal(latest.release.version, '2.0.0');

  const stale = selectPermitRuleRelease(
    releases,
    { id: 'rules', version: '1.0.0' },
    '2026-10-03',
  );
  assert.deepEqual(
    stale.issues.map((issue) => issue.code),
    ['stale_rule_release'],
  );
});

test('invalid rule versions fail closed with configuration issues', () => {
  const rule = {
    id: 'wrong-version',
    version: '2.0.0',
    permitTypeId: 'test-permit',
    outcome: 'likely',
    explanation:
      'A mismatched rule version must fail configuration validation.',
    condition: {
      type: 'answer',
      questionId: 'trigger',
      operator: 'equals',
      value: true,
    },
  };
  const result = evaluatePermitReadiness(basicInput([rule]));
  assert.equal(result.status, 'invalid_configuration');
  assert.deepEqual(
    result.configurationIssues.map((issue) => issue.code),
    ['invalid_rule_version'],
  );
});

test('per-rule effective dates exclude future rules without treating silence as evidence', () => {
  const result = evaluation(
    evaluatePermitReadiness(
      basicInput([
        {
          id: 'future-rule',
          version: '1.0.0',
          permitTypeId: 'test-permit',
          outcome: 'likely',
          effectiveFrom: '2027-01-01',
          explanation: 'A future synthetic rule is not active yet.',
          condition: {
            type: 'answer',
            questionId: 'trigger',
            operator: 'equals',
            value: true,
          },
        },
      ]),
    ),
    'test-permit',
  );
  assert.equal(result.disposition, 'not_indicated');
  assert.equal(result.confidence.level, 'insufficient');
  assert.deepEqual(result.consideredRuleIds, []);
});

test('sequencing finds cycles, external blockers, parallel work, and stable groups', () => {
  const dependencies = [
    {
      permitTypeId: 'c',
      dependsOnPermitTypeId: 'a',
      relationship: 'before',
      explanation: 'A blocks C in this synthetic sequence.',
    },
    {
      permitTypeId: 'c',
      dependsOnPermitTypeId: 'b',
      relationship: 'before',
      explanation: 'B blocks C in this synthetic sequence.',
    },
    {
      permitTypeId: 'b',
      dependsOnPermitTypeId: 'a',
      relationship: 'parallel',
      explanation: 'A and B can proceed in parallel.',
    },
  ];
  const plan = sequencePermits(['c', 'b', 'a'], dependencies);
  assert.equal(plan.status, 'ready');
  assert.deepEqual(plan.groups, [
    { order: 1, permitTypeIds: ['a', 'b'] },
    { order: 2, permitTypeIds: ['c'] },
  ]);
  assert.deepEqual(plan.entries[0].parallelPermitTypeIds, ['b']);

  const blocked = sequencePermits(['c'], dependencies);
  assert.equal(blocked.status, 'blocked');
  assert.deepEqual(blocked.entries[0].externalBlockingPrerequisiteIds, [
    'a',
    'b',
  ]);

  const cycle = sequencePermits(
    ['a', 'b'],
    [
      {
        permitTypeId: 'a',
        dependsOnPermitTypeId: 'b',
        relationship: 'before',
        explanation: 'B blocks A.',
      },
      {
        permitTypeId: 'b',
        dependsOnPermitTypeId: 'a',
        relationship: 'confirm_first',
        explanation: 'A blocks B.',
      },
    ],
  );
  assert.equal(cycle.status, 'blocked');
  assert.deepEqual(cycle.cycles, [{ permitTypeIds: ['a', 'b'] }]);
});

test('evaluation is stable under input permutations and does not mutate input', () => {
  const original = structuredClone(genericSyntheticRuleFixture.input);
  original.assumptions = ['Synthetic boundary used.', 'Applicant estimate.'];
  const before = JSON.stringify(original);
  const baseline = evaluatePermitReadiness(original);

  for (let index = 0; index < 20; index += 1) {
    const permuted = structuredClone(original);
    if (index % 2 === 0) {
      permuted.answers.reverse();
      permuted.permitTypes.reverse();
      permuted.ruleReleases[0].rules.reverse();
      permuted.assumptions.reverse();
    }
    assert.deepEqual(evaluatePermitReadiness(permuted), baseline);
  }
  assert.equal(JSON.stringify(original), before);
});
