import { z } from 'zod';
import {
  IsoDateSchema,
  IsoDateTimeSchema,
  ProjectIdSchema,
  SlugSchema,
  VersionSchema,
} from './common.js';

export const IntakeQuestionKindSchema = z.enum([
  'short_text',
  'long_text',
  'boolean',
  'single_select',
  'multi_select',
  'number',
  'date',
]);

export const IntakeQuestionOptionSchema = z
  .object({
    id: SlugSchema,
    label: z.string().min(1).max(160),
    description: z.string().min(1).max(500).optional(),
  })
  .strict();

export const IntakeVisibilityConditionSchema = z
  .object({
    questionId: SlugSchema,
    operator: z.enum(['equals', 'not_equals', 'includes']),
    value: z.union([
      z.string().min(1).max(500),
      z.number().finite(),
      z.boolean(),
    ]),
  })
  .strict();

const QuestionBaseShape = {
  id: SlugSchema,
  label: z.string().min(2).max(500),
  helpText: z.string().min(1).max(1000).optional(),
  required: z.boolean(),
  visibleWhen: IntakeVisibilityConditionSchema.optional(),
};

export const IntakeQuestionSchema = z.discriminatedUnion('kind', [
  z
    .object({
      ...QuestionBaseShape,
      kind: z.literal('short_text'),
      maxLength: z.number().int().min(1).max(1000).default(500),
    })
    .strict(),
  z
    .object({
      ...QuestionBaseShape,
      kind: z.literal('long_text'),
      maxLength: z.number().int().min(1).max(5000).default(2000),
    })
    .strict(),
  z
    .object({
      ...QuestionBaseShape,
      kind: z.literal('boolean'),
    })
    .strict(),
  z
    .object({
      ...QuestionBaseShape,
      kind: z.literal('single_select'),
      options: z.array(IntakeQuestionOptionSchema).min(2).max(100),
    })
    .strict(),
  z
    .object({
      ...QuestionBaseShape,
      kind: z.literal('multi_select'),
      options: z.array(IntakeQuestionOptionSchema).min(2).max(100),
      maxSelections: z.number().int().min(1).max(100).optional(),
    })
    .strict(),
  z
    .object({
      ...QuestionBaseShape,
      kind: z.literal('number'),
      minimum: z.number().finite().optional(),
      maximum: z.number().finite().optional(),
      unit: z.string().min(1).max(40).optional(),
    })
    .strict(),
  z
    .object({
      ...QuestionBaseShape,
      kind: z.literal('date'),
    })
    .strict(),
]);

export const IntakeQuestionSetSchema = z
  .object({
    id: SlugSchema,
    version: VersionSchema,
    title: z.string().min(2).max(160),
    description: z.string().min(1).max(1000).optional(),
    projectTypeIds: z.array(SlugSchema).min(1),
    questions: z.array(IntakeQuestionSchema).min(1).max(250),
  })
  .strict()
  .superRefine((questionSet, context) => {
    const questionIds = new Set<string>();
    questionSet.questions.forEach((question, index) => {
      if (questionIds.has(question.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['questions', index, 'id'],
          message: 'Question identifiers must be unique.',
        });
      }
      if (
        question.visibleWhen &&
        !questionIds.has(question.visibleWhen.questionId)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['questions', index, 'visibleWhen', 'questionId'],
          message:
            'Visibility conditions must reference an earlier question in the set.',
        });
      }
      questionIds.add(question.id);

      if ('options' in question) {
        const optionIds = question.options.map((option) => option.id);
        if (new Set(optionIds).size !== optionIds.length) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['questions', index, 'options'],
            message: 'Question option identifiers must be unique.',
          });
        }
      }

      if (
        question.kind === 'number' &&
        question.minimum !== undefined &&
        question.maximum !== undefined &&
        question.minimum > question.maximum
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['questions', index, 'minimum'],
          message: 'Question minimum cannot exceed maximum.',
        });
      }
    });
  });

const AnswerBaseShape = {
  questionId: SlugSchema,
  state: z.literal('answered'),
};

export const IntakeAnswerSchema = z.union([
  z
    .object({
      ...AnswerBaseShape,
      kind: z.enum(['short_text', 'long_text', 'single_select']),
      value: z.string().min(1).max(5000),
    })
    .strict(),
  z
    .object({
      ...AnswerBaseShape,
      kind: z.literal('multi_select'),
      value: z.array(SlugSchema).min(1).max(100),
    })
    .strict(),
  z
    .object({
      ...AnswerBaseShape,
      kind: z.literal('boolean'),
      value: z.boolean(),
    })
    .strict(),
  z
    .object({
      ...AnswerBaseShape,
      kind: z.literal('number'),
      value: z.number().finite(),
    })
    .strict(),
  z
    .object({
      ...AnswerBaseShape,
      kind: z.literal('date'),
      value: IsoDateSchema,
    })
    .strict(),
  z
    .object({
      questionId: SlugSchema,
      state: z.enum(['unknown', 'deferred']),
    })
    .strict(),
]);

export const IntakeCompletenessSchema = z
  .object({
    requiredCount: z.number().int().nonnegative(),
    answeredRequiredCount: z.number().int().nonnegative(),
    missingRequiredQuestionIds: z.array(SlugSchema),
    unknownRequiredQuestionIds: z.array(SlugSchema),
    isComplete: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.answeredRequiredCount > value.requiredCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['answeredRequiredCount'],
        message: 'Answered required count cannot exceed required count.',
      });
    }
    const calculatedComplete =
      value.answeredRequiredCount === value.requiredCount &&
      value.missingRequiredQuestionIds.length === 0 &&
      value.unknownRequiredQuestionIds.length === 0;
    if (value.isComplete !== calculatedComplete) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['isComplete'],
        message: 'Completeness flag does not match the supplied counts.',
      });
    }
  });

export const ProjectIntakeSchema = z
  .object({
    projectId: ProjectIdSchema,
    questionSetId: SlugSchema,
    questionSetVersion: VersionSchema,
    answers: z.array(IntakeAnswerSchema).max(250),
    completeness: IntakeCompletenessSchema,
    version: z.number().int().positive(),
    updatedAt: IsoDateTimeSchema,
    completedAt: IsoDateTimeSchema.optional(),
  })
  .strict()
  .superRefine((intake, context) => {
    const answerIds = intake.answers.map((answer) => answer.questionId);
    if (new Set(answerIds).size !== answerIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['answers'],
        message: 'Only one current answer is allowed per question.',
      });
    }
    if (intake.completeness.isComplete !== Boolean(intake.completedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['completedAt'],
        message: 'completedAt must be present exactly when intake is complete.',
      });
    }
  });

export const UpdateIntakeBodySchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    answers: z.array(IntakeAnswerSchema).min(1).max(250),
  })
  .strict()
  .refine(
    (body) =>
      new Set(body.answers.map((answer) => answer.questionId)).size ===
      body.answers.length,
    { path: ['answers'], message: 'Question answers must be unique.' },
  );

export const CompleteIntakeBodySchema = z
  .object({
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export type IntakeAnswer = z.infer<typeof IntakeAnswerSchema>;
export type IntakeQuestion = z.infer<typeof IntakeQuestionSchema>;
export type IntakeQuestionSet = z.infer<typeof IntakeQuestionSetSchema>;
export type ProjectIntake = z.infer<typeof ProjectIntakeSchema>;
