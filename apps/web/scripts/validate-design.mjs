import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const files = {
  landing: await readFile(path.join(root, 'src/app/page.tsx'), 'utf8'),
  chrome: await readFile(
    path.join(root, 'src/components/site-chrome.tsx'),
    'utf8',
  ),
  shell: await readFile(
    path.join(root, 'src/app/projects/[projectId]/page.tsx'),
    'utf8',
  ),
  tokens: await readFile(path.join(root, 'src/styles/tokens.css'), 'utf8'),
  styles: await readFile(path.join(root, 'src/styles/site.css'), 'utf8'),
};

const requiredLandingCopy = [
  'How the service works',
  'Housing',
  'Electrification',
  'Connectivity',
  'not a permit decision',
];

for (const phrase of requiredLandingCopy) {
  if (!files.landing.includes(phrase)) {
    throw new Error(`Landing page is missing required content: ${phrase}`);
  }
}

for (const phrase of [
  'Demonstration — not an official government service',
  'data-brand-placeholder',
  'href="#main-content"',
]) {
  if (!files.chrome.includes(phrase)) {
    throw new Error(`Shared chrome is missing required content: ${phrase}`);
  }
}

for (const landmark of ['<header', '<main', '<footer']) {
  const combined = `${files.chrome}\n${files.landing}`;
  if (!combined.includes(landmark)) {
    throw new Error(`Application is missing semantic landmark ${landmark}.`);
  }
}

if (!files.tokens.includes('--color-brand-blue: #234075')) {
  throw new Error('The documented B.C. corporate blue token is missing.');
}

if (!files.tokens.includes('--color-brand-gold: #e3a82b')) {
  throw new Error('The documented B.C. corporate gold token is missing.');
}

if (/linear-gradient|radial-gradient|backdrop-filter/.test(files.styles)) {
  throw new Error('Disallowed decorative treatment detected.');
}

console.log('Web application design validation passed.');
