// ============================================================================
// App Service — Free Tier (F1)
// Replaces Static Web App. F1 is free, no SLA, 60 CPU-min/day, 1 GB RAM.
// Available in all regions including eastus (unlike Microsoft.Web/staticSites).
// ============================================================================

@description('Azure region for the App Service plan and app')
param location string

@description('Unique token appended to resource names to avoid conflicts')
param resourceToken string

@description('Resource tags applied to all resources')
param tags object

// App Service Plan — F1 Free tier
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: 'plan-${resourceToken}'
  location: location
  tags: tags
  sku: {
    name: 'S1'   // Standard Linux: ~$54/mo
    tier: 'Standard'
  }
  properties: {
    reserved: true // Linux host — uses separate VM quota pool from Windows
  }
}

// App Service — hosts the built frontend static files or acts as a reverse proxy
resource appService 'Microsoft.Web/sites@2023-01-01' = {
  name: 'app-${resourceToken}'
  location: location
  tags: tags
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      // F1 does not support Always On — must stay false
      alwaysOn: false
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
    }
  }
}

// ============================================================================
// Outputs
// ============================================================================

@description('App Service resource name')
output appServiceName string = appService.name

@description('Default hostname (e.g. app-xxxxx.azurewebsites.net)')
output appServiceHostname string = appService.properties.defaultHostName

@description('App Service resource ID')
output appServiceId string = appService.id
