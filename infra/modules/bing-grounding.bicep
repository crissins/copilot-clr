// ============================================================================
// Grounding with Bing Search
// Provides real-time web grounding for Foundry Agent Service.
// Tier: Pay-as-you-go (billed per tool call per agent run)
// ============================================================================

// Bing resources are deployed globally; location param kept for module interface consistency.
@description('Azure region — consumed in displayName to satisfy linter')
param location string

@description('Unique suffix for resource naming')
param resourceToken string

@description('Tags to apply')
param tags object = {}

var bingName = 'bing-grounding-${resourceToken}'

#disable-next-line BCP081
resource bingAccount 'Microsoft.Bing/accounts@2025-05-01-preview' = {
  name: bingName
  location: 'global'
  tags: union(tags, { region: location })
  kind: 'Bing.Grounding.Search'
  sku: {
    name: 'G1'
  }
}

output bingAccountId string = bingAccount.id
output bingAccountName string = bingAccount.name
