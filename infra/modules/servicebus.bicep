// ============================================================================
// Azure Service Bus (Basic Tier)
// Used by: Async agent task processing, background document indexing
// Tier: Basic (~$0.05/month)
// ============================================================================

@description('Azure region')
param location string

@description('Unique suffix for resource naming')
param resourceToken string

@description('Tags to apply')
param tags object = {}

var serviceBusName = 'sb-${resourceToken}'

resource serviceBus 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: serviceBusName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
    tier: 'Basic'
  }
  properties: {
    minimumTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}

resource agentTasksQueue 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  parent: serviceBus
  name: 'agent-tasks'
  properties: {
    maxDeliveryCount: 5
    defaultMessageTimeToLive: 'P1D' // 1 day TTL
    lockDuration: 'PT1M'
    deadLetteringOnMessageExpiration: true
  }
}

resource notificationsQueue 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  parent: serviceBus
  name: 'notifications'
  properties: {
    maxDeliveryCount: 3
    defaultMessageTimeToLive: 'PT4H' // 4 hour TTL
    lockDuration: 'PT30S'
    deadLetteringOnMessageExpiration: true
  }
}

output serviceBusId string = serviceBus.id
output serviceBusName string = serviceBus.name
output serviceBusEndpoint string = serviceBus.properties.serviceBusEndpoint
