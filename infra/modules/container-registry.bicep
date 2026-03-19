// ============================================================================
// Azure Container Registry (Basic)
// Used by: Container Apps — stores the backend container image
// Tier: Basic (~$5/month) — sufficient for dev/hackathon
// Auth: Admin user disabled; Container App uses AcrPull via managed identity
// ============================================================================

@description('Azure region')
param location string

@description('Unique suffix for resource naming')
@minLength(5)
param resourceToken string

@description('Tags to apply')
param tags object = {}

var acrName = 'container-registry${resourceToken}'

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false // Use managed identity only — no admin secrets
    publicNetworkAccess: 'Enabled'
    zoneRedundancy: 'Disabled'
  }
}

output registryId string = containerRegistry.id
output registryName string = containerRegistry.name
output registryLoginServer string = containerRegistry.properties.loginServer
