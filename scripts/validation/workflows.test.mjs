import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { parseDocument } from 'yaml';
import { environmentRequirements } from '../infra/environment-requirements.mjs';
import { validateEnvironment } from '../infra/validate-environment.mjs';

const workflowDirectory = path.resolve('.github', 'workflows');
const expectedWorkflows = [
  'ci.yml',
  'deploy-dev.yml',
  'promote-production.yml',
];

async function loadWorkflow(fileName) {
  const source = await readFile(path.join(workflowDirectory, fileName), 'utf8');
  const document = parseDocument(source);
  assert.deepEqual(
    document.errors,
    [],
    `${fileName} must contain syntactically valid YAML`,
  );
  return { source, workflow: document.toJS() };
}

function walk(value, callback) {
  if (Array.isArray(value)) {
    value.forEach((entry) => walk(entry, callback));
    return;
  }
  if (!value || typeof value !== 'object') return;
  callback(value);
  Object.values(value).forEach((entry) => walk(entry, callback));
}

function findStep(workflow, jobName, stepName) {
  const step = workflow.jobs[jobName].steps.find(
    (candidate) => candidate.name === stepName,
  );
  assert.ok(step, `${jobName} must contain "${stepName}"`);
  return step;
}

function azdEnvironmentValueNames(step) {
  return new Set(
    [...step.run.matchAll(/\bazd env set ([A-Z0-9_]+)\b/g)].map(
      (match) => match[1],
    ),
  );
}

function assertCompleteEnvironmentMapping(step, profile) {
  const actual = azdEnvironmentValueNames(step);
  for (const name of environmentRequirements[profile]) {
    assert.ok(actual.has(name), `${profile} workflow must set ${name}`);
  }
}

function assertShellEnvironmentMappings(step, mappings) {
  for (const [name, shellName] of Object.entries(mappings)) {
    assert.match(
      step.run,
      new RegExp(`azd env set ${name} "\\$${shellName}" --no-prompt`),
      `${name} must be populated from ${shellName}`,
    );
  }
}

function validEnvironment(profile) {
  const host = 'example.ciamlogin.com';
  return {
    AZURE_ENV_PROFILE: profile,
    AZURE_ENV_NAME: `permit-readiness-${profile}`,
    AZURE_LOCATION: 'canadacentral',
    AZURE_POSTGRES_ADMIN_PASSWORD: 'not-a-real-password',
    AUTH_SESSION_SECRET: 'not-a-real-session-secret-32-chars',
    ENABLE_SYNTHETIC_AUTH: 'true',
    WEB_CONTAINER_APP_MODE: 'existing',
    ENTRA_EXTERNAL_ID_TENANT_SUBDOMAIN: 'example',
    ENTRA_EXTERNAL_ID_CLIENT_ID: '00000000-0000-0000-0000-000000000000',
    ENTRA_EXTERNAL_ID_CLIENT_SECRET: 'not-a-real-client-secret',
    ENTRA_EXTERNAL_ID_AUTHORITY_HOST: `https://${host}`,
    ENTRA_EXTERNAL_ID_REDIRECT_URI:
      'https://permit.example.test/api/auth/callback/entra',
    ENTRA_EXTERNAL_ID_ISSUER: `https://${host}/tenant/v2.0`,
    ENTRA_EXTERNAL_ID_ORGANIZATION_ID: '11111111-1111-1111-1111-111111111111',
  };
}

test('workflow files are valid and actions are immutable', async () => {
  const files = (await readdir(workflowDirectory))
    .filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'))
    .sort();
  assert.deepEqual(files, expectedWorkflows);

  for (const fileName of files) {
    const { source, workflow } = await loadWorkflow(fileName);
    assert.deepEqual(workflow.permissions, { contents: 'read' });
    assert.doesNotMatch(source, /(?:^|\n)\s*AZURE_DEV_USER_AGENT\s*:/);
    assert.doesNotMatch(source, /(?:^|\n)\s*path:\s*\.azure(?:\/|$)/);

    for (const line of source.split(/\r?\n/)) {
      if (
        /(^|\s)azd(?:\s|$)/.test(line) &&
        !line.trimStart().startsWith('#') &&
        !line.includes('name:') &&
        !line.includes('uses:')
      ) {
        assert.match(
          line,
          /AZURE_DEV_USER_AGENT=microsoft_foundry_skill\s+azd\b/,
          `${fileName}: every azd command must set the Foundry user agent inline`,
        );
      }
    }

    walk(workflow, (node) => {
      if (typeof node.uses !== 'string') return;
      assert.match(
        node.uses,
        /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}$/,
        `${fileName}: ${node.uses} must be pinned to a full commit SHA`,
      );
    });
  }
});

test('pull request CI contains every release gate', async () => {
  const { source, workflow } = await loadWorkflow('ci.yml');
  assert.ok(workflow.on.pull_request);
  assert.ok(workflow.on.push.branches.includes('main'));
  for (const event of ['pull_request', 'push']) {
    for (const handoffPath of ['*.md', 'accelerator.yaml', 'docs/**']) {
      assert.ok(
        workflow.on[event].paths.includes(handoffPath),
        `${event} must validate ${handoffPath} changes`,
      );
    }
  }
  const browserSmoke = findStep(workflow, 'browser-smoke', 'Run browser smoke');
  assert.ok(browserSmoke.run.indexOf('pnpm build') >= 0);
  assert.ok(
    browserSmoke.run.indexOf('pnpm build') <
      browserSmoke.run.indexOf('test:e2e'),
    'fresh-checkout browser smoke must build workspace outputs first',
  );
  for (const expected of [
    'pnpm install --frozen-lockfile',
    'pnpm format:check',
    'pnpm lint',
    'pnpm typecheck',
    'pnpm test',
    'pnpm build',
    'pnpm db:check',
    'eval:preflight',
    'az bicep build',
    'docker/build-push-action',
    'playwright install\\s+--with-deps chromium',
    'playwright-report',
    'test-results',
  ]) {
    assert.match(source, new RegExp(expected.replaceAll('/', '\\/')));
  }
});

test('accelerator draft keeps publication gates and handoff paths explicit', async () => {
  const document = parseDocument(await readFile('accelerator.yaml', 'utf8'));
  assert.deepEqual(document.errors, []);
  const metadata = document.toJS();
  assert.equal(metadata.id, 'permit-readiness-navigator');
  assert.equal(metadata.readiness.catalog_schema_verified, false);
  assert.equal(metadata.license, null);
  assert.deepEqual(metadata.maintainers, []);
  assert.equal(
    metadata.experience_modes.local.cloud_credentials_required,
    false,
  );
  assert.equal(metadata.experience_modes.azure.cost_approval_required, true);
  assert.ok(
    metadata.limitations.includes(
      'Demonstration, not an official government service',
    ),
  );
  const paths = [
    ...Object.values(metadata.documentation),
    metadata.readiness.evidence,
    metadata.readiness.publication_checklist,
    ...Object.values(metadata.assets).flat(),
  ].filter((value) => typeof value === 'string');
  for (const relativePath of paths) {
    assert.ok(!path.isAbsolute(relativePath) && !relativePath.includes('..'));
    await access(path.resolve(relativePath.split('#')[0]));
  }
});

test('public lockfile preserves registry-independent integrity checks', async () => {
  const document = parseDocument(await readFile('pnpm-lock.yaml', 'utf8'));
  assert.deepEqual(document.errors, []);
  for (const [name, entry] of Object.entries(document.toJS().packages)) {
    assert.ok(entry.resolution.integrity, `${name} must retain integrity`);
    assert.equal(
      entry.resolution.tarball,
      undefined,
      `${name} must not pin a private mirror tarball URL`,
    );
  }
});

test('deployment workflows use OIDC, protected environments, and gates', async () => {
  const dev = await loadWorkflow('deploy-dev.yml');
  const production = await loadWorkflow('promote-production.yml');

  assert.ok(dev.workflow.on.push.branches.includes('main'));
  assert.ok(dev.workflow.on.workflow_dispatch);
  assert.equal(dev.workflow.jobs.deploy.environment, 'development');
  assert.equal(dev.workflow.jobs.deploy.permissions['id-token'], 'write');
  assert.match(dev.source, /DEV_AZURE_CLIENT_ID/);
  assert.match(dev.source, /--profile smoke/);
  assert.match(dev.source, /--version "\$AGENT_VERSION"/);
  assert.match(dev.source, /pnpm db:initialize/);
  assert.match(dev.source, /pnpm db:seed:demo/);
  assert.match(dev.source, /pnpm guidance:initialize/);
  assert.ok(
    dev.source.indexOf('pnpm db:initialize') <
      dev.source.indexOf('azd deploy --all'),
  );
  assert.ok(
    dev.source.indexOf('pnpm guidance:initialize') <
      dev.source.indexOf('azd deploy --all'),
  );
  assert.ok(
    dev.source.indexOf('pnpm guidance:initialize') <
      dev.source.indexOf('Invoke exact hosted-agent candidate'),
  );
  assert.ok(
    dev.source.indexOf('pnpm guidance:initialize') <
      dev.source.indexOf('Check deployed web health'),
  );
  assert.match(dev.source, /cancel-in-progress: false/);

  const devBootstrap = findStep(
    dev.workflow,
    'deploy',
    'Configure development azd environment',
  );
  assertCompleteEnvironmentMapping(devBootstrap, 'dev');
  assertShellEnvironmentMappings(devBootstrap, {
    AZURE_ENV_NAME: 'DEV_ENV_NAME',
    AZURE_LOCATION: 'DEV_LOCATION',
    AZURE_POSTGRES_ADMIN_PASSWORD: 'POSTGRES_ADMIN_PASSWORD',
    AUTH_SESSION_SECRET: 'AUTH_SESSION_SECRET',
    ENABLE_SYNTHETIC_AUTH: 'ENABLE_SYNTHETIC_AUTH',
  });
  assert.match(
    devBootstrap.env.POSTGRES_ADMIN_PASSWORD,
    /secrets\.DEV_AZURE_POSTGRES_ADMIN_PASSWORD/,
  );
  assert.match(
    devBootstrap.env.AUTH_SESSION_SECRET,
    /secrets\.DEV_AUTH_SESSION_SECRET/,
  );
  assert.match(
    dev.workflow.jobs.deploy.env.DEV_ENABLE_SYNTHETIC_AUTH,
    /vars\.DEV_ENABLE_SYNTHETIC_AUTH\s*\|\|\s*'false'/,
  );
  assert.doesNotThrow(() => validateEnvironment(validEnvironment('dev')));
  assert.throws(
    () =>
      validateEnvironment({
        ...validEnvironment('dev'),
        WEB_CONTAINER_APP_MODE: 'bootstrap',
        WEB_CONTAINER_IMAGE: 'registry.example.test/permit-readiness/web:dev',
      }),
    /AGENT_PERMIT_READINESS_AGENT_RESPONSES_ENDPOINT/,
  );
  assert.doesNotThrow(() =>
    validateEnvironment({
      ...validEnvironment('dev'),
      WEB_CONTAINER_APP_MODE: 'bootstrap',
      WEB_CONTAINER_IMAGE: 'registry.example.test/permit-readiness/web:dev',
      AGENT_PERMIT_READINESS_AGENT_RESPONSES_ENDPOINT:
        'https://agent.example.test/responses',
    }),
  );
  assert.throws(
    () =>
      validateEnvironment({
        ...validEnvironment('dev'),
        WEB_CONTAINER_APP_MODE: 'bootstrap',
        WEB_CONTAINER_IMAGE: 'registry.example.test/permit-readiness/web:dev',
        AGENT_PERMIT_READINESS_AGENT_RESPONSES_ENDPOINT:
          'http://agent.example.test/responses',
      }),
    /Bootstrap agent endpoint must use HTTPS/,
  );

  assert.ok(production.workflow.on.workflow_dispatch);
  assert.equal(
    production.workflow.on.workflow_dispatch.inputs.operation.default,
    'promote',
  );
  assert.equal(production.workflow.jobs.candidate.environment, 'production');
  assert.equal(production.workflow.jobs.promote.environment, 'production');
  assert.equal(
    production.workflow.jobs.promote.permissions['id-token'],
    'write',
  );
  assert.match(production.source, /PROD_AZURE_CLIENT_ID/);
  assert.match(production.source, /tested_ref/);
  assert.doesNotMatch(production.source, /tested_agent_version/);
  assert.match(production.source, /run-foundry-eval\.sh[\s\S]*regression/);
  assert.match(production.source, /steps\.baseline\.outputs\.file/);
  assert.match(production.source, /previous-release\.json/);
  assert.match(production.source, /-name 'baseline\.json'/);
  assert.match(production.source, /stable-agent-route\.json/);
  assert.match(production.source, /stable-app-traffic\.json/);
  assert.match(production.source, /agent endpoint update/);
  assert.match(production.source, /--version "\$CANDIDATE_AGENT_VERSION"/);
  assert.match(
    production.source,
    /regression "\$BASELINE_FILE" "\$CANDIDATE_AGENT_VERSION"/,
  );
  assert.match(production.source, /production-release-metadata/);
  assert.match(
    production.source,
    /Restore stable routes after candidate failure/,
  );
  assert.match(
    production.source,
    /Restore stable routes after promotion failure/,
  );
  assert.match(production.source, /failure\(\) \|\| cancelled\(\)/);
  assert.match(production.source, /rollback_run_id/);
  assert.match(production.source, /Restore exact recorded stable routes/);
  assert.equal(
    production.workflow.on.workflow_dispatch.inputs.include_demo_data.default,
    false,
  );
  assert.match(production.source, /ALLOW_DEMO_DATA: 'true'/);
  assert.match(production.source, /pnpm db:initialize/);
  assert.match(production.source, /pnpm guidance:initialize/);
  assert.ok(
    production.source.indexOf('pnpm db:initialize') <
      production.source.indexOf('azd deploy --all'),
  );
  assert.ok(
    production.source.indexOf('pnpm guidance:initialize') <
      production.source.indexOf('azd deploy --all'),
  );
  assert.ok(
    production.source.indexOf(
      'Synchronize web identity before candidate snapshot',
    ) <
      production.source.indexOf(
        'Snapshot production versions immediately before deployment',
      ),
  );
  assert.ok(
    production.source.indexOf(
      'Synchronize web identity before candidate snapshot',
    ) < production.source.indexOf('azd deploy --all'),
  );
  assert.match(
    production.source,
    /Synchronize web identity before candidate snapshot[\s\S]*sync-agent-endpoint\.mjs[\s\S]*verify-stable-routes\.sh/,
  );
  assert.ok(
    production.source.indexOf(
      'Pin stable public routes before candidate provisioning',
    ) < production.source.indexOf('azd provision --no-prompt'),
  );
  assert.ok(
    production.source.indexOf(
      'Verify stable routes after production provision',
    ) > production.source.indexOf('azd provision --no-prompt'),
  );
  assert.ok(
    production.source.indexOf(
      'Verify stable routes after production provision',
    ) < production.source.indexOf('azd deploy --all'),
  );
  assert.ok(
    production.source.indexOf(
      'Run exact-candidate regression and baseline gate',
    ) < production.source.indexOf('Promote exact candidate routes'),
  );
  assert.ok(
    production.source.indexOf('pnpm guidance:initialize') <
      production.source.indexOf(
        'Invoke exact production candidate while routing stays stable',
      ),
  );
  assert.ok(
    production.source.indexOf('pnpm guidance:initialize') <
      production.source.indexOf(
        'Run exact-candidate regression and baseline gate',
      ),
  );
  assert.ok(
    production.source.indexOf('pnpm guidance:initialize') <
      production.source.indexOf(
        'Check exact candidate revision and stable public health',
      ),
  );
  assert.match(production.source, /cancel-in-progress: false/);

  const productionBootstrap = findStep(
    production.workflow,
    'candidate',
    'Configure production azd environment',
  );
  assertCompleteEnvironmentMapping(productionBootstrap, 'prod');
  assertShellEnvironmentMappings(productionBootstrap, {
    AZURE_ENV_NAME: 'PROD_ENV_NAME',
    AZURE_LOCATION: 'PROD_LOCATION',
    AZURE_POSTGRES_ADMIN_PASSWORD: 'POSTGRES_ADMIN_PASSWORD',
    AUTH_SESSION_SECRET: 'AUTH_SESSION_SECRET',
    ENTRA_EXTERNAL_ID_TENANT_SUBDOMAIN: 'ENTRA_EXTERNAL_ID_TENANT_SUBDOMAIN',
    ENTRA_EXTERNAL_ID_CLIENT_ID: 'ENTRA_EXTERNAL_ID_CLIENT_ID',
    ENTRA_EXTERNAL_ID_CLIENT_SECRET: 'ENTRA_EXTERNAL_ID_CLIENT_SECRET',
    ENTRA_EXTERNAL_ID_AUTHORITY_HOST: 'ENTRA_EXTERNAL_ID_AUTHORITY_HOST',
    ENTRA_EXTERNAL_ID_REDIRECT_URI: 'ENTRA_EXTERNAL_ID_REDIRECT_URI',
    ENTRA_EXTERNAL_ID_ISSUER: 'ENTRA_EXTERNAL_ID_ISSUER',
    ENTRA_EXTERNAL_ID_ORGANIZATION_ID: 'ENTRA_EXTERNAL_ID_ORGANIZATION_ID',
  });
  assert.match(
    productionBootstrap.run,
    /azd env set WEB_CONTAINER_APP_MODE existing --no-prompt/,
  );
  assert.match(
    productionBootstrap.env.POSTGRES_ADMIN_PASSWORD,
    /secrets\.PROD_AZURE_POSTGRES_ADMIN_PASSWORD/,
  );
  assert.match(
    productionBootstrap.env.AUTH_SESSION_SECRET,
    /secrets\.PROD_AUTH_SESSION_SECRET/,
  );
  assert.match(
    productionBootstrap.env.ENTRA_EXTERNAL_ID_CLIENT_SECRET,
    /secrets\.PROD_ENTRA_EXTERNAL_ID_CLIENT_SECRET/,
  );
  for (const name of [
    'ENTRA_EXTERNAL_ID_TENANT_SUBDOMAIN',
    'ENTRA_EXTERNAL_ID_CLIENT_ID',
    'ENTRA_EXTERNAL_ID_AUTHORITY_HOST',
    'ENTRA_EXTERNAL_ID_REDIRECT_URI',
    'ENTRA_EXTERNAL_ID_ISSUER',
    'ENTRA_EXTERNAL_ID_ORGANIZATION_ID',
  ]) {
    assert.match(
      production.workflow.jobs.candidate.env[name],
      new RegExp(`vars\\.PROD_${name}`),
    );
  }
  assert.doesNotThrow(() => validateEnvironment(validEnvironment('prod')));
  assert.throws(
    () =>
      validateEnvironment({
        ...validEnvironment('prod'),
        WEB_CONTAINER_APP_MODE: 'bootstrap',
      }),
    /WEB_CONTAINER_IMAGE/,
  );
  assert.throws(
    () =>
      validateEnvironment({
        ...validEnvironment('prod'),
        WEB_CONTAINER_APP_MODE: 'bootstrap',
        WEB_CONTAINER_IMAGE:
          'registry.example.test/permit-readiness/web:latest',
        AGENT_PERMIT_READINESS_AGENT_RESPONSES_ENDPOINT:
          'https://agent.example.test/responses',
      }),
    /immutable sha256 digest/,
  );
  assert.doesNotThrow(() =>
    validateEnvironment({
      ...validEnvironment('prod'),
      WEB_CONTAINER_APP_MODE: 'bootstrap',
      WEB_CONTAINER_IMAGE: `registry.example.test/permit-readiness/web@sha256:${'a'.repeat(64)}`,
      AGENT_PERMIT_READINESS_AGENT_RESPONSES_ENDPOINT:
        'https://agent.example.test/responses',
    }),
  );

  for (const job of Object.values(production.workflow.jobs)) {
    for (const step of job.steps ?? []) {
      if (typeof step.run === 'string') {
        assert.doesNotMatch(
          step.run,
          /\$\{\{\s*inputs\./,
          'workflow_dispatch strings must enter shell commands through env',
        );
      }
    }
  }
});

test('validator, Bicep profiles, and workflows share required values', async () => {
  for (const profile of ['dev', 'prod']) {
    const source = await readFile(
      path.resolve('infra', 'parameters', `${profile}.bicepparam`),
      'utf8',
    );
    const bicepEnvironmentValues = new Set(
      [...source.matchAll(/readEnvironmentVariable\('([A-Z0-9_]+)'\)/g)].map(
        (match) => match[1],
      ),
    );
    for (const optionalName of [
      'WEB_CONTAINER_IMAGE',
      'AGENT_PERMIT_READINESS_AGENT_RESPONSES_ENDPOINT',
    ]) {
      if (source.includes(`readEnvironmentVariable('${optionalName}', '')`)) {
        bicepEnvironmentValues.add(optionalName);
      }
    }
    const expectedBicepValues = environmentRequirements[profile].filter(
      (name) => !['AZURE_ENV_NAME', 'AZURE_LOCATION'].includes(name),
    );
    for (const name of expectedBicepValues) {
      assert.ok(
        bicepEnvironmentValues.has(name),
        `${profile}.bicepparam must consume ${name}`,
      );
    }
    assert.ok(bicepEnvironmentValues.has('WEB_CONTAINER_IMAGE'));
    assert.ok(
      bicepEnvironmentValues.has(
        'AGENT_PERMIT_READINESS_AGENT_RESPONSES_ENDPOINT',
      ),
    );

    for (const name of environmentRequirements[profile]) {
      const environment = validEnvironment(profile);
      delete environment[name];
      assert.throws(
        () => validateEnvironment(environment),
        new RegExp(`Missing required azd environment values for ${profile}:`),
        `${profile} validator must reject missing ${name}`,
      );
    }
  }
});

test('CI helper scripts scope the Foundry user agent to azd', async () => {
  for (const fileName of ['rollback-app.sh', 'run-foundry-eval.sh']) {
    const source = await readFile(
      path.resolve('scripts', 'ci', fileName),
      'utf8',
    );
    for (const line of source.split(/\r?\n/)) {
      if (/(^|\s)azd(?:\s|$)/.test(line)) {
        assert.match(
          line,
          /AZURE_DEV_USER_AGENT=microsoft_foundry_skill\s+azd\b/,
        );
      }
    }
  }
  const evaluation = await readFile(
    path.resolve('scripts', 'ci', 'run-foundry-eval.sh'),
    'utf8',
  );
  assert.match(evaluation, /--require-baseline/);
});
