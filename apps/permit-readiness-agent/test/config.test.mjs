import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfiguration } from '../dist/config.js';

const required = {
  FOUNDRY_PROJECT_ENDPOINT:
    'https://example.services.ai.azure.com/api/projects/example',
  FOUNDRY_MODEL_NAME: 'test-model',
};

test('production rejects the local guidance fallback', () => {
  assert.throws(
    () =>
      loadConfiguration({
        ...required,
        NODE_ENV: 'production',
        GUIDANCE_SEARCH_MODE: 'local',
        GUIDANCE_MANIFEST_PATH: 'corpus.json',
      }),
    /Local guidance search is not permitted in production/,
  );
});

test('Azure guidance mode requires an HTTPS endpoint', () => {
  assert.throws(
    () =>
      loadConfiguration({
        ...required,
        GUIDANCE_SEARCH_MODE: 'azure',
      }),
    /Azure guidance search requires AZURE_SEARCH_ENDPOINT/,
  );
  const configuration = loadConfiguration({
    ...required,
    NODE_ENV: 'production',
    GUIDANCE_SEARCH_MODE: 'azure',
    AZURE_SEARCH_ENDPOINT: 'https://example.search.windows.net',
  });
  assert.equal(configuration.GUIDANCE_SEARCH_MODE, 'azure');
});

test('Foundry numeric agent versions are accepted', () => {
  const configuration = loadConfiguration({
    ...required,
    FOUNDRY_AGENT_VERSION: '1',
  });
  assert.equal(configuration.FOUNDRY_AGENT_VERSION, '1');
});
