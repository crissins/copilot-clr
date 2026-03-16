// ============================================================================
// Azure Document Intelligence (Form Recognizer)
// Used by: PDF/DOCX layout extraction, table/figure detection
// Tier: F0 (free, 500 pages/month) or S0 (pay-per-transaction)
// ============================================================================

@description('Azure region')
param location string

@description('Unique suffix for resource naming')
param resourceToken string

@description('Tags to apply')
param tags object = {}

@description('SKU name. Use F0 for free tier (500 pages/month) or S0 for production.')
param skuName string = 'S0'

var docIntelName = 'document-intelligence-${resourceToken}'

resource docIntelligence 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' = {
  name: docIntelName
  location: location
  tags: tags
  kind: 'FormRecognizer'
  sku: {
    name: skuName
    tier: skuName == 'F0' ? 'Free' : 'Standard'
  }
  properties: {
    customSubDomainName: docIntelName
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
    }
  }
}

output docIntelId string = docIntelligence.id
output docIntelName string = docIntelligence.name
output docIntelEndpoint string = docIntelligence.properties.endpoint
