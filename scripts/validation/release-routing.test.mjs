import assert from 'node:assert/strict';
import test from 'node:test';
import {
  agentVersions,
  revisionRecords,
  stableAgentVersion,
  stableAppRevision,
} from '../ci/release-json.mjs';

test('stable route discovery requires one explicit 100 percent target', () => {
  assert.equal(
    stableAgentVersion({
      agentEndpoint: {
        version_selection_rules: [
          { agent_version: '7', traffic_percentage: 100 },
        ],
      },
    }),
    '7',
  );
  assert.equal(
    stableAppRevision([{ revisionName: 'web--stable', weight: 100 }]),
    'web--stable',
  );
  assert.equal(
    stableAppRevision({
      traffic: [{ latestRevision: true, weight: 100 }],
      latestRevisionName: 'web--stable',
    }),
    'web--stable',
  );

  assert.throws(() =>
    stableAgentVersion({
      rules: [
        { agentVersion: '7', trafficPercentage: 90 },
        { agentVersion: '8', trafficPercentage: 10 },
      ],
    }),
  );
  assert.throws(() =>
    stableAppRevision([{ latestRevision: true, weight: 100 }]),
  );
});

test('candidate discovery helpers retain production versions and revisions', () => {
  assert.deepEqual(
    [...agentVersions({ versions: [{ version: '7' }, { version: '8' }] })],
    ['7', '8'],
  );

  const revisions = revisionRecords([
    {
      name: 'web--candidate',
      properties: {
        active: true,
        fqdn: 'web--candidate.example.test',
        healthState: 'Healthy',
        runningState: 'Running',
      },
    },
  ]);
  assert.deepEqual(revisions.get('web--candidate'), {
    name: 'web--candidate',
    active: true,
    fqdn: 'web--candidate.example.test',
    healthState: 'Healthy',
    runningState: 'Running',
  });
});
