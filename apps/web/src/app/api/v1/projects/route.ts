import {
  CreateProjectBodySchema,
  ProjectListSchema,
  ProjectSchema,
} from '@permit-readiness/contracts';
import { NextResponse } from 'next/server';
import { getOptionalSession } from '../../../../lib/auth';
import { apiError } from '../../../../lib/api-response';
import { getPermitAppRepository } from '../../../../lib/repository';

export async function GET() {
  const session = await getOptionalSession();
  if (!session) return apiError(401, 'UNAUTHENTICATED', 'Sign-in required.');
  const repository = await getPermitAppRepository();
  const projects = await repository.listProjects(session);
  const body = ProjectListSchema.parse({
    items: projects,
    page: { nextCursor: null, hasMore: false },
  });
  return NextResponse.json(body);
}

export async function POST(request: Request) {
  const session = await getOptionalSession();
  if (!session) return apiError(401, 'UNAUTHENTICATED', 'Sign-in required.');
  const parsed = CreateProjectBodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return apiError(422, 'VALIDATION_FAILED', 'Project input is invalid.');
  }
  const repository = await getPermitAppRepository();
  const project = await repository.createProject(session, parsed.data);
  return NextResponse.json(ProjectSchema.parse(project), { status: 201 });
}
