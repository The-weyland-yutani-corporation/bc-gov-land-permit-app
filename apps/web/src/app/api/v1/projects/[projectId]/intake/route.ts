import {
  ProjectIntakeSchema,
  UpdateIntakeBodySchema,
} from '@permit-readiness/contracts';
import { NextResponse } from 'next/server';
import { getOptionalSession } from '../../../../../../lib/auth';
import { apiError } from '../../../../../../lib/api-response';
import { getPermitAppRepository } from '../../../../../../lib/repository';

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const session = await getOptionalSession();
  if (!session) return apiError(401, 'UNAUTHENTICATED', 'Sign-in required.');
  const { projectId } = await context.params;
  const repository = await getPermitAppRepository();
  const workspace = await repository.getWorkspace(session, projectId);
  return NextResponse.json(ProjectIntakeSchema.parse(workspace.intake));
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const session = await getOptionalSession();
  if (!session) return apiError(401, 'UNAUTHENTICATED', 'Sign-in required.');
  const parsed = UpdateIntakeBodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return apiError(422, 'VALIDATION_FAILED', 'Intake input is invalid.');
  }
  const { projectId } = await context.params;
  const repository = await getPermitAppRepository();
  const workspace = await repository.getWorkspace(session, projectId);
  if (!workspace.project.location) {
    return apiError(
      409,
      'CONFLICT',
      'Save a project location before updating intake through this route.',
    );
  }
  const changedQuestionIds = new Set(
    parsed.data.answers.map((answer) => answer.questionId),
  );
  const updated = await repository.saveIntake(session, projectId, {
    expectedVersion: parsed.data.expectedVersion,
    expectedProjectVersion: workspace.project.version,
    answers: [
      ...workspace.intake.answers.filter(
        (answer) => !changedQuestionIds.has(answer.questionId),
      ),
      ...parsed.data.answers,
    ],
    location: workspace.project.location,
  });
  return NextResponse.json(ProjectIntakeSchema.parse(updated.intake));
}
