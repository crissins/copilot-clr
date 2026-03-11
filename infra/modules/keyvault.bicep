// ============================================================================
// Azure Key Vault
// Used by: AI Foundry Hub (required connected service), secrets management
// Tier: Standard (free for first 10k operations/month)
// Auth: RBAC mode (no access policies)
// ============================================================================

@description('Azure region')
param location string

@description('Unique suffix for resource naming')
param resourceToken string

@description('Tags to apply')
param tags object = {}

@description('Tenant ID for Key Vault')
param tenantId string = subscription().tenantId

var keyVaultName = 'kv-${resourceToken}'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    tenantId: tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    enablePurgeProtection: false // Allow purge in dev for easy cleanup
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

output keyVaultId string = keyVault.id
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
