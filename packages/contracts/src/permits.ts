import { z } from 'zod';
import {
  IsoDateSchema,
  SlugSchema,
  VersionSchema,
  createPaginatedSchema,
} from './common.js';

export const PermitKindSchema = z.enum([
  'permit',
  'authorization',
  'notification',
  'review',
]);

export const PermitTypeSchema = z
  .object({
    id: SlugSchema,
    name: z.string().min(2).max(200),
    kind: PermitKindSchema,
    authorityName: z.string().min(2).max(200),
    authorityUrl: z.string().url().startsWith('https://').optional(),
    summary: z.string().min(10).max(2000),
    guidanceSourceIds: z.array(SlugSchema).max(50),
  })
  .strict();

export const RuleComparisonOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'includes',
  'greater_than',
  'greater_than_or_equal',
  'less_than',
  'less_than_or_equal',
]);

export type PermitCondition =
  | {
      type: 'project_type';
      projectTypeIds: string[];
    }
  | {
      type: 'answer';
      questionId: string;
      operator: z.infer<typeof RuleComparisonOperatorSchema>;
      value: string | number | boolean;
    }
  | {
      type: 'location_provided';
      expected: boolean;
    }
  | {
      type: 'location_intersects_zone';
      zoneIds: string[];
    }
  | {
      type: 'all' | 'any';
      conditions: PermitCondition[];
    }
  | {
      type: 'not';
      condition: PermitCondition;
    };

export const PermitConditionSchema: z.ZodType<PermitCondition> = z.lazy(() =>
  z.union([
    z
      .object({
        type: z.literal('project_type'),
        projectTypeIds: z.array(SlugSchema).min(1).max(100),
      })
      .strict(),
    z
      .object({
        type: z.literal('answer'),
        questionId: SlugSchema,
        operator: RuleComparisonOperatorSchema,
        value: z.union([
          z.string().min(1).max(500),
          z.number().finite(),
          z.boolean(),
        ]),
      })
      .strict(),
    z
      .object({
        type: z.literal('location_provided'),
        expected: z.boolean(),
      })
      .strict(),
    z
      .object({
        type: z.literal('location_intersects_zone'),
        zoneIds: z.array(SlugSchema).min(1).max(100),
      })
      .strict(),
    z
      .object({
        type: z.enum(['all', 'any']),
        conditions: z.array(PermitConditionSchema).min(1).max(50),
      })
      .strict(),
    z
      .object({
        type: z.literal('not'),
        condition: PermitConditionSchema,
      })
      .strict(),
  ]),
);

export const PermitRuleSchema = z
  .object({
    id: SlugSchema,
    version: VersionSchema,
    permitTypeId: SlugSchema,
    outcome: z.enum(['likely', 'may_apply', 'not_indicated']),
    explanation: z.string().min(10).max(2000),
    priority: z.number().int().min(-10000).max(10000).optional(),
    effectiveFrom: IsoDateSchema.optional(),
    effectiveTo: IsoDateSchema.optional(),
    sourceIds: z.array(SlugSchema).max(100).optional(),
    followUpQuestionIds: z.array(SlugSchema).max(100).optional(),
    requiresEscalation: z.boolean().optional(),
    condition: PermitConditionSchema,
  })
  .strict()
  .refine(
    (rule) =>
      rule.effectiveFrom === undefined ||
      rule.effectiveTo === undefined ||
      rule.effectiveFrom <= rule.effectiveTo,
    {
      path: ['effectiveTo'],
      message: 'Rule effectiveTo cannot precede effectiveFrom.',
    },
  );

export const PermitDependencySchema = z
  .object({
    permitTypeId: SlugSchema,
    dependsOnPermitTypeId: SlugSchema,
    relationship: z.enum(['before', 'confirm_first', 'parallel']),
    explanation: z.string().min(10).max(1000),
  })
  .strict()
  .refine(
    (dependency) =>
      dependency.permitTypeId !== dependency.dependsOnPermitTypeId,
    {
      path: ['dependsOnPermitTypeId'],
      message: 'A permit cannot depend on itself.',
    },
  );

export const MissingInformationSchema = z
  .object({
    id: SlugSchema,
    questionId: SlugSchema.optional(),
    field: z.enum(['project_type', 'location', 'intake_answer']).optional(),
    label: z.string().min(2).max(300),
    reason: z.string().min(5).max(1000),
    severity: z.enum(['required', 'recommended']),
  })
  .strict()
  .refine(
    (missing) =>
      (missing.questionId === undefined) !== (missing.field === undefined),
    {
      message: 'Missing information must identify one question or one field.',
    },
  );

export const TriggerEvaluationSchema = z
  .object({
    permitTypeId: SlugSchema,
    outcome: z.enum(['triggered', 'not_triggered', 'indeterminate']),
    recommendation: z.enum(['likely', 'may_apply', 'not_indicated']),
    matchedRuleIds: z.array(SlugSchema).max(100),
    missingInformation: z.array(MissingInformationSchema).max(100),
    assumptions: z.array(z.string().min(1).max(1000)).max(100),
    ruleVersion: VersionSchema,
  })
  .strict()
  .superRefine((evaluation, context) => {
    if (
      evaluation.outcome === 'indeterminate' &&
      evaluation.missingInformation.length === 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['missingInformation'],
        message: 'Indeterminate evaluations require missing information.',
      });
    }
    if (
      evaluation.outcome === 'triggered' &&
      evaluation.matchedRuleIds.length === 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['matchedRuleIds'],
        message: 'Triggered evaluations require at least one matched rule.',
      });
    }
    if (
      evaluation.outcome === 'not_triggered' &&
      evaluation.recommendation !== 'not_indicated'
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recommendation'],
        message: 'A non-triggered evaluation must be not indicated.',
      });
    }
  });

export const PermitTypeListSchema = createPaginatedSchema(PermitTypeSchema);

export type MissingInformation = z.infer<typeof MissingInformationSchema>;
export type PermitDependency = z.infer<typeof PermitDependencySchema>;
export type PermitRule = z.infer<typeof PermitRuleSchema>;
export type PermitType = z.infer<typeof PermitTypeSchema>;
export type TriggerEvaluation = z.infer<typeof TriggerEvaluationSchema>;
