import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GuidanceSourceManifestSchema } from '@permit-readiness/contracts';
import {
  AzureGuidanceDocumentStore,
  FoundryEmbeddingProvider,
  createOrUpdateGuidanceIndex,
} from './azure.js';
import {
  buildSearchDocuments,
  GUIDANCE_INDEX_OWNER,
  synchronizeGuidanceDocuments,
} from './ingestion.js';
import { loadGuidanceDeploymentCatalog } from './catalog.js';
import { InMemoryGuidanceSearchBackend } from './search.js';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function readManifest(command: string | undefined) {
  const configuredPath = process.env.GUIDANCE_MANIFEST_PATH?.trim();
  const manifestPath = configuredPath
    ? path.resolve(process.env.INIT_CWD ?? process.cwd(), configuredPath)
    : command === 'local-test'
      ? fileURLToPath(
          new URL(
            '../corpus/generic-public-sector.manifest.json',
            import.meta.url,
          ),
        )
      : path.resolve(
          process.env.INIT_CWD ?? process.cwd(),
          required('GUIDANCE_MANIFEST_PATH'),
        );
  const manifest = GuidanceSourceManifestSchema.parse(
    JSON.parse(await readFile(manifestPath, 'utf8')),
  );
  return { manifest, manifestPath };
}

function embeddingProvider() {
  const model = process.env.FOUNDRY_EMBEDDING_MODEL?.trim();
  return model
    ? new FoundryEmbeddingProvider(required('FOUNDRY_PROJECT_ENDPOINT'), model)
    : undefined;
}

async function main() {
  const command = process.argv[2];
  if (command === 'initialize') {
    const catalogPath = path.resolve(
      process.env.INIT_CWD ?? process.cwd(),
      required('GUIDANCE_CATALOG_PATH'),
    );
    const endpoint = required('AZURE_SEARCH_ENDPOINT');
    const indexName =
      process.env.AZURE_SEARCH_INDEX_NAME ?? 'permit-guidance-v1';
    const catalog = await loadGuidanceDeploymentCatalog(catalogPath);
    await createOrUpdateGuidanceIndex(
      endpoint,
      indexName,
      Number(process.env.GUIDANCE_VECTOR_DIMENSIONS ?? '1536'),
    );
    for (const entry of catalog.entries) {
      const documents = await buildSearchDocuments(entry.manifest, {
        baseDirectory: path.dirname(entry.manifestPath),
        embeddingProvider: embeddingProvider(),
      });
      const result = await synchronizeGuidanceDocuments(
        entry.manifest,
        documents,
        new AzureGuidanceDocumentStore(endpoint, indexName),
        {
          indexOwner: catalog.indexOwner,
          acceptedExistingReleaseVersions:
            entry.acceptedExistingReleaseVersions,
        },
      );
      console.log(
        `${entry.manifest.releaseId}@${entry.manifest.releaseVersion}: ${result.uploaded} uploaded, ${result.deleted} stale deleted.`,
      );
    }
    console.log(`Guidance catalog ${catalog.catalogVersion} initialized.`);
    return;
  }
  if (command === 'create-index') {
    await createOrUpdateGuidanceIndex(
      required('AZURE_SEARCH_ENDPOINT'),
      process.env.AZURE_SEARCH_INDEX_NAME ?? 'permit-guidance-v1',
      Number(process.env.GUIDANCE_VECTOR_DIMENSIONS ?? '1536'),
    );
    console.log('Guidance search index is ready.');
    return;
  }
  const { manifest, manifestPath } = await readManifest(command);
  const documents = await buildSearchDocuments(manifest, {
    baseDirectory: path.dirname(manifestPath),
    embeddingProvider: embeddingProvider(),
  });
  if (command === 'ingest') {
    const store = new AzureGuidanceDocumentStore(
      required('AZURE_SEARCH_ENDPOINT'),
      process.env.AZURE_SEARCH_INDEX_NAME ?? 'permit-guidance-v1',
    );
    const result = await synchronizeGuidanceDocuments(
      manifest,
      documents,
      store,
      {
        indexOwner: GUIDANCE_INDEX_OWNER,
        acceptedExistingReleaseVersions: [manifest.releaseVersion],
      },
    );
    console.log(
      `Guidance refresh complete: ${result.uploaded} uploaded, ${result.deleted} stale deleted.`,
    );
    return;
  }
  if (command === 'local-test') {
    const backend = new InMemoryGuidanceSearchBackend(documents);
    const query = process.argv.slice(3).join(' ') || 'permit planning';
    const hits = await backend.search({
      query,
      jurisdictionId: manifest.jurisdictionId,
      projectTypeId: manifest.sources[0]!.projectTypeIds[0] ?? 'all-projects',
      sourceIds: [],
      maxResults: 5,
      minimumScore: 0.1,
    });
    console.log(
      JSON.stringify(
        hits.map((hit) => ({
          id: (hit.document as { id: string }).id,
          score: hit.score,
        })),
        null,
        2,
      ),
    );
    return;
  }
  throw new Error(
    'Usage: cli.js <initialize|create-index|ingest|local-test> [local query]',
  );
}

await main();
