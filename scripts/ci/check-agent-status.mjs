import { readFile } from 'node:fs/promises';

const [statusFile, expectedVersion] = process.argv.slice(2);
if (!statusFile || !expectedVersion) {
  throw new Error(
    'Usage: node scripts/ci/check-agent-status.mjs <status.json> <expected-version>',
  );
}

const document = JSON.parse(await readFile(statusFile, 'utf8'));
const versions = new Set();
const statuses = new Set();

function visit(value, key = '') {
  if (Array.isArray(value)) {
    value.forEach((entry) => visit(entry, key));
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [childKey, childValue] of Object.entries(value)) {
    const normalized = childKey.toLowerCase().replace(/[^a-z]/g, '');
    if (
      typeof childValue === 'string' &&
      (normalized === 'version' || normalized === 'agentversion')
    ) {
      versions.add(childValue);
    }
    if (
      typeof childValue === 'string' &&
      [
        'status',
        'state',
        'provisioningstate',
        'runtime state',
        'runtimestate',
      ].includes(normalized)
    ) {
      statuses.add(childValue.toLowerCase());
    }
    visit(childValue, childKey);
  }
}

visit(document);

if (!versions.has(expectedVersion)) {
  throw new Error(
    `Agent status did not report expected version ${expectedVersion}; found: ${
      [...versions].join(', ') || 'none'
    }.`,
  );
}

const healthyStatuses = new Set([
  'active',
  'available',
  'ready',
  'running',
  'succeeded',
]);
if (
  statuses.size === 0 ||
  ![...statuses].some((status) => healthyStatuses.has(status))
) {
  throw new Error(
    `Agent status is not healthy; found: ${[...statuses].join(', ') || 'none'}.`,
  );
}

console.log(
  `Hosted agent version ${expectedVersion} is healthy (${[...statuses].join(', ')}).`,
);
