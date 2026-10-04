param mapsAccountName string
param tags object

resource maps 'Microsoft.Maps/accounts@2023-06-01' = {
  name: mapsAccountName
  location: 'global'
  tags: tags
  kind: 'Gen2'
  sku: {
    name: 'G2'
  }
  properties: {
    disableLocalAuth: true
  }
}

output name string = maps.name
output resourceId string = maps.id
output clientId string = maps.properties.uniqueId
