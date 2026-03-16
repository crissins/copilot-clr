// ============================================================================
// Azure Speech Service
// Used by: Text-to-speech (neural voices), Speech-to-text (voice input)
// Tier: F0 (free, 5K chars TTS / 5hr STT per month) or S0 (pay-per-transaction)
// ============================================================================

@description('Azure region')
param location string

@description('Unique suffix for resource naming')
param resourceToken string

@description('Tags to apply')
param tags object = {}

@description('SKU name. Use F0 for free tier (5K chars TTS, 5hr STT/month) or S0 for production.')
param skuName string = 'S0'

var speechName = 'speech-${resourceToken}'

resource speech 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' = {
  name: speechName
  location: location
  tags: tags
  kind: 'SpeechServices'
  sku: {
    name: skuName
    tier: skuName == 'F0' ? 'Free' : 'Standard'
  }
  properties: {
    customSubDomainName: speechName
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
    }
  }
}

output speechId string = speech.id
output speechName string = speech.name
output speechEndpoint string = speech.properties.endpoint
output speechRegion string = location
