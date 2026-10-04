import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateInfrastructure } from './validate-infra.mjs';

const root = process.cwd();
const requiredRootFiles = [
  '.editorconfig',
  '.gitignore',
  '.prettierignore',
  '.prettierrc.json',
  'AGENTS.md',
  'ARCHITECTURE.md',
  'DESIGN.md',
  'PRODUCT.md',
  'README.md',
  'package.json',
  'pnpm-workspace.yaml',
  'tsconfig.base.json',
  'turbo.json',
];
const workspaces = [
  'apps/permit-readiness-agent',
  'apps/web',
  'packages/contracts',
  'packages/db',
  'packages/domain',
  'packages/jurisdiction-config',
  'packages/observability',
  'packages/test-utils',
  'packages/ui',
];
const localGuidance = [
  'apps/permit-readiness-agent/AGENTS.md',
  'apps/web/AGENTS.md',
  'packages/contracts/AGENTS.md',
  'packages/db/AGENTS.md',
  'infra/AGENTS.md',
];
const requiredScripts = [
  'build',
  'dev',
  'format',
  'format:check',
  'lint',
  'test',
  'typecheck',
  'validate',
];

for (const file of [...requiredRootFiles, ...localGuidance]) {
  await access(path.join(root, file));
}

const rootManifest = JSON.parse(
  await readFile(path.join(root, 'package.json'), 'utf8'),
);

for (const script of requiredScripts) {
  if (!rootManifest.scripts?.[script]) {
    throw new Error(`Root package is missing its ${script} script.`);
  }
}

for (const workspace of workspaces) {
  const manifestPath = path.join(root, workspace, 'package.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  if (!manifest.name?.startsWith('@permit-readiness/')) {
    throw new Error(`${workspace} has an invalid workspace package name.`);
  }
}

console.log(
  `Repository scaffold is valid (${workspaces.length} workspaces checked).`,
);

await validateInfrastructure(root);
