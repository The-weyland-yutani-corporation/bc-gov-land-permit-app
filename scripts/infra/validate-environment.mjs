import { pathToFileURL } from 'node:url';
import { getRequiredEnvironmentValues } from './environment-requirements.mjs';

function getBootstrapRequirements(profile, mode) {
  if (mode !== 'bootstrap') return [];
  return [
    'WEB_CONTAINER_IMAGE',
    'AGENT_PERMIT_READINESS_AGENT_RESPONSES_ENDPOINT',
  ];
}

export function validateEnvironment(environment = process.env) {
  const profile = environment.AZURE_ENV_PROFILE ?? 'dev';
  const required = getRequiredEnvironmentValues(profile);
  const mode = environment.WEB_CONTAINER_APP_MODE?.trim();
  const missing = [
    ...required,
    ...getBootstrapRequirements(profile, mode),
  ].filter((name) => !environment[name]?.trim());
  if (missing.length) {
    throw new Error(
      `Missing required azd environment values for ${profile}: ${missing.join(', ')}`,
    );
  }

  if ((environment.AUTH_SESSION_SECRET?.trim().length ?? 0) < 32) {
    throw new Error('AUTH_SESSION_SECRET must contain at least 32 characters.');
  }

  if (!['base', 'bootstrap', 'existing'].includes(mode)) {
    throw new Error(
      'WEB_CONTAINER_APP_MODE must be base, bootstrap, or existing.',
    );
  }

  if (
    mode === 'bootstrap' &&
    profile === 'prod' &&
    !/@sha256:[a-f0-9]{64}$/i.test(environment.WEB_CONTAINER_IMAGE)
  ) {
    throw new Error(
      'Production WEB_CONTAINER_IMAGE must use an immutable sha256 digest.',
    );
  }

  if (mode === 'bootstrap') {
    const endpoint = new URL(
      environment.AGENT_PERMIT_READINESS_AGENT_RESPONSES_ENDPOINT,
    );
    if (endpoint.protocol !== 'https:') {
      throw new Error('Bootstrap agent endpoint must use HTTPS.');
    }
  }

  if (
    profile === 'prod' &&
    environment.ENTRA_EXTERNAL_ID_REDIRECT_URI?.includes('localhost')
  ) {
    throw new Error(
      'Production External ID redirect URI cannot use localhost.',
    );
  }

  if (profile === 'dev' && environment.ENABLE_SYNTHETIC_AUTH !== 'true') {
    throw new Error(
      'Deployed demo identity requires explicit ENABLE_SYNTHETIC_AUTH=true.',
    );
  }

  if (profile === 'prod') {
    const subdomain = environment.ENTRA_EXTERNAL_ID_TENANT_SUBDOMAIN;
    const expectedHost = `${subdomain}.ciamlogin.com`;
    for (const name of [
      'ENTRA_EXTERNAL_ID_AUTHORITY_HOST',
      'ENTRA_EXTERNAL_ID_ISSUER',
    ]) {
      const value = new URL(environment[name]);
      if (value.protocol !== 'https:' || value.hostname !== expectedHost) {
        throw new Error(`${name} must use https://${expectedHost}.`);
      }
    }
  }

  return profile;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const profile = validateEnvironment();
  console.log(`azd ${profile} environment inputs are present.`);
}
