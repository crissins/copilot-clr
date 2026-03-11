// ============================================================================
// Azure Functions (Python Backend)
// Used by: Chat API endpoints, Agent Framework host
// Tier: Consumption (free 1M executions/month)
// Runtime: Python 3.11, Linux, v2 programming model
// ============================================================================

@description('Azure region')
param location string

@description('Unique suffix for resource naming')
param resourceToken string

@description('Tags to apply')
param tags object = {}

// Dependencies
@description('Storage account name for Functions runtime')
param storageAccountName string

@description('Application Insights connection string')
param appInsightsConnectionString string

@description('Cosmos DB endpoint')
param cosmosDbEndpoint string

@description('Azure OpenAI endpoint')
param openAiEndpoint string

@description('Azure AI Search endpoint')
param searchEndpoint string

@description('AI Services endpoint')
param aiServicesEndpoint string

@description('Service Bus namespace FQDN')
param serviceBusNamespace string

@description('Key Vault URI')
param keyVaultUri string

@description('AI Foundry Project name')
param aiProjectName string

@description('Static Web App default hostname (for CORS)')
param staticWebAppHostname string = ''

@description('Entra ID Client ID for token validation')
param entraClientId string = ''

var functionAppName = 'func-${resourceToken}'
var hostingPlanName = 'plan-${resourceToken}'

resource hostingPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: hostingPlanName
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {
    reserved: true // Required for Linux
  }
}

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: functionAppName
  location: location
  tags: union(tags, { 'azd-service-name': 'api' })
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: hostingPlan.id
    httpsOnly: true
    publicNetworkAccess: 'Enabled'
    siteConfig: {
      pythonVersion: '3.11'
      linuxFxVersion: 'Python|3.11'
      appSettings: [
        { name: 'AzureWebJobsStorage__accountName', value: storageAccountName }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'python' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsightsConnectionString }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'true' }
        // App-specific settings (all use managed identity, no keys)
        { name: 'COSMOS_DB_ENDPOINT', value: cosmosDbEndpoint }
        { name: 'COSMOS_DB_DATABASE', value: 'ChatApp' }
        { name: 'AZURE_OPENAI_ENDPOINT', value: openAiEndpoint }
        { name: 'AZURE_SEARCH_ENDPOINT', value: searchEndpoint }
        { name: 'AZURE_AI_SERVICES_ENDPOINT', value: aiServicesEndpoint }
        { name: 'SERVICE_BUS_NAMESPACE', value: serviceBusNamespace }
        { name: 'KEY_VAULT_URI', value: keyVaultUri }
        { name: 'AI_PROJECT_NAME', value: aiProjectName }
        { name: 'ENTRA_CLIENT_ID', value: entraClientId }
      ]
      cors: {
        allowedOrigins: empty(staticWebAppHostname) ? [
          'http://localhost:5173' // Vite dev server
        ] : [
          'https://${staticWebAppHostname}'
          'http://localhost:5173'
        ]
        supportCredentials: true
      }
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
    }
  }
}

output functionAppId string = functionApp.id
output functionAppName string = functionApp.name
output functionAppHostname string = functionApp.properties.defaultHostName
output functionAppPrincipalId string = functionApp.identity.principalId
output functionAppResourceId string = functionApp.id
