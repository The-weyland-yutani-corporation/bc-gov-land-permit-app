param location string
param environmentName string
param containerAppName string
param infrastructureSubnetId string
param logAnalyticsCustomerId string

@secure()
param logAnalyticsSharedKey string

param registryServer string
param webIdentityResourceId string
param webIdentityClientId string
param webContainerAppMode string
param webContainerImage string
param databaseSecretUri string
param externalIdSecretUri string
param authSessionSecretUri string
param appInsightsConnectionString string
param mapsClientId string
param foundryProjectEndpoint string
param agentEndpoint string
param searchEndpoint string
param searchIndexName string
param environmentProfile string
param entraExternalIdTenantSubdomain string
param entraExternalIdClientId string
param entraExternalIdAuthorityHost string
param entraExternalIdRedirectUri string
param entraExternalIdIssuer string
param entraExternalIdOrganizationId string
param enableSyntheticAuth string
param minReplicas int
param maxReplicas int
param cpu string
param memory string
param tags object

resource managedEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: environmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsCustomerId
        sharedKey: logAnalyticsSharedKey
      }
    }
    vnetConfiguration: {
      infrastructureSubnetId: infrastructureSubnetId
      internal: false
    }
    zoneRedundant: false
  }
}

var production = environmentProfile == 'prod'
var bootstrapWebContainerApp = webContainerAppMode == 'bootstrap'
var existingWebContainerApp = webContainerAppMode == 'existing'
var validatedAgentEndpoint = !bootstrapWebContainerApp || !empty(agentEndpoint)
  ? agentEndpoint
  : fail('AGENT_PERMIT_READINESS_AGENT_RESPONSES_ENDPOINT is required when WEB_CONTAINER_APP_MODE is bootstrap.')
var baseEnvironmentVariables = [
  {
    name: 'NODE_ENV'
    value: 'production'
  }
  {
    name: 'APP_ENV'
    value: environmentProfile
  }
  {
    name: 'PORT'
    value: '3000'
  }
  {
    name: 'HOSTNAME'
    value: '0.0.0.0'
  }
  {
    name: 'AZURE_CLIENT_ID'
    value: webIdentityClientId
  }
  {
    name: 'AUTH_MODE'
    value: production ? 'entra-external-id' : 'local-demo'
  }
  {
    name: 'ENABLE_SYNTHETIC_AUTH'
    value: enableSyntheticAuth
  }
  {
    name: 'AUTH_SESSION_SECRET'
    secretRef: 'auth-session-secret'
  }
  {
    name: 'DATABASE_URL'
    secretRef: 'database-url'
  }
  {
    name: 'DATABASE_SSL_MODE'
    value: 'verify-full'
  }
  {
    name: 'DATABASE_MAX_CONNECTIONS'
    value: production ? '20' : '5'
  }
  {
    name: 'AZURE_MAPS_CLIENT_ID'
    value: mapsClientId
  }
  {
    name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
    value: appInsightsConnectionString
  }
  {
    name: 'PERMIT_AGENT_NAME'
    value: 'permit-readiness-agent'
  }
  {
    name: 'PERMIT_AGENT_TOKEN_SCOPE'
    value: 'https://ai.azure.com/.default'
  }
  {
    name: 'FOUNDRY_PROJECT_ENDPOINT'
    value: foundryProjectEndpoint
  }
  {
    name: 'AZURE_SEARCH_ENDPOINT'
    value: searchEndpoint
  }
  {
    name: 'AZURE_SEARCH_INDEX_NAME'
    value: searchIndexName
  }
]
var agentEnvironmentVariables = [
  {
    name: 'PERMIT_AGENT_MODE'
    value: 'remote'
  }
  {
    name: 'PERMIT_AGENT_ENDPOINT'
    value: validatedAgentEndpoint
  }
]
var externalIdEnvironmentVariables = production ? [
  {
    name: 'ENTRA_EXTERNAL_ID_TENANT_SUBDOMAIN'
    value: entraExternalIdTenantSubdomain
  }
  {
    name: 'ENTRA_EXTERNAL_ID_CLIENT_ID'
    value: entraExternalIdClientId
  }
  {
    name: 'ENTRA_EXTERNAL_ID_CLIENT_SECRET'
    secretRef: 'external-id-client-secret'
  }
  {
    name: 'ENTRA_EXTERNAL_ID_AUTHORITY_HOST'
    value: entraExternalIdAuthorityHost
  }
  {
    name: 'ENTRA_EXTERNAL_ID_REDIRECT_URI'
    value: entraExternalIdRedirectUri
  }
  {
    name: 'ENTRA_EXTERNAL_ID_ISSUER'
    value: entraExternalIdIssuer
  }
  {
    name: 'ENTRA_EXTERNAL_ID_ORGANIZATION_ID'
    value: entraExternalIdOrganizationId
  }
] : []
var secrets = concat([
  {
    name: 'database-url'
    keyVaultUrl: databaseSecretUri
    identity: webIdentityResourceId
  }
  {
    name: 'auth-session-secret'
    keyVaultUrl: authSessionSecretUri
    identity: webIdentityResourceId
  }
], production ? [
  {
    name: 'external-id-client-secret'
    keyVaultUrl: externalIdSecretUri
    identity: webIdentityResourceId
  }
] : [])

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = if (bootstrapWebContainerApp) {
  name: containerAppName
  location: location
  tags: union(tags, {
    'azd-service-name': 'web'
  })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${webIdentityResourceId}': {}
    }
  }
  properties: {
    environmentId: managedEnvironment.id
    configuration: {
      activeRevisionsMode: production ? 'Multiple' : 'Single'
      ingress: {
        allowInsecure: false
        external: true
        targetPort: 3000
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
        transport: 'auto'
      }
      registries: [
        {
          server: registryServer
          identity: webIdentityResourceId
        }
      ]
      secrets: secrets
    }
    template: {
      containers: [
        {
          name: 'web'
          image: webContainerImage
          env: concat(baseEnvironmentVariables, agentEnvironmentVariables, externalIdEnvironmentVariables)
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/v1/health/live'
                port: 3000
                scheme: 'HTTP'
              }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/v1/health/ready'
                port: 3000
                scheme: 'HTTP'
              }
              initialDelaySeconds: 5
              periodSeconds: 15
            }
          ]
          resources: {
            cpu: json(cpu)
            memory: memory
          }
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

resource deployedContainerApp 'Microsoft.App/containerApps@2024-03-01' existing = if (existingWebContainerApp) {
  name: containerAppName
}

output environmentName string = managedEnvironment.name
output containerAppName string = containerAppName
output containerAppUri string = webContainerAppMode == 'base'
  ? ''
  : 'https://${bootstrapWebContainerApp ? containerApp!.properties.configuration.ingress.fqdn : deployedContainerApp!.properties.configuration.ingress.fqdn}'
