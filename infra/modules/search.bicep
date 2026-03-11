// ============================================================================
// Azure AI Search (Free Tier)
// Used by: RAG knowledge base, Agent file search tool, semantic caching
// Tier: Free (3 indexes, 50MB, no semantic ranker)
// ============================================================================

@description('Azure region')
param location string

@description('Unique suffix for resource naming')
param resourceToken string

@description('Tags to apply')
param tags object = {}

var searchName = 'search-${resourceToken}'

resource search 'Microsoft.Search/searchServices@2024-03-01-preview' = {
  name: searchName
  location: location
  tags: tags
  sku: {
    name: 'free'
  }
  properties: {
    replicaCount: 1
    partitionCount: 1
    hostingMode: 'default'
    publicNetworkAccess: 'enabled'
    authOptions: {
      aadOrApiKey: {
        aadAuthFailureMode: 'http401WithBearerChallenge'
      }
    }
  }
}

output searchId string = search.id
output searchName string = search.name
output searchEndpoint string = 'https://${search.name}.search.windows.net'
