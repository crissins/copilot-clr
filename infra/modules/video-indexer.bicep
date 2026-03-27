// ============================================================================
// Azure Video Indexer
// Extracts transcripts, topics, and scenes from uploaded videos.
// Tier: Pay-as-you-go (Trial allows 40 free indexing hours per account)
// ============================================================================

@description('Azure region')
param location string

@description('Unique suffix for resource naming')
param resourceToken string

@description('Tags to apply')
param tags object = {}

@description('Storage Account ID attached to Video Indexer')
param storageAccountId string

var videoIndexerName = 'videoindexer-${resourceToken}'

resource videoIndexer 'Microsoft.VideoIndexer/accounts@2024-01-01' = {
  name: videoIndexerName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    accountId: '00000000-0000-0000-0000-000000000000' // This is ignored during creation but required by schema
    storageServices: {
      resourceId: storageAccountId
    }
  }
}

output videoIndexerId string = videoIndexer.id
output videoIndexerName string = videoIndexer.name
output videoIndexerAccountId string = videoIndexer.properties.accountId
output videoIndexerLocation string = videoIndexer.location
