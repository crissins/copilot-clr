// ============================================================================
// Azure Static Web Apps (React Frontend)
// Used by: Chat UI hosting, built-in Entra ID authentication
// Tier: Free
// ============================================================================

@description('Azure region')
param location string

@description('Unique suffix for resource naming')
param resourceToken string

@description('Tags to apply')
param tags object = {}

var staticWebAppName = 'swa-${resourceToken}'

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: staticWebAppName
  location: location
  tags: union(tags, { 'azd-service-name': 'frontend' })
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    buildProperties: {
      appLocation: '/frontend'
      outputLocation: 'dist'
      skipGithubActionWorkflowGeneration: true
    }
  }
}

output staticWebAppId string = staticWebApp.id
output staticWebAppName string = staticWebApp.name
output staticWebAppHostname string = staticWebApp.properties.defaultHostname
output staticWebAppDeploymentToken string = staticWebApp.listSecrets().properties.apiKey
