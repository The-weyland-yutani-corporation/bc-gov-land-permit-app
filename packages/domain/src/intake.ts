import type { Identifier, IsoDate } from './types.js';

export type IntakeQuestionKind =
  | 'short_text'
  | 'long_text'
  | 'boolean'
  | 'single_select'
  | 'multi_select'
  | 'number'
  | 'date';

export interface IntakeQuestionOption {
  readonly id: Identifier;
  readonly label: string;
  readonly description?: string;
}

export interface IntakeVisibilityCondition {
  readonly questionId: Identifier;
  readonly operator: 'equals' | 'not_equals' | 'includes';
  readonly value: string | number | boolean;
}

export interface IntakeQuestionDefinition {
  readonly id: Identifier;
  readonly kind: IntakeQuestionKind;
  readonly label: string;
  readonly helpText?: string;
  readonly required: boolean;
  readonly options?: readonly IntakeQuestionOption[];
  readonly visibleWhen?: IntakeVisibilityCondition;
}

export interface IntakeQuestionSet {
  readonly id: Identifier;
  readonly version: string;
  readonly title: string;
  readonly projectTypeIds: readonly Identifier[];
  readonly questions: readonly IntakeQuestionDefinition[];
}

export type IntakeAnswerValue = string | number | boolean | readonly string[];

export type IntakeAnswer =
  | {
      readonly questionId: Identifier;
      readonly state: 'answered';
      readonly value: IntakeAnswerValue;
    }
  | {
      readonly questionId: Identifier;
      readonly state: 'unknown' | 'deferred';
      readonly value?: never;
    };

export interface IntakeSnapshot {
  readonly questionSetId: Identifier;
  readonly questionSetVersion: string;
  readonly answers: readonly IntakeAnswer[];
  readonly completedAt?: string;
}

export interface IntakeCompleteness {
  readonly requiredCount: number;
  readonly answeredRequiredCount: number;
  readonly missingRequiredQuestionIds: readonly Identifier[];
  readonly unknownRequiredQuestionIds: readonly Identifier[];
  readonly isComplete: boolean;
}

export function calculateIntakeCompleteness(
  questions: readonly Pick<IntakeQuestionDefinition, 'id' | 'required'>[],
  answers: readonly IntakeAnswer[],
): IntakeCompleteness {
  const answersByQuestion = new Map(
    answers.map((answer) => [answer.questionId, answer] as const),
  );
  const requiredQuestions = questions.filter((question) => question.required);
  const missingRequiredQuestionIds: Identifier[] = [];
  const unknownRequiredQuestionIds: Identifier[] = [];
  let answeredRequiredCount = 0;

  for (const question of requiredQuestions) {
    const answer = answersByQuestion.get(question.id);
    if (!answer) {
      missingRequiredQuestionIds.push(question.id);
    } else if (answer.state === 'answered') {
      answeredRequiredCount += 1;
    } else {
      unknownRequiredQuestionIds.push(question.id);
    }
  }

  return {
    requiredCount: requiredQuestions.length,
    answeredRequiredCount,
    missingRequiredQuestionIds,
    unknownRequiredQuestionIds,
    isComplete:
      missingRequiredQuestionIds.length === 0 &&
      unknownRequiredQuestionIds.length === 0,
  };
}

export function isIsoDate(value: string): value is IsoDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
