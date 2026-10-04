param location string
param vaultName string
param softDeleteRetentionDays int
param enablePurgeProtection bool
param postgresServerName string
param postgresDatabaseName string
param postgresAdminLogin string

@secure()
param postgresAdminPassword string

@secure()
param entraExternalIdClientSecret string

@secure()
param authSessionSecret string

param createExternalIdSecret bool
param tags object

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: vaultName
  location: location
  tags: tags
  properties: {
    tenantId: tenant().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enablePurgeProtection: enablePurgeProtection
    enableRbacAuthorization: true
    enableSoftDelete: true
    publicNetworkAccess: 'Enabled'
    softDeleteRetentionInDays: softDeleteRetentionDays
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }
}

var encodedPassword = uriComponent(postgresAdminPassword)
var databaseUrl = 'postgresql://${postgresAdminLogin}:${encodedPassword}@${postgresServerName}.postgres.database.azure.com:5432/${postgresDatabaseName}?sslmode=verify-full'

resource databaseUrlSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: 'database-url'
  parent: vault
  properties: {
    value: databaseUrl
    contentType: 'text/plain'
  }
}

resource externalIdClientSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (createExternalIdSecret) {
  name: 'entra-external-id-client-secret'
  parent: vault
  properties: {
    value: entraExternalIdClientSecret
    contentType: 'text/plain'
  }
}

resource authSessionSecretResource 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: 'auth-session-secret'
  parent: vault
  properties: {
    value: authSessionSecret
    contentType: 'text/plain'
  }
}

output endpoint string = vault.properties.vaultUri
output databaseUrlSecretUri string = '${vault.properties.vaultUri}secrets/${databaseUrlSecret.name}'
output entraExternalIdClientSecretUri string = createExternalIdSecret ? '${vault.properties.vaultUri}secrets/${externalIdClientSecret.name}' : ''
output authSessionSecretUri string = '${vault.properties.vaultUri}secrets/${authSessionSecretResource.name}'
