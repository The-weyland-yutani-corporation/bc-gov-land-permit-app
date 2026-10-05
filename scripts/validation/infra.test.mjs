import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateInfrastructure } from './validate-infra.mjs';

test('Azure infrastructure contract is internally consistent', async () => {
  await validateInfrastructure();
});

test('Container App provisioning is explicit and traffic-neutral', async () => {
  const [main, containerApps, parameters, syncAgentEndpoint] =
    await Promise.all([
      readFile('infra/main.bicep', 'utf8'),
      readFile('infra/modules/container-apps.bicep', 'utf8'),
      readFile('infra/main.parameters.json', 'utf8'),
      readFile('scripts/infra/sync-agent-endpoint.mjs', 'utf8'),
    ]);

  assert.doesNotMatch(
    `${main}\n${containerApps}\n${parameters}`,
    /containerapps-helloworld|hello-world/i,
  );
  assert.match(main, /param webContainerImage string = ''/);
  assert.match(
    main,
    /fail\('WEB_CONTAINER_IMAGE is required when WEB_CONTAINER_APP_MODE is bootstrap\.'\)/,
  );
  assert.match(
    main,
    /fail\('AGENT_PERMIT_READINESS_AGENT_RESPONSES_ENDPOINT is required when WEB_CONTAINER_APP_MODE is bootstrap\.'\)/,
  );
  assert.match(
    containerApps,
    /resource containerApp .* = if \(bootstrapWebContainerApp\)/,
  );
  assert.match(
    containerApps,
    /resource deployedContainerApp .* existing = if \(existingWebContainerApp\)/,
  );
  assert.match(
    containerApps,
    /var validatedAgentEndpoint = !bootstrapWebContainerApp \|\| !empty\(agentEndpoint\)/,
  );
  assert.match(containerApps, /name: 'PERMIT_AGENT_MODE'\s+value: 'remote'/);
  assert.doesNotMatch(containerApps, /value: 'local'/);
  assert.match(
    containerApps,
    /env: concat\(baseEnvironmentVariables, agentEnvironmentVariables, externalIdEnvironmentVariables\)/,
  );
  assert.match(main, /webIdentityClientId: identity\.outputs\.clientId/);
  assert.match(containerApps, /param webIdentityClientId string/);
  assert.match(
    containerApps,
    /name: 'AZURE_CLIENT_ID'\s+value: webIdentityClientId/,
  );
  assert.match(
    syncAgentEndpoint,
    /webIdentityClientId = process\.env\.AZURE_CLIENT_ID/,
  );
  assert.match(syncAgentEndpoint, /`AZURE_CLIENT_ID=\${webIdentityClientId}`/);
  assert.match(
    syncAgentEndpoint,
    /values\.get\('AZURE_CLIENT_ID'\) === webIdentityClientId/,
  );
});
