import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  AzureGuidanceSearchBackend,
  FoundryEmbeddingProvider,
  InMemoryGuidanceSearchBackend,
  PermitGuidanceSearchService,
  buildSearchDocuments,
} from '@permit-readiness/guidance-search';
import type { AgentConfiguration } from './config.js';
import type { GuidanceSearch } from './tools.js';

export async function createConfiguredGuidanceSearch(
  configuration: AgentConfiguration,
): Promise<GuidanceSearch | undefined> {
  if (configuration.GUIDANCE_SEARCH_MODE === 'disabled') return undefined;

  const embeddingProvider = configuration.FOUNDRY_EMBEDDING_MODEL
    ? new FoundryEmbeddingProvider(
        configuration.FOUNDRY_PROJECT_ENDPOINT,
        configuration.FOUNDRY_EMBEDDING_MODEL,
      )
    : undefined;

  if (configuration.GUIDANCE_SEARCH_MODE === 'azure') {
    return new PermitGuidanceSearchService(
      new AzureGuidanceSearchBackend(
        configuration.AZURE_SEARCH_ENDPOINT!,
        configuration.AZURE_SEARCH_INDEX_NAME,
      ),
      {
        minimumScore: configuration.GUIDANCE_SEARCH_MIN_SCORE,
        embeddingProvider,
      },
    );
  }

  const manifestPath = path.resolve(configuration.GUIDANCE_MANIFEST_PATH!);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as unknown;
  const documents = await buildSearchDocuments(manifest, {
    baseDirectory: path.dirname(manifestPath),
    embeddingProvider,
  });
  return new PermitGuidanceSearchService(
    new InMemoryGuidanceSearchBackend(documents),
    { minimumScore: configuration.GUIDANCE_SEARCH_MIN_SCORE },
  );
}
