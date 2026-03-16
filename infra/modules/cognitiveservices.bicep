// ============================================================================
// Azure AI Services (Multi-service)
// Used by: Content Safety (input/output filtering), Language (PII detection)
// Tier: F0 (free, 20 calls/min) or S0 (pay-per-transaction)
// ============================================================================

@description('Azure region')
param location string

@description('Unique suffix for resource naming')
param resourceToken string

@description('Tags to apply')
param tags object = {}

@description('SKU name. Use F0 for free tier (20 calls/min) or S0 for production.')
param skuName string = 'S0'

var aiServicesName = 'ais-${resourceToken}'

resource aiServices 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' = {
  name: aiServicesName
  location: location
  tags: tags
  kind: 'CognitiveServices'
  sku: {
    name: skuName
    tier: skuName == 'F0' ? 'Free' : 'Standard'
  }
  properties: {
    customSubDomainName: aiServicesName
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
    }
  }
}

output aiServicesId string = aiServices.id
output aiServicesName string = aiServices.name
output aiServicesEndpoint string = aiServices.properties.endpoint
