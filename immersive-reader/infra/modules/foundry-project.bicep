param foundryAccountName string
param foundryProjectName string
param location string = resourceGroup().location
param projectDisplayName string = foundryProjectName
param projectDescription string = 'Hackathon cognitive load reduction project'
param tags object = {}

resource foundryAccount 'Microsoft.CognitiveServices/accounts@2025-12-01' existing = {
  name: foundryAccountName
}

resource foundryProject 'Microsoft.CognitiveServices/accounts/projects@2025-12-01' = {
  parent: foundryAccount
  name: foundryProjectName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    displayName: projectDisplayName
    description: projectDescription
  }
  tags: tags
}

output foundryProjectId string = foundryProject.id
output azureAiProjectEndpoint string = 'https://${foundryAccount.name}.services.ai.azure.com/api/projects/${foundryProject.name}'
