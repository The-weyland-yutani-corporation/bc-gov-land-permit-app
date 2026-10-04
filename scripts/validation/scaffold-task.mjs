import { readFile } from 'node:fs/promises';
import path from 'node:path';

const [task = 'dev'] = process.argv.slice(2);
const manifest = JSON.parse(
  await readFile(path.join(process.cwd(), 'package.json'), 'utf8'),
);

console.log(
  `${manifest.name}: ${task} has no runtime implementation at scaffold stage.`,
);
