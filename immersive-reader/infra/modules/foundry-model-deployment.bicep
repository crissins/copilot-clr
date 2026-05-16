param foundryAccountName string
param deploymentName string
param modelName string
param modelVersion string
param modelFormat string = 'OpenAI'
param skuName string = 'GlobalStandard'
param skuCapacity int = 1

resource foundryAccount 'Microsoft.CognitiveServices/accounts@2025-06-01' existing = {
  name: foundryAccountName
}

resource modelDeployment 'Microsoft.CognitiveServices/accounts/deployments@2025-12-01' = {
  parent: foundryAccount
  name: deploymentName
  sku: {
    name: skuName
    capacity: skuCapacity
  }
  properties: {
    model: {
      name: modelName
      version: modelVersion
      format: modelFormat
    }
  }
}

output deploymentNameOut string = modelDeployment.name
