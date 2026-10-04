import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  GuidanceSourceManifestSchema,
  type GuidanceSourceManifest,
} from '@permit-readiness/contracts';
import { z } from 'zod';
import { GUIDANCE_INDEX_OWNER } from './ingestion.js';

const VersionSchema = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);

const CatalogSchema = z
  .object({
    schemaVersion: z.literal('1.0.0'),
    catalogVersion: VersionSchema,
    indexOwner: z.literal(GUIDANCE_INDEX_OWNER),
    manifests: z
      .array(
        z
          .object({
            path: z.string().min(1).max(500),
            releaseId: z.string().min(2).max(80),
            releaseVersion: VersionSchema,
            jurisdictionId: z.string().min(2).max(80),
            acceptedExistingReleaseVersions: z
              .array(VersionSchema)
              .min(1)
              .max(20),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict()
  .superRefine((catalog, context) => {
    const releaseIds = new Set<string>();
    catalog.manifests.forEach((entry, index) => {
      if (releaseIds.has(entry.releaseId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['manifests', index, 'releaseId'],
          message: 'Catalog release identifiers must be unique.',
        });
      }
      releaseIds.add(entry.releaseId);
      if (
        !entry.acceptedExistingReleaseVersions.includes(entry.releaseVersion)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['manifests', index, 'acceptedExistingReleaseVersions'],
          message: 'The current release version must be explicitly accepted.',
        });
      }
    });
  });

export interface LoadedGuidanceCatalogEntry {
  readonly manifestPath: string;
  readonly manifest: GuidanceSourceManifest;
  readonly acceptedExistingReleaseVersions: readonly string[];
}

export interface LoadedGuidanceCatalog {
  readonly catalogVersion: string;
  readonly indexOwner: string;
  readonly entries: readonly LoadedGuidanceCatalogEntry[];
}

export async function loadGuidanceDeploymentCatalog(
  catalogPath: string,
): Promise<LoadedGuidanceCatalog> {
  const absoluteCatalogPath = path.resolve(catalogPath);
  const baseDirectory = path.dirname(absoluteCatalogPath);
  const catalog = CatalogSchema.parse(
    JSON.parse(await readFile(absoluteCatalogPath, 'utf8')),
  );
  const entries = await Promise.all(
    catalog.manifests.map(async (entry) => {
      const manifestPath = path.resolve(baseDirectory, entry.path);
      if (!manifestPath.startsWith(`${baseDirectory}${path.sep}`)) {
        throw new Error(`Guidance manifest ${entry.path} escapes the catalog.`);
      }
      const manifest = GuidanceSourceManifestSchema.parse(
        JSON.parse(await readFile(manifestPath, 'utf8')),
      );
      if (
        manifest.releaseId !== entry.releaseId ||
        manifest.releaseVersion !== entry.releaseVersion ||
        manifest.jurisdictionId !== entry.jurisdictionId
      ) {
        throw new Error(
          `Guidance manifest ${entry.path} does not match its approved catalog entry.`,
        );
      }
      return {
        manifestPath,
        manifest,
        acceptedExistingReleaseVersions: entry.acceptedExistingReleaseVersions,
      };
    }),
  );
  return {
    catalogVersion: catalog.catalogVersion,
    indexOwner: catalog.indexOwner,
    entries,
  };
}
