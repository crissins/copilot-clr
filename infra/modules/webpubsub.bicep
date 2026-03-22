// ============================================================================
// Azure Web PubSub Service
// Used by: Real-time voice sessions (browser ↔ Voice Live + Foundry Agent)
// Reason: Azure Static Web Apps don't support WebSocket proxying to linked
//         backends. Web PubSub acts as the real-time transport layer.
// Hub: "voice" — event handler forwards CloudEvents to the Container App.
// Tier: Free_F1 (20 concurrent connections, 20K messages/day) or
//       Standard_S1 (1000 concurrent connections, unlimited messages)
// ============================================================================

@description('Azure region')
param location string

@description('Unique suffix for resource naming')
param resourceToken string

@description('Tags to apply')
param tags object = {}

@description('SKU name. Free_F1 for dev, Standard_S1 for production.')
param skuName string = 'Free_F1'

@description('FQDN of the backend Container App (event handler target)')
param backendHostname string

var webPubSubName = 'webpubsub-${resourceToken}'

resource webPubSub 'Microsoft.SignalRService/webPubSub@2024-03-01' = {
  name: webPubSubName
  location: location
  tags: tags
  sku: {
    name: skuName
    capacity: 1
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    tls: {
      clientCertEnabled: false
    }
    publicNetworkAccess: 'Enabled'
  }
}

resource voiceHub 'Microsoft.SignalRService/webPubSub/hubs@2024-03-01' = {
  parent: webPubSub
  name: 'voice'
  properties: {
    eventHandlers: [
      {
        urlTemplate: 'https://${backendHostname}/api/webpubsub/voice'
        userEventPattern: '*'
        systemEvents: [
          'connect'
          'disconnected'
        ]
      }
    ]
    anonymousConnectPolicy: 'deny'
  }
}

output webPubSubId string = webPubSub.id
output webPubSubName string = webPubSub.name
output webPubSubHostname string = webPubSub.properties.hostName
output webPubSubEndpoint string = 'https://${webPubSub.properties.hostName}'
output webPubSubPrincipalId string = webPubSub.identity.principalId
