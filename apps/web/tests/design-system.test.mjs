import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

const read = (file) => readFile(path.join(root, file), 'utf8');

const luminance = (hex) => {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((channel) => {
      const value = Number.parseInt(channel, 16) / 255;
      return value <= 0.03928
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrast = (foreground, background) => {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};

test('core colour pairings meet WCAG AA contrast', () => {
  assert.ok(contrast('#ffffff', '#234075') >= 4.5);
  assert.ok(contrast('#ffffff', '#1a3058') >= 4.5);
  assert.ok(contrast('#313132', '#ffffff') >= 4.5);
  assert.ok(contrast('#1a5a96', '#ffffff') >= 4.5);
});

test('canonical surfaces preserve demo and asset safeguards', async () => {
  const landing = await read('src/site/index.html');
  const shell = await read('src/site/projects.html');

  for (const surface of [landing, shell]) {
    assert.match(surface, /Demonstration — not an official government service/);
    assert.match(surface, /data-brand-placeholder/);
    assert.doesNotMatch(surface, /<img[^>]+bc.?mark/i);
  }
});

test('interaction and motion safeguards are defined', async () => {
  const styles = await read('src/styles/site.css');

  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /min-height: 2\.75rem/);
});
