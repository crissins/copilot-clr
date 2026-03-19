@description('Azure location for all resources')
param location string = resourceGroup().location

@description('Unique Azure AI Foundry resource name. Must be globally unique because it is also used as the custom subdomain.')
param foundryAccountName string

@description('Foundry project name')
param foundryProjectName string = 'cognitive-load-app'

@description('Optional display name for the Foundry project')
param foundryProjectDisplayName string = 'Cognitive Load App'

@description('Optional description for the Foundry project')
param foundryProjectDescription string = 'Base conversational agent project for the hackathon'

@description('Model deployment name to expose as an azd environment variable')
param modelDeploymentName string = 'gpt-4.1-mini'

resource foundryAccount 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: foundryAccountName
  location: location
  kind: 'AIServices'
  identity: {
    type: 'SystemAssigned'
  }
  sku: {
    name: 'S0'
  }
  properties: {
    allowProjectManagement: true
    customSubDomainName: foundryAccountName
    disableLocalAuth: false
    dynamicThrottlingEnabled: false
    publicNetworkAccess: 'Enabled'
    restrictOutboundNetworkAccess: false
  }
}

resource foundryProject 'Microsoft.CognitiveServices/accounts/projects@2025-06-01' = {
  parent: foundryAccount
  name: foundryProjectName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    displayName: foundryProjectDisplayName
    description: foundryProjectDescription
  }
}

output AZURE_LOCATION string = location
output AZURE_RESOURCE_GROUP string = resourceGroup().name
output FOUNDRY_ACCOUNT_NAME string = foundryAccount.name
output FOUNDRY_PROJECT_NAME string = foundryProject.name
output FOUNDRY_PROJECT_ENDPOINT string = 'https://${foundryAccount.name}.services.ai.azure.com/api/projects/${foundryProject.name}'
output MODEL_DEPLOYMENT_NAME string = modelDeploymentName
output FOUNDRY_ACCOUNT_PRINCIPAL_ID string = foundryAccount.identity.principalId
output FOUNDRY_PROJECT_PRINCIPAL_ID string = foundryProject.identity.principalId
