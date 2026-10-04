import type { IntakeAnswer } from '@permit-readiness/contracts';
import { bcInspiredSyntheticPreset } from '@permit-readiness/jurisdiction-config';
import { ResourceNotFoundError } from './repository-types';

export const DEMO_RELEASE = {
  schemaVersion: bcInspiredSyntheticPreset.schemaVersion,
  jurisdictionId: bcInspiredSyntheticPreset.jurisdiction.id,
  releaseVersion: bcInspiredSyntheticPreset.release.version,
  contentVersion: bcInspiredSyntheticPreset.release.contentVersion,
  ruleVersion: bcInspiredSyntheticPreset.release.ruleVersion,
  guidanceVersion: bcInspiredSyntheticPreset.release.guidanceVersion,
};

export const demoProjectTypes = bcInspiredSyntheticPreset.projectTypes.filter(
  (projectType) => projectType.enabled,
);

export function getDemoQuestionSet(projectTypeId: string) {
  const projectType = demoProjectTypes.find(
    (candidate) => candidate.id === projectTypeId,
  );
  if (!projectType) throw new ResourceNotFoundError('Project type not found.');
  const set = bcInspiredSyntheticPreset.questionSets.find(
    (candidate) => candidate.id === projectType.intakeQuestionSetId,
  );
  if (!set) throw new ResourceNotFoundError('Question set not found.');
  return set;
}

export function calculateCompleteness(
  projectTypeId: string,
  answers: IntakeAnswer[],
) {
  const required = getDemoQuestionSet(projectTypeId).questions.filter(
    (question) => question.required,
  );
  const byId = new Map(answers.map((answer) => [answer.questionId, answer]));
  const missingRequiredQuestionIds: string[] = [];
  const unknownRequiredQuestionIds: string[] = [];
  let answeredRequiredCount = 0;

  for (const question of required) {
    const answer = byId.get(question.id);
    if (!answer) missingRequiredQuestionIds.push(question.id);
    else if (answer.state === 'answered') answeredRequiredCount += 1;
    else unknownRequiredQuestionIds.push(question.id);
  }

  return {
    requiredCount: required.length,
    answeredRequiredCount,
    missingRequiredQuestionIds,
    unknownRequiredQuestionIds,
    isComplete:
      missingRequiredQuestionIds.length === 0 &&
      unknownRequiredQuestionIds.length === 0,
  };
}

export { bcInspiredSyntheticPreset as demoConfiguration };
