'use server';

import {
  CreateProjectBodySchema,
  GenerateReadinessReportBodySchema,
  IntakeAnswerSchema,
  ProjectLocationSchema,
  ProjectTaskStatusSchema,
} from '@permit-readiness/contracts';
import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  clearSession,
  enableLocalDemoSession,
  requireSession,
} from '../lib/auth';
import { DEMO_RELEASE } from '../lib/demo-config';
import { getPermitAppRepository } from '../lib/repository';
import { safeReturnPath } from '../lib/safe-return-path';

const SaveWizardSchema = z.object({
  expectedVersion: z.number().int().positive(),
  expectedProjectVersion: z.number().int().positive(),
  answers: z.array(IntakeAnswerSchema),
  location: ProjectLocationSchema,
});

function deterministicUuid(value: string) {
  const hex = createHash('sha256').update(value).digest('hex').slice(0, 32);
  const characters = [...hex];
  characters[12] = '5';
  characters[16] = (
    (Number.parseInt(characters[16]!, 16) & 0x3) |
    0x8
  ).toString(16);
  const normalized = characters.join('');
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20)}`;
}

export async function signInLocalDemoAction(formData: FormData) {
  await enableLocalDemoSession();
  redirect(safeReturnPath(String(formData.get('returnTo') ?? '')));
}

export async function signOutAction() {
  await clearSession();
  redirect('/');
}

export async function createProjectAction(formData: FormData) {
  const session = await requireSession('/projects/new');
  const input = CreateProjectBodySchema.parse({
    idempotencyKey: formData.get('idempotencyKey'),
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    projectTypeId: formData.get('projectTypeId'),
    jurisdictionRelease: DEMO_RELEASE,
  });
  const repository = await getPermitAppRepository();
  const project = await repository.createProject(session, input);
  redirect(`/projects/${project.id}/intake`);
}

export async function saveIntakeAction(projectId: string, rawInput: unknown) {
  const session = await requireSession(`/projects/${projectId}/intake`);
  const input = SaveWizardSchema.parse(rawInput);
  const repository = await getPermitAppRepository();
  const workspace = await repository.saveIntake(session, projectId, input);
  revalidatePath(`/projects/${projectId}`);
  return {
    ok: true as const,
    isComplete: workspace.intake.completeness.isComplete,
    redirectTo: `/projects/${projectId}/summary`,
  };
}

export async function invokeNavigatorAction(
  projectId: string,
  message: string,
) {
  const session = await requireSession(`/projects/${projectId}/navigator`);
  const repository = await getPermitAppRepository();
  const workspace = await repository.invokeNavigator(
    session,
    projectId,
    message,
  );
  return {
    ok: true as const,
    messages: workspace.messages,
    available: true,
  };
}

export async function generateReportAction(
  projectId: string,
  expectedProjectVersion: number,
) {
  const session = await requireSession(`/projects/${projectId}/summary`);
  const repository = await getPermitAppRepository();
  const workspace = await repository.getWorkspace(session, projectId);
  if (workspace.intake.completeness.missingRequiredQuestionIds.length > 0) {
    throw new Error(
      'Required intake questions must be answered or explicitly marked unknown.',
    );
  }
  const input = GenerateReadinessReportBodySchema.parse({
    expectedProjectVersion,
    idempotencyKey: deterministicUuid(
      `readiness-report:${projectId}:${expectedProjectVersion}`,
    ),
  });
  await repository.generateReport(session, projectId, input);
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/report`);
}

export async function updateTaskAction(
  projectId: string,
  taskId: string,
  formData: FormData,
) {
  const session = await requireSession(`/projects/${projectId}/tasks`);
  const status = ProjectTaskStatusSchema.parse(formData.get('status'));
  const repository = await getPermitAppRepository();
  await repository.updateTask(session, projectId, taskId, status);
  revalidatePath(`/projects/${projectId}/tasks`);
}
