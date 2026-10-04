import { and, eq } from 'drizzle-orm';
import type { Database } from './client.js';
import {
  intakeQuestionSets,
  memberships,
  organizations,
  projectIntakes,
  projects,
  users,
} from './schema.js';

export const DEMO_DATA_INITIALIZATION_VERSION = '1.0.0';
export const DEMO_USER_ID = '11111111-1111-4111-8111-111111111111';
export const DEMO_ORGANIZATION_ID = '22222222-2222-4222-8222-222222222222';
export const DEMO_PROJECT_ID = '33333333-3333-4333-8333-333333333333';
const DEMO_MEMBERSHIP_ID = '44444444-4444-4444-8444-444444444444';
const DEMO_INTAKE_ID = '55555555-5555-4555-8555-555555555555';

export function requireDemoDataApproval(
  environment: NodeJS.ProcessEnv = process.env,
): void {
  if (environment.ALLOW_DEMO_DATA !== 'true') {
    throw new Error('Demo data initialization requires ALLOW_DEMO_DATA=true.');
  }
}

export async function initializeDemoData(database: Database): Promise<void> {
  await database.transaction(async (transaction) => {
    const [user] = await transaction
      .insert(users)
      .values({
        id: DEMO_USER_ID,
        subjectId: 'local-demo-applicant',
        provider: 'local_demo',
        displayName: 'Demo applicant',
        email: 'applicant@example.invalid',
      })
      .onConflictDoUpdate({
        target: [users.provider, users.subjectId],
        set: {
          displayName: 'Demo applicant',
          email: 'applicant@example.invalid',
          updatedAt: new Date(),
        },
      })
      .returning({ id: users.id });
    if (user?.id !== DEMO_USER_ID) {
      throw new Error('The local demo identity is owned by another user row.');
    }

    const [organization] = await transaction
      .insert(organizations)
      .values({
        id: DEMO_ORGANIZATION_ID,
        slug: 'local-demo',
        name: 'Local demonstration organization',
      })
      .onConflictDoUpdate({
        target: organizations.slug,
        set: {
          name: 'Local demonstration organization',
          updatedAt: new Date(),
        },
      })
      .returning({ id: organizations.id });
    if (organization?.id !== DEMO_ORGANIZATION_ID) {
      throw new Error(
        'The local demo organization slug is owned by another row.',
      );
    }

    await transaction
      .insert(memberships)
      .values({
        id: DEMO_MEMBERSHIP_ID,
        organizationId: DEMO_ORGANIZATION_ID,
        userId: DEMO_USER_ID,
        role: 'demo_admin',
      })
      .onConflictDoUpdate({
        target: [memberships.organizationId, memberships.userId],
        set: { role: 'demo_admin' },
      });

    await transaction
      .insert(projects)
      .values({
        id: DEMO_PROJECT_ID,
        organizationId: DEMO_ORGANIZATION_ID,
        name: 'Community connectivity demonstration',
        description:
          'Synthetic sample project. Do not enter real applicant or site information.',
        projectTypeId: 'community-connectivity',
        status: 'draft',
        jurisdictionSchemaVersion: '1.0.0',
        jurisdictionId: 'bc-inspired-synthetic',
        jurisdictionReleaseVersion: '1.0.0',
        contentVersion: '1.0.0',
        ruleVersion: '1.0.0',
        guidanceVersion: '1.0.0',
      })
      .onConflictDoNothing({ target: projects.id });

    const [questionSet] = await transaction
      .select({ id: intakeQuestionSets.id })
      .from(intakeQuestionSets)
      .where(
        and(
          eq(intakeQuestionSets.jurisdictionId, 'bc-inspired-synthetic'),
          eq(intakeQuestionSets.releaseVersion, '1.0.0'),
          eq(intakeQuestionSets.questionSetId, 'bc-demo-land-intake'),
          eq(intakeQuestionSets.version, '1.0.0'),
        ),
      )
      .limit(1);
    if (!questionSet) {
      throw new Error(
        'Required reference data must be initialized before demo data.',
      );
    }

    await transaction
      .insert(projectIntakes)
      .values({
        id: DEMO_INTAKE_ID,
        organizationId: DEMO_ORGANIZATION_ID,
        projectId: DEMO_PROJECT_ID,
        questionSetId: questionSet.id,
        completeness: {
          requiredCount: 4,
          answeredRequiredCount: 0,
          missingRequiredQuestionIds: [
            'public-land-involved',
            'near-water-feature',
            'changes-road-access',
            'linear-corridor',
          ],
          unknownRequiredQuestionIds: [],
          isComplete: false,
        },
      })
      .onConflictDoNothing({
        target: [projectIntakes.projectId, projectIntakes.organizationId],
      });
  });
}
