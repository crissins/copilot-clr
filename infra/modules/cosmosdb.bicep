// ============================================================================
// Azure Cosmos DB (Serverless)
// Used by: Chat history, sessions, user profiles, audit logs
// Tier: Serverless (pay-per-request, ~$0 in dev)
// API: NoSQL (SQL API)
// ============================================================================

@description('Azure region')
param location string

@description('Unique suffix for resource naming')
param resourceToken string

@description('Tags to apply')
param tags object = {}

var cosmosDbName = 'cosmos-${resourceToken}'
var databaseName = 'ChatApp'

resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts@2024-02-15-preview' = {
  name: cosmosDbName
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
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    publicNetworkAccess: 'Enabled'
    minimalTlsVersion: 'Tls12'
  }
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-02-15-preview' = {
  parent: cosmosDb
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
  }
}

// Chat sessions container
resource sessionsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-02-15-preview' = {
  parent: database
  name: 'sessions'
  properties: {
    resource: {
      id: 'sessions'
      partitionKey: {
        paths: ['/userId']
        kind: 'Hash'
        version: 2
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [
          { path: '/userId/?' }
          { path: '/createdAt/?' }
        ]
        excludedPaths: [
          { path: '/*' }
        ]
      }
    }
  }
}

// Chat messages container
resource messagesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-02-15-preview' = {
  parent: database
  name: 'messages'
  properties: {
    resource: {
      id: 'messages'
      partitionKey: {
        paths: ['/sessionId']
        kind: 'Hash'
        version: 2
      }
      defaultTtl: 2592000 // 30 days TTL for cost control
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [
          { path: '/sessionId/?' }
          { path: '/createdAt/?' }
          { path: '/role/?' }
        ]
        excludedPaths: [
          { path: '/*' }
        ]
      }
    }
  }
}

// Users container
resource usersContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-02-15-preview' = {
  parent: database
  name: 'users'
  properties: {
    resource: {
      id: 'users'
      partitionKey: {
        paths: ['/id']
        kind: 'Hash'
        version: 2
      }
    }
  }
}

// User accessibility preferences container
resource preferencesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-02-15-preview' = {
  parent: database
  name: 'preferences'
  properties: {
    resource: {
      id: 'preferences'
      partitionKey: {
        paths: ['/userId']
        kind: 'Hash'
        version: 2
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [
          { path: '/userId/?' }
        ]
        excludedPaths: [
          { path: '/*' }
        ]
      }
    }
  }
}

// RAI flagged response reports container
resource reportsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-02-15-preview' = {
  parent: database
  name: 'reports'
  properties: {
    resource: {
      id: 'reports'
      partitionKey: {
        paths: ['/userId']
        kind: 'Hash'
        version: 2
      }
      defaultTtl: 7776000
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [
          { path: '/userId/?' }
          { path: '/createdAt/?' }
        ]
        excludedPaths: [
          { path: '/*' }
        ]
      }
    }
  }
}

// Audit log container
resource auditContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-02-15-preview' = {
  parent: database
  name: 'audit'
  properties: {
    resource: {
      id: 'audit'
      partitionKey: {
        paths: ['/userId']
        kind: 'Hash'
        version: 2
      }
      defaultTtl: 7776000 // 90 days TTL
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [
          { path: '/userId/?' }
          { path: '/action/?' }
          { path: '/timestamp/?' }
        ]
        excludedPaths: [
          { path: '/*' }
        ]
      }
    }
  }
}

// User tasks container (managed by AI agent workflow + Task Decomposer)
resource tasksContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-02-15-preview' = {
  parent: database
  name: 'tasks'
  properties: {
    resource: {
      id: 'tasks'
      partitionKey: {
        paths: ['/taskId']
        kind: 'Hash'
        version: 2
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [
          { path: '/taskId/?' }
          { path: '/userId/?' }
          { path: '/createdAt/?' }
        ]
        excludedPaths: [
          { path: '/*' }
        ]
      }
    }
  }
}

// Content uploads container
resource contentContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-02-15-preview' = {
  parent: database
  name: 'content'
  properties: {
    resource: {
      id: 'content'
      partitionKey: {
        paths: ['/userId']
        kind: 'Hash'
        version: 2
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [
          { path: '/userId/?' }
          { path: '/createdAt/?' }
        ]
        excludedPaths: [
          { path: '/*' }
        ]
      }
    }
  }
}

// Adapted content container
resource adaptedContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-02-15-preview' = {
  parent: database
  name: 'adapted'
  properties: {
    resource: {
      id: 'adapted'
      partitionKey: {
        paths: ['/userId']
        kind: 'Hash'
        version: 2
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [
          { path: '/userId/?' }
          { path: '/createdAt/?' }
        ]
        excludedPaths: [
          { path: '/*' }
        ]
      }
    }
  }
}

// TTS audio snippets container
resource audioContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-02-15-preview' = {
  parent: database
  name: 'audio'
  properties: {
    resource: {
      id: 'audio'
      partitionKey: {
        paths: ['/userId']
        kind: 'Hash'
        version: 2
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [
          { path: '/userId/?' }
          { path: '/createdAt/?' }
        ]
        excludedPaths: [
          { path: '/*' }
        ]
      }
    }
  }
}

// Reminders container
resource remindersContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-02-15-preview' = {
  parent: database
  name: 'reminders'
  properties: {
    resource: {
      id: 'reminders'
      partitionKey: {
        paths: ['/userId']
        kind: 'Hash'
        version: 2
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [
          { path: '/userId/?' }
          { path: '/scheduledTime/?' }
          { path: '/status/?' }
        ]
        excludedPaths: [
          { path: '/*' }
        ]
      }
    }
  }
}

output cosmosDbId string = cosmosDb.id
output cosmosDbName string = cosmosDb.name
output cosmosDbEndpoint string = cosmosDb.properties.documentEndpoint
output databaseName string = databaseName
