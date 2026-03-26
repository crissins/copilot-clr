targetScope = 'resourceGroup'

@description('Azure region')
param location string = resourceGroup().location

@description('Foundry account name')
param foundryAccountName string

@description('Foundry project name')
param foundryProjectName string

@description('Model deployment name')
param modelDeploymentName string

@description('Base model name')
param modelName string

@description('Base model version')
param modelVersion string

@description('Model format')
param modelFormat string = 'OpenAI'

@description('Immersive Reader account name')
param immersiveReaderName string

@description('Common tags')
param tags object = {}

module foundryAccount './modules/foundry-account.bicep' = {
  name: 'foundry-account'
  params: {
    foundryAccountName: foundryAccountName
    location: location
    tags: tags
  }
}

module foundryProject './modules/foundry-project.bicep' = {
  name: 'foundry-project'
  params: {
    foundryAccountName: foundryAccountName
    foundryProjectName: foundryProjectName
    location: location
    projectDisplayName: foundryProjectName
    projectDescription: 'Hackathon project for document simplification'
    tags: tags
  }
  dependsOn: [
    foundryAccount
  ]
}

module foundryModelDeployment './modules/foundry-model-deployment.bicep' = {
  name: 'foundry-model-deployment'
  params: {
    foundryAccountName: foundryAccountName
    deploymentName: modelDeploymentName
    modelName: modelName
    modelVersion: modelVersion
    modelFormat: modelFormat
  }
  dependsOn: [
    foundryAccount
  ]
}

module immersiveReader './modules/immersive-reader.bicep' = {
  name: 'immersive-reader'
  params: {
    immersiveReaderName: immersiveReaderName
    location: location
    tags: tags
  }
}

output azureAiProjectEndpoint string = foundryProject.outputs.azureAiProjectEndpoint
output azureAiModelDeploymentName string = foundryModelDeployment.outputs.deploymentNameOut
output immersiveReaderSubdomain string = immersiveReader.outputs.immersiveReaderSubdomain
