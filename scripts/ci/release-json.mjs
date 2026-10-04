import { readFile, writeFile } from 'node:fs/promises';

export const normalize = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export function visit(value, callback, path = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => visit(entry, callback, [...path, index]));
    return;
  }
  if (!value || typeof value !== 'object') return;
  callback(value, path);
  for (const [key, child] of Object.entries(value)) {
    visit(child, callback, [...path, key]);
  }
}

export function normalizedEntries(value) {
  const entries = new Map();
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return entries;
  for (const [key, child] of Object.entries(value)) {
    entries.set(normalize(key), child);
  }
  return entries;
}

export function agentRouteRules(document) {
  const rules = new Map();
  visit(document, (value) => {
    const entries = normalizedEntries(value);
    const version = entries.get('agentversion');
    const percentage = entries.get('trafficpercentage');
    if (
      (typeof version === 'string' || typeof version === 'number') &&
      Number.isFinite(Number(percentage))
    ) {
      const rule = {
        version: String(version),
        percentage: Number(percentage),
      };
      rules.set(`${rule.version}:${rule.percentage}`, rule);
    }
  });
  return [...rules.values()];
}

export function appTrafficRules(document) {
  const rules = new Map();
  visit(document, (value) => {
    const entries = normalizedEntries(value);
    const weight = entries.get('weight');
    const revisionName = entries.get('revisionname');
    const latestRevision = entries.get('latestrevision');
    if (
      Number.isFinite(Number(weight)) &&
      (typeof revisionName === 'string' || typeof latestRevision === 'boolean')
    ) {
      const rule = {
        revisionName:
          typeof revisionName === 'string' ? revisionName : undefined,
        latestRevision:
          typeof latestRevision === 'boolean' ? latestRevision : undefined,
        weight: Number(weight),
      };
      rules.set(JSON.stringify(rule), rule);
    }
  });
  return [...rules.values()];
}

export function agentVersions(document) {
  const versions = new Set();
  visit(document, (value) => {
    const entries = normalizedEntries(value);
    for (const key of ['agentversion', 'version']) {
      const candidate = entries.get(key);
      if (typeof candidate === 'string' || typeof candidate === 'number') {
        versions.add(String(candidate));
      }
    }
  });
  return versions;
}

export function revisionRecords(document) {
  const records = new Map();
  visit(document, (value) => {
    const entries = normalizedEntries(value);
    const properties = normalizedEntries(entries.get('properties'));
    const field = (name) => entries.get(name) ?? properties.get(name);
    const name = field('name') ?? field('revisionname');
    if (typeof name !== 'string' || !name.includes('--') || records.has(name)) {
      return;
    }
    records.set(name, {
      name,
      active: field('active'),
      fqdn: field('fqdn'),
      healthState: field('healthstate'),
      runningState: field('runningstate'),
    });
  });
  return records;
}

export function stableAgentVersion(document, expected) {
  const rules = agentRouteRules(document);
  if (
    rules.length !== 1 ||
    rules[0].percentage !== 100 ||
    (expected && rules[0].version !== expected)
  ) {
    throw new Error(`Ambiguous agent routing: ${JSON.stringify(rules)}.`);
  }
  return rules[0].version;
}

export function stableAppRevision(document, expected) {
  const rules = appTrafficRules(document);
  if (
    !expected &&
    rules.length === 1 &&
    rules[0].weight === 100 &&
    rules[0].latestRevision === true &&
    !rules[0].revisionName
  ) {
    const latestNames = new Set();
    visit(document, (value) => {
      const latest = normalizedEntries(value).get('latestrevisionname');
      if (typeof latest === 'string') latestNames.add(latest);
    });
    if (latestNames.size === 1) return [...latestNames][0];
  }
  if (
    rules.length !== 1 ||
    rules[0].weight !== 100 ||
    !rules[0].revisionName ||
    rules[0].latestRevision === true ||
    (expected && rules[0].revisionName !== expected)
  ) {
    throw new Error(
      `Ambiguous Container App traffic: ${JSON.stringify(rules)}.`,
    );
  }
  return rules[0].revisionName;
}

export async function readJson(fileName) {
  return JSON.parse(await readFile(fileName, 'utf8'));
}

export async function appendOutputs(outputs) {
  if (!process.env.GITHUB_OUTPUT) return;
  const body = Object.entries(outputs)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  await writeFile(process.env.GITHUB_OUTPUT, `${body}\n`, { flag: 'a' });
}
