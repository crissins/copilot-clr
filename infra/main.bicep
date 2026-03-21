// ============================================================================
// MAIN ORCHESTRATOR — Copilot CLR Infrastructure
// AI Accessibility Assistant for Neurodiverse Users
// Deploys all modules in dependency order with a single command:
//   az deployment group create -g <rg> -f main.bicep -p main.bicepparam
//
// Deployment tiers (choose parameter file):
//   Production:   main.bicepparam          — full 18 services (~$10-14/mo)
//   Low-cost:     main.lowcost.bicepparam  — same 18 services, reduced capacity (~$6-8/mo)
//   Development:  main.dev.bicepparam      — API services only, no compute (~$0-2/mo)
//
// Services deployed (18 in prod/low-cost, 14 in dev — no ACR, Container Apps, App Service, Service Bus):
//   1.  Storage Account           10. Container Registry (Basic)*
//   2.  Key Vault                 11. Container Apps (Consumption)*
//   3.  Log Analytics + AppInsights 12. App Service (Free F1)*
//   4.  Azure OpenAI              13. Cosmos DB (Serverless)
//   5.  AI Foundry Hub            14. RBAC Role Assignments
//   6.  AI Foundry Project        15. Azure Speech Service
//   7.  AI Search (Free)          16. Azure Immersive Reader
//   8.  AI Services (Content Safety) 17. Entra ID (external)
//   9.  Service Bus (Basic)*      18. Managed Identity (system-assigned)
//   * Skipped when localDevMode=true (dev tier)
//
// NOTE: If Cognitive Services deployment fails with FlagMustBeSetForRestore,
// a soft-deleted account exists. Purge it first:
//   az cognitiveservices account purge \
//     --name <account-name> --resource-group <rg> --location <location>
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

@description('Local development mode — skip compute/hosting resources (Container Apps, ACR, App Service, Service Bus). Backend and frontend run locally. Use with main.dev.bicepparam.')
param localDevMode bool = false

@description('Static Web App SKU. Standard enables linked backend (API proxying to Container Apps). Free requires VITE_API_BASE for direct CORS calls.')
@allowed(['Free', 'Standard'])
param swaSkuName string = 'Standard'

// FIX BCP334: resourceToken expanded to 5 chars — Container Registry requires
// a minimum name length of 5. Longer token also reduces naming collision risk.
var resourceToken = substring(toLower(uniqueString(subscription().id, resourceGroup().id, projectName, environmentName)), 0, 5)

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
    skuName: 'S0' // Multi-service CognitiveServices requires S0
  }
}

module serviceBus 'modules/servicebus.bicep' = if (!localDevMode) {
  name: 'servicebus-deployment'
  params: {
    location: location
    resourceToken: resourceToken
    tags: tags
  }
}

module speech 'modules/speech.bicep' = {
  name: 'speech-deployment'
  params: {
    location: location
    resourceToken: resourceToken
    tags: tags
    skuName: 'S0' // Use S0 for paid tier to avoid free-account limit
  }
}

module immersiveReader 'modules/immersive-reader.bicep' = {
  name: 'immersive-reader-deployment'
  params: {
    location: location
    resourceToken: resourceToken
    tags: tags
  }
}

module documentIntelligence 'modules/document-intelligence.bicep' = {
  name: 'document-intelligence-deployment'
  params: {
    location: location
    resourceToken: resourceToken
    tags: tags
    skuName: 'S0' // Use S0 to avoid free-account limit
  }
}

// Container Registry — skipped in localDevMode (no containers in local development)
module containerRegistry 'modules/container-registry.bicep' = if (!localDevMode) {
  name: 'container-registry-deployment'
  params: {
    location: location
    resourceToken: resourceToken
    tags: tags
  }
}

// Static Web App (Free) — frontend hosting.
// Free tier does not use any VM quota.
// Skipped in localDevMode — frontend runs locally via `npm run dev`.
module staticWebApp 'modules/staticwebapp.bicep' = if (!localDevMode) {
  name: 'staticwebapp-deployment'
  params: {
    location: 'eastus2'
    resourceToken: resourceToken
    tags: tags
    skuName: swaSkuName
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

// Container Apps replaces Azure Functions as the API compute layer.
// Reasons: native WebSocket support for Azure OpenAI GPT Realtime API voice
// sessions (up to 30 min), scale-to-zero on Consumption plan ($0 idle cost),
// no per-request execution timeout, KEDA HTTP autoscaling.
module containerApps 'modules/container-apps.bicep' = if (!localDevMode) {
  name: 'container-apps-deployment'
  params: {
    location: location
    resourceToken: resourceToken
    tags: tags
    // FIX BCP318: All conditional module outputs below are guarded by the same
    // !localDevMode condition as this module itself, so they are guaranteed
    // non-null at runtime. #disable-next-line suppresses the false-positive warning.
    #disable-next-line BCP318
    registryLoginServer: containerRegistry.outputs.registryLoginServer
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsId
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    cosmosDbEndpoint: cosmosDb.outputs.cosmosDbEndpoint
    openAiEndpoint: openAi.outputs.openAiEndpoint
    searchEndpoint: search.outputs.searchEndpoint
    aiServicesEndpoint: aiServices.outputs.aiServicesEndpoint
    #disable-next-line BCP318
    serviceBusNamespace: '${serviceBus.outputs.serviceBusName}.servicebus.windows.net'
    keyVaultUri: keyVault.outputs.keyVaultUri
    aiProjectName: aiFoundryProject.outputs.projectName
    aiFoundryEndpoint: aiFoundryProject.outputs.projectDiscoveryUrl
    #disable-next-line BCP318
    staticWebAppHostname: staticWebApp.outputs.staticWebAppHostname
    entraClientId: entraClientId
    containerCpu: containerCpu
    containerMemory: containerMemory
    speechEndpoint: speech.outputs.speechEndpoint
    speechRegion: speech.outputs.speechRegion
    irEndpoint: immersiveReader.outputs.irEndpoint
    docIntelEndpoint: documentIntelligence.outputs.docIntelEndpoint
  }
}

// Link SWA → Container Apps backend for transparent /api/* proxying.
// Requires SWA Standard tier. Conditional on both SWA and Container Apps existing.
module swaLinkedBackend 'modules/swa-linked-backend.bicep' = if (!localDevMode && swaSkuName == 'Standard') {
  name: 'swa-linked-backend-deployment'
  params: {
    #disable-next-line BCP318
    staticWebAppName: staticWebApp.outputs.staticWebAppName
    #disable-next-line BCP318
    containerAppResourceId: containerApps.outputs.containerAppId
    location: location
  }
}

// ============================================================================
// Phase 4: Security — RBAC Role Assignments (depends on all above)
// ============================================================================

module security 'modules/security.bicep' = {
  name: 'security-deployment'
  params: {
    localDevMode: localDevMode
    #disable-next-line BCP318
    containerAppPrincipalId: localDevMode ? '' : containerApps.outputs.containerAppPrincipalId
    #disable-next-line BCP318
    containerRegistryName: localDevMode ? '' : containerRegistry.outputs.registryName
    hubPrincipalId: aiFoundryHub.outputs.hubPrincipalId
    projectPrincipalId: aiFoundryProject.outputs.projectPrincipalId
    speechName: speech.outputs.speechName
    irName: immersiveReader.outputs.irName
    cosmosDbName: cosmosDb.outputs.cosmosDbName
    storageAccountName: storage.outputs.storageAccountName
    keyVaultName: keyVault.outputs.keyVaultName
    openAiName: openAi.outputs.openAiName
    searchName: search.outputs.searchName
    aiServicesName: aiServices.outputs.aiServicesName
    #disable-next-line BCP318
    serviceBusName: localDevMode ? '' : serviceBus.outputs.serviceBusName
    aiProjectName: aiFoundryProject.outputs.projectName
  }
}

// ============================================================================
// Outputs — Used by GitHub Actions and deploy scripts
// ============================================================================

output RESOURCE_GROUP string = resourceGroup().name
output AZURE_LOCATION string = location

// Compute (empty in localDevMode — backend and frontend run locally)
#disable-next-line BCP318
output CONTAINER_APP_NAME string = localDevMode ? '' : containerApps.outputs.containerAppName
#disable-next-line BCP318
output CONTAINER_APP_HOSTNAME string = localDevMode ? '' : containerApps.outputs.containerAppHostname
#disable-next-line BCP318
output CONTAINER_REGISTRY_LOGIN_SERVER string = localDevMode ? '' : containerRegistry.outputs.registryLoginServer
#disable-next-line BCP318
output STATIC_WEB_APP_NAME string = localDevMode ? '' : staticWebApp.outputs.staticWebAppName
#disable-next-line BCP318
output STATIC_WEB_APP_HOSTNAME string = localDevMode ? '' : staticWebApp.outputs.staticWebAppHostname

// AI
output AZURE_OPENAI_ENDPOINT string = openAi.outputs.openAiEndpoint
output AI_FOUNDRY_PROJECT_NAME string = aiFoundryProject.outputs.projectName

// Data
output COSMOS_DB_ENDPOINT string = cosmosDb.outputs.cosmosDbEndpoint
output AZURE_SEARCH_ENDPOINT string = search.outputs.searchEndpoint

// Monitoring
output APP_INSIGHTS_NAME string = monitoring.outputs.appInsightsName

// Speech + Immersive Reader
output SPEECH_ENDPOINT string = speech.outputs.speechEndpoint
output SPEECH_REGION string = speech.outputs.speechRegion
output IR_ENDPOINT string = immersiveReader.outputs.irEndpoint

// Document Intelligence
output DOC_INTELLIGENCE_ENDPOINT string = documentIntelligence.outputs.docIntelEndpoint

// Storage
output STORAGE_ACCOUNT_NAME string = storage.outputs.storageAccountName
