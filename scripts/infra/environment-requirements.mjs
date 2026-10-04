const commonEnvironmentValues = [
  'AZURE_ENV_NAME',
  'AZURE_LOCATION',
  'AZURE_POSTGRES_ADMIN_PASSWORD',
  'AUTH_SESSION_SECRET',
  'WEB_CONTAINER_APP_MODE',
];

export const environmentRequirements = Object.freeze({
  dev: Object.freeze([...commonEnvironmentValues, 'ENABLE_SYNTHETIC_AUTH']),
  prod: Object.freeze([
    ...commonEnvironmentValues,
    'ENTRA_EXTERNAL_ID_TENANT_SUBDOMAIN',
    'ENTRA_EXTERNAL_ID_CLIENT_ID',
    'ENTRA_EXTERNAL_ID_CLIENT_SECRET',
    'ENTRA_EXTERNAL_ID_AUTHORITY_HOST',
    'ENTRA_EXTERNAL_ID_REDIRECT_URI',
    'ENTRA_EXTERNAL_ID_ISSUER',
    'ENTRA_EXTERNAL_ID_ORGANIZATION_ID',
  ]),
});

export function getRequiredEnvironmentValues(profile) {
  const required = environmentRequirements[profile];
  if (!required) {
    throw new Error('AZURE_ENV_PROFILE must be dev or prod.');
  }
  return required;
}
