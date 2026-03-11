// ============================================================================
// Azure AI Foundry Project
// Workspace for deploying and managing AI agents via Agent Service.
// Kind: Project (child of Hub)
// The Agent Framework SDK connects to this project endpoint.
// ============================================================================

@description('Azure region')
param location string

@description('Unique suffix for resource naming')
param resourceToken string

@description('Tags to apply')
param tags object = {}

@description('AI Foundry Hub resource ID (parent)')
param hubId string

var projectName = 'aiproj-${resourceToken}'

resource project 'Microsoft.MachineLearningServices/workspaces@2024-04-01' = {
  name: projectName
  location: location
  tags: tags
  kind: 'Project'
  sku: {
    name: 'Basic'
    tier: 'Basic'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    friendlyName: 'Chat App AI Project'
    description: 'AI Foundry project for chat agent deployment and management'
    hubResourceId: hubId
    publicNetworkAccess: 'Enabled'
  }
}

output projectId string = project.id
output projectName string = project.name
output projectPrincipalId string = project.identity.principalId
// The discovery URL is used by the Agent Framework SDK to connect
output projectDiscoveryUrl string = project.properties.discoveryUrl
