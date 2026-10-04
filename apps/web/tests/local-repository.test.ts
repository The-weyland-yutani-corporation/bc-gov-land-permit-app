import { describe, expect, it } from 'vitest';
import { LocalDemoRepository } from '../src/lib/local-repository';
import type { AuthSession } from '../src/lib/auth';
import { DEMO_RELEASE } from '../src/lib/demo-config';

const owner: AuthSession = {
  userId: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  displayName: 'Demo applicant',
  email: 'applicant@example.invalid',
  mode: 'local-demo',
  expiresAt: Date.now() + 60_000,
};

describe('LocalDemoRepository', () => {
  it('opens the initialized workspace and makes create retries ownership-safe', async () => {
    const repository = new LocalDemoRepository();
    const input = {
      idempotencyKey: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      name: 'Atomic project',
      description: 'Synthetic project creation retry.',
      projectTypeId: 'community-connectivity',
      jurisdictionRelease: DEMO_RELEASE,
    };

    const created = await repository.createProject(owner, input);
    const workspace = await repository.getWorkspace(owner, created.id);
    expect(workspace.project.id).toBe(created.id);
    expect(workspace.intake.projectId).toBe(created.id);
    expect(workspace.intake.version).toBe(1);

    const retried = await repository.createProject(owner, input);
    expect(retried.id).toBe(created.id);
    expect(
      (await repository.listProjects(owner)).filter(
        (project) => project.name === input.name,
      ),
    ).toHaveLength(1);

    await expect(
      repository.createProject(owner, { ...input, name: 'Changed input' }),
    ).rejects.toThrow('different input');

    const otherOwner = {
      ...owner,
      organizationId: '55555555-5555-4555-8555-555555555555',
    };
    const otherProject = await repository.createProject(otherOwner, input);
    expect(otherProject.id).not.toBe(created.id);
    await expect(
      repository.getWorkspace(otherOwner, created.id),
    ).rejects.toThrow('Project not found');
  });

  it('enforces project ownership at the repository boundary', async () => {
    const repository = new LocalDemoRepository();
    const projects = await repository.listProjects(owner);
    expect(projects).toHaveLength(1);

    await expect(
      repository.getWorkspace(
        { ...owner, organizationId: crypto.randomUUID() },
        projects[0]!.id,
      ),
    ).rejects.toThrow('Project not found');
  });

  it('validates and saves a complete intake', async () => {
    const repository = new LocalDemoRepository();
    const [project] = await repository.listProjects(owner);
    const workspace = await repository.getWorkspace(owner, project!.id);
    const answers = [
      'public-land-involved',
      'near-water-feature',
      'changes-road-access',
      'linear-corridor',
    ].map((questionId) => ({
      questionId,
      state: 'answered' as const,
      kind: 'boolean' as const,
      value: false,
    }));
    const saved = await repository.saveIntake(owner, project!.id, {
      expectedVersion: workspace.intake.version,
      expectedProjectVersion: workspace.project.version,
      answers,
      location: {
        geometry: { type: 'Point', coordinates: [-123.1, 49.2] },
        source: 'coordinates',
      },
    });
    expect(saved.intake.completeness.isComplete).toBe(true);
    expect(saved.project.status).toBe('ready_for_review');
  });

  it('carries explicit unknown answers into a degraded report', async () => {
    const repository = new LocalDemoRepository();
    const [project] = await repository.listProjects(owner);
    const workspace = await repository.getWorkspace(owner, project!.id);
    const answers = [
      {
        questionId: 'public-land-involved',
        state: 'answered' as const,
        kind: 'boolean' as const,
        value: true,
      },
      {
        questionId: 'near-water-feature',
        state: 'unknown' as const,
      },
      {
        questionId: 'changes-road-access',
        state: 'answered' as const,
        kind: 'boolean' as const,
        value: false,
      },
      {
        questionId: 'linear-corridor',
        state: 'answered' as const,
        kind: 'boolean' as const,
        value: true,
      },
    ];
    const saved = await repository.saveIntake(owner, project!.id, {
      expectedVersion: workspace.intake.version,
      expectedProjectVersion: workspace.project.version,
      answers,
      location: {
        geometry: { type: 'Point', coordinates: [-123.1, 49.2] },
        source: 'coordinates',
      },
    });

    expect(saved.intake.completeness.isComplete).toBe(false);
    expect(saved.intake.completeness.missingRequiredQuestionIds).toEqual([]);
    expect(saved.project.status).toBe('ready_for_review');

    const reported = await repository.generateReport(owner, project!.id, {
      expectedProjectVersion: saved.project.version,
      idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    expect(reported.report?.status).toBe('degraded');
    expect(reported.report?.missingInformation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ questionId: 'near-water-feature' }),
      ]),
    );
    expect(reported.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'answer_question',
          title:
            'Could work occur in or near a stream, wet area, or shoreline?',
        }),
      ]),
    );
  });

  it('rolls back the whole intake edit when either version is stale', async () => {
    const repository = new LocalDemoRepository();
    const [project] = await repository.listProjects(owner);
    const before = await repository.getWorkspace(owner, project!.id);
    const input = {
      expectedVersion: before.intake.version,
      expectedProjectVersion: before.project.version,
      answers: [
        {
          questionId: 'public-land-involved',
          state: 'answered' as const,
          kind: 'boolean' as const,
          value: false,
        },
      ],
      location: {
        geometry: {
          type: 'Point' as const,
          coordinates: [-122.9, 49.1] as [number, number],
        },
        source: 'coordinates' as const,
      },
    };

    await expect(
      repository.saveIntake(owner, project!.id, {
        ...input,
        expectedProjectVersion: input.expectedProjectVersion + 1,
      }),
    ).rejects.toThrow('project changed');
    expect(await repository.getWorkspace(owner, project!.id)).toEqual(before);

    await expect(
      repository.saveIntake(owner, project!.id, {
        ...input,
        expectedVersion: input.expectedVersion + 1,
      }),
    ).rejects.toThrow('intake changed');
    expect(await repository.getWorkspace(owner, project!.id)).toEqual(before);
  });

  it('invalidates the current report and all report-derived tasks on edit', async () => {
    const repository = new LocalDemoRepository();
    const [project] = await repository.listProjects(owner);
    const initial = await repository.getWorkspace(owner, project!.id);
    const answers = [
      'public-land-involved',
      'near-water-feature',
      'changes-road-access',
      'linear-corridor',
    ].map((questionId) => ({
      questionId,
      state: 'answered' as const,
      kind: 'boolean' as const,
      value: true,
    }));
    const saved = await repository.saveIntake(owner, project!.id, {
      expectedVersion: initial.intake.version,
      expectedProjectVersion: initial.project.version,
      answers,
      location: {
        geometry: { type: 'Point', coordinates: [-123.1, 49.2] },
        source: 'coordinates',
      },
    });
    const reported = await repository.generateReport(owner, project!.id, {
      expectedProjectVersion: saved.project.version,
      idempotencyKey: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });
    expect(reported.report).toBeDefined();
    expect(reported.tasks.length).toBeGreaterThan(0);

    const edited = await repository.saveIntake(owner, project!.id, {
      expectedVersion: reported.intake.version,
      expectedProjectVersion: reported.project.version,
      answers: answers.map((answer) =>
        answer.questionId === 'near-water-feature'
          ? { ...answer, value: false }
          : answer,
      ),
      location: reported.project.location!,
    });
    expect(edited.project.latestReadinessReportId).toBeUndefined();
    expect(edited.report).toBeUndefined();
    expect(edited.tasks).toEqual([]);
  });

  it('persists one owned conversation and returns bounded history', async () => {
    const repository = new LocalDemoRepository();
    const [project] = await repository.listProjects(owner);

    const first = await repository.invokeNavigator(
      owner,
      project!.id,
      'What does location mean?',
    );
    const conversationId = first.conversation!.id;
    await repository.invokeNavigator(owner, project!.id, 'What about water?');
    for (let index = 0; index < 49; index += 1) {
      await repository.invokeNavigator(
        owner,
        project!.id,
        `Explain saved item ${index}.`,
      );
    }

    const loaded = await repository.getWorkspace(owner, project!.id);
    expect(loaded.conversation?.id).toBe(conversationId);
    expect(loaded.messages).toHaveLength(100);
    expect(loaded.messages.at(-1)?.role).toBe('assistant');
    await expect(
      repository.invokeNavigator(
        { ...owner, organizationId: crypto.randomUUID() },
        project!.id,
        'Show another tenant history.',
      ),
    ).rejects.toThrow('Project not found');
  });

  it('returns the same report and tasks after an idempotent lost response retry', async () => {
    const repository = new LocalDemoRepository();
    const [project] = await repository.listProjects(owner);
    const workspace = await repository.getWorkspace(owner, project!.id);
    const request = {
      expectedProjectVersion: workspace.project.version,
      idempotencyKey: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    };

    const first = await repository.generateReport(owner, project!.id, request);
    const retried = await repository.generateReport(
      owner,
      project!.id,
      request,
    );
    expect(retried.report?.id).toBe(first.report?.id);
    expect(retried.project.version).toBe(first.project.version);
    expect(retried.tasks.map((task) => task.id)).toEqual(
      first.tasks.map((task) => task.id),
    );
    await expect(
      repository.generateReport(
        { ...owner, organizationId: crypto.randomUUID() },
        project!.id,
        request,
      ),
    ).rejects.toThrow('Project not found');
  });
});
