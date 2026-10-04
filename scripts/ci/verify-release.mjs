import {
  appendOutputs,
  normalizedEntries,
  readJson,
  stableAgentVersion,
  stableAppRevision,
  visit,
} from './release-json.mjs';

async function emitMetadata(metadataFile, candidateFile) {
  const metadata = await readJson(metadataFile);
  if (
    metadata.schemaVersion !== 1 ||
    !metadata.stableAgentVersion ||
    !metadata.stableAppRevision
  ) {
    throw new Error(`${metadataFile} is not valid rollback metadata.`);
  }
  const outputs = {
    stable_agent_version: metadata.stableAgentVersion,
    stable_app_revision: metadata.stableAppRevision,
  };
  if (candidateFile) {
    const candidate = await readJson(candidateFile);
    if (
      candidate.schemaVersion !== 1 ||
      !candidate.agentVersion ||
      !candidate.appRevision ||
      !candidate.appRevisionUri
    ) {
      throw new Error(`${candidateFile} is not valid candidate metadata.`);
    }
    Object.assign(outputs, {
      candidate_agent_version: candidate.agentVersion,
      candidate_app_revision: candidate.appRevision,
      candidate_web_uri: candidate.appRevisionUri,
    });
  }
  await appendOutputs(outputs);
  console.log('Validated release metadata.');
}

async function verifyEval(resultsFile, expectedVersion) {
  const results = await readJson(resultsFile);
  const versions = new Set();
  visit(results, (value, path) => {
    const entries = normalizedEntries(value);
    const explicit = entries.get('agentversion');
    if (typeof explicit === 'string' || typeof explicit === 'number') {
      versions.add(String(explicit));
    }
    const agent = entries.get('agent');
    if (agent && typeof agent === 'object' && !Array.isArray(agent)) {
      const version = normalizedEntries(agent).get('version');
      if (typeof version === 'string' || typeof version === 'number') {
        versions.add(String(version));
      }
    }
    if (path.some((entry) => String(entry).toLowerCase().includes('agent'))) {
      const version = entries.get('version');
      if (typeof version === 'string' || typeof version === 'number') {
        versions.add(String(version));
      }
    }
  });
  if (!versions.has(String(expectedVersion))) {
    throw new Error(
      `Evaluation did not identify agent version ${expectedVersion}; found ${JSON.stringify(
        [...versions],
      )}.`,
    );
  }
  console.log(`Evaluation targeted agent version ${expectedVersion}.`);
}

const [command, ...args] = process.argv.slice(2);
if (command === 'agent-route') {
  stableAgentVersion(await readJson(args[0]), args[1]);
  console.log(`Agent routing is pinned to version ${args[1]}.`);
} else if (command === 'app-route') {
  stableAppRevision(await readJson(args[0]), args[1]);
  console.log(`App traffic is pinned to revision ${args[1]}.`);
} else if (command === 'eval') {
  await verifyEval(args[0], args[1]);
} else if (command === 'metadata') {
  await emitMetadata(args[0], args[1]);
} else {
  throw new Error(
    'Usage: verify-release.mjs <agent-route|app-route|eval|metadata> ...',
  );
}
