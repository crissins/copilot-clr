// ============================================================================
// Security: RBAC Role Assignments
// Assigns managed identity permissions for passwordless auth between services.
// All services communicate via managed identity — zero secrets in code.
// ============================================================================

@description('Principal ID of the Container App system-assigned managed identity')
param containerAppPrincipalId string

@description('Name of the Azure Container Registry (for AcrPull role assignment)')
param containerRegistryName string

@description('Principal ID of the AI Foundry Hub managed identity')
param hubPrincipalId string

@description('Principal ID of the AI Foundry Project managed identity')
param projectPrincipalId string

// Resource names for scope references
@description('Cosmos DB account name')
param cosmosDbName string

@description('Storage account name')
param storageAccountName string

@description('Key Vault name')
param keyVaultName string

@description('Azure OpenAI account name')
param openAiName string

@description('Azure AI Search service name')
param searchName string

@description('Azure AI Services account name')
param aiServicesName string

@description('Service Bus namespace name')
param serviceBusName string

@description('AI Foundry Project name')
param aiProjectName string

// ============================================================================
// Built-in Role Definition IDs
// https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles
// ============================================================================
var roles = {
  cosmosDbDataContributor: 'b24988ac-6180-42a0-ab88-20f7382dd24c' // Contributor (for serverless, data plane RBAC not yet GA)
  storageBlobDataContributor: 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
  keyVaultSecretsUser: '4633458b-17de-408a-b874-0445c86b69e6'
  cognitiveServicesOpenAIUser: '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'
  cognitiveServicesUser: 'a97b65f3-24c7-4388-baec-2e87135dc908'
  searchIndexDataContributor: '8ebe5a00-799e-43f5-93ac-243d3dce84a7'
  searchServiceContributor: '7ca78c08-252a-4471-8644-bb5ff32d4ba0'
  serviceBusDataOwner: '090c5cfd-751d-490a-894a-3ce6f1109419'
  azureMLDataScientist: 'f6c7c914-8db3-469d-8ca1-694a8f32e121'
  acrPull: '7f951dda-4ed3-4680-a7ca-43fe172d538d' // AcrPull — Container App image pull via MI
}

// ============================================================================
// Existing resource references (to scope role assignments)
// ============================================================================
resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts@2024-02-15-preview' existing = {
  name: cosmosDbName
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource openAi 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' existing = {
  name: openAiName
}

resource search 'Microsoft.Search/searchServices@2024-03-01-preview' existing = {
  name: searchName
}

resource aiServices 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' existing = {
  name: aiServicesName
}

resource serviceBus 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' existing = {
  name: serviceBusName
}

resource aiProject 'Microsoft.MachineLearningServices/workspaces@2024-04-01' existing = {
  name: aiProjectName
}

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: containerRegistryName
}

// ============================================================================
// Container App → Container Registry (AcrPull — image pull via managed identity)
// ============================================================================
resource appAcrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistry.id, containerAppPrincipalId, roles.acrPull)
  scope: containerRegistry
  properties: {
    principalId: containerAppPrincipalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.acrPull)
    principalType: 'ServicePrincipal'
  }
}

// ============================================================================
// Container App → Cosmos DB (Data Contributor)
// ============================================================================
resource funcCosmosRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(cosmosDb.id, containerAppPrincipalId, roles.cosmosDbDataContributor)
  scope: cosmosDb
  properties: {
    principalId: containerAppPrincipalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.cosmosDbDataContributor)
    principalType: 'ServicePrincipal'
  }
}

// ============================================================================
// Container App → Storage (Blob Data Contributor)
// ============================================================================
resource funcStorageRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, containerAppPrincipalId, roles.storageBlobDataContributor)
  scope: storageAccount
  properties: {
    principalId: containerAppPrincipalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.storageBlobDataContributor)
    principalType: 'ServicePrincipal'
  }
}

// ============================================================================
// Container App → Key Vault (Secrets User)
// ============================================================================
resource funcKeyVaultRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, containerAppPrincipalId, roles.keyVaultSecretsUser)
  scope: keyVault
  properties: {
    principalId: containerAppPrincipalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.keyVaultSecretsUser)
    principalType: 'ServicePrincipal'
  }
}

// ============================================================================
// Container App → Azure OpenAI (OpenAI User + Cognitive Services User)
// Both roles required: OpenAI User for chat/realtime, CS User for Content Safety
// ============================================================================
resource funcOpenAiRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(openAi.id, containerAppPrincipalId, roles.cognitiveServicesOpenAIUser)
  scope: openAi
  properties: {
    principalId: containerAppPrincipalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.cognitiveServicesOpenAIUser)
    principalType: 'ServicePrincipal'
  }
}

// ============================================================================
// Container App → AI Search (Index Data Contributor + Service Contributor)
// ============================================================================
resource funcSearchDataRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(search.id, containerAppPrincipalId, roles.searchIndexDataContributor)
  scope: search
  properties: {
    principalId: containerAppPrincipalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.searchIndexDataContributor)
    principalType: 'ServicePrincipal'
  }
}

resource funcSearchServiceRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(search.id, containerAppPrincipalId, roles.searchServiceContributor)
  scope: search
  properties: {
    principalId: containerAppPrincipalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.searchServiceContributor)
    principalType: 'ServicePrincipal'
  }
}

// ============================================================================
// Container App → AI Services (Cognitive Services User — Content Safety)
// ============================================================================
resource funcAiServicesRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(aiServices.id, containerAppPrincipalId, roles.cognitiveServicesUser)
  scope: aiServices
  properties: {
    principalId: containerAppPrincipalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.cognitiveServicesUser)
    principalType: 'ServicePrincipal'
  }
}

// ============================================================================
// Container App → Service Bus (Data Owner)
// ============================================================================
resource funcServiceBusRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(serviceBus.id, containerAppPrincipalId, roles.serviceBusDataOwner)
  scope: serviceBus
  properties: {
    principalId: containerAppPrincipalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.serviceBusDataOwner)
    principalType: 'ServicePrincipal'
  }
}

// ============================================================================
// Container App → AI Foundry Project (Data Scientist — Agent Service access)
// ============================================================================
resource funcAiProjectRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(aiProject.id, containerAppPrincipalId, roles.azureMLDataScientist)
  scope: aiProject
  properties: {
    principalId: containerAppPrincipalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.azureMLDataScientist)
    principalType: 'ServicePrincipal'
  }
}

// ============================================================================
// AI Foundry Hub → Storage (Blob Data Contributor)
// ============================================================================
resource hubStorageRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, hubPrincipalId, roles.storageBlobDataContributor)
  scope: storageAccount
  properties: {
    principalId: hubPrincipalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.storageBlobDataContributor)
    principalType: 'ServicePrincipal'
  }
}

// ============================================================================
// AI Foundry Hub → Key Vault (Secrets User)
// ============================================================================
resource hubKeyVaultRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, hubPrincipalId, roles.keyVaultSecretsUser)
  scope: keyVault
  properties: {
    principalId: hubPrincipalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.keyVaultSecretsUser)
    principalType: 'ServicePrincipal'
  }
}

// ============================================================================
// AI Foundry Hub → OpenAI (OpenAI User)
// ============================================================================
resource hubOpenAiRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(openAi.id, hubPrincipalId, roles.cognitiveServicesOpenAIUser)
  scope: openAi
  properties: {
    principalId: hubPrincipalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.cognitiveServicesOpenAIUser)
    principalType: 'ServicePrincipal'
  }
}

// ============================================================================
// AI Foundry Project → OpenAI (OpenAI User)
// ============================================================================
resource projectOpenAiRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(openAi.id, projectPrincipalId, roles.cognitiveServicesOpenAIUser)
  scope: openAi
  properties: {
    principalId: projectPrincipalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.cognitiveServicesOpenAIUser)
    principalType: 'ServicePrincipal'
  }
}
