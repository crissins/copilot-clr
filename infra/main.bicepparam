using 'main.bicep'

param location = 'eastus'
param environmentName = 'dev'
param projectName = 'chatapp'
param entraClientId = '' // Set after Entra ID app registration

// Voice disabled — gpt-4o-mini-realtime-preview not available with Standard/GlobalStandard SKU in eastus
param deployVoice = false
