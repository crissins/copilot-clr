// ============================================================================
// Azure OpenAI Service
// Used by: AI Foundry Hub (connected AI service), Agent Framework inference
// Tier: S0 (pay-per-token, ~$1-5/mo in dev with gpt-4o-mini)
// Models: gpt-4o-mini (chat), text-embedding-ada-002 (vectors)
// ============================================================================

@description('Azure region')
param location string

@description('Unique suffix for resource naming')
param resourceToken string

@description('Tags to apply')
param tags object = {}

@description('TPM capacity for gpt-4o-mini. Each unit = 1K tokens/min. Set 1 in low-cost mode to cap runaway usage.')
param chatModelCapacity int = 10

@description('TPM capacity for text-embedding-ada-002. Set 1 in low-cost mode.')
param embeddingModelCapacity int = 10

@description('Deploy gpt-4o-mini-realtime-preview for voice. Realtime API costs ~$0.06/min input + $0.24/min output audio — set false in low-cost mode.')
param deployRealtimeModel bool = true

var openAiName = 'open-ai-${resourceToken}'

resource openAi 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' = {
  name: openAiName
  location: location
  tags: tags
  kind: 'OpenAI'
  sku: {
    name: 'S0'
    tier: 'Standard'
  }
  properties: {
    customSubDomainName: openAiName
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
    }
  }
}

resource gpt4oMiniDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = {
  parent: openAi
  name: 'gpt-4o-mini'
  sku: {
    name: 'Standard'
    capacity: chatModelCapacity // 1K tokens per minute per unit
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4o-mini'
      version: '2024-07-18'
    }
    raiPolicyName: 'Microsoft.DefaultV2'
  }
}

resource embeddingDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = {
  parent: openAi
  name: 'text-embedding-ada-002'
  dependsOn: [gpt4oMiniDeployment] // Sequential deployment required by Azure OpenAI
  sku: {
    name: 'Standard'
    capacity: embeddingModelCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'text-embedding-ada-002'
      version: '2'
    }
  }
}

// Sequential deployment required — each model must finish before the next starts
// Set deployRealtimeModel = false in low-cost mode: Realtime API costs ~$0.06/min input + $0.24/min output audio
resource realtimeDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = if (deployRealtimeModel) {
  parent: openAi
  name: 'gpt-4o-mini-realtime-preview'
  dependsOn: [embeddingDeployment]
  sku: {
    name: 'GlobalStandard'
    capacity: 6 // 6K tokens per minute (min capacity for realtime preview)
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4o-mini-realtime-preview'
      version: '2024-12-17'
    }
    raiPolicyName: 'Microsoft.DefaultV2'
  }
}

output openAiId string = openAi.id
output openAiName string = openAi.name
output openAiEndpoint string = openAi.properties.endpoint
