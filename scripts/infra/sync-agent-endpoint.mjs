import { spawnSync } from 'node:child_process';

const endpointEntry = Object.entries(process.env).find(
  ([name, value]) =>
    /^AGENT_PERMIT_READINESS_AGENT_RESPONSES_ENDPOINT$/.test(name) &&
    value?.startsWith('https://'),
);
const resourceGroup = process.env.AZURE_RESOURCE_GROUP;
const containerApp = process.env.AZURE_CONTAINER_APP_NAME;
const profile = process.env.AZURE_ENV_PROFILE ?? 'dev';

if (!endpointEntry || !resourceGroup || !containerApp) {
  const message =
    'Hosted-agent endpoint, resource group, or Container App output is unavailable; web endpoint synchronization was skipped.';
  if (profile === 'prod') throw new Error(message);
  console.warn(message);
  process.exit(0);
}

const endpoint = endpointEntry[1];
const current = spawnSync(
  'az',
  [
    'containerapp',
    'show',
    '--name',
    containerApp,
    '--resource-group',
    resourceGroup,
    '--query',
    'properties.template.containers[0].env',
    '--output',
    'json',
    '--only-show-errors',
  ],
  { encoding: 'utf8' },
);
if (current.error) throw current.error;
if (current.status !== 0) {
  throw new Error(
    `Failed to inspect the Container App environment (az exit ${current.status}).`,
  );
}

const environment = JSON.parse(current.stdout);
const values = new Map(
  environment
    .filter(
      ({ name, value }) => typeof name === 'string' && value !== undefined,
    )
    .map(({ name, value }) => [name, value]),
);
if (
  values.get('PERMIT_AGENT_MODE') === 'remote' &&
  values.get('PERMIT_AGENT_ENDPOINT') === endpoint
) {
  console.log('Container App hosted-agent endpoint is already synchronized.');
  process.exit(0);
}

const result = spawnSync(
  'az',
  [
    'containerapp',
    'update',
    '--name',
    containerApp,
    '--resource-group',
    resourceGroup,
    '--set-env-vars',
    'PERMIT_AGENT_MODE=remote',
    `PERMIT_AGENT_ENDPOINT=${endpoint}`,
    '--only-show-errors',
  ],
  { encoding: 'utf8', stdio: 'inherit' },
);

if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(
    `Failed to synchronize the hosted-agent endpoint (az exit ${result.status}).`,
  );
}

console.log('Container App hosted-agent endpoint synchronized.');
