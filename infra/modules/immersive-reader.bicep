// ============================================================================
// Azure Immersive Reader
// Used by: Accessible reading experience — line focus, syllabification,
//          picture dictionary, read-aloud, bilingual support
// Tier: S0 (pay-per-transaction, ~$0 in dev)
// ============================================================================

@description('Azure region')
param location string

@description('Unique suffix for resource naming')
param resourceToken string

@description('Tags to apply')
param tags object = {}

var irName = 'ir-${resourceToken}'

resource immersiveReader 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' = {
  name: irName
  location: location
  tags: tags
  kind: 'ImmersiveReader'
  sku: {
    name: 'S0'
    tier: 'Standard'
  }
  properties: {
    customSubDomainName: irName
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
    }
  }
}

output irId string = immersiveReader.id
output irName string = immersiveReader.name
output irEndpoint string = immersiveReader.properties.endpoint
