import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const agentRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')),
  '..',
  '..',
);

export const datasetPaths = [
  '.foundry/datasets/smoke/v1.0.0/permit-readiness-smoke.jsonl',
  '.foundry/datasets/regression/v1.0.0/permit-readiness-regression.jsonl',
];

export async function normalizeDatasets({ check = false } = {}) {
  const stale = [];
  for (const relativePath of datasetPaths) {
    const filePath = path.join(agentRoot, ...relativePath.split('/'));
    const rows = (await readFile(filePath, 'utf8'))
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line, index) => {
        try {
          return JSON.parse(line);
        } catch (error) {
          throw new Error(`${relativePath}:${index + 1}: ${error.message}`);
        }
      });
    const normalized = `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`;
    const current = await readFile(filePath, 'utf8');
    if (current !== normalized) {
      if (check) stale.push(relativePath);
      else await writeFile(filePath, normalized);
    }
    console.log(`${relativePath}: ${rows.length} cases`);
  }
  if (stale.length > 0) {
    throw new Error(
      `Evaluation datasets require normalization:\n${stale
        .map((file) => `- ${file}`)
        .join('\n')}\nRun pnpm eval:datasets.`,
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await normalizeDatasets({ check: process.argv.includes('--check') });
}
