import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const packageDirectory = process.cwd();
const manifestPath = path.join(packageDirectory, 'package.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const requiredScripts = ['build', 'dev', 'lint', 'test', 'typecheck'];

if (!manifest.name || manifest.private !== true) {
  throw new Error(
    `${manifestPath} must define a name and remain private at scaffold stage.`,
  );
}

for (const script of requiredScripts) {
  if (!manifest.scripts?.[script]) {
    throw new Error(`${manifest.name} is missing its ${script} script.`);
  }
}

await access(path.join(packageDirectory, 'src', 'index.ts'));
await access(path.join(packageDirectory, 'tsconfig.json'));

console.log(`${manifest.name}: package boundary is valid.`);
