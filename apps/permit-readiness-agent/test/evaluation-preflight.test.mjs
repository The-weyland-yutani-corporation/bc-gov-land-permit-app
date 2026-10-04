import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import {
  createPassingCapture,
  evaluateCapturedRun,
} from '../scripts/evaluation/preflight-evaluators.mjs';
import { runPreflight } from '../scripts/evaluation/preflight.mjs';

const smokePath = path.join(
  process.cwd(),
  '.foundry',
  'datasets',
  'smoke',
  'v1.0.0',
  'permit-readiness-smoke.jsonl',
);

async function smokeCase(name) {
  const rows = (await readFile(smokePath, 'utf8'))
    .split(/\r?\n/)
    .filter(Boolean)
    .map(JSON.parse);
  return rows.find((row) => row.name === name);
}

test('Foundry evaluation assets pass deterministic local preflight', async () => {
  await runPreflight();
});

test('local evaluators reject missing citations, tools, and prohibited claims', async () => {
  const testCase = await smokeCase('land-trigger-with-citation');

  const missingCitation = structuredClone(createPassingCapture(testCase));
  missingCitation.response.citations = [];
  missingCitation.response.readinessReport.citations = [];
  assert.match(
    evaluateCapturedRun(testCase, missingCitation).join('\n'),
    /citation|schema/i,
  );

  const missingTool = structuredClone(createPassingCapture(testCase));
  missingTool.toolTrace = missingTool.toolTrace.filter(
    (entry) => entry.name !== 'evaluate_permit_triggers',
  );
  assert.match(
    evaluateCapturedRun(testCase, missingTool).join('\n'),
    /required successful tool call/i,
  );

  const unsafeClaim = structuredClone(createPassingCapture(testCase));
  unsafeClaim.response.content = `Your project is approved. ${unsafeClaim.response.content}`;
  assert.match(
    evaluateCapturedRun(testCase, unsafeClaim).join('\n'),
    /prohibited claim/i,
  );
});

test('local evaluators reject permit drift and cross-scope tool traces', async () => {
  const testCase = await smokeCase('land-trigger-with-citation');
  const capture = structuredClone(createPassingCapture(testCase));
  capture.response.readinessReport.recommendations[0].permitTypeId =
    'invented-permit';
  capture.toolTrace[0].arguments.projectId =
    '99999999-9999-4999-8999-999999999999';
  const errors = evaluateCapturedRun(testCase, capture).join('\n');
  assert.match(errors, /expected permits/i);
  assert.match(errors, /out-of-scope projectId/i);
});

test('cloud result gate fails closed for missing metrics', async () => {
  const cacheDirectory = path.join(
    process.cwd(),
    '.foundry',
    'cache',
    'evaluation-test',
  );
  await mkdir(cacheDirectory, { recursive: true });
  const passingPath = path.join(cacheDirectory, 'passing.json');
  const failingPath = path.join(cacheDirectory, 'failing.json');
  const metrics = {
    relevance: 1,
    task_adherence: 1,
    intent_resolution: 1,
    indirect_attack: 1,
    tool_call_accuracy: 1,
    permit_recommendation_completeness: 1,
    uncertainty_citation: 1,
  };
  await writeFile(
    passingPath,
    JSON.stringify({ summary: { pass_rate: 1, metrics } }),
  );
  await writeFile(
    failingPath,
    JSON.stringify({
      summary: {
        pass_rate: 1,
        metrics: { ...metrics, indirect_attack: undefined },
      },
    }),
  );
  try {
    const script = path.join(
      process.cwd(),
      'scripts',
      'evaluation',
      'check-results.mjs',
    );
    const passing = spawnSync(
      process.execPath,
      [script, '--results', passingPath, '--profile', 'smoke'],
      { encoding: 'utf8' },
    );
    assert.equal(passing.status, 0, passing.stderr);
    const failing = spawnSync(
      process.execPath,
      [script, '--results', failingPath, '--profile', 'smoke'],
      { encoding: 'utf8' },
    );
    assert.notEqual(failing.status, 0);
    assert.match(failing.stderr, /indirect_attack is missing/i);
  } finally {
    await rm(cacheDirectory, { recursive: true, force: true });
  }
});
