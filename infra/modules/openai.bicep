// ============================================================================
// Azure OpenAI Service + Custom RAI Content Filter Policy
// Used by: AI Foundry Hub (connected AI service), Agent Framework inference
// Tier: S0 (pay-per-token, ~$1-5/mo in dev with gpt-4o-mini)
// Models: gpt-4o-mini (chat), text-embedding-ada-002 (vectors)
//
// RAI Policy: CopilotCLR-ContentFilter enforces blocking content filters
// on all prompts and completions (Hate, Sexual, SelfHarm, Violence,
// Jailbreak, Protected Material, Profanity).
// Ref: https://learn.microsoft.com/rest/api/aifoundry/accountmanagement/rai-policies
// ============================================================================

@description('Azure region')
param location string

@description('Unique suffix for resource naming')
param resourceToken string

@description('Tags to apply')
param tags object = {}

@description('TPM capacity for gpt-4o-mini. Each unit = 1K tokens/min. Set 1 in low-cost mode to cap runaway usage.')
param chatModelCapacity int = 10

@description('TPM capacity for text-embedding-ada-002. Set 1 in low-cost mode.')
param embeddingModelCapacity int = 10

@description('Deploy gpt-4o-mini-realtime-preview for voice. Realtime API costs ~$0.06/min input + $0.24/min output audio — set false in low-cost mode.')
param deployRealtimeModel bool = true

@description('Deploy a custom RAI content filter policy and assign to all model deployments.')
param deployCustomRaiPolicy bool = true

var openAiName = 'open-ai-${resourceToken}'
var customRaiPolicyName = 'CopilotCLR-ContentFilter'
var effectiveRaiPolicy = deployCustomRaiPolicy ? customRaiPolicyName : 'Microsoft.DefaultV2'

resource openAi 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' = {
  name: openAiName
  location: location
  tags: tags
  kind: 'OpenAI'
  sku: {
    name: 'S0'
    tier: 'Standard'
  }
  properties: {
    customSubDomainName: openAiName
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
    }
  }
}

// ============================================================================
// Custom RAI Content Filter Policy
// Enforces blocking filters on Prompt and Completion for all harm categories.
// Severity thresholds: Medium for prompts, Low for completions (stricter output).
// ============================================================================
resource raiPolicy 'Microsoft.CognitiveServices/accounts/raiPolicies@2024-04-01-preview' = if (deployCustomRaiPolicy) {
  parent: openAi
  name: customRaiPolicyName
  properties: {
    basePolicyName: 'Microsoft.DefaultV2'
    mode: 'Deferred'
    contentFilters: [
      // ── Hate ──
      { name: 'Hate',     blocking: true, enabled: true, allowedContentLevel: 'Medium', source: 'Prompt' }
      { name: 'Hate',     blocking: true, enabled: true, allowedContentLevel: 'Low',    source: 'Completion' }
      // ── Sexual ──
      { name: 'Sexual',   blocking: true, enabled: true, allowedContentLevel: 'Medium', source: 'Prompt' }
      { name: 'Sexual',   blocking: true, enabled: true, allowedContentLevel: 'Low',    source: 'Completion' }
      // ── Self-Harm ──
      { name: 'Selfharm', blocking: true, enabled: true, allowedContentLevel: 'Medium', source: 'Prompt' }
      { name: 'Selfharm', blocking: true, enabled: true, allowedContentLevel: 'Low',    source: 'Completion' }
      // ── Violence ──
      { name: 'Violence', blocking: true, enabled: true, allowedContentLevel: 'Medium', source: 'Prompt' }
      { name: 'Violence', blocking: true, enabled: true, allowedContentLevel: 'Low',    source: 'Completion' }
      // ── Jailbreak (prompt only — no severity levels) ──
      { name: 'Jailbreak',               blocking: true, enabled: true, source: 'Prompt' }
      // ── Protected Material (completion only) ──
      { name: 'Protected Material Text',  blocking: true, enabled: true, source: 'Completion' }
      { name: 'Protected Material Code',  blocking: true, enabled: true, source: 'Completion' }
      // ── Profanity (prompt) ──
      { name: 'Profanity',               blocking: true, enabled: true, source: 'Prompt' }
    ]
  }
}

resource gpt4oMiniDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = {
  parent: openAi
  name: 'gpt-4o-mini'
  dependsOn: deployCustomRaiPolicy ? [raiPolicy] : []
  sku: {
    name: 'Standard'
    capacity: chatModelCapacity // 1K tokens per minute per unit
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4o-mini'
      version: '2024-07-18'
    }
    raiPolicyName: effectiveRaiPolicy
  }
}

resource embeddingDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = {
  parent: openAi
  name: 'text-embedding-ada-002'
  dependsOn: [gpt4oMiniDeployment] // Sequential deployment required by Azure OpenAI
  sku: {
    name: 'Standard'
    capacity: embeddingModelCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'text-embedding-ada-002'
      version: '2'
    }
  }
}

// Sequential deployment required — each model must finish before the next starts
// Set deployRealtimeModel = false in low-cost mode: Realtime API costs ~$0.06/min input + $0.24/min output audio
resource realtimeDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = if (deployRealtimeModel) {
  parent: openAi
  name: 'gpt-4o-mini-realtime-preview'
  dependsOn: [embeddingDeployment]
  sku: {
    name: 'GlobalStandard'
    capacity: 6 // 6K tokens per minute (min capacity for realtime preview)
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4o-mini-realtime-preview'
      version: '2024-12-17'
    }
    raiPolicyName: effectiveRaiPolicy
  }
}

output openAiId string = openAi.id
output openAiName string = openAi.name
output openAiEndpoint string = openAi.properties.endpoint
