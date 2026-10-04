import type {
  AgentProjectContext,
  TriggerEvaluation,
} from '@permit-readiness/contracts';
import {
  evaluatePermitReadiness,
  type PermitReasoningEvaluation,
} from '@permit-readiness/domain';

export function evaluateContext(context: AgentProjectContext) {
  const releaseId = ruleReleaseId(context);
  return evaluatePermitReadiness({
    projectTypeId: context.project.projectTypeId,
    answers: context.intake.answers.map((answer) => ({
      questionId: answer.questionId,
      state: answer.state,
      value: answer.state === 'answered' ? answer.value : undefined,
    })),
    spatial: context.project.location
      ? { geometry: context.project.location.geometry }
      : undefined,
    permitTypes: context.permitTypes,
    ruleReleases: [
      {
        id: releaseId,
        version: context.project.jurisdictionRelease.ruleVersion,
        state: 'approved',
        effectiveFrom: '2000-01-01',
        rules: context.rules,
      },
    ],
    selectedRuleRelease: {
      id: releaseId,
      version: context.project.jurisdictionRelease.ruleVersion,
    },
    dependencies: context.permitDependencies,
    evaluationDate: context.evaluationDate,
    jurisdictionRelease: context.project.jurisdictionRelease,
  });
}

export function ruleReleaseId(context: AgentProjectContext): string {
  return `rules-${context.project.jurisdictionRelease.jurisdictionId}`;
}

export function toTriggerEvaluation(
  evaluation: PermitReasoningEvaluation,
  ruleVersion: string,
  context: AgentProjectContext,
): TriggerEvaluation {
  const disposition = evaluation.disposition;
  const positiveRecommendation = context.rules.some(
    (rule) =>
      evaluation.matchedRuleIds.includes(rule.id) && rule.outcome === 'likely',
  )
    ? 'likely'
    : 'may_apply';
  return {
    permitTypeId: evaluation.permitTypeId,
    outcome:
      disposition === 'likely'
        ? 'triggered'
        : disposition === 'not_indicated'
          ? 'not_triggered'
          : 'indeterminate',
    recommendation:
      disposition === 'likely'
        ? positiveRecommendation
        : disposition === 'not_indicated'
          ? 'not_indicated'
          : 'may_apply',
    matchedRuleIds: [...evaluation.matchedRuleIds],
    missingInformation: [...evaluation.missingInformation],
    assumptions: [...evaluation.assumptions],
    ruleVersion,
  };
}

export function identifyMissing(context: AgentProjectContext) {
  const result = evaluateContext(context);
  const fromRules =
    result.status === 'evaluated'
      ? result.evaluations.flatMap((item) => item.missingInformation)
      : [];
  const questionIds = [
    ...context.intake.completeness.missingRequiredQuestionIds,
    ...context.intake.completeness.unknownRequiredQuestionIds,
  ];
  const fromIntake = questionIds.map((questionId) => ({
    id: `missing-${questionId}`,
    questionId,
    label:
      context.questionSet.questions.find(
        (question) => question.id === questionId,
      )?.label ?? questionId,
    reason: 'This required answer is missing or marked unknown.',
    severity: 'required' as const,
  }));
  return [
    ...new Map(
      [...fromIntake, ...fromRules].map((item) => [item.id, item]),
    ).values(),
  ];
}
