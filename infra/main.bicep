targetScope = 'subscription'

@minLength(2)
@maxLength(32)
param applicationName string = 'permit-readiness'

@minLength(2)
@maxLength(24)
param environmentName string

@allowed([
  'dev'
  'prod'
])
param environmentProfile string = 'dev'

param location string = deployment().location
param resourceGroupName string = 'rg-${applicationName}-${environmentName}'

@secure()
param postgresAdminPassword string

param postgresAdminLogin string = 'permitadmin'
param postgresDatabaseName string = 'permit_readiness'

@allowed([
  'base'
  'bootstrap'
  'existing'
])
param webContainerAppMode string

param agentEndpoint string = ''
param webContainerImage string = ''
param guidanceSearchIndexName string = 'permit-guidance-v1'

@description('JSON generated from services.ai-project.deployments by the Foundry azd extension.')
param aiProjectDeployments string = '[{"name":"gpt-5-mini","model":{"format":"OpenAI","name":"gpt-5-mini"},"sku":{"name":"GlobalStandard","capacity":10}}]'

param entraExternalIdTenantSubdomain string = ''
param entraExternalIdClientId string = ''

@secure()
param entraExternalIdClientSecret string = ''

@secure()
param authSessionSecret string

@allowed([
  'true'
  'false'
])
param enableSyntheticAuth string = 'false'

param entraExternalIdAuthorityHost string = ''
param entraExternalIdRedirectUri string = ''
param entraExternalIdIssuer string = ''
param entraExternalIdOrganizationId string = ''

param logRetentionDays int = environmentProfile == 'prod' ? 90 : 30
param containerAppMinReplicas int = environmentProfile == 'prod' ? 2 : 0
param containerAppMaxReplicas int = environmentProfile == 'prod' ? 10 : 2
param webCpu string = environmentProfile == 'prod' ? '1.0' : '0.5'
param webMemory string = environmentProfile == 'prod' ? '2Gi' : '1Gi'
param postgresSkuName string = environmentProfile == 'prod' ? 'Standard_D2ds_v5' : 'Standard_B1ms'
param postgresSkuTier string = environmentProfile == 'prod' ? 'GeneralPurpose' : 'Burstable'
param postgresStorageGb int = environmentProfile == 'prod' ? 128 : 32
param postgresBackupRetentionDays int = environmentProfile == 'prod' ? 35 : 7
param searchSku string = environmentProfile == 'prod' ? 'standard' : 'basic'
param searchReplicaCount int = environmentProfile == 'prod' ? 2 : 1
param searchSemanticTier string = environmentProfile == 'prod' ? 'standard' : 'free'
param registrySku string = environmentProfile == 'prod' ? 'Premium' : 'Basic'
param storageSku string = environmentProfile == 'prod' ? 'Standard_ZRS' : 'Standard_LRS'
param keyVaultRetentionDays int = environmentProfile == 'prod' ? 90 : 7
param keyVaultPurgeProtection bool = environmentProfile == 'prod'

var suffix = take(uniqueString(subscription().id, environmentName), 6)
var compactPrefix = take(toLower(replace('${applicationName}${environmentName}', '-', '')), 12)
var bootstrapWebContainerApp = webContainerAppMode == 'bootstrap'
var validatedWebContainerImage = !bootstrapWebContainerApp || !empty(webContainerImage)
  ? webContainerImage
  : fail('WEB_CONTAINER_IMAGE is required when WEB_CONTAINER_APP_MODE is bootstrap.')
var validatedAgentEndpoint = !bootstrapWebContainerApp || !empty(agentEndpoint)
  ? agentEndpoint
  : fail('AGENT_PERMIT_READINESS_AGENT_RESPONSES_ENDPOINT is required when WEB_CONTAINER_APP_MODE is bootstrap.')
var resourceNames = {
  registry: 'acr${compactPrefix}${suffix}'
  containerEnvironment: 'cae-${applicationName}-${environmentName}'
  containerApp: 'ca-${applicationName}-${environmentName}'
  identity: 'id-${applicationName}-web-${environmentName}'
  keyVault: take('kv-${compactPrefix}-${suffix}', 24)
  storage: take('st${compactPrefix}${suffix}', 24)
  search: take('srch-${applicationName}-${environmentName}-${suffix}', 60)
  maps: take('maps-${applicationName}-${environmentName}-${suffix}', 98)
  postgres: take('psql-${applicationName}-${environmentName}-${suffix}', 63)
  foundryAccount: take('aif-${applicationName}-${environmentName}-${suffix}', 64)
  foundryProject: take('${applicationName}-${environmentName}', 64)
  logAnalytics: take('log-${applicationName}-${environmentName}', 63)
  applicationInsights: take('appi-${applicationName}-${environmentName}', 255)
  virtualNetwork: 'vnet-${applicationName}-${environmentName}'
}
var deployments = json(aiProjectDeployments)

resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-11-01' = {
  name: resourceGroupName
  location: location
  tags: {
    'azd-env-name': environmentName
    application: applicationName
    environment: environmentProfile
    'data-classification': 'potentially-sensitive'
  }
}

module monitoring './modules/monitoring.bicep' = {
  name: 'monitoring'
  scope: resourceGroup
  params: {
    location: location
    logAnalyticsName: resourceNames.logAnalytics
    applicationInsightsName: resourceNames.applicationInsights
    retentionDays: logRetentionDays
    tags: resourceGroup.tags
  }
}

module network './modules/network.bicep' = {
  name: 'network'
  scope: resourceGroup
  params: {
    location: location
    virtualNetworkName: resourceNames.virtualNetwork
    tags: resourceGroup.tags
  }
}

module identity './modules/identity.bicep' = {
  name: 'identity'
  scope: resourceGroup
  params: {
    location: location
    identityName: resourceNames.identity
    tags: resourceGroup.tags
  }
}

module registry './modules/registry.bicep' = {
  name: 'registry'
  scope: resourceGroup
  params: {
    location: location
    registryName: resourceNames.registry
    skuName: registrySku
    tags: resourceGroup.tags
  }
}

module keyVault './modules/key-vault.bicep' = {
  name: 'key-vault'
  scope: resourceGroup
  params: {
    location: location
    vaultName: resourceNames.keyVault
    softDeleteRetentionDays: keyVaultRetentionDays
    enablePurgeProtection: keyVaultPurgeProtection
    postgresServerName: resourceNames.postgres
    postgresDatabaseName: postgresDatabaseName
    postgresAdminLogin: postgresAdminLogin
    postgresAdminPassword: postgresAdminPassword
    entraExternalIdClientSecret: entraExternalIdClientSecret
    authSessionSecret: authSessionSecret
    createExternalIdSecret: environmentProfile == 'prod'
    tags: resourceGroup.tags
  }
}

module storage './modules/storage.bicep' = {
  name: 'storage'
  scope: resourceGroup
  params: {
    location: location
    storageAccountName: resourceNames.storage
    skuName: storageSku
    tags: resourceGroup.tags
  }
}

module search './modules/search.bicep' = {
  name: 'search'
  scope: resourceGroup
  params: {
    location: location
    searchServiceName: resourceNames.search
    skuName: searchSku
    replicaCount: searchReplicaCount
    semanticSearchTier: searchSemanticTier
    tags: resourceGroup.tags
  }
}

module maps './modules/maps.bicep' = {
  name: 'maps'
  scope: resourceGroup
  params: {
    mapsAccountName: resourceNames.maps
    tags: resourceGroup.tags
  }
}

module postgres './modules/postgres.bicep' = {
  name: 'postgres'
  scope: resourceGroup
  params: {
    location: location
    serverName: resourceNames.postgres
    databaseName: postgresDatabaseName
    administratorLogin: postgresAdminLogin
    administratorPassword: postgresAdminPassword
    delegatedSubnetResourceId: network.outputs.postgresSubnetId
    privateDnsZoneResourceId: network.outputs.postgresPrivateDnsZoneId
    skuName: postgresSkuName
    skuTier: postgresSkuTier
    storageSizeGb: postgresStorageGb
    backupRetentionDays: postgresBackupRetentionDays
    tags: resourceGroup.tags
  }
}

module foundry './modules/foundry.bicep' = {
  name: 'foundry'
  scope: resourceGroup
  params: {
    location: location
    accountName: resourceNames.foundryAccount
    projectName: resourceNames.foundryProject
    deployments: deployments
    tags: resourceGroup.tags
  }
}

module rbac './modules/rbac.bicep' = {
  name: 'rbac'
  scope: resourceGroup
  params: {
    webPrincipalId: identity.outputs.principalId
    foundryProjectPrincipalId: foundry.outputs.projectPrincipalId
    registryName: resourceNames.registry
    keyVaultName: resourceNames.keyVault
    storageAccountName: resourceNames.storage
    searchServiceName: resourceNames.search
    mapsAccountName: resourceNames.maps
    foundryAccountName: resourceNames.foundryAccount
    foundryProjectName: resourceNames.foundryProject
  }
  dependsOn: [
    registry
    keyVault
    storage
    search
    maps
  ]
}

module containerApps './modules/container-apps.bicep' = {
  name: 'container-apps'
  scope: resourceGroup
  params: {
    location: location
    environmentName: resourceNames.containerEnvironment
    containerAppName: resourceNames.containerApp
    infrastructureSubnetId: network.outputs.containerAppsSubnetId
    logAnalyticsCustomerId: monitoring.outputs.logAnalyticsCustomerId
    logAnalyticsSharedKey: monitoring.outputs.logAnalyticsSharedKey
    registryServer: registry.outputs.loginServer
    webIdentityResourceId: identity.outputs.resourceId
    webContainerAppMode: webContainerAppMode
    webContainerImage: validatedWebContainerImage
    databaseSecretUri: keyVault.outputs.databaseUrlSecretUri
    externalIdSecretUri: keyVault.outputs.entraExternalIdClientSecretUri
    authSessionSecretUri: keyVault.outputs.authSessionSecretUri
    appInsightsConnectionString: monitoring.outputs.applicationInsightsConnectionString
    mapsClientId: maps.outputs.clientId
    foundryProjectEndpoint: foundry.outputs.projectEndpoint
    agentEndpoint: validatedAgentEndpoint
    searchEndpoint: search.outputs.endpoint
    searchIndexName: guidanceSearchIndexName
    environmentProfile: environmentProfile
    entraExternalIdTenantSubdomain: entraExternalIdTenantSubdomain
    entraExternalIdClientId: entraExternalIdClientId
    entraExternalIdAuthorityHost: entraExternalIdAuthorityHost
    entraExternalIdRedirectUri: entraExternalIdRedirectUri
    entraExternalIdIssuer: entraExternalIdIssuer
    entraExternalIdOrganizationId: entraExternalIdOrganizationId
    enableSyntheticAuth: enableSyntheticAuth
    minReplicas: containerAppMinReplicas
    maxReplicas: containerAppMaxReplicas
    cpu: webCpu
    memory: webMemory
    tags: resourceGroup.tags
  }
  dependsOn: [
    postgres
    rbac
  ]
}

output AZURE_RESOURCE_GROUP string = resourceGroup.name
output AZURE_CONTAINER_REGISTRY_NAME string = registry.outputs.name
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = registry.outputs.loginServer
output AZURE_CONTAINER_REGISTRY_RESOURCE_ID string = registry.outputs.resourceId
output AZURE_CONTAINER_APP_ENVIRONMENT_NAME string = containerApps.outputs.environmentName
output AZURE_CONTAINER_APP_NAME string = containerApps.outputs.containerAppName
output AZURE_CONTAINER_APP_URI string = containerApps.outputs.containerAppUri
output WEB_CONTAINER_APP_MODE string = webContainerAppMode
output WEB_CONTAINER_APP_PROVISIONED bool = bootstrapWebContainerApp
output SERVICE_WEB_NAME string = containerApps.outputs.containerAppName
output SERVICE_WEB_URI string = containerApps.outputs.containerAppUri
output AZURE_CLIENT_ID string = identity.outputs.clientId
output AZURE_KEY_VAULT_ENDPOINT string = keyVault.outputs.endpoint
output AZURE_STORAGE_ACCOUNT_NAME string = storage.outputs.name
output AZURE_STORAGE_BLOB_ENDPOINT string = storage.outputs.blobEndpoint
output AZURE_SEARCH_ENDPOINT string = search.outputs.endpoint
output AZURE_SEARCH_INDEX_NAME string = guidanceSearchIndexName
output AZURE_MAPS_CLIENT_ID string = maps.outputs.clientId
output AZURE_POSTGRES_HOST string = postgres.outputs.fullyQualifiedDomainName
output AZURE_POSTGRES_DATABASE string = postgresDatabaseName
output AZURE_POSTGRES_USER string = postgresAdminLogin
output DATABASE_SSL_MODE string = 'verify-full'
output APPLICATIONINSIGHTS_CONNECTION_STRING string = monitoring.outputs.applicationInsightsConnectionString
output AZURE_AI_ACCOUNT_NAME string = foundry.outputs.accountName
output AZURE_AI_PROJECT_NAME string = foundry.outputs.projectName
output AZURE_AI_PROJECT_ID string = foundry.outputs.projectId
output AZURE_AI_PROJECT_ENDPOINT string = foundry.outputs.projectEndpoint
output FOUNDRY_PROJECT_ENDPOINT string = foundry.outputs.projectEndpoint
output AZURE_AI_MODEL_DEPLOYMENT_NAME string = deployments[0].name
