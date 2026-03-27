// ============================================================================
// Azure Communication Services
// Used by: Email + SMS delivery of reminders and notifications
// Tier: Free (pay-per-message)
// ============================================================================

@description('Azure region')
param location string

@description('Unique suffix for resource naming')
param resourceToken string

@description('Tags to apply')
param tags object = {}

@description('Name of the Key Vault to store the ACS connection string')
param keyVaultName string

var acsName = 'azure-communication-services-${resourceToken}'

resource communicationService 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: acsName
  location: 'global'
  tags: tags
  properties: {
    dataLocation: 'United States'
    linkedDomains: [
      emailDomain.id
    ]
  }
}

resource emailService 'Microsoft.Communication/emailServices@2023-04-01' = {
  name: '${acsName}-email'
  location: 'global'
  tags: tags
  properties: {
    dataLocation: 'United States'
  }
}

resource emailDomain 'Microsoft.Communication/emailServices/domains@2023-04-01' = {
  parent: emailService
  name: 'AzureManagedDomain'
  location: 'global'
  properties: {
    domainManagement: 'AzureManaged'
    userEngagementTracking: 'Disabled'
  }
}

// Store ACS connection string securely in Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource acsConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'acs-connection-string'
  properties: {
    value: communicationService.listKeys().primaryConnectionString
  }
}

output acsName string = communicationService.name
output acsConnectionEndpoint string = communicationService.properties.hostName
output emailDomainSender string = 'DoNotReply@${emailDomain.properties.fromSenderDomain}'
