@description('Azure location for all resources')
param location string = resourceGroup().location

@description('Unique Azure AI Foundry resource name')
param foundryAccountName string

@description('Foundry project name')
param foundryProjectName string = 'cognitive-load-app'

@description('Model deployment name')
param modelDeploymentName string = 'gpt-4.1-mini'

@description('Container registry name')
param containerRegistryName string

@description('Container Apps environment name')
param containerAppsEnvName string = 'cae-cognitive-load'

@description('Backend container app name')
param backendContainerAppName string = 'aca-cognitive-backend'

@description('Key Vault name')
param keyVaultName string

@description('Static Web App name')
param staticWebAppName string = 'swa-cognitive-load'

@description('Backend image name')
param backendImageName string = 'backend'

@description('Backend image tag')
param backendImageTag string = 'latest'

@description('Allowed origins for API CORS')
param allowedOrigins string = 'http://localhost:5173'

@description('User-assigned managed identity name for backend')
param backendUamiName string = 'uami-cognitive-backend'

/* ============================
   Foundry
============================ */

resource foundryAccount 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: foundryAccountName
  location: location
  kind: 'AIServices'
  identity: {
    type: 'SystemAssigned'
  }
  sku: {
    name: 'S0'
  }
  properties: {
    allowProjectManagement: true
    customSubDomainName: foundryAccountName
    publicNetworkAccess: 'Enabled'
  }
}

resource foundryProject 'Microsoft.CognitiveServices/accounts/projects@2025-06-01' = {
  parent: foundryAccount
  name: foundryProjectName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    displayName: 'Cognitive Load App'
    description: 'Hackathon project'
  }
}

/* ============================
   ACR
============================ */

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: containerRegistryName
  location: location
  sku: {
    name: 'Basic'
  }
}

/* ============================
   Key Vault
============================ */

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
  }
}

/* ============================
   Container Apps Environment
============================ */

resource containerAppsEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: containerAppsEnvName
  location: location
  properties: {}
}

/* ============================
   Static Web App
============================ */

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: staticWebAppName
  location: 'eastus2'
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    buildProperties: {
      appLocation: '/'
      outputLocation: 'dist'
    }
  }
}

/* ============================
   User Assigned Identity
============================ */

resource backendUami 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: backendUamiName
  location: location
}

/* ============================
   Role Assignments for UAMI
============================ */

// Key Vault access for secrets
resource backendUamiKvSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, backendUami.id, 'kv-secrets-user')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '4633458b-17de-408a-b874-0445c86b69e6' // Key Vault Secrets User
    )
    principalId: backendUami.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ACR pull for image pull
resource backendUamiAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, backendUami.id, 'acr-pull')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '7f951dda-4ed3-4680-a7ca-43fe172d538d' // AcrPull
    )
    principalId: backendUami.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Foundry access
resource backendUamiFoundryAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(foundryAccount.id, backendUami.id, 'foundry-access')
  scope: foundryAccount
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      'a97b65f3-24c7-4388-baec-2e87135dc908' // Cognitive Services User
    )
    principalId: backendUami.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

/* ============================
   Backend Container App
============================ */

resource backendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: backendContainerAppName
  location: location
  identity: {
    type: 'SystemAssigned, UserAssigned'
    userAssignedIdentities: {
      '${backendUami.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8000
      }
      // registries: [
      //   {
      //     server: acr.properties.loginServer
      //     identity: backendUami.id
      //   }
      // ]
      // secrets: [
      //   {
      //     name: 'foundry-project-endpoint'
      //     keyVaultUrl: 'https://${keyVault.name}.vault.azure.net/secrets/foundry-project-endpoint'
      //     identity: backendUami.id
      //   }
      //   {
      //     name: 'agent-name'
      //     keyVaultUrl: 'https://${keyVault.name}.vault.azure.net/secrets/agent-name'
      //     identity: backendUami.id
      //   }
      // ]
    }
    template: {
      containers: [
        {
          name: 'backend'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            // {
            //   name: 'FOUNDRY_PROJECT_ENDPOINT'
            //   secretRef: 'foundry-project-endpoint'
            // }
            // {
            //   name: 'AGENT_NAME'
            //   secretRef: 'agent-name'
            // }
            {
              name: 'ALLOWED_ORIGINS'
              value: allowedOrigins
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 2
      }
    }
  }
  dependsOn: [
    backendUamiKvSecretsUser
    backendUamiAcrPull
    backendUamiFoundryAccess
  ]
}

/* ============================
   Outputs
============================ */

output FOUNDRY_PROJECT_ENDPOINT string = 'https://${foundryAccount.name}.services.ai.azure.com/api/projects/${foundryProject.name}'
output BACKEND_URL string = backendApp.properties.configuration.ingress.fqdn
output BACKEND_UAMI_ID string = backendUami.id
