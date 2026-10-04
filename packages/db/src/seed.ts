import { and, eq } from 'drizzle-orm';
import type { Database } from './client.js';
import { serializePolygonToEwkt } from './geometry.js';
import {
  demoZones,
  guidanceSources,
  intakeQuestionSets,
  permitDependencies,
  permitRules,
  permitTypes,
} from './schema.js';
import { referenceDataPacks } from './seed-data.js';

export async function initializeReferenceData(
  database: Database,
): Promise<void> {
  await database.transaction(async (transaction) => {
    for (const pack of referenceDataPacks) {
      for (const questionSet of pack.questionSets) {
        await transaction
          .insert(intakeQuestionSets)
          .values({
            jurisdictionId: pack.jurisdictionId,
            releaseVersion: pack.releaseVersion,
            questionSetId: questionSet.id,
            version: questionSet.version,
            title: questionSet.title,
            description: questionSet.description,
            projectTypeIds: [...questionSet.projectTypeIds],
            questions: [...questionSet.questions],
          })
          .onConflictDoUpdate({
            target: [
              intakeQuestionSets.jurisdictionId,
              intakeQuestionSets.releaseVersion,
              intakeQuestionSets.questionSetId,
              intakeQuestionSets.version,
            ],
            set: {
              title: questionSet.title,
              description: questionSet.description,
              projectTypeIds: [...questionSet.projectTypeIds],
              questions: [...questionSet.questions],
            },
          });
      }

      for (const source of pack.guidanceSources) {
        await transaction
          .insert(guidanceSources)
          .values({
            jurisdictionId: pack.jurisdictionId,
            releaseVersion: pack.releaseVersion,
            guidanceVersion: source.version,
            sourceId: source.id,
            title: source.title,
            publisher: source.publisher,
            url: source.url,
            publishedAt: source.publishedAt,
            reviewedAt: source.reviewedAt,
            expiresAt: source.expiresAt,
            license: source.license,
            synthetic: source.synthetic,
            contentHash: source.contentHash,
          })
          .onConflictDoUpdate({
            target: [
              guidanceSources.jurisdictionId,
              guidanceSources.releaseVersion,
              guidanceSources.sourceId,
              guidanceSources.guidanceVersion,
            ],
            set: {
              title: source.title,
              publisher: source.publisher,
              url: source.url,
              publishedAt: source.publishedAt,
              reviewedAt: source.reviewedAt,
              expiresAt: source.expiresAt,
              license: source.license,
              synthetic: source.synthetic,
              contentHash: source.contentHash,
            },
          });
      }

      for (const permit of pack.permits) {
        await transaction
          .insert(permitTypes)
          .values({
            jurisdictionId: pack.jurisdictionId,
            releaseVersion: pack.releaseVersion,
            permitTypeId: permit.id,
            name: permit.name,
            kind: permit.kind,
            authorityName: permit.authorityName,
            authorityUrl: permit.authorityUrl,
            summary: permit.summary,
            guidanceSourceIds: [...permit.guidanceSourceIds],
          })
          .onConflictDoUpdate({
            target: [
              permitTypes.jurisdictionId,
              permitTypes.releaseVersion,
              permitTypes.permitTypeId,
            ],
            set: {
              name: permit.name,
              kind: permit.kind,
              authorityName: permit.authorityName,
              authorityUrl: permit.authorityUrl,
              summary: permit.summary,
              guidanceSourceIds: [...permit.guidanceSourceIds],
            },
          });
      }

      const permitRows = await transaction
        .select({
          id: permitTypes.id,
          permitTypeId: permitTypes.permitTypeId,
        })
        .from(permitTypes)
        .where(
          and(
            eq(permitTypes.jurisdictionId, pack.jurisdictionId),
            eq(permitTypes.releaseVersion, pack.releaseVersion),
          ),
        );
      const permitKeys = new Map(
        permitRows.map((permit) => [permit.permitTypeId, permit.id] as const),
      );

      for (const rule of pack.rules) {
        const permitTypeKey = permitKeys.get(rule.permitTypeId);
        if (!permitTypeKey) {
          throw new Error(`Seed rule references ${rule.permitTypeId}.`);
        }
        await transaction
          .insert(permitRules)
          .values({
            jurisdictionId: pack.jurisdictionId,
            releaseVersion: pack.releaseVersion,
            ruleVersion: rule.version,
            ruleId: rule.id,
            permitTypeKey,
            outcome: rule.outcome,
            explanation: rule.explanation,
            condition: rule.condition,
          })
          .onConflictDoUpdate({
            target: [
              permitRules.jurisdictionId,
              permitRules.releaseVersion,
              permitRules.ruleId,
            ],
            set: {
              ruleVersion: rule.version,
              permitTypeKey,
              outcome: rule.outcome,
              explanation: rule.explanation,
              condition: rule.condition,
            },
          });
      }

      for (const dependency of pack.dependencies) {
        const permitTypeKey = permitKeys.get(dependency.permitTypeId);
        const dependsOnPermitTypeKey = permitKeys.get(
          dependency.dependsOnPermitTypeId,
        );
        if (!permitTypeKey || !dependsOnPermitTypeKey) {
          throw new Error('Seed dependency references an unknown permit.');
        }
        await transaction
          .insert(permitDependencies)
          .values({
            jurisdictionId: pack.jurisdictionId,
            releaseVersion: pack.releaseVersion,
            permitTypeKey,
            dependsOnPermitTypeKey,
            relationship: dependency.relationship,
            explanation: dependency.explanation,
          })
          .onConflictDoUpdate({
            target: [
              permitDependencies.jurisdictionId,
              permitDependencies.releaseVersion,
              permitDependencies.permitTypeKey,
              permitDependencies.dependsOnPermitTypeKey,
            ],
            set: {
              relationship: dependency.relationship,
              explanation: dependency.explanation,
            },
          });
      }

      for (const zone of pack.zones) {
        await transaction
          .insert(demoZones)
          .values({
            jurisdictionId: pack.jurisdictionId,
            releaseVersion: pack.releaseVersion,
            zoneId: zone.id,
            name: zone.name,
            description: zone.description,
            geometry: serializePolygonToEwkt(zone.geometry),
            synthetic: true,
          })
          .onConflictDoUpdate({
            target: [
              demoZones.jurisdictionId,
              demoZones.releaseVersion,
              demoZones.zoneId,
            ],
            set: {
              name: zone.name,
              description: zone.description,
              geometry: serializePolygonToEwkt(zone.geometry),
              synthetic: true,
            },
          });
      }
    }
  });
}

/**
 * Backward-compatible alias. Deployments should call initializeReferenceData
 * through the db:initialize command.
 */
export const seedDatabase = initializeReferenceData;
