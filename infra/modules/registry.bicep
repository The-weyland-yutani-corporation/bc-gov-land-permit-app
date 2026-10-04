param location string
param registryName string

@allowed([
  'Basic'
  'Standard'
  'Premium'
])
param skuName string

param tags object

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryName
  location: location
  tags: tags
  sku: {
    name: skuName
  }
  properties: {
    adminUserEnabled: false
    dataEndpointEnabled: false
    networkRuleBypassOptions: 'AzureServices'
    publicNetworkAccess: 'Enabled'
  }
}

output name string = registry.name
output resourceId string = registry.id
output loginServer string = registry.properties.loginServer
