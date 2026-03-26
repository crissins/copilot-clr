// Foundry Account + Project for Agent Service (Basic Setup)
// This creates a proper Microsoft Foundry resource with agent capabilities

param aiFoundryName string = 'foundry-kvhky'
param aiProjectName string = '${aiFoundryName}-proj'
param location string = 'eastus2'

/* A Foundry account is a CognitiveServices/account kind=AIServices */
resource aiFoundry 'Microsoft.CognitiveServices/accounts@2025-04-01-preview' = {
  name: aiFoundryName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  sku: {
    name: 'S0'
  }
  kind: 'AIServices'
  properties: {
    allowProjectManagement: true
    customSubDomainName: aiFoundryName
    disableLocalAuth: false
    publicNetworkAccess: 'Enabled'
  }
}

/* Project under the Foundry account */
resource aiProject 'Microsoft.CognitiveServices/accounts/projects@2025-04-01-preview' = {
  name: aiProjectName
  parent: aiFoundry
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {}
}

/* Deploy gpt-4o-mini model for agents */
resource modelDeployment 'Microsoft.CognitiveServices/accounts/deployments@2025-04-01-preview' = {
  parent: aiFoundry
  name: 'gpt-4o-mini'
  sku: {
    capacity: 50
    name: 'GlobalStandard'
  }
  properties: {
    model: {
      name: 'gpt-4o-mini'
      format: 'OpenAI'
      version: '2024-07-18'
    }
  }
}

output projectEndpoint string = 'https://${aiFoundryName}.services.ai.azure.com/api/projects/${aiProjectName}'
output foundryEndpoint string = aiFoundry.properties.endpoint
output projectName string = aiProjectName
