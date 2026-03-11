// ============================================================================
// Azure AI Foundry Hub
// Central governance layer for AI services. Connects Storage, Key Vault,
// App Insights, and OpenAI as managed dependencies.
// Kind: Hub (parent workspace for AI Foundry Projects)
// ============================================================================

@description('Azure region')
param location string

@description('Unique suffix for resource naming')
param resourceToken string

@description('Tags to apply')
param tags object = {}

// Connected service resource IDs (required by Hub)
@description('Storage Account ID')
param storageAccountId string

@description('Key Vault ID')
param keyVaultId string

@description('Application Insights ID')
param appInsightsId string

@description('Azure OpenAI resource ID')
param openAiId string

@description('Azure OpenAI resource name')
param openAiName string

@description('Azure AI Search resource ID')
param searchServiceId string = ''

@description('Azure AI Search resource name')
param searchServiceName string = ''

var hubName = 'aihub-${resourceToken}'

resource hub 'Microsoft.MachineLearningServices/workspaces@2024-04-01' = {
  name: hubName
  location: location
  tags: tags
  kind: 'Hub'
  sku: {
    name: 'Basic'
    tier: 'Basic'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    friendlyName: 'AI Foundry Hub'
    description: 'Central AI governance hub for the chat application'
    storageAccount: storageAccountId
    keyVault: keyVaultId
    applicationInsights: appInsightsId
    publicNetworkAccess: 'Enabled'
  }
}

// Connect Azure OpenAI to the Hub
resource openAiConnection 'Microsoft.MachineLearningServices/workspaces/connections@2024-04-01' = {
  parent: hub
  name: 'aoai-connection'
  properties: {
    category: 'AzureOpenAI'
    authType: 'AAD'
    isSharedToAll: true
    target: 'https://${openAiName}.openai.azure.com/'
    metadata: {
      ApiType: 'Azure'
      ResourceId: openAiId
    }
  }
}

// Connect Azure AI Search to the Hub (if provided)
resource searchConnection 'Microsoft.MachineLearningServices/workspaces/connections@2024-04-01' = if (!empty(searchServiceId)) {
  parent: hub
  name: 'search-connection'
  properties: {
    category: 'CognitiveSearch'
    authType: 'AAD'
    isSharedToAll: true
    target: 'https://${searchServiceName}.search.windows.net'
    metadata: {
      ResourceId: searchServiceId
    }
  }
}

output hubId string = hub.id
output hubName string = hub.name
output hubPrincipalId string = hub.identity.principalId
