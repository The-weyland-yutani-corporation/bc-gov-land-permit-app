import { AIProjectClient } from '@azure/ai-projects';
import { DefaultAzureCredential, type TokenCredential } from '@azure/identity';
import {
  SearchClient,
  SearchIndexClient,
  type SearchIndex,
} from '@azure/search-documents';
import type { GuidanceDocumentStore } from './ingestion.js';
import type {
  EmbeddingProvider,
  GuidanceSearchBackend,
  GuidanceSearchDocument,
  SearchHit,
  SearchQuery,
} from './schema.js';

export const DEFAULT_VECTOR_DIMENSIONS = 1_536;
export const GUIDANCE_SEMANTIC_CONFIGURATION = 'permit-guidance-semantic';
export const GUIDANCE_VECTOR_PROFILE = 'permit-guidance-vector-profile';

export function createGuidanceSearchIndex(
  indexName: string,
  vectorDimensions = DEFAULT_VECTOR_DIMENSIONS,
): SearchIndex {
  return {
    name: indexName,
    fields: [
      { name: 'id', type: 'Edm.String', key: true, filterable: true },
      { name: 'indexOwner', type: 'Edm.String', filterable: true },
      {
        name: 'manifestSchemaVersion',
        type: 'Edm.String',
        filterable: true,
      },
      {
        name: 'sourceId',
        type: 'Edm.String',
        filterable: true,
        facetable: true,
      },
      { name: 'sourceVersion', type: 'Edm.String', filterable: true },
      { name: 'releaseId', type: 'Edm.String', filterable: true },
      { name: 'releaseVersion', type: 'Edm.String', filterable: true },
      {
        name: 'jurisdictionId',
        type: 'Edm.String',
        filterable: true,
        facetable: true,
      },
      {
        name: 'projectTypeIds',
        type: 'Collection(Edm.String)',
        filterable: true,
        facetable: true,
      },
      { name: 'title', type: 'Edm.String', searchable: true },
      {
        name: 'authority',
        type: 'Edm.String',
        searchable: true,
        filterable: true,
      },
      { name: 'canonicalUrl', type: 'Edm.String', filterable: true },
      { name: 'content', type: 'Edm.String', searchable: true },
      { name: 'heading', type: 'Edm.String', searchable: true },
      { name: 'chunkIndex', type: 'Edm.Int32', sortable: true },
      { name: 'chunkCount', type: 'Edm.Int32' },
      { name: 'contentHash', type: 'Edm.String', filterable: true },
      { name: 'effectiveFrom', type: 'Edm.String', filterable: true },
      { name: 'effectiveTo', type: 'Edm.String', filterable: true },
      {
        name: 'reviewedAt',
        type: 'Edm.String',
        filterable: true,
        sortable: true,
      },
      {
        name: 'nextReviewAt',
        type: 'Edm.String',
        filterable: true,
        sortable: true,
      },
      {
        name: 'tags',
        type: 'Collection(Edm.String)',
        searchable: true,
        filterable: true,
        facetable: true,
      },
      {
        name: 'allowedUsage',
        type: 'Collection(Edm.String)',
        filterable: true,
      },
      { name: 'synthetic', type: 'Edm.Boolean', filterable: true },
      { name: 'safetyFlag', type: 'Edm.Boolean', filterable: true },
      {
        name: 'safetyReasons',
        type: 'Collection(Edm.String)',
        filterable: true,
      },
      {
        name: 'contentVector',
        type: 'Collection(Edm.Single)',
        searchable: true,
        vectorSearchDimensions: vectorDimensions,
        vectorSearchProfileName: GUIDANCE_VECTOR_PROFILE,
      },
    ],
    vectorSearch: {
      algorithms: [
        {
          name: 'permit-guidance-hnsw',
          kind: 'hnsw',
          parameters: {
            metric: 'cosine',
            m: 4,
            efConstruction: 400,
            efSearch: 500,
          },
        },
      ],
      profiles: [
        {
          name: GUIDANCE_VECTOR_PROFILE,
          algorithmConfigurationName: 'permit-guidance-hnsw',
        },
      ],
    },
    semanticSearch: {
      configurations: [
        {
          name: GUIDANCE_SEMANTIC_CONFIGURATION,
          prioritizedFields: {
            titleField: { name: 'title' },
            contentFields: [{ name: 'content' }],
            keywordsFields: [{ name: 'tags' }, { name: 'heading' }],
          },
        },
      ],
    },
  };
}

function escapeFilter(value: string): string {
  return value.replace(/'/g, "''");
}

function filterFor(query: SearchQuery): string {
  const clauses = [
    `jurisdictionId eq '${escapeFilter(query.jurisdictionId)}'`,
    `(not projectTypeIds/any() or projectTypeIds/any(p: p eq '${escapeFilter(query.projectTypeId)}'))`,
    `allowedUsage/any(u: u eq 'grounding')`,
  ];
  if (query.sourceIds.length > 0) {
    clauses.push(
      `search.in(sourceId, '${query.sourceIds.map(escapeFilter).join(',')}', ',')`,
    );
  }
  return clauses.join(' and ');
}

export class AzureGuidanceSearchBackend implements GuidanceSearchBackend {
  private readonly client: SearchClient<GuidanceSearchDocument>;

  constructor(
    endpoint: string,
    indexName: string,
    credential: TokenCredential = new DefaultAzureCredential(),
  ) {
    this.client = new SearchClient(endpoint, indexName, credential);
  }

  async search(query: SearchQuery): Promise<readonly SearchHit[]> {
    const vectorQueries = query.vector
      ? [
          {
            kind: 'vector' as const,
            vector: [...query.vector],
            kNearestNeighborsCount: Math.max(query.maxResults * 3, 10),
            fields: ['contentVector'] as const,
          },
        ]
      : undefined;
    const results = await this.client.search(query.query, {
      filter: filterFor(query),
      top: Math.max(query.maxResults * 3, 10),
      queryType: 'semantic',
      semanticSearchOptions: {
        configurationName: GUIDANCE_SEMANTIC_CONFIGURATION,
      },
      vectorSearchOptions: vectorQueries
        ? { queries: vectorQueries }
        : undefined,
      abortSignal: query.signal,
    });
    const hits: SearchHit[] = [];
    for await (const result of results.results) {
      const reranker = result.rerankerScore;
      hits.push({
        document: result.document,
        score:
          typeof reranker === 'number'
            ? Math.min(1, reranker / 4)
            : Math.min(1, result.score ?? 0),
      });
    }
    return hits.filter((hit) => hit.score >= query.minimumScore);
  }
}

export class AzureGuidanceDocumentStore implements GuidanceDocumentStore {
  private readonly search: SearchClient<GuidanceSearchDocument>;

  constructor(
    endpoint: string,
    indexName: string,
    credential: TokenCredential = new DefaultAzureCredential(),
  ) {
    this.search = new SearchClient(endpoint, indexName, credential);
  }

  async listManagedDocuments(releaseId: string) {
    const response = await this.search.search('*', {
      filter: `releaseId eq '${escapeFilter(releaseId)}'`,
      select: [
        'id',
        'indexOwner',
        'manifestSchemaVersion',
        'releaseVersion',
        'jurisdictionId',
      ],
    });
    const documents = [];
    for await (const result of response.results) {
      documents.push({
        id: result.document.id,
        indexOwner: result.document.indexOwner,
        manifestSchemaVersion: result.document.manifestSchemaVersion,
        releaseVersion: result.document.releaseVersion,
        jurisdictionId: result.document.jurisdictionId,
      });
    }
    return documents;
  }

  async mergeOrUpload(
    documents: readonly GuidanceSearchDocument[],
  ): Promise<void> {
    for (let offset = 0; offset < documents.length; offset += 500) {
      const batch = documents.slice(offset, offset + 500);
      const result = await this.search.mergeOrUploadDocuments(batch);
      const failed = result.results.filter((item) => !item.succeeded);
      if (failed.length > 0) {
        throw new Error(
          `Azure AI Search rejected ${failed.length} guidance documents.`,
        );
      }
    }
  }

  async delete(ids: readonly string[]): Promise<void> {
    for (let offset = 0; offset < ids.length; offset += 500) {
      const batch = ids.slice(offset, offset + 500);
      const result = await this.search.deleteDocuments('id', batch);
      const failed = result.results.filter((item) => !item.succeeded);
      if (failed.length > 0) {
        throw new Error(
          `Azure AI Search failed to delete ${failed.length} stale documents.`,
        );
      }
    }
  }
}

export async function createOrUpdateGuidanceIndex(
  endpoint: string,
  indexName: string,
  vectorDimensions = DEFAULT_VECTOR_DIMENSIONS,
  credential: TokenCredential = new DefaultAzureCredential(),
): Promise<void> {
  const client = new SearchIndexClient(endpoint, credential);
  await client.createOrUpdateIndex(
    createGuidanceSearchIndex(indexName, vectorDimensions),
  );
}

export class FoundryEmbeddingProvider implements EmbeddingProvider {
  private readonly openAI: ReturnType<AIProjectClient['getOpenAIClient']>;

  constructor(
    endpoint: string,
    private readonly model: string,
    credential: TokenCredential = new DefaultAzureCredential(),
  ) {
    this.openAI = new AIProjectClient(endpoint, credential).getOpenAIClient();
  }

  async embed(
    texts: readonly string[],
    signal?: AbortSignal,
  ): Promise<number[][]> {
    const result = await this.openAI.embeddings.create(
      { model: this.model, input: [...texts], encoding_format: 'float' },
      { signal },
    );
    return [...result.data]
      .sort((left, right) => left.index - right.index)
      .map((item) => item.embedding);
  }
}
