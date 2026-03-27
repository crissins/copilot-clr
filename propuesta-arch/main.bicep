// main.bicep - Cognitive Load Reduction Assistant Infrastructure
// Orquestación principal de todos los recursos Azure

metadata description = 'CLRA - Infrastructure as Code'
metadata version = '1.0'

param location string = resourceGroup().location
param environment string = 'dev'
param projectName string = 'clra'
param uniqueSuffix string = uniqueString(resourceGroup().id)

param tags object = {
  environment: environment
  project: projectName
  createdBy: 'Bicep'
}

// Variables para nombres
var appServicePlanName = '${projectName}-plan-${environment}-${uniqueSuffix}'
var appServiceName = '${projectName}-app-${environment}-${uniqueSuffix}'
var cosmosDbAccountName = '${projectName}-cosmos-${environment}-${uniqueSuffix}'
var cosmosDbDatabaseName = '${projectName}db'
var keyVaultName = '${projectName}-kv-${environment}-${substring(uniqueSuffix, 0, 8)}'
var storageAccountName = 'clrast${environment}${replace(substring(uniqueSuffix, 0, 8), '-', '')}'
var appInsightsName = '${projectName}-insights-${environment}-${uniqueSuffix}'

// ═══════════════════════════════════════════════════════════════
// 1. STORAGE ACCOUNT
// ═══════════════════════════════════════════════════════════════

resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: storageAccountName
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2022-09-01' = {
  name: 'default'
  parent: storageAccount
}

resource documentContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2022-09-01' = {
  name: 'documents'
  parent: blobService
  properties: {
    publicAccess: 'None'
  }
}

// ═══════════════════════════════════════════════════════════════
// 2. COSMOS DB
// ═══════════════════════════════════════════════════════════════

resource cosmosDbAccount 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: cosmosDbAccountName
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
  }
}

resource cosmosDbDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-04-15' = {
  name: cosmosDbDatabaseName
  parent: cosmosDbAccount
  properties: {
    resource: {
      id: cosmosDbDatabaseName
    }
  }
}

resource usersContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  name: 'users'
  parent: cosmosDbDatabase
  properties: {
    resource: {
      id: 'users'
      partitionKey: {
        paths: ['/id']
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. APPLICATION INSIGHTS
// ═══════════════════════════════════════════════════════════════

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    RetentionInDays: 30
  }
}

// ═══════════════════════════════════════════════════════════════
// 4. APP SERVICE PLAN
// ═══════════════════════════════════════════════════════════════

resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: appServicePlanName
  location: location
  tags: tags
  sku: {
    name: 'B1'
    capacity: 1
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

// ═══════════════════════════════════════════════════════════════
// 5. APP SERVICE (Backend)
// ═══════════════════════════════════════════════════════════════

resource appService 'Microsoft.Web/sites@2022-09-01' = {
  name: appServiceName
  location: location
  tags: tags
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.10'
      alwaysOn: true
      http20Enabled: true
      appSettings: [
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
      ]
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 6. KEY VAULT
// ═══════════════════════════════════════════════════════════════

resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    enabledForDeployment: true
    enabledForTemplateDeployment: true
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    accessPolicies: []
  }
}

// ═══════════════════════════════════════════════════════════════
// OUTPUTS
// ═══════════════════════════════════════════════════════════════

output appServiceUrl string = 'https://${appService.properties.defaultHostName}'
output cosmosDbEndpoint string = cosmosDbAccount.properties.documentEndpoint
output storageAccountName string = storageAccount.name
output keyVaultUrl string = 'https://${keyVault.name}.vault.azure.net/'
output appInsightsKey string = appInsights.properties.InstrumentationKey

output environmentVars string = format('''
COSMOS_DB_ENDPOINT={0}
STORAGE_ACCOUNT_NAME={1}
KEY_VAULT_URL=https://{2}.vault.azure.net/
APP_SERVICE_URL=https://{3}
APP_INSIGHTS_KEY={4}
''', cosmosDbAccount.properties.documentEndpoint, storageAccount.name, keyVault.name, appService.properties.defaultHostName, appInsights.properties.InstrumentationKey)
