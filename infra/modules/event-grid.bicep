// ============================================================================
// Azure Event Grid � System Topic for Blob Storage events
// Used by: Trigger Azure Functions on document upload to blob storage
// ============================================================================

@description('Azure region')
param location string

@description('Unique suffix for resource naming')
param resourceToken string

@description('Tags to apply')
param tags object = {}

@description('Storage account resource ID')
param storageAccountId string

var topicName = 'event-grid-${resourceToken}'

resource systemTopic 'Microsoft.EventGrid/systemTopics@2024-06-01-preview' = {
  name: topicName
  location: location
  tags: tags
  properties: {
    source: storageAccountId
    topicType: 'Microsoft.Storage.StorageAccounts'
  }
}

output systemTopicId string = systemTopic.id
output systemTopicName string = systemTopic.name
