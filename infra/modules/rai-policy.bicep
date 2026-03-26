// ============================================================================
// Custom RAI Content Filter Policy — Azure OpenAI
// Enforces content filtering on all prompts and completions for:
//   Hate, Sexual, SelfHarm, Violence, Jailbreak, Protected Material, Profanity
//
// Applied to all model deployments via raiPolicyName parameter.
// API version: 2025-06-01 (Asynchronous_filter mode)
// Reference: https://learn.microsoft.com/rest/api/aifoundry/accountmanagement/rai-policies
// ============================================================================

@description('Name of the existing Azure OpenAI account to attach the policy to')
param openAiAccountName string

@description('Severity threshold for prompt filters (Low, Medium, High)')
@allowed(['Low', 'Medium', 'High'])
param promptSeverityThreshold string = 'Medium'

@description('Severity threshold for completion/output filters (Low, Medium, High)')
@allowed(['Low', 'Medium', 'High'])
param completionSeverityThreshold string = 'Low'

var policyName = 'CopilotCLR-ContentFilter'

resource openAiAccount 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' existing = {
  name: openAiAccountName
}

resource raiPolicy 'Microsoft.CognitiveServices/accounts/raiPolicies@2024-04-01-preview' = {
  parent: openAiAccount
  name: policyName
  properties: {
    basePolicyName: 'Microsoft.DefaultV2'
    mode: 'Asynchronous_filter'
    contentFilters: [
      // ── Hate ──
      {
        name: 'Hate'
        blocking: true
        enabled: true
        allowedContentLevel: promptSeverityThreshold
        source: 'Prompt'
      }
      {
        name: 'Hate'
        blocking: true
        enabled: true
        allowedContentLevel: completionSeverityThreshold
        source: 'Completion'
      }
      // ── Sexual ──
      {
        name: 'Sexual'
        blocking: true
        enabled: true
        allowedContentLevel: promptSeverityThreshold
        source: 'Prompt'
      }
      {
        name: 'Sexual'
        blocking: true
        enabled: true
        allowedContentLevel: completionSeverityThreshold
        source: 'Completion'
      }
      // ── SelfHarm ──
      {
        name: 'Selfharm'
        blocking: true
        enabled: true
        allowedContentLevel: promptSeverityThreshold
        source: 'Prompt'
      }
      {
        name: 'Selfharm'
        blocking: true
        enabled: true
        allowedContentLevel: completionSeverityThreshold
        source: 'Completion'
      }
      // ── Violence ──
      {
        name: 'Violence'
        blocking: true
        enabled: true
        allowedContentLevel: promptSeverityThreshold
        source: 'Prompt'
      }
      {
        name: 'Violence'
        blocking: true
        enabled: true
        allowedContentLevel: completionSeverityThreshold
        source: 'Completion'
      }
      // ── Jailbreak (prompt only — no severity levels) ──
      {
        name: 'Jailbreak'
        blocking: true
        enabled: true
        source: 'Prompt'
      }
      // ── Protected Material (completion only) ──
      {
        name: 'Protected Material Text'
        blocking: true
        enabled: true
        source: 'Completion'
      }
      {
        name: 'Protected Material Code'
        blocking: true
        enabled: true
        source: 'Completion'
      }
      // ── Profanity (prompt) ──
      {
        name: 'Profanity'
        blocking: true
        enabled: true
        source: 'Prompt'
      }
    ]
  }
}

output raiPolicyName string = raiPolicy.name
