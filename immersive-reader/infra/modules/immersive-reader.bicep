param immersiveReaderName string
param location string = resourceGroup().location
param tags object = {}

resource immersiveReader 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: immersiveReaderName
  location: location
  kind: 'ImmersiveReader'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: immersiveReaderName
    publicNetworkAccess: 'Enabled'
  }
  tags: tags
}

output immersiveReaderId string = immersiveReader.id
output immersiveReaderNameOut string = immersiveReader.name
output immersiveReaderSubdomain string = immersiveReader.name
