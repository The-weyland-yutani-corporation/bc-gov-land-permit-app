param location string
param searchServiceName string

@allowed([
  'basic'
  'standard'
])
param skuName string

param replicaCount int

@allowed([
  'free'
  'standard'
])
param semanticSearchTier string

param tags object

resource search 'Microsoft.Search/searchServices@2025-05-01' = {
  name: searchServiceName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  sku: {
    name: skuName
  }
  properties: {
    disableLocalAuth: true
    hostingMode: 'Default'
    networkRuleSet: {
      ipRules: []
    }
    partitionCount: 1
    publicNetworkAccess: 'Enabled'
    replicaCount: replicaCount
    semanticSearch: semanticSearchTier
  }
}

output name string = search.name
output resourceId string = search.id
output endpoint string = 'https://${search.name}.search.windows.net'
