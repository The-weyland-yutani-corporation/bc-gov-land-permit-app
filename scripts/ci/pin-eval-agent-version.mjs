import { readFile, writeFile } from 'node:fs/promises';
import { parseDocument } from 'yaml';

const [sourceFile, outputFile, version] = process.argv.slice(2);
if (!sourceFile || !outputFile || !version) {
  throw new Error(
    'Usage: node scripts/ci/pin-eval-agent-version.mjs <source> <output> <version>',
  );
}

const document = parseDocument(await readFile(sourceFile, 'utf8'));
if (document.errors.length > 0) {
  throw new Error(
    `Unable to parse ${sourceFile}: ${document.errors.map(String).join('; ')}`,
  );
}

const agent = document.get('agent', true);
if (!agent || typeof agent.get('name') !== 'string') {
  throw new Error(`${sourceFile} does not define an agent target.`);
}

document.setIn(['agent', 'version'], String(version));
await writeFile(outputFile, document.toString());
console.log(`Pinned evaluation target to agent version ${version}.`);
