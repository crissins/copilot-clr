// ============================================================================
// Development / Local-Only Deployment Parameters
// Use with:
//   az deployment group create -g <rg> -f infra/main.bicep -p infra/main.dev.bicepparam
//
// What this deploys:
//   ONLY cloud API services (OpenAI, AI Foundry, Speech, Search, Content Safety,
//   Immersive Reader, Document Intelligence, Cosmos DB, Storage, Key Vault, Monitoring)
//
//   NOT deployed (compute/hosting):
//     - Container Registry       (saves ~$5/mo)
//     - Container Apps            (backend runs locally via uvicorn)
//     - Static Web App            (frontend runs locally via vite dev)
//     - Service Bus               (async tasks run in-process for dev)
//
// Backend: LOCAL_DEV=true uvicorn main:app --reload --port 8000
// Frontend: cd frontend && npm run dev  (http://localhost:5173)
//
// Estimated monthly cost: ~$0-2 (all free tiers + minimal OpenAI token usage)
// ============================================================================

using 'main.bicep'

param location         = 'eastus'
param environmentName  = 'dev'
param projectName      = 'chatapp'
param entraClientId    = '' // Set after Entra ID app registration

// Local dev mode — skip all compute/hosting resources
param localDevMode = true

// OpenAI — minimum capacity (1K TPM), sufficient for single-user dev
param openAiChatCapacity      = 1
param openAiEmbeddingCapacity = 1

// Voice disabled — Realtime API pricing makes it impractical for iterative dev
param deployVoice = false

// Container settings irrelevant in dev mode but must satisfy Bicep param types
param containerCpu    = '0.25'
param containerMemory = '0.5Gi'

// Logs — minimum valid retention for the Log Analytics SKU
param logRetentionDays = 30
