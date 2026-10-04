import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  GuidanceSourceManifestSchema,
  type GuidanceManifestSource,
  type GuidanceSourceManifest,
} from '@permit-readiness/contracts';
import {
  GuidanceSearchDocumentSchema,
  type EmbeddingProvider,
  type GuidanceSearchDocument,
} from './schema.js';
import { sanitizeRetrievedText } from './safety.js';

export const GUIDANCE_INDEX_OWNER = 'permit-readiness-guidance';

export interface ChunkOptions {
  readonly maxCharacters?: number;
  readonly overlapCharacters?: number;
}

export interface GuidanceDocumentStore {
  listManagedDocuments(
    releaseId: string,
  ): Promise<readonly ManagedGuidanceDocument[]>;
  mergeOrUpload(documents: readonly GuidanceSearchDocument[]): Promise<void>;
  delete(ids: readonly string[]): Promise<void>;
}

export interface ManagedGuidanceDocument {
  readonly id: string;
  readonly indexOwner?: string;
  readonly manifestSchemaVersion?: string;
  readonly releaseVersion?: string;
  readonly jurisdictionId?: string;
}

export interface SynchronizeGuidanceOptions {
  readonly indexOwner?: string;
  readonly acceptedExistingReleaseVersions?: readonly string[];
}

export interface BuildDocumentsOptions extends ChunkOptions {
  readonly baseDirectory?: string;
  readonly fetchImplementation?: typeof fetch;
  readonly embeddingProvider?: EmbeddingProvider;
}

export function normalizeGuidanceContent(
  value: string,
  mediaType = 'text/markdown',
): string {
  const withoutMarkup =
    mediaType === 'text/html'
      ? value
          .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, '\n')
      : value;
  return withoutMarkup
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function hashContent(content: string): string {
  return `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

export function deterministicChunkId(
  sourceId: string,
  sourceVersion: string,
  contentHash: string,
  chunkIndex: number,
): string {
  return createHash('sha256')
    .update(`${sourceId}\n${sourceVersion}\n${contentHash}\n${chunkIndex}`)
    .digest('hex');
}

export function chunkGuidance(
  content: string,
  options: ChunkOptions = {},
): { heading: string; content: string }[] {
  const maxCharacters = options.maxCharacters ?? 1_200;
  const overlapCharacters = options.overlapCharacters ?? 160;
  if (
    maxCharacters < 200 ||
    overlapCharacters < 0 ||
    overlapCharacters >= maxCharacters
  ) {
    throw new Error('Invalid guidance chunk settings.');
  }
  const normalized = normalizeGuidanceContent(content);
  const sections: { heading: string; body: string }[] = [];
  let heading = 'Overview';
  let body: string[] = [];
  const flush = () => {
    const value = body.join('\n').trim();
    if (value) sections.push({ heading, body: value });
    body = [];
  };
  for (const line of normalized.split('\n')) {
    const match = /^#{1,6}\s+(.+)$/.exec(line);
    if (match) {
      flush();
      heading = match[1]!.trim().slice(0, 300);
    } else {
      body.push(line);
    }
  }
  flush();
  if (sections.length === 0 && normalized) {
    sections.push({ heading: 'Overview', body: normalized });
  }

  const chunks: { heading: string; content: string }[] = [];
  for (const section of sections) {
    let remaining = section.body;
    while (remaining.length > maxCharacters) {
      let split = remaining.lastIndexOf('\n\n', maxCharacters);
      if (split < Math.floor(maxCharacters * 0.5)) {
        split = remaining.lastIndexOf('. ', maxCharacters);
        if (split >= 0) split += 1;
      }
      if (split < Math.floor(maxCharacters * 0.5)) split = maxCharacters;
      const value = remaining.slice(0, split).trim();
      chunks.push({ heading: section.heading, content: value });
      const overlapStart = Math.max(0, split - overlapCharacters);
      remaining = remaining.slice(overlapStart).trim();
    }
    if (remaining)
      chunks.push({ heading: section.heading, content: remaining });
  }
  return chunks;
}

async function readSource(
  source: GuidanceManifestSource,
  options: BuildDocumentsOptions,
): Promise<string> {
  if (source.content.kind === 'inline') return source.content.value;
  if (source.content.kind === 'file') {
    const base = path.resolve(options.baseDirectory ?? process.cwd());
    const target = path.resolve(base, source.content.value);
    if (!target.startsWith(`${base}${path.sep}`)) {
      throw new Error(
        `Guidance source ${source.id} escapes its base directory.`,
      );
    }
    return readFile(target, 'utf8');
  }
  const sourceUrl = new URL(source.content.value);
  const canonicalUrl = new URL(source.canonicalUrl);
  if (sourceUrl.hostname !== canonicalUrl.hostname) {
    throw new Error(
      `Remote content host for ${source.id} must match its canonical host.`,
    );
  }
  const response = await (options.fetchImplementation ?? fetch)(sourceUrl, {
    redirect: 'error',
    headers: { accept: source.content.mediaType },
  });
  if (!response.ok) {
    throw new Error(
      `Guidance source ${source.id} returned HTTP ${response.status}.`,
    );
  }
  const text = await response.text();
  if (text.length > 2_000_000) {
    throw new Error(
      `Guidance source ${source.id} exceeds the ingestion limit.`,
    );
  }
  return text;
}

export async function buildSearchDocuments(
  input: unknown,
  options: BuildDocumentsOptions = {},
): Promise<GuidanceSearchDocument[]> {
  const manifest = GuidanceSourceManifestSchema.parse(input);
  const documents: GuidanceSearchDocument[] = [];
  for (const source of manifest.sources) {
    if (!source.allowedUsage.includes('grounding')) continue;
    const raw = await readSource(source, options);
    const normalized = normalizeGuidanceContent(raw, source.content.mediaType);
    if (hashContent(normalized) !== source.contentHash) {
      throw new Error(
        `Guidance source ${source.id} failed content hash validation.`,
      );
    }
    const chunks = chunkGuidance(normalized, options);
    const pending = chunks.map((chunk, chunkIndex) => {
      const safe = sanitizeRetrievedText(chunk.content);
      return GuidanceSearchDocumentSchema.parse({
        id: deterministicChunkId(
          source.id,
          source.version,
          source.contentHash,
          chunkIndex,
        ),
        indexOwner: GUIDANCE_INDEX_OWNER,
        manifestSchemaVersion: manifest.schemaVersion,
        sourceId: source.id,
        sourceVersion: source.version,
        releaseId: manifest.releaseId,
        releaseVersion: manifest.releaseVersion,
        jurisdictionId: source.jurisdictionId,
        projectTypeIds: source.projectTypeIds,
        title: source.title,
        authority: source.authority.name,
        canonicalUrl: source.canonicalUrl,
        content: safe.text,
        heading: chunk.heading,
        chunkIndex,
        chunkCount: chunks.length,
        contentHash: source.contentHash,
        effectiveFrom: source.effectiveFrom,
        effectiveTo: source.effectiveTo,
        reviewedAt: source.reviewedAt,
        nextReviewAt: source.nextReviewAt,
        tags: source.tags,
        allowedUsage: source.allowedUsage,
        synthetic: source.synthetic,
        safetyFlag: safe.flagged,
        safetyReasons: safe.reasons,
      });
    });
    if (options.embeddingProvider && pending.length > 0) {
      const vectors = await options.embeddingProvider.embed(
        pending.map((document) => document.content),
      );
      if (vectors.length !== pending.length) {
        throw new Error(
          'Embedding provider returned an unexpected vector count.',
        );
      }
      pending.forEach((document, index) => {
        documents.push(
          GuidanceSearchDocumentSchema.parse({
            ...document,
            contentVector: vectors[index],
          }),
        );
      });
    } else {
      documents.push(...pending);
    }
  }
  return documents;
}

export async function synchronizeGuidanceDocuments(
  manifest: GuidanceSourceManifest,
  documents: readonly GuidanceSearchDocument[],
  store: GuidanceDocumentStore,
  options: SynchronizeGuidanceOptions = {},
): Promise<{ uploaded: number; deleted: number }> {
  const indexOwner = options.indexOwner ?? GUIDANCE_INDEX_OWNER;
  const acceptedVersions = new Set(
    options.acceptedExistingReleaseVersions ?? [manifest.releaseVersion],
  );
  if (!acceptedVersions.has(manifest.releaseVersion)) {
    throw new Error(
      `Accepted release versions must include ${manifest.releaseVersion}.`,
    );
  }
  if (
    documents.some(
      (document) =>
        document.indexOwner !== indexOwner ||
        document.manifestSchemaVersion !== manifest.schemaVersion ||
        document.releaseId !== manifest.releaseId ||
        document.releaseVersion !== manifest.releaseVersion ||
        document.jurisdictionId !== manifest.jurisdictionId,
    )
  ) {
    throw new Error(
      'Guidance documents do not match the approved manifest ownership and version.',
    );
  }
  const existing = await store.listManagedDocuments(manifest.releaseId);
  for (const document of existing) {
    if (
      document.indexOwner !== indexOwner ||
      document.manifestSchemaVersion !== manifest.schemaVersion ||
      document.jurisdictionId !== manifest.jurisdictionId ||
      !document.releaseVersion ||
      !acceptedVersions.has(document.releaseVersion)
    ) {
      throw new Error(
        `Refusing to replace unowned or unapproved guidance document ${document.id}.`,
      );
    }
  }
  await store.mergeOrUpload(documents);
  const current = new Set(documents.map((document) => document.id));
  const stale = existing
    .map((document) => document.id)
    .filter((id) => !current.has(id));
  if (stale.length > 0) await store.delete(stale);
  return { uploaded: documents.length, deleted: stale.length };
}
