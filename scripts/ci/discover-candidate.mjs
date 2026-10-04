import { writeFile } from 'node:fs/promises';
import {
  agentVersions,
  appendOutputs,
  normalize,
  readJson,
  revisionRecords,
} from './release-json.mjs';

const [
  beforeAgentsFile,
  afterAgentsFile,
  beforeRevisionsFile,
  afterRevisionsFile,
  outputFile,
  deployedVersion,
] = process.argv.slice(2);
if (!deployedVersion) {
  throw new Error(
    'Usage: discover-candidate.mjs <before-agents> <after-agents> <before-revisions> <after-revisions> <output> <deployed-version>',
  );
}

const [beforeAgents, afterAgents, beforeRevisions, afterRevisions] =
  await Promise.all([
    readJson(beforeAgentsFile),
    readJson(afterAgentsFile),
    readJson(beforeRevisionsFile),
    readJson(afterRevisionsFile),
  ]);

const beforeVersions = agentVersions(beforeAgents);
const newVersions = [...agentVersions(afterAgents)].filter(
  (version) => !beforeVersions.has(version),
);
if (newVersions.length !== 1 || newVersions[0] !== String(deployedVersion)) {
  throw new Error(
    `Expected one new production agent version ${deployedVersion}; found ${JSON.stringify(
      newVersions,
    )}.`,
  );
}

const beforeRevisionNames = new Set(revisionRecords(beforeRevisions).keys());
const newRevisions = [...revisionRecords(afterRevisions).values()].filter(
  ({ name }) => !beforeRevisionNames.has(name),
);
if (newRevisions.length !== 1) {
  throw new Error(
    `Expected one new Container App revision; found ${JSON.stringify(
      newRevisions.map(({ name }) => name),
    )}.`,
  );
}

const revision = newRevisions[0];
const health = normalize(revision.healthState ?? '');
const running = normalize(revision.runningState ?? '');
if (
  revision.active === false ||
  !revision.fqdn ||
  (health && !['healthy', 'none'].includes(health)) ||
  (running && !['running', 'runningatmaxscale'].includes(running))
) {
  throw new Error(
    `Candidate Container App revision is not testable: ${JSON.stringify(
      revision,
    )}.`,
  );
}

const candidate = {
  schemaVersion: 1,
  discoveredAt: new Date().toISOString(),
  candidateCommit: process.env.CANDIDATE_COMMIT ?? process.env.GITHUB_SHA,
  agentVersion: String(deployedVersion),
  appRevision: revision.name,
  appRevisionUri: `https://${revision.fqdn}`,
};
await writeFile(outputFile, `${JSON.stringify(candidate, null, 2)}\n`);
await appendOutputs({
  candidate_agent_version: candidate.agentVersion,
  candidate_app_revision: candidate.appRevision,
  candidate_web_uri: candidate.appRevisionUri,
});
console.log(
  `Discovered agent ${candidate.agentVersion} and app revision ${candidate.appRevision}.`,
);
