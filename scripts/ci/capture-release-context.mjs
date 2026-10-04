import { writeFile } from 'node:fs/promises';

const outputFile = process.argv[2];
if (!outputFile) {
  throw new Error('Usage: capture-release-context.mjs <output.json>');
}

const allowedNames = [
  'AZURE_AI_ACCOUNT_NAME',
  'AZURE_AI_MODEL_DEPLOYMENT_NAME',
  'AZURE_AI_PROJECT_ENDPOINT',
  'AZURE_AI_PROJECT_ID',
  'AZURE_AI_PROJECT_NAME',
  'AZURE_CONTAINER_APP_NAME',
  'AZURE_LOCATION',
  'AZURE_RESOURCE_GROUP',
  'AZURE_SUBSCRIPTION_ID',
  'FOUNDRY_PROJECT_ENDPOINT',
  'AGENT_PERMIT_READINESS_AGENT_NAME',
  'AGENT_PERMIT_READINESS_AGENT_RESPONSES_ENDPOINT',
  'SERVICE_WEB_URI',
];

const context = Object.fromEntries(
  allowedNames
    .filter((name) => process.env[name])
    .map((name) => [name, process.env[name]]),
);
for (const required of ['AZURE_RESOURCE_GROUP', 'AZURE_CONTAINER_APP_NAME']) {
  if (!context[required])
    throw new Error(`Missing release context ${required}.`);
}

await writeFile(outputFile, `${JSON.stringify(context, null, 2)}\n`);
console.log(
  `Captured ${Object.keys(context).length} non-secret release values.`,
);
