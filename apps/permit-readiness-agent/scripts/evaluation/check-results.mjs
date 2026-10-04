import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

function arg(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function metricName(value) {
  return String(value)
    .replace(/^builtin[._-]/i, '')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function rate(value) {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' && value >= 0 && value <= 1) return value;
  if (!value || typeof value !== 'object') return undefined;
  for (const key of ['pass_rate', 'passed_rate', 'value', 'mean', 'score']) {
    if (typeof value[key] === 'number' && value[key] >= 0 && value[key] <= 1) {
      return value[key];
    }
  }
  if (
    typeof value.passed === 'number' &&
    typeof value.total === 'number' &&
    value.total > 0
  ) {
    return value.passed / value.total;
  }
  if (typeof value.passed === 'boolean') return value.passed ? 1 : 0;
  if (String(value.label).toLowerCase() === 'pass') return 1;
  if (String(value.label).toLowerCase() === 'fail') return 0;
  return undefined;
}

function addContainer(metrics, container) {
  if (!container) return;
  const entries = Array.isArray(container)
    ? container.map((item) => [
        item?.metric ?? item?.name ?? item?.evaluator_name,
        item,
      ])
    : Object.entries(container);
  for (const [name, value] of entries) {
    const parsed = rate(value);
    if (name && parsed !== undefined) metrics.set(metricName(name), parsed);
  }
}

function parseResult(document) {
  const metrics = new Map();
  for (const container of [
    document.metrics,
    document.aggregate_metrics,
    document.summary?.metrics,
    document.summary?.aggregate_metrics,
    document.aggregate?.metrics,
  ]) {
    addContainer(metrics, container);
  }
  const rowMetrics = new Map();
  for (const row of document.results ?? []) {
    for (const container of [
      row.metrics,
      row.scores,
      row.evaluator_results,
      row.evaluation_results,
    ]) {
      const entries = Array.isArray(container)
        ? container.map((item) => [
            item?.metric ?? item?.name ?? item?.evaluator_name,
            item,
          ])
        : Object.entries(container ?? {});
      for (const [name, value] of entries) {
        const parsed = rate(value);
        if (!name || parsed === undefined) continue;
        const key = metricName(name);
        rowMetrics.set(key, [...(rowMetrics.get(key) ?? []), parsed]);
      }
    }
  }
  for (const [name, values] of rowMetrics) {
    if (!metrics.has(name)) {
      metrics.set(
        name,
        values.reduce((sum, value) => sum + value, 0) / values.length,
      );
    }
  }
  let overall;
  for (const candidate of [
    document.overall_pass_rate,
    document.pass_rate,
    document.summary?.overall_pass_rate,
    document.summary?.pass_rate,
  ]) {
    overall ??= rate(candidate);
  }
  const summary = document.summary ?? {};
  if (
    overall === undefined &&
    typeof summary.passed === 'number' &&
    typeof summary.total === 'number' &&
    summary.total > 0
  ) {
    overall = summary.passed / summary.total;
  }
  return { overall, metrics };
}

async function load(file) {
  try {
    return JSON.parse(await readFile(path.resolve(file), 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read evaluation JSON ${file}: ${error.message}`);
  }
}

function check(current, profile) {
  const failures = [];
  if (current.overall === undefined)
    failures.push('Overall pass rate is missing.');
  else if (current.overall < profile.minimumOverallPassRate) {
    failures.push(
      `Overall ${current.overall.toFixed(3)} < ${profile.minimumOverallPassRate.toFixed(3)}.`,
    );
  }
  for (const [name, threshold] of Object.entries(profile.requiredMetrics)) {
    const actual = current.metrics.get(metricName(name));
    if (actual === undefined)
      failures.push(`Required metric ${name} is missing.`);
    else if (actual < threshold) {
      failures.push(`${name} ${actual.toFixed(3)} < ${threshold.toFixed(3)}.`);
    }
  }
  return failures;
}

function compare(current, baseline, maximumDrop) {
  const failures = [];
  if (current.overall === undefined || baseline.overall === undefined) {
    failures.push('Baseline comparison requires both overall pass rates.');
  } else if (baseline.overall - current.overall > maximumDrop) {
    failures.push('Overall pass rate exceeded the allowed regression drop.');
  }
  for (const [name, oldValue] of baseline.metrics) {
    const newValue = current.metrics.get(name);
    if (newValue === undefined) failures.push(`Current result omits ${name}.`);
    else if (oldValue - newValue > maximumDrop) {
      failures.push(`${name} exceeded the allowed regression drop.`);
    }
  }
  return failures;
}

const resultsFile = arg('--results');
const profileName = arg('--profile');
const baselineFile = arg('--baseline');
if (!resultsFile || !profileName) {
  throw new Error(
    'Usage: pnpm eval:check -- --results <results.json> --profile <smoke|regression> [--baseline <baseline.json>] [--require-baseline]',
  );
}
if (process.argv.includes('--require-baseline') && !baselineFile) {
  throw new Error('--require-baseline requires --baseline.');
}

const thresholds = JSON.parse(
  await readFile(
    path.join(root, '.foundry', 'suites', 'thresholds.json'),
    'utf8',
  ),
);
const profile = thresholds.profiles?.[profileName];
if (!profile) throw new Error(`Unknown threshold profile ${profileName}.`);
const current = parseResult(await load(resultsFile));
const failures = check(current, profile);
if (baselineFile) {
  failures.push(
    ...compare(
      current,
      parseResult(await load(baselineFile)),
      profile.maximumRegressionDrop,
    ),
  );
}
if (failures.length) {
  console.error(`Foundry evaluation gate failed (${profileName}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Foundry evaluation gate passed (${profileName}).`);
}
