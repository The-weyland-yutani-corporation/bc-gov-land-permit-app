import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('workspace exposes a named scaffold boundary', async () => {
  const packageDirectory = process.cwd();
  const manifest = JSON.parse(
    await readFile(path.join(packageDirectory, 'package.json'), 'utf8'),
  );
  const source = await readFile(
    path.join(packageDirectory, 'src', 'index.ts'),
    'utf8',
  );

  assert.match(manifest.name, /^@permit-readiness\//);
  assert.match(source, /workspaceBoundary/);
});
