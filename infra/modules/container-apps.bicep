// ============================================================================
// Azure Container Apps — FastAPI Backend
// Replaces Azure Functions as the primary compute layer.
// Supports: HTTP endpoints (text chat, sessions CRUD) + WebSocket (voice relay)
// Plan: Consumption (scale to zero, $0 in dev)
// Image: Placeholder on first deploy; replaced by CI/CD push to ACR
// ============================================================================

@description('Azure region')
param location string

@description('Unique suffix for resource naming')
param resourceToken string

@description('Tags to apply')
param tags object = {}

@description('Log Analytics workspace resource ID')
param logAnalyticsWorkspaceId string

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

@description('ACR login server')
param registryLoginServer string

@description('Static Web App hostname for CORS')
param staticWebAppHostname string = ''

@description('Entra ID Client ID for token validation')
param entraClientId string = ''

@description('AI Foundry endpoint (discovery URL) for Agent Service')
param aiFoundryEndpoint string = ''

@description('Azure Speech Service endpoint')
param speechEndpoint string = ''

@description('Azure Speech Service region')
param speechRegion string = 'eastus'

@description('Azure Immersive Reader endpoint')
param irEndpoint string = ''

@description('Azure Document Intelligence endpoint')
param docIntelEndpoint string = ''

@description('Azure Web PubSub endpoint for real-time voice transport')
param webPubSubEndpoint string = ''

@description('Container vCPU allocation. Valid: 0.25, 0.5, 0.75, 1.0. Use 0.25 in low-cost mode (0.25 CPU must pair with 0.5Gi memory).')
param containerCpu string = '0.5'

@description('Container memory allocation. Must match CPU tier: 0.25→0.5Gi, 0.5→1Gi, 0.75→1.5Gi, 1.0→2Gi.')
param containerMemory string = '1Gi'

var environmentName = 'container-apps-environment-${resourceToken}'
var appName = 'container-apps-${resourceToken}'

// Placeholder image — replaced on first `az acr build` + `az containerapp update`
var placeholderImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

var corsOrigins = empty(staticWebAppHostname) ? [
  'http://localhost:5173'
] : [
  'https://${staticWebAppHostname}'
  'http://localhost:5173'
]

// ============================================================================
// Container Apps Environment (Consumption — serverless, scale to zero)
// ============================================================================
resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: environmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: reference(logAnalyticsWorkspaceId, '2023-09-01').customerId
        sharedKey: listKeys(logAnalyticsWorkspaceId, '2023-09-01').primarySharedKey
      }
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

// ============================================================================
// Container App — FastAPI backend
// ============================================================================
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  tags: union(tags, { 'azd-service-name': 'api' })
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: environment.id
    workloadProfileName: 'Consumption'
    configuration: {
      ingress: {
        external: true
        targetPort: 8000
        transport: 'http'         // http transport enables HTTP/1.1, HTTP/2, WebSocket, gRPC
        corsPolicy: {
          allowedOrigins: corsOrigins
          allowedMethods: ['GET', 'POST', 'DELETE', 'OPTIONS']
          allowedHeaders: ['Authorization', 'Content-Type']
          allowCredentials: true
        }
      }
      registries: [
        {
          server: registryLoginServer
          identity: 'system'      // AcrPull via managed identity — no secrets
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: placeholderImage
          resources: {
            cpu: json(containerCpu)
            memory: containerMemory
          }
          env: [
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsightsConnectionString }
            { name: 'COSMOS_DB_ENDPOINT',         value: cosmosDbEndpoint }
            { name: 'COSMOS_DB_DATABASE',         value: 'ChatApp' }
            { name: 'AZURE_OPENAI_ENDPOINT',      value: openAiEndpoint }
            { name: 'AZURE_SEARCH_ENDPOINT',      value: searchEndpoint }
            { name: 'AZURE_AI_SERVICES_ENDPOINT', value: aiServicesEndpoint }
            { name: 'SERVICE_BUS_NAMESPACE',      value: serviceBusNamespace }
            { name: 'KEY_VAULT_URI',              value: keyVaultUri }
            { name: 'AI_PROJECT_NAME',            value: aiProjectName }
            { name: 'AI_FOUNDRY_ENDPOINT',        value: aiFoundryEndpoint }
            { name: 'AZURE_SUBSCRIPTION_ID',      value: subscription().subscriptionId }
            { name: 'AZURE_RESOURCE_GROUP',       value: resourceGroup().name }
            { name: 'SPEECH_ENDPOINT',             value: speechEndpoint }
            { name: 'SPEECH_REGION',               value: speechRegion }
            { name: 'IR_ENDPOINT',                 value: irEndpoint }
            { name: 'DOC_INTELLIGENCE_ENDPOINT',   value: docIntelEndpoint }
            { name: 'WEBPUBSUB_ENDPOINT',           value: webPubSubEndpoint }
            { name: 'ENTRA_CLIENT_ID',            value: entraClientId }
          ]
        }
      ]
      scale: {
        minReplicas: 0    // Scale to zero when idle — $0 in dev
        maxReplicas: 10
        rules: [
          {
            name: 'http-concurrency'
            http: {
              metadata: {
                concurrentRequests: '20'
              }
            }
          }
        ]
      }
    }
  }
}

output containerAppId string = containerApp.id
output containerAppName string = containerApp.name
output containerAppHostname string = containerApp.properties.configuration.ingress.fqdn
output containerAppPrincipalId string = containerApp.identity.principalId
output containerAppEnvironmentId string = environment.id
