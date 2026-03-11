// ============================================================================
// MAIN ORCHESTRATOR — Azure Voice + Chat App Infrastructure
// Deploys all modules in dependency order with a single command:
//   az deployment group create -g <rg> -f main.bicep -p main.bicepparam
//
// Services deployed (14):
//   1.  Storage Account           8.  AI Services (Content Safety)
//   2.  Key Vault                 9.  Service Bus (Basic)
//   3.  Log Analytics + AppInsights 10. Container Registry (Basic)
//   4.  Azure OpenAI             11.  Container Apps (Consumption)
//   5.  AI Foundry Hub           12.  Static Web App (Free — frontend only)
//   6.  AI Foundry Project       13.  Cosmos DB (Serverless)
//   7.  AI Search (Free)         14.  RBAC Role Assignments
// ============================================================================

@description('Primary Azure region for all resources')
param location string = 'eastus'

@description('Environment name (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environmentName string = 'dev'

@description('Project name used for resource naming')
param projectName string = 'chatapp'

@description('Entra ID Client ID for user authentication (set after app registration)')
param entraClientId string = ''

// ============================================================================
// Low-Cost Configuration — override in main.lowcost.bicepparam
// Default values deploy the full-featured standard configuration.
// ============================================================================

@description('GPT-4o-mini TPM capacity (1 unit = 1K tokens/min). Set 1 in low-cost mode.')
param openAiChatCapacity int = 10

@description('text-embedding-ada-002 TPM capacity. Set 1 in low-cost mode.')
param openAiEmbeddingCapacity int = 10

@description('Deploy gpt-4o-mini-realtime-preview for voice interactions. Set false in low-cost mode — Realtime API charges ~$0.06/min input + $0.24/min output audio.')
param deployVoice bool = true

@description('Container App CPU (vCPU). Use 0.25 in low-cost mode (must pair with 0.5Gi memory).')
param containerCpu string = '0.5'

@description('Container App memory. Must match CPU tier: 0.25→0.5Gi, 0.5→1Gi.')
param containerMemory string = '1Gi'

@description('Log Analytics and App Insights retention in days. Set 7 in low-cost mode.')
param logRetentionDays int = 30

// Generate a unique token for resource naming to avoid conflicts
var resourceToken = toLower(uniqueString(subscription().id, resourceGroup().id, projectName, environmentName))

var tags = {
  project: projectName
  environment: environmentName
  'managed-by': 'bicep'
}

// ============================================================================
// Phase 1: Foundation (no dependencies)
// ============================================================================

module storage 'modules/storage.bicep' = {
  name: 'storage-deployment'
  params: {
    location: location
    resourceToken: resourceToken
    tags: tags
  }
}

module keyVault 'modules/keyvault.bicep' = {
  name: 'keyvault-deployment'
  params: {
    location: location
    resourceToken: resourceToken
    tags: tags
  }
}

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring-deployment'
  params: {
    location: location
    resourceToken: resourceToken
    tags: tags
    logRetentionDays: logRetentionDays
  }
}

module cosmosDb 'modules/cosmosdb.bicep' = {
  name: 'cosmosdb-deployment'
  params: {
    location: location
    resourceToken: resourceToken
    tags: tags
  }
}

module search 'modules/search.bicep' = {
  name: 'search-deployment'
  params: {
    location: location
    resourceToken: resourceToken
    tags: tags
  }
}

module aiServices 'modules/cognitiveservices.bicep' = {
  name: 'cognitiveservices-deployment'
  params: {
    location: location
    resourceToken: resourceToken
    tags: tags
  }
}

module serviceBus 'modules/servicebus.bicep' = {
  name: 'servicebus-deployment'
  params: {
    location: location
    resourceToken: resourceToken
    tags: tags
  }
}

// Container Registry — must exist before Container Apps references its login server
module containerRegistry 'modules/container-registry.bicep' = {
  name: 'container-registry-deployment'
  params: {
    location: location
    resourceToken: resourceToken
    tags: tags
  }
}

// ============================================================================
// Phase 2: AI Layer (depends on storage, keyvault, monitoring)
// ============================================================================

module openAi 'modules/openai.bicep' = {
  name: 'openai-deployment'
  params: {
    location: location
    resourceToken: resourceToken
    tags: tags
    chatModelCapacity: openAiChatCapacity
    embeddingModelCapacity: openAiEmbeddingCapacity
    deployRealtimeModel: deployVoice
  }
}

module aiFoundryHub 'modules/ai-foundry-hub.bicep' = {
  name: 'ai-foundry-hub-deployment'
  params: {
    location: location
    resourceToken: resourceToken
    tags: tags
    storageAccountId: storage.outputs.storageAccountId
    keyVaultId: keyVault.outputs.keyVaultId
    appInsightsId: monitoring.outputs.appInsightsId
    openAiId: openAi.outputs.openAiId
    openAiName: openAi.outputs.openAiName
    searchServiceId: search.outputs.searchId
    searchServiceName: search.outputs.searchName
  }
}

module aiFoundryProject 'modules/ai-foundry-project.bicep' = {
  name: 'ai-foundry-project-deployment'
  params: {
    location: location
    resourceToken: resourceToken
    tags: tags
    hubId: aiFoundryHub.outputs.hubId
  }
}

// ============================================================================
// Phase 3: Compute (depends on foundation + AI layer + container registry)
// ============================================================================

module staticWebApp 'modules/staticwebapp.bicep' = {
  name: 'staticwebapp-deployment'
  params: {
    location: location
    resourceToken: resourceToken
    tags: tags
  }
}

// Container Apps replaces Azure Functions as the API compute layer.
// Reasons: native WebSocket support for Azure OpenAI GPT Realtime API voice
// sessions (up to 30 min), scale-to-zero on Consumption plan ($0 idle cost),
// no per-request execution timeout, KEDA HTTP autoscaling.
module containerApps 'modules/container-apps.bicep' = {
  name: 'container-apps-deployment'
  params: {
    location: location
    resourceToken: resourceToken
    tags: tags
    registryLoginServer: containerRegistry.outputs.registryLoginServer
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsId
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    cosmosDbEndpoint: cosmosDb.outputs.cosmosDbEndpoint
    openAiEndpoint: openAi.outputs.openAiEndpoint
    searchEndpoint: search.outputs.searchEndpoint
    aiServicesEndpoint: aiServices.outputs.aiServicesEndpoint
    serviceBusNamespace: '${serviceBus.outputs.serviceBusName}.servicebus.windows.net'
    keyVaultUri: keyVault.outputs.keyVaultUri
    aiProjectName: aiFoundryProject.outputs.projectName
    staticWebAppHostname: staticWebApp.outputs.staticWebAppHostname
    entraClientId: entraClientId
    containerCpu: containerCpu
    containerMemory: containerMemory
  }
}

// ============================================================================
// Phase 4: Security — RBAC Role Assignments (depends on all above)
// ============================================================================

module security 'modules/security.bicep' = {
  name: 'security-deployment'
  params: {
    containerAppPrincipalId: containerApps.outputs.containerAppPrincipalId
    containerRegistryName: containerRegistry.outputs.registryName
    hubPrincipalId: aiFoundryHub.outputs.hubPrincipalId
    projectPrincipalId: aiFoundryProject.outputs.projectPrincipalId
    cosmosDbName: cosmosDb.outputs.cosmosDbName
    storageAccountName: storage.outputs.storageAccountName
    keyVaultName: keyVault.outputs.keyVaultName
    openAiName: openAi.outputs.openAiName
    searchName: search.outputs.searchName
    aiServicesName: aiServices.outputs.aiServicesName
    serviceBusName: serviceBus.outputs.serviceBusName
    aiProjectName: aiFoundryProject.outputs.projectName
  }
}

// ============================================================================
// Outputs — Used by GitHub Actions and deploy scripts
// ============================================================================

output RESOURCE_GROUP string = resourceGroup().name
output AZURE_LOCATION string = location

// Compute
output CONTAINER_APP_NAME string = containerApps.outputs.containerAppName
output CONTAINER_APP_HOSTNAME string = containerApps.outputs.containerAppHostname
output CONTAINER_REGISTRY_LOGIN_SERVER string = containerRegistry.outputs.registryLoginServer
output STATIC_WEB_APP_NAME string = staticWebApp.outputs.staticWebAppName
output STATIC_WEB_APP_HOSTNAME string = staticWebApp.outputs.staticWebAppHostname

// AI
output AZURE_OPENAI_ENDPOINT string = openAi.outputs.openAiEndpoint
output AI_FOUNDRY_PROJECT_NAME string = aiFoundryProject.outputs.projectName

// Data
output COSMOS_DB_ENDPOINT string = cosmosDb.outputs.cosmosDbEndpoint
output AZURE_SEARCH_ENDPOINT string = search.outputs.searchEndpoint

// Monitoring
output APP_INSIGHTS_NAME string = monitoring.outputs.appInsightsName

// Storage
output STORAGE_ACCOUNT_NAME string = storage.outputs.storageAccountName
