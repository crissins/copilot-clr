// ============================================================================
// Low-Cost Deployment Parameters
// Use with:
//   az deployment group create -g <rg> -f infra/main.bicep -p infra/main.lowcost.bicepparam
//
// What changes from standard:
//   - Voice (Realtime API) disabled            saves ~$9 per 30-min session
//   - OpenAI model capacity reduced to 1K TPM  caps runaway token spend
//   - Container App sized at 0.25 vCPU / 0.5Gi halves active compute billing
//   - Log retention reduced to 7 days          saves once free 5 GB tier exceeded
//
// Estimated monthly cost in this mode: ~$6-8 (dominated by ACR Basic at ~$5)
// See docs/06-low-cost-deployment.md for full breakdown and further savings tips.
// ============================================================================

using 'main.bicep'

param location       = 'eastus'
param environmentName = 'dev'
param projectName    = 'chatapp'
param entraClientId  = '' // Set after Entra ID app registration

// OpenAI — 1K TPM floor prevents runaway cost; just enough for dev testing
param openAiChatCapacity      = 1
param openAiEmbeddingCapacity = 1

// Voice disabled — Realtime API pricing: $0.06/min input + $0.24/min output audio
// A single 30-minute session costs ~$9. Re-enable for voice testing only.
param deployVoice = false

// Container App — minimum valid CPU/memory pairing on Consumption plan
param containerCpu    = '0.25'
param containerMemory = '0.5Gi'

// Logs — 7 days is sufficient for debugging; free tier covers 5 GB/mo
param logRetentionDays = 7
