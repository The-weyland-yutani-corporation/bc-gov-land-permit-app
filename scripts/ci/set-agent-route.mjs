import { readFile, writeFile } from 'node:fs/promises';
import { parseDocument } from 'yaml';

const [fileName, serviceName, version] = process.argv.slice(2);
if (!fileName || !serviceName || !version) {
  throw new Error(
    'Usage: node scripts/ci/set-agent-route.mjs <azure.yaml> <service> <version>',
  );
}

const document = parseDocument(await readFile(fileName, 'utf8'));
if (document.errors.length > 0) {
  throw new Error(
    `Unable to parse ${fileName}: ${document.errors.map(String).join('; ')}`,
  );
}

const service = document.getIn(['services', serviceName], true);
if (!service || service.get('host') !== 'azure.ai.agent') {
  throw new Error(
    `${serviceName} is not an azure.ai.agent service in ${fileName}.`,
  );
}

document.setIn(
  [
    'services',
    serviceName,
    'agentEndpoint',
    'versionSelector',
    'versionSelectionRules',
  ],
  [
    {
      type: 'FixedRatio',
      agentVersion: String(version),
      trafficPercentage: 100,
    },
  ],
);

await writeFile(fileName, document.toString());
console.log(`Pinned ${serviceName} endpoint routing to version ${version}.`);
