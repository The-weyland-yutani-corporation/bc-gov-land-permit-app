import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const requiredOutputs = [
  'AZURE_RESOURCE_GROUP',
  'AZURE_CONTAINER_REGISTRY_NAME',
  'AZURE_CONTAINER_REGISTRY_ENDPOINT',
  'AZURE_CONTAINER_REGISTRY_RESOURCE_ID',
  'AZURE_CONTAINER_APP_NAME',
  'AZURE_CONTAINER_APP_URI',
  'WEB_CONTAINER_APP_MODE',
  'WEB_CONTAINER_APP_PROVISIONED',
  'AZURE_CLIENT_ID',
  'AZURE_KEY_VAULT_ENDPOINT',
  'AZURE_STORAGE_ACCOUNT_NAME',
  'AZURE_STORAGE_BLOB_ENDPOINT',
  'AZURE_SEARCH_ENDPOINT',
  'AZURE_SEARCH_INDEX_NAME',
  'AZURE_MAPS_CLIENT_ID',
  'AZURE_POSTGRES_HOST',
  'DATABASE_SSL_MODE',
  'APPLICATIONINSIGHTS_CONNECTION_STRING',
  'AZURE_AI_ACCOUNT_NAME',
  'AZURE_AI_PROJECT_NAME',
  'AZURE_AI_PROJECT_ID',
  'AZURE_AI_PROJECT_ENDPOINT',
  'FOUNDRY_PROJECT_ENDPOINT',
  'AZURE_AI_MODEL_DEPLOYMENT_NAME',
  'SERVICE_WEB_NAME',
  'SERVICE_WEB_URI',
];

const requiredModules = [
  'container-apps.bicep',
  'foundry.bicep',
  'identity.bicep',
  'key-vault.bicep',
  'maps.bicep',
  'monitoring.bicep',
  'network.bicep',
  'postgres.bicep',
  'rbac.bicep',
  'registry.bicep',
  'search.bicep',
  'storage.bicep',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function read(root, relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

export async function validateInfrastructure(root = process.cwd()) {
  const [
    azureYaml,
    mainBicep,
    packageManifest,
    agentManifest,
    agentDockerfile,
    webDockerfile,
  ] = await Promise.all([
    read(root, 'azure.yaml'),
    read(root, 'infra/main.bicep'),
    read(root, 'package.json').then(JSON.parse),
    read(root, 'apps/permit-readiness-agent/package.json').then(JSON.parse),
    read(root, 'apps/permit-readiness-agent/Dockerfile'),
    read(root, 'apps/web/Dockerfile'),
  ]);

  assert(
    azureYaml.includes(
      '$schema=https://raw.githubusercontent.com/Azure/azure-dev/main/schemas/v1.0/azure.yaml.json',
    ),
    'azure.yaml must declare the current azd schema.',
  );
  assert(
    /ai-project:\s*\n\s+host: azure\.ai\.project/.test(azureYaml),
    'azure.yaml must declare the Foundry project service.',
  );
  assert(
    /deployments:\s*\n\s+- name: gpt-5-mini/.test(azureYaml),
    'azure.yaml must declare the model deployment.',
  );
  assert(
    /permit-readiness-agent:\s*\n\s+host: azure\.ai\.agent/.test(azureYaml),
    'azure.yaml must declare the hosted agent service.',
  );
  assert(
    /project: apps\/permit-readiness-agent/.test(azureYaml),
    'Hosted agent project path is inconsistent.',
  );
  assert(
    /name: permit-readiness-agent/.test(azureYaml) &&
      agentManifest.name === '@permit-readiness/agent',
    'Hosted agent service identity is inconsistent.',
  );
  assert(
    /protocol: responses\s*\n\s+version: 2\.0\.0/.test(azureYaml),
    'Hosted agent must declare Responses 2.0.0.',
  );
  assert(
    /language: docker/.test(azureYaml) && /context: \.\.\/\.\./.test(azureYaml),
    'Hosted services must use the repository-root Docker context.',
  );
  assert(
    /uses:\s*\n\s+- ai-project/.test(azureYaml),
    'Hosted agent must depend on ai-project.',
  );
  assert(
    !/^\s+FOUNDRY_[A-Z0-9_]+:/m.test(
      azureYaml.match(/permit-readiness-agent:[\s\S]*?\n\s{2}web:/)?.[0] ?? '',
    ),
    'Platform-reserved FOUNDRY_* variables must not be declared on the agent.',
  );
  assert(
    /web:\s*\n\s+host: containerapp/.test(azureYaml),
    'azure.yaml must declare the web Container App.',
  );
  assert(
    agentDockerfile.includes('packages/guidance-search') &&
      agentDockerfile.includes('EXPOSE 8088') &&
      agentDockerfile.includes('USER node'),
    'Hosted-agent Dockerfile must package guidance search and run non-root on port 8088.',
  );
  assert(
    webDockerfile.includes('.next/standalone') &&
      webDockerfile.includes('["node", "apps/web/server.js"]') &&
      webDockerfile.includes('USER node'),
    'Web Dockerfile must package the standalone server and run non-root.',
  );
  assert(
    /infra:\s*\n\s+provider: bicep\s*\n\s+path: infra\s*\n\s+module: main/.test(
      azureYaml,
    ),
    'azure.yaml must use the checked-in Bicep entry point.',
  );

  for (const output of requiredOutputs) {
    assert(
      new RegExp(`output\\s+${output}\\s`).test(mainBicep),
      `Missing required Bicep output ${output}.`,
    );
  }

  const moduleNames = await readdir(path.join(root, 'infra/modules'));
  for (const moduleName of requiredModules) {
    assert(
      moduleNames.includes(moduleName),
      `Missing infrastructure module ${moduleName}.`,
    );
  }

  const profileFiles = [
    'infra/parameters/dev.bicepparam',
    'infra/parameters/prod.bicepparam',
  ];
  for (const file of profileFiles) await access(path.join(root, file));

  const sensitiveFiles = [
    'azure.yaml',
    'infra/main.bicep',
    'infra/main.parameters.json',
    '.azure/dev.env.example',
    '.azure/prod.env.example',
    ...requiredModules.map((file) => `infra/modules/${file}`),
    ...profileFiles,
  ];
  for (const file of sensitiveFiles) {
    const content = await read(root, file);
    assert(
      !/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content),
      `${file} contains a private key.`,
    );
    assert(
      !/(?:password|client[_-]?secret|api[_-]?key)\s*[:=]\s*["'][^"'${}<\s]{12,}["']/i.test(
        content,
      ),
      `${file} appears to contain a hardcoded secret.`,
    );
  }

  assert(
    packageManifest.scripts?.['infra:validate'] ===
      'node scripts/validation/validate-infra.mjs',
    'Root package must expose infra:validate.',
  );

  console.log(
    `Infrastructure contract is valid (${requiredModules.length} modules, ${requiredOutputs.length} outputs).`,
  );
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  await validateInfrastructure();
}
