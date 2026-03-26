// ============================================================================
// SWA Linked Backend — Transparent /api/* proxying to Container Apps
// Requires: SWA Standard tier
// See: https://learn.microsoft.com/azure/static-web-apps/apis-container-apps
// ============================================================================

@description('Name of the existing Static Web App')
param staticWebAppName string

@description('Full ARM resource ID of the Container App backend')
param containerAppResourceId string

@description('Region where the Container App is deployed')
param location string

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' existing = {
  name: staticWebAppName
}

resource linkedBackend 'Microsoft.Web/staticSites/linkedBackends@2023-12-01' = {
  parent: staticWebApp
  name: 'backend'
  properties: {
    backendResourceId: containerAppResourceId
    region: location
  }
}
