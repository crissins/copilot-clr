param foundryAccountName string
param location string = resourceGroup().location
param tags object = {}

resource foundryAccount 'Microsoft.CognitiveServices/accounts@2025-12-01' = {
  name: foundryAccountName
  location: location
  kind: 'AIServices'
  sku: {
    name: 'S0'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    allowProjectManagement: true
    customSubDomainName: foundryAccountName
    disableLocalAuth: false
    dynamicThrottlingEnabled: false
    publicNetworkAccess: 'Enabled'
    restrictOutboundNetworkAccess: false
  }
  tags: tags
}

output foundryAccountId string = foundryAccount.id
output foundryAccountNameOut string = foundryAccount.name
output foundryEndpoint string = 'https://${foundryAccount.name}.services.ai.azure.com'
