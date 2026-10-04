import { writeFile } from 'node:fs/promises';
import {
  agentVersions,
  appendOutputs,
  readJson,
  revisionRecords,
  stableAgentVersion,
  stableAppRevision,
} from './release-json.mjs';

const [endpointFile, agentsFile, trafficFile, revisionsFile, outputFile] =
  process.argv.slice(2);
if (!outputFile) {
  throw new Error(
    'Usage: capture-release.mjs <endpoint> <agents> <traffic> <revisions> <output>',
  );
}

const [endpoint, agents, traffic, revisions] = await Promise.all([
  readJson(endpointFile),
  readJson(agentsFile),
  readJson(trafficFile),
  readJson(revisionsFile),
]);
const stableAgent = stableAgentVersion(endpoint);
const stableRevision = stableAppRevision(traffic);

if (!agentVersions(agents).has(stableAgent)) {
  throw new Error(`Routed agent version ${stableAgent} was not discovered.`);
}
if (!revisionRecords(revisions).has(stableRevision)) {
  throw new Error(`Routed app revision ${stableRevision} was not discovered.`);
}
await writeFile(
  outputFile,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      candidateCommit: process.env.CANDIDATE_COMMIT ?? process.env.GITHUB_SHA,
      agentName: process.env.AGENT_NAME ?? 'permit-readiness-agent',
      stableAgentVersion: stableAgent,
      stableAppRevision: stableRevision,
      stableAgentRouting: endpoint,
      stableAppTraffic: traffic,
    },
    null,
    2,
  )}\n`,
);
await appendOutputs({
  stable_agent_version: stableAgent,
  stable_app_revision: stableRevision,
});
console.log(
  `Captured stable agent ${stableAgent} and app revision ${stableRevision}.`,
);
