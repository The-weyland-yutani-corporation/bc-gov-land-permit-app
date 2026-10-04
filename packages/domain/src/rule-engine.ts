import { isIsoDate, type IntakeAnswerValue } from './intake.js';
import type {
  MissingInformation,
  PermitCondition,
  PermitDependency,
  PermitRule,
  PermitTypeDefinition,
  RuleComparisonOperator,
} from './permits.js';
import { sequencePermits, type PermitSequencePlan } from './sequencing.js';
import { calculateSpatialMatches, type SpatialZone } from './spatial.js';
import type {
  Identifier,
  JurisdictionReleaseReference,
  ProjectGeometry,
} from './types.js';

export type RuleReleaseState = 'draft' | 'approved' | 'retired';

export interface PermitRuleRelease {
  readonly id: Identifier;
  readonly version: string;
  readonly state: RuleReleaseState;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
  readonly rules: readonly PermitRule[];
}

export interface RuleAnswerEvidence {
  readonly questionId: Identifier;
  readonly state: 'answered' | 'unknown' | 'deferred';
  readonly value?: IntakeAnswerValue;
  readonly sourceId?: Identifier;
}

export interface SpatialIntersectionSignal {
  readonly zoneId: Identifier;
  readonly relation: 'intersects' | 'does_not_intersect' | 'unknown';
  readonly sourceId: Identifier;
  readonly geometryType: ProjectGeometry['type'];
}

export interface RuleEngineSpatialInput {
  readonly geometry?: ProjectGeometry;
  readonly zones?: readonly SpatialZone[];
  readonly signals?: readonly SpatialIntersectionSignal[];
}

export interface RuleEngineInput {
  readonly projectTypeId?: Identifier;
  readonly answers: readonly RuleAnswerEvidence[];
  readonly spatial?: RuleEngineSpatialInput;
  readonly permitTypes: readonly PermitTypeDefinition[];
  readonly ruleReleases: readonly PermitRuleRelease[];
  readonly selectedRuleRelease: {
    readonly id: Identifier;
    readonly version?: string;
  };
  readonly dependencies?: readonly PermitDependency[];
  readonly evaluationDate: string;
  readonly assumptions?: readonly string[];
  readonly jurisdictionRelease?: JurisdictionReleaseReference;
}

export type RuleConfigurationIssueCode =
  | 'duplicate_rule_id'
  | 'invalid_date'
  | 'invalid_rule_version'
  | 'release_not_approved'
  | 'release_not_effective'
  | 'stale_rule_release'
  | 'unknown_permit'
  | 'rule_release_not_found';

export interface RuleConfigurationIssue {
  readonly code: RuleConfigurationIssueCode;
  readonly message: string;
  readonly ruleId?: Identifier;
}

export type EscalationFlag =
  | 'configuration_invalid'
  | 'conflicting_rules'
  | 'contradictory_evidence'
  | 'dependency_cycle'
  | 'missing_required_information'
  | 'stale_rule_release'
  | 'authority_confirmation_recommended';

export interface DeterministicEvidence {
  readonly id: string;
  readonly ruleId: Identifier;
  readonly conditionPath: string;
  readonly kind:
    | 'project_type'
    | 'intake_answer'
    | 'location'
    | 'spatial_intersection';
  readonly status: 'supports' | 'opposes' | 'unknown' | 'contradictory';
  readonly fieldId: Identifier;
  readonly expected: unknown;
  readonly actual: unknown;
  readonly sourceIds: readonly Identifier[];
  readonly reason: string;
}

export interface EvidenceCompleteness {
  readonly level: 'complete' | 'partial' | 'insufficient';
  readonly knownEvidenceCount: number;
  readonly totalEvidenceCount: number;
  readonly completenessRatio: number;
}

export interface PermitReasoningEvaluation {
  readonly permitTypeId: Identifier;
  readonly disposition: 'likely' | 'not_indicated' | 'needs_information';
  readonly confidence: EvidenceCompleteness;
  readonly matchedRuleIds: readonly Identifier[];
  readonly consideredRuleIds: readonly Identifier[];
  readonly reasons: readonly string[];
  readonly assumptions: readonly string[];
  readonly requiredFields: readonly string[];
  readonly missingFields: readonly string[];
  readonly missingInformation: readonly MissingInformation[];
  readonly followUpQuestionIds: readonly Identifier[];
  readonly sourceIds: readonly Identifier[];
  readonly evidence: readonly DeterministicEvidence[];
  readonly escalationFlags: readonly EscalationFlag[];
}

export type RuleEngineResult =
  | {
      readonly status: 'invalid_configuration';
      readonly ruleRelease?: {
        readonly id: Identifier;
        readonly version: string;
      };
      readonly configurationIssues: readonly RuleConfigurationIssue[];
      readonly evaluations: readonly [];
      readonly sequence: PermitSequencePlan;
      readonly escalationFlags: readonly EscalationFlag[];
    }
  | {
      readonly status: 'evaluated';
      readonly ruleRelease: {
        readonly id: Identifier;
        readonly version: string;
      };
      readonly configurationIssues: readonly [];
      readonly evaluations: readonly PermitReasoningEvaluation[];
      readonly sequence: PermitSequencePlan;
      readonly escalationFlags: readonly EscalationFlag[];
    };

type TruthValue = true | false | 'unknown';

interface ConditionEvaluation {
  readonly value: TruthValue;
  readonly evidence: readonly DeterministicEvidence[];
  readonly missingInformation: readonly MissingInformation[];
  readonly followUpQuestionIds: readonly Identifier[];
  readonly contradictory: boolean;
}

interface AnswerFact {
  readonly state: 'answered' | 'unknown' | 'deferred' | 'contradictory';
  readonly value?: IntakeAnswerValue;
  readonly sourceIds: readonly Identifier[];
}

interface SpatialFact {
  readonly state:
    | 'intersects'
    | 'does_not_intersect'
    | 'unknown'
    | 'contradictory';
  readonly sourceIds: readonly Identifier[];
}

function compareVersions(left: string, right: string): number {
  const parse = (value: string) =>
    value
      .split(/[.-]/)
      .map((part) => (/^\d+$/.test(part) ? Number(part) : part));
  const leftParts = parse(left);
  const rightParts = parse(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart === rightPart) continue;
    if (typeof leftPart === 'number' && typeof rightPart === 'number') {
      return leftPart - rightPart;
    }
    return String(leftPart).localeCompare(String(rightPart));
  }
  return 0;
}

function releaseDateIssue(
  release: PermitRuleRelease,
  evaluationDate: string,
): RuleConfigurationIssue | undefined {
  if (
    !isIsoDate(release.effectiveFrom) ||
    (release.effectiveTo !== undefined && !isIsoDate(release.effectiveTo))
  ) {
    return {
      code: 'invalid_date',
      message: `Rule release ${release.id}@${release.version} has an invalid effective date.`,
    };
  }
  if (evaluationDate < release.effectiveFrom) {
    return {
      code: 'release_not_effective',
      message: `Rule release ${release.id}@${release.version} is not effective on ${evaluationDate}.`,
    };
  }
  if (
    release.effectiveTo !== undefined &&
    evaluationDate > release.effectiveTo
  ) {
    return {
      code: 'stale_rule_release',
      message: `Rule release ${release.id}@${release.version} expired on ${release.effectiveTo}.`,
    };
  }
  return undefined;
}

export function selectPermitRuleRelease(
  releases: readonly PermitRuleRelease[],
  selection: RuleEngineInput['selectedRuleRelease'],
  evaluationDate: string,
):
  | { readonly release: PermitRuleRelease; readonly issues: readonly [] }
  | {
      readonly release?: PermitRuleRelease;
      readonly issues: readonly RuleConfigurationIssue[];
    } {
  if (!isIsoDate(evaluationDate)) {
    return {
      issues: [
        {
          code: 'invalid_date',
          message: `Evaluation date ${evaluationDate} is not a valid ISO date.`,
        },
      ],
    };
  }
  const candidates = releases
    .filter((release) => release.id === selection.id)
    .filter(
      (release) =>
        selection.version === undefined ||
        release.version === selection.version,
    )
    .sort((left, right) => compareVersions(right.version, left.version));

  if (selection.version !== undefined) {
    const release = candidates[0];
    if (!release) {
      return {
        issues: [
          {
            code: 'rule_release_not_found',
            message: `Rule release ${selection.id}@${selection.version} was not found.`,
          },
        ],
      };
    }
    const issues: RuleConfigurationIssue[] = [];
    if (release.state !== 'approved') {
      issues.push({
        code: 'release_not_approved',
        message: `Rule release ${release.id}@${release.version} is ${release.state}.`,
      });
    }
    const dateIssue = releaseDateIssue(release, evaluationDate);
    if (dateIssue) issues.push(dateIssue);
    return issues.length > 0 ? { release, issues } : { release, issues: [] };
  }

  const release = candidates.find(
    (candidate) =>
      candidate.state === 'approved' &&
      releaseDateIssue(candidate, evaluationDate) === undefined,
  );
  return release
    ? { release, issues: [] }
    : {
        issues: [
          {
            code: 'rule_release_not_found',
            message: `No approved effective rule release ${selection.id} exists on ${evaluationDate}.`,
          },
        ],
      };
}

function validateRelease(
  release: PermitRuleRelease,
  permitTypes: readonly PermitTypeDefinition[],
): RuleConfigurationIssue[] {
  const issues: RuleConfigurationIssue[] = [];
  const permitIds = new Set(permitTypes.map((permit) => permit.id));
  const ruleIds = new Set<Identifier>();
  for (const rule of release.rules) {
    if (ruleIds.has(rule.id)) {
      issues.push({
        code: 'duplicate_rule_id',
        ruleId: rule.id,
        message: `Rule identifier ${rule.id} is duplicated.`,
      });
    }
    ruleIds.add(rule.id);
    if (rule.version !== release.version) {
      issues.push({
        code: 'invalid_rule_version',
        ruleId: rule.id,
        message: `Rule ${rule.id} has version ${rule.version}; expected ${release.version}.`,
      });
    }
    if (!permitIds.has(rule.permitTypeId)) {
      issues.push({
        code: 'unknown_permit',
        ruleId: rule.id,
        message: `Rule ${rule.id} references unknown permit ${rule.permitTypeId}.`,
      });
    }
    if (
      (rule.effectiveFrom !== undefined && !isIsoDate(rule.effectiveFrom)) ||
      (rule.effectiveTo !== undefined && !isIsoDate(rule.effectiveTo))
    ) {
      issues.push({
        code: 'invalid_date',
        ruleId: rule.id,
        message: `Rule ${rule.id} has an invalid effective date.`,
      });
    }
  }
  return issues.sort((left, right) =>
    `${left.code}\0${left.ruleId ?? ''}`.localeCompare(
      `${right.code}\0${right.ruleId ?? ''}`,
    ),
  );
}

function stableValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${[...value].map(stableValue).sort().join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${key}:${stableValue(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function buildAnswerFacts(
  answers: readonly RuleAnswerEvidence[],
): ReadonlyMap<Identifier, AnswerFact> {
  const grouped = new Map<Identifier, RuleAnswerEvidence[]>();
  for (const answer of answers) {
    const values = grouped.get(answer.questionId) ?? [];
    values.push(answer);
    grouped.set(answer.questionId, values);
  }
  return new Map<Identifier, AnswerFact>(
    [...grouped.entries()].map(([questionId, answerEvidence]) => {
      const sourceIds = [
        ...new Set(
          answerEvidence
            .map((item) => item.sourceId)
            .filter((value): value is string => value !== undefined),
        ),
      ].sort();
      const signatures = new Set(
        answerEvidence.map((item) =>
          stableValue({
            state: item.state,
            value: item.state === 'answered' ? item.value : undefined,
          }),
        ),
      );
      if (signatures.size > 1) {
        return [
          questionId,
          { state: 'contradictory', sourceIds } satisfies AnswerFact,
        ] as const;
      }
      const first = answerEvidence[0];
      if (!first || first.state !== 'answered') {
        return [
          questionId,
          { state: first?.state ?? 'unknown', sourceIds } satisfies AnswerFact,
        ] as const;
      }
      return [
        questionId,
        {
          state: 'answered',
          value: first.value,
          sourceIds,
        } satisfies AnswerFact,
      ] as const;
    }),
  );
}

function buildSpatialFacts(
  spatial: RuleEngineSpatialInput | undefined,
): ReadonlyMap<Identifier, SpatialFact> {
  const grouped = new Map<
    Identifier,
    {
      relation: SpatialIntersectionSignal['relation'];
      sourceId: Identifier;
    }[]
  >();
  if (spatial?.geometry && spatial.zones) {
    const matches = calculateSpatialMatches(spatial.geometry, spatial.zones);
    for (const zone of spatial.zones) {
      const values = grouped.get(zone.id) ?? [];
      values.push({
        relation: matches[zone.id] ? 'intersects' : 'does_not_intersect',
        sourceId: zone.sourceId ?? `geometry:${zone.id}`,
      });
      grouped.set(zone.id, values);
    }
  }
  for (const signal of spatial?.signals ?? []) {
    const values = grouped.get(signal.zoneId) ?? [];
    values.push({ relation: signal.relation, sourceId: signal.sourceId });
    grouped.set(signal.zoneId, values);
  }
  return new Map(
    [...grouped.entries()].map(([zoneId, signalEvidence]) => {
      const relations = new Set(
        signalEvidence
          .map((item) => item.relation)
          .filter((relation) => relation !== 'unknown'),
      );
      const state: SpatialFact['state'] =
        relations.size > 1
          ? 'contradictory'
          : (relations.values().next().value ?? 'unknown');
      return [
        zoneId,
        {
          state,
          sourceIds: [
            ...new Set(signalEvidence.map((item) => item.sourceId)),
          ].sort(),
        },
      ] as const;
    }),
  );
}

function compareAnswer(
  actual: IntakeAnswerValue,
  operator: RuleComparisonOperator,
  expected: string | number | boolean,
): boolean | 'unknown' {
  switch (operator) {
    case 'equals':
      return actual === expected;
    case 'not_equals':
      return actual !== expected;
    case 'includes':
      return Array.isArray(actual)
        ? actual.includes(String(expected))
        : typeof actual === 'string' && typeof expected === 'string'
          ? actual.includes(expected)
          : false;
    case 'greater_than':
    case 'greater_than_or_equal':
    case 'less_than':
    case 'less_than_or_equal':
      if (typeof actual !== 'number' || typeof expected !== 'number') {
        return 'unknown';
      }
      if (operator === 'greater_than') return actual > expected;
      if (operator === 'greater_than_or_equal') return actual >= expected;
      if (operator === 'less_than') return actual < expected;
      return actual <= expected;
  }
}

function missingAnswer(
  rule: PermitRule,
  questionId: Identifier,
  reason: string,
): MissingInformation {
  return {
    id: `missing-answer-${questionId}`,
    questionId,
    label: `Answer ${questionId}`,
    reason,
    severity: 'required',
  };
}

function missingField(
  field: 'project_type' | 'location',
  reason: string,
): MissingInformation {
  return {
    id: `missing-${field.replace('_', '-')}`,
    field,
    label: field === 'project_type' ? 'Project type' : 'Project location',
    reason,
    severity: 'required',
  };
}

function evidence(
  rule: PermitRule,
  path: string,
  value: Omit<DeterministicEvidence, 'id' | 'ruleId' | 'conditionPath'>,
): DeterministicEvidence {
  return {
    id: `${rule.id}:${path}`,
    ruleId: rule.id,
    conditionPath: path,
    ...value,
  };
}

function evaluateCondition(
  condition: PermitCondition,
  rule: PermitRule,
  path: string,
  facts: {
    readonly projectTypeId?: Identifier;
    readonly answers: ReadonlyMap<Identifier, AnswerFact>;
    readonly spatial: ReadonlyMap<Identifier, SpatialFact>;
    readonly locationProvided: boolean;
  },
): ConditionEvaluation {
  switch (condition.type) {
    case 'project_type': {
      const actual = facts.projectTypeId;
      if (actual === undefined) {
        return {
          value: 'unknown',
          evidence: [
            evidence(rule, path, {
              kind: 'project_type',
              status: 'unknown',
              fieldId: 'project_type',
              expected: condition.projectTypeIds,
              actual: undefined,
              sourceIds: [],
              reason: 'Project type was not provided.',
            }),
          ],
          missingInformation: [
            missingField(
              'project_type',
              'A project type is required by this rule.',
            ),
          ],
          followUpQuestionIds: [...(rule.followUpQuestionIds ?? [])],
          contradictory: false,
        };
      }
      const matches = condition.projectTypeIds.includes(actual);
      return {
        value: matches,
        evidence: [
          evidence(rule, path, {
            kind: 'project_type',
            status: matches ? 'supports' : 'opposes',
            fieldId: 'project_type',
            expected: condition.projectTypeIds,
            actual,
            sourceIds: [],
            reason: matches
              ? `Project type ${actual} is in the configured set.`
              : `Project type ${actual} is outside the configured set.`,
          }),
        ],
        missingInformation: [],
        followUpQuestionIds: [],
        contradictory: false,
      };
    }
    case 'answer': {
      const fact = facts.answers.get(condition.questionId);
      if (!fact || fact.state === 'unknown' || fact.state === 'deferred') {
        const state = fact?.state ?? 'missing';
        return {
          value: 'unknown',
          evidence: [
            evidence(rule, path, {
              kind: 'intake_answer',
              status: 'unknown',
              fieldId: condition.questionId,
              expected: {
                operator: condition.operator,
                value: condition.value,
              },
              actual: state,
              sourceIds: fact?.sourceIds ?? [],
              reason: `Answer ${condition.questionId} is ${state}.`,
            }),
          ],
          missingInformation: [
            missingAnswer(
              rule,
              condition.questionId,
              `Rule ${rule.id} requires a known answer to ${condition.questionId}.`,
            ),
          ],
          followUpQuestionIds: [
            condition.questionId,
            ...(rule.followUpQuestionIds ?? []),
          ],
          contradictory: false,
        };
      }
      if (fact.state === 'contradictory') {
        return {
          value: 'unknown',
          evidence: [
            evidence(rule, path, {
              kind: 'intake_answer',
              status: 'contradictory',
              fieldId: condition.questionId,
              expected: {
                operator: condition.operator,
                value: condition.value,
              },
              actual: 'contradictory',
              sourceIds: fact.sourceIds,
              reason: `Answer evidence for ${condition.questionId} is contradictory.`,
            }),
          ],
          missingInformation: [
            missingAnswer(
              rule,
              condition.questionId,
              `Contradictory answers to ${condition.questionId} must be resolved.`,
            ),
          ],
          followUpQuestionIds: [
            condition.questionId,
            ...(rule.followUpQuestionIds ?? []),
          ],
          contradictory: true,
        };
      }
      const matches = compareAnswer(
        fact.value as IntakeAnswerValue,
        condition.operator,
        condition.value,
      );
      if (matches === 'unknown') {
        return {
          value: 'unknown',
          evidence: [
            evidence(rule, path, {
              kind: 'intake_answer',
              status: 'unknown',
              fieldId: condition.questionId,
              expected: {
                operator: condition.operator,
                value: condition.value,
              },
              actual: fact.value,
              sourceIds: fact.sourceIds,
              reason: `Answer ${condition.questionId} has an incompatible value type for ${condition.operator}.`,
            }),
          ],
          missingInformation: [
            missingAnswer(
              rule,
              condition.questionId,
              `A compatible value is required for ${condition.operator}.`,
            ),
          ],
          followUpQuestionIds: [
            condition.questionId,
            ...(rule.followUpQuestionIds ?? []),
          ],
          contradictory: false,
        };
      }
      return {
        value: matches,
        evidence: [
          evidence(rule, path, {
            kind: 'intake_answer',
            status: matches ? 'supports' : 'opposes',
            fieldId: condition.questionId,
            expected: {
              operator: condition.operator,
              value: condition.value,
            },
            actual: fact.value,
            sourceIds: fact.sourceIds,
            reason: matches
              ? `Answer ${condition.questionId} satisfies ${condition.operator}.`
              : `Answer ${condition.questionId} does not satisfy ${condition.operator}.`,
          }),
        ],
        missingInformation: [],
        followUpQuestionIds: [],
        contradictory: false,
      };
    }
    case 'location_provided': {
      if (!facts.locationProvided && condition.expected) {
        return {
          value: 'unknown',
          evidence: [
            evidence(rule, path, {
              kind: 'location',
              status: 'unknown',
              fieldId: 'location',
              expected: true,
              actual: false,
              sourceIds: [],
              reason: 'A project location was not provided.',
            }),
          ],
          missingInformation: [
            missingField(
              'location',
              `Rule ${rule.id} requires a project location.`,
            ),
          ],
          followUpQuestionIds: [...(rule.followUpQuestionIds ?? [])],
          contradictory: false,
        };
      }
      const matches = facts.locationProvided === condition.expected;
      return {
        value: matches,
        evidence: [
          evidence(rule, path, {
            kind: 'location',
            status: matches ? 'supports' : 'opposes',
            fieldId: 'location',
            expected: condition.expected,
            actual: facts.locationProvided,
            sourceIds: [],
            reason: matches
              ? 'Location presence matches the rule.'
              : 'Location presence does not match the rule.',
          }),
        ],
        missingInformation: [],
        followUpQuestionIds: [],
        contradictory: false,
      };
    }
    case 'location_intersects_zone': {
      const zoneFacts = condition.zoneIds.map((zoneId) => ({
        zoneId,
        fact: facts.spatial.get(zoneId),
      }));
      const contradictory = zoneFacts.some(
        ({ fact }) => fact?.state === 'contradictory',
      );
      const intersects = zoneFacts.some(
        ({ fact }) => fact?.state === 'intersects',
      );
      const allKnown = zoneFacts.every(
        ({ fact }) =>
          fact?.state === 'intersects' || fact?.state === 'does_not_intersect',
      );
      const value: TruthValue = contradictory
        ? 'unknown'
        : intersects
          ? true
          : allKnown
            ? false
            : 'unknown';
      return {
        value,
        evidence: zoneFacts.map(({ zoneId, fact }, index) =>
          evidence(rule, `${path}.zone[${index}]`, {
            kind: 'spatial_intersection',
            status:
              fact?.state === 'intersects'
                ? 'supports'
                : fact?.state === 'does_not_intersect'
                  ? 'opposes'
                  : fact?.state === 'contradictory'
                    ? 'contradictory'
                    : 'unknown',
            fieldId: zoneId,
            expected: 'intersects',
            actual: fact?.state ?? 'absent',
            sourceIds: fact?.sourceIds ?? [],
            reason:
              fact?.state === 'intersects'
                ? `Project geometry intersects zone ${zoneId}.`
                : fact?.state === 'does_not_intersect'
                  ? `Project geometry does not intersect zone ${zoneId}.`
                  : fact?.state === 'contradictory'
                    ? `Spatial evidence for zone ${zoneId} is contradictory.`
                    : `No spatial evidence is available for zone ${zoneId}.`,
          }),
        ),
        missingInformation:
          value === 'unknown'
            ? [
                missingField(
                  'location',
                  contradictory
                    ? `Contradictory spatial evidence for rule ${rule.id} must be resolved.`
                    : `Spatial intersection evidence is absent for rule ${rule.id}.`,
                ),
              ]
            : [],
        followUpQuestionIds:
          value === 'unknown' ? [...(rule.followUpQuestionIds ?? [])] : [],
        contradictory,
      };
    }
    case 'all':
    case 'any': {
      const children = condition.conditions.map((child, index) =>
        evaluateCondition(
          child,
          rule,
          `${path}.${condition.type}[${index}]`,
          facts,
        ),
      );
      const values = children.map((child) => child.value);
      const value: TruthValue =
        condition.type === 'all'
          ? values.includes(false)
            ? false
            : values.includes('unknown')
              ? 'unknown'
              : true
          : values.includes(true)
            ? true
            : values.includes('unknown')
              ? 'unknown'
              : false;
      return {
        value,
        evidence: children.flatMap((child) => child.evidence),
        missingInformation: children.flatMap(
          (child) => child.missingInformation,
        ),
        followUpQuestionIds: children.flatMap(
          (child) => child.followUpQuestionIds,
        ),
        contradictory: children.some((child) => child.contradictory),
      };
    }
    case 'not': {
      const child = evaluateCondition(
        condition.condition,
        rule,
        `${path}.not`,
        facts,
      );
      return {
        ...child,
        value:
          child.value === 'unknown' ? 'unknown' : child.value ? false : true,
      };
    }
  }
}

function activeOn(rule: PermitRule, evaluationDate: string): boolean {
  return (
    (rule.effectiveFrom === undefined ||
      evaluationDate >= rule.effectiveFrom) &&
    (rule.effectiveTo === undefined || evaluationDate <= rule.effectiveTo)
  );
}

function deduplicateMissing(
  values: readonly MissingInformation[],
): MissingInformation[] {
  return [
    ...new Map(
      [...values]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((value) => [value.id, value]),
    ).values(),
  ];
}

function confidenceFor(
  evidenceItems: readonly DeterministicEvidence[],
): EvidenceCompleteness {
  const totalEvidenceCount = evidenceItems.length;
  const knownEvidenceCount = evidenceItems.filter(
    (item) => item.status === 'supports' || item.status === 'opposes',
  ).length;
  const completenessRatio =
    totalEvidenceCount === 0 ? 0 : knownEvidenceCount / totalEvidenceCount;
  return {
    level:
      completenessRatio === 1
        ? 'complete'
        : completenessRatio === 0
          ? 'insufficient'
          : 'partial',
    knownEvidenceCount,
    totalEvidenceCount,
    completenessRatio,
  };
}

function evaluatePermit(
  permit: PermitTypeDefinition,
  rules: readonly PermitRule[],
  facts: Parameters<typeof evaluateCondition>[3],
  assumptions: readonly string[],
): PermitReasoningEvaluation {
  const evaluations = rules
    .map((rule) => ({
      rule,
      evaluation: evaluateCondition(rule.condition, rule, 'condition', facts),
    }))
    .sort(
      (left, right) =>
        (right.rule.priority ?? 0) - (left.rule.priority ?? 0) ||
        left.rule.id.localeCompare(right.rule.id),
    );
  const matched = evaluations.filter((item) => item.evaluation.value === true);
  const indeterminate = evaluations.filter(
    (item) => item.evaluation.value === 'unknown',
  );
  const topMatchedPriority =
    matched.length > 0 ? (matched[0]?.rule.priority ?? 0) : undefined;
  const topIndeterminatePriority =
    indeterminate.length > 0
      ? Math.max(...indeterminate.map((item) => item.rule.priority ?? 0))
      : undefined;
  const decisionPriority =
    topMatchedPriority === undefined
      ? topIndeterminatePriority
      : topIndeterminatePriority === undefined
        ? topMatchedPriority
        : Math.max(topMatchedPriority, topIndeterminatePriority);
  const decisionMatches = matched.filter(
    (item) => (item.rule.priority ?? 0) === decisionPriority,
  );
  const unresolvedAtDecision = indeterminate.filter(
    (item) => (item.rule.priority ?? 0) >= (decisionPriority ?? 0),
  );
  const hasPositive = decisionMatches.some(
    (item) =>
      item.rule.outcome === 'likely' || item.rule.outcome === 'may_apply',
  );
  const hasNegative = decisionMatches.some(
    (item) => item.rule.outcome === 'not_indicated',
  );
  const unresolvedCouldConflict =
    (decisionMatches.length === 0 && unresolvedAtDecision.length > 0) ||
    unresolvedAtDecision.some((item) =>
      hasPositive
        ? item.rule.outcome === 'not_indicated'
        : item.rule.outcome !== 'not_indicated',
    );
  const conflictingRules = hasPositive && hasNegative;
  const disposition: PermitReasoningEvaluation['disposition'] =
    conflictingRules || unresolvedCouldConflict
      ? 'needs_information'
      : hasPositive
        ? 'likely'
        : 'not_indicated';
  const relevantUnknowns =
    disposition === 'needs_information' ? unresolvedAtDecision : indeterminate;
  const missing = deduplicateMissing(
    relevantUnknowns.flatMap((item) => item.evaluation.missingInformation),
  );
  const allEvidence = evaluations.flatMap((item) => item.evaluation.evidence);
  const contradictory = evaluations.some(
    (item) => item.evaluation.contradictory,
  );
  const escalationFlags = new Set<EscalationFlag>();
  if (disposition === 'needs_information') {
    escalationFlags.add('missing_required_information');
  }
  if (conflictingRules) escalationFlags.add('conflicting_rules');
  if (contradictory) escalationFlags.add('contradictory_evidence');
  if (
    decisionMatches.some((item) => item.rule.requiresEscalation) ||
    conflictingRules
  ) {
    escalationFlags.add('authority_confirmation_recommended');
  }
  const reasons = conflictingRules
    ? [
        `Rules at priority ${decisionPriority ?? 0} conflict for ${permit.name}.`,
        ...decisionMatches.map((item) => item.rule.explanation),
      ]
    : disposition === 'needs_information'
      ? [
          `More information is required before ${permit.name} can be indicated.`,
          ...unresolvedAtDecision.map((item) => item.rule.explanation),
        ]
      : disposition === 'likely'
        ? decisionMatches.map((item) => item.rule.explanation)
        : decisionMatches.length > 0
          ? decisionMatches.map((item) => item.rule.explanation)
          : [`No active rule indicates ${permit.name}.`];
  const ruleSourceIds = evaluations.flatMap(
    (item) => item.rule.sourceIds ?? [],
  );
  const evidenceSourceIds = allEvidence.flatMap((item) => item.sourceIds);

  return {
    permitTypeId: permit.id,
    disposition,
    confidence: confidenceFor(allEvidence),
    matchedRuleIds: decisionMatches.map((item) => item.rule.id).sort(),
    consideredRuleIds: evaluations.map((item) => item.rule.id).sort(),
    reasons: [...new Set(reasons)].sort(),
    assumptions: [...new Set(assumptions)].sort(),
    requiredFields: [
      ...new Set(
        evaluations.flatMap((item) =>
          item.evaluation.evidence.map((entry) => entry.fieldId),
        ),
      ),
    ].sort(),
    missingFields: missing
      .map((item) => item.questionId ?? item.field ?? item.id)
      .sort(),
    missingInformation: missing,
    followUpQuestionIds: [
      ...new Set(
        relevantUnknowns.flatMap((item) => item.evaluation.followUpQuestionIds),
      ),
    ].sort(),
    sourceIds: [
      ...new Set([
        ...permit.guidanceSourceIds,
        ...ruleSourceIds,
        ...evidenceSourceIds,
      ]),
    ].sort(),
    evidence: allEvidence.sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    escalationFlags: [...escalationFlags].sort(),
  };
}

export function evaluatePermitReadiness(
  input: RuleEngineInput,
): RuleEngineResult {
  const selection = selectPermitRuleRelease(
    input.ruleReleases,
    input.selectedRuleRelease,
    input.evaluationDate,
  );
  if (!selection.release || selection.issues.length > 0) {
    const flags: EscalationFlag[] = ['configuration_invalid'];
    if (selection.issues.some((issue) => issue.code === 'stale_rule_release')) {
      flags.push('stale_rule_release');
    }
    return {
      status: 'invalid_configuration',
      ruleRelease: selection.release
        ? { id: selection.release.id, version: selection.release.version }
        : undefined,
      configurationIssues: selection.issues,
      evaluations: [],
      sequence: sequencePermits([], input.dependencies ?? []),
      escalationFlags: flags.sort(),
    };
  }
  const release = selection.release;
  const configurationIssues = validateRelease(release, input.permitTypes);
  if (configurationIssues.length > 0) {
    return {
      status: 'invalid_configuration',
      ruleRelease: { id: release.id, version: release.version },
      configurationIssues,
      evaluations: [],
      sequence: sequencePermits([], input.dependencies ?? []),
      escalationFlags: ['configuration_invalid'],
    };
  }

  const facts = {
    projectTypeId: input.projectTypeId,
    answers: buildAnswerFacts(input.answers),
    spatial: buildSpatialFacts(input.spatial),
    locationProvided:
      input.spatial?.geometry !== undefined ||
      (input.spatial?.signals?.length ?? 0) > 0,
  };
  const activeRules = release.rules.filter((rule) =>
    activeOn(rule, input.evaluationDate),
  );
  const evaluations = [...input.permitTypes]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((permit) =>
      evaluatePermit(
        permit,
        activeRules.filter((rule) => rule.permitTypeId === permit.id),
        facts,
        input.assumptions ?? [],
      ),
    );
  const selectedPermits = evaluations
    .filter((evaluation) => evaluation.disposition !== 'not_indicated')
    .map((evaluation) => evaluation.permitTypeId);
  const sequence = sequencePermits(selectedPermits, input.dependencies ?? []);
  const escalationFlags = new Set(
    evaluations.flatMap((evaluation) => evaluation.escalationFlags),
  );
  if (sequence.cycles.length > 0) {
    escalationFlags.add('dependency_cycle');
  }
  return {
    status: 'evaluated',
    ruleRelease: { id: release.id, version: release.version },
    configurationIssues: [],
    evaluations,
    sequence,
    escalationFlags: [...escalationFlags].sort(),
  };
}
