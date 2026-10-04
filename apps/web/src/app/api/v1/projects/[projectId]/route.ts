import { ProjectSchema } from '@permit-readiness/contracts';
import { NextResponse } from 'next/server';
import { getOptionalSession } from '../../../../../lib/auth';
import { apiError } from '../../../../../lib/api-response';
import { getPermitAppRepository } from '../../../../../lib/repository';

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const session = await getOptionalSession();
  if (!session) return apiError(401, 'UNAUTHENTICATED', 'Sign-in required.');
  const { projectId } = await context.params;
  try {
    const repository = await getPermitAppRepository();
    const workspace = await repository.getWorkspace(session, projectId);
    return NextResponse.json(ProjectSchema.parse(workspace.project));
  } catch {
    return apiError(404, 'NOT_FOUND', 'Project not found.');
  }
}
