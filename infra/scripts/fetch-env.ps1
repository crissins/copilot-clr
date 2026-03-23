# ============================================================================
# Fetch Azure resource endpoints and write backend/.env for local development.
#
# Usage (from repo root):
#   .\infra\scripts\fetch-env.ps1 [-ResourceGroup rg-chatapp-prod]
#
# Requires: az CLI (logged in). No other dependencies.
# Auth: DefaultAzureCredential (az login) — no keys stored in the .env.
# ============================================================================

param(
    [string]$ResourceGroup = "rg-chatapp-prod"
)

$ErrorActionPreference = "Stop"
$EnvFile = "backend\.env"

Write-Host ""
Write-Host "=========================================="
Write-Host "  Fetch Azure Endpoints -> $EnvFile"
Write-Host "=========================================="
Write-Host "  Resource Group: $ResourceGroup"
Write-Host "=========================================="

# --- Verify prerequisites ---
if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Error "az CLI not found. Install: https://aka.ms/install-azure-cli"
    exit 1
}

Write-Host ""
Write-Host "[1/6] Checking Azure login..."
$account = az account show --query "{subscription:name, id:id}" -o json 2>&1 | ConvertFrom-Json
if (-not $account.subscription) {
    Write-Error "Not logged in. Run: az login"
    exit 1
}
Write-Host "  Subscription: $($account.subscription)"

# --- Discover resource names ---
Write-Host ""
Write-Host "[2/6] Listing resources in $ResourceGroup..."
$resources = az resource list --resource-group $ResourceGroup -o json 2>&1 | ConvertFrom-Json

function Find-Resource {
    param([string]$Type, [string]$Kind = $null)
    if ($Kind) {
        return ($resources | Where-Object { $_.type -eq $Type -and $_.kind -eq $Kind } | Select-Object -First 1).name
    }
    return ($resources | Where-Object { $_.type -eq $Type } | Select-Object -First 1).name
}

$openaiName   = Find-Resource -Type "Microsoft.CognitiveServices/accounts" -Kind "OpenAI"
$speechName   = Find-Resource -Type "Microsoft.CognitiveServices/accounts" -Kind "SpeechServices"
$aiSvcName    = Find-Resource -Type "Microsoft.CognitiveServices/accounts" -Kind "CognitiveServices"
$docIntelName = Find-Resource -Type "Microsoft.CognitiveServices/accounts" -Kind "FormRecognizer"
$irName       = Find-Resource -Type "Microsoft.CognitiveServices/accounts" -Kind "ImmersiveReader"
$searchName   = Find-Resource -Type "Microsoft.Search/searchServices"
$cosmosName   = Find-Resource -Type "Microsoft.DocumentDB/databaseAccounts"
$kvName       = Find-Resource -Type "Microsoft.KeyVault/vaults"
$storageName  = Find-Resource -Type "Microsoft.Storage/storageAccounts"
$sbName       = Find-Resource -Type "Microsoft.ServiceBus/namespaces"
$projectName  = Find-Resource -Type "Microsoft.MachineLearningServices/workspaces" -Kind "Project"
$swaName      = Find-Resource -Type "Microsoft.Web/staticSites"

Write-Host "  Found resources:"
Write-Host "    OpenAI:              $( if ($openaiName) { $openaiName } else { '<not found>' } )"
Write-Host "    Speech:              $( if ($speechName) { $speechName } else { '<not found>' } )"
Write-Host "    AI Services:         $( if ($aiSvcName) { $aiSvcName } else { '<not found>' } )"
Write-Host "    Doc Intelligence:    $( if ($docIntelName) { $docIntelName } else { '<not found>' } )"
Write-Host "    Immersive Reader:    $( if ($irName) { $irName } else { '<not found>' } )"
Write-Host "    AI Search:           $( if ($searchName) { $searchName } else { '<not found>' } )"
Write-Host "    Cosmos DB:           $( if ($cosmosName) { $cosmosName } else { '<not found>' } )"
Write-Host "    Key Vault:           $( if ($kvName) { $kvName } else { '<not found>' } )"
Write-Host "    Storage:             $( if ($storageName) { $storageName } else { '<not found>' } )"
Write-Host "    Service Bus:         $( if ($sbName) { $sbName } else { '<not found>' } )"
Write-Host "    AI Foundry Project:  $( if ($projectName) { $projectName } else { '<not found>' } )"
Write-Host "    Static Web App:      $( if ($swaName) { $swaName } else { '<not found>' } )"

# --- Helper: fetch Cognitive Services endpoint ---
function Get-CogEndpoint {
    param([string]$Name)
    if (-not $Name) { return "" }
    $result = az cognitiveservices account show --name $Name --resource-group $ResourceGroup --query "properties.endpoint" -o tsv 2>$null
    if ($result) { return $result.Trim() } else { return "" }
}

# --- Fetch endpoints ---
Write-Host ""
Write-Host "[3/6] Querying resource endpoints..."

$azureOpenAiEndpoint   = Get-CogEndpoint $openaiName
$speechEndpoint        = Get-CogEndpoint $speechName
$aiServicesEndpoint    = Get-CogEndpoint $aiSvcName
$docIntelEndpoint      = Get-CogEndpoint $docIntelName
$irEndpoint            = Get-CogEndpoint $irName

$speechRegion = ""
if ($speechName) {
    $speechRegion = (az cognitiveservices account show --name $speechName --resource-group $ResourceGroup --query "location" -o tsv 2>$null).Trim()
}

$searchEndpoint = ""
if ($searchName) { $searchEndpoint = "https://${searchName}.search.windows.net" }

$cosmosEndpoint = ""
if ($cosmosName) {
    $cosmosEndpoint = (az cosmosdb show --name $cosmosName --resource-group $ResourceGroup --query "documentEndpoint" -o tsv 2>$null).Trim()
}

$keyVaultUri = ""
if ($kvName) {
    $keyVaultUri = (az keyvault show --name $kvName --resource-group $ResourceGroup --query "properties.vaultUri" -o tsv 2>$null).Trim()
}

$sbNamespace = if ($sbName) { $sbName } else { "" }

$swaHostname = ""
if ($swaName) {
    $swaHostname = (az staticwebapp show --name $swaName --resource-group $ResourceGroup --query "defaultHostname" -o tsv 2>$null).Trim()
}

# --- AI Foundry project endpoint ---
Write-Host ""
Write-Host "[4/6] Resolving AI Foundry project endpoint..."

$aiFoundryEndpoint = ""
$aiProject = if ($projectName) { $projectName } else { "" }
if ($projectName -and $aiSvcName) {
    $workspaceId = (az resource show `
        --name $projectName `
        --resource-group $ResourceGroup `
        --resource-type "Microsoft.MachineLearningServices/workspaces" `
        --query "properties.workspaceId" -o tsv 2>$null).Trim()
    if ($workspaceId -and $aiServicesEndpoint) {
        # Derive: https://<ai-services-subdomain>.services.ai.azure.com/api/projects/<workspaceId>
        $aiSvcHost = ($aiServicesEndpoint -replace "https://", "" -replace "\.cognitiveservices\.azure\.com.*", "")
        $aiFoundryEndpoint = "https://${aiSvcHost}.services.ai.azure.com/api/projects/${workspaceId}"
    }
}
Write-Host "  AI Foundry Endpoint: $( if ($aiFoundryEndpoint) { $aiFoundryEndpoint } else { '<could not resolve>' } )"

# --- Detect model deployments ---
Write-Host ""
Write-Host "[5/6] Checking OpenAI model deployments..."

$speechModelDeployment = ""
if ($openaiName) {
    $deployments = az cognitiveservices account deployment list `
        --name $openaiName `
        --resource-group $ResourceGroup `
        -o json 2>$null | ConvertFrom-Json

    if ($deployments) {
        foreach ($d in $deployments) {
            $modelName = $d.properties.model.name
            $deployName = $d.name
            $version = $d.properties.model.version
            Write-Host "    $deployName -> $modelName ($version)"
        }
        # Prefer nano/5.4 model, fall back to first gpt model
        $nanoDeployment = $deployments | Where-Object { $_.properties.model.name -match "nano|5\.4" } | Select-Object -First 1
        if ($nanoDeployment) {
            $speechModelDeployment = $nanoDeployment.name
        } else {
            $gptDeployment = $deployments | Where-Object { $_.properties.model.name -match "gpt" } | Select-Object -First 1
            if ($gptDeployment) { $speechModelDeployment = $gptDeployment.name }
        }
    }
}
Write-Host "  Speech model deployment: $( if ($speechModelDeployment) { $speechModelDeployment } else { '<not found>' } )"

# --- Write the .env file ---
Write-Host ""
Write-Host "[6/6] Writing $EnvFile..."

$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$envContent = @"
# Local development environment variables.
# Auto-generated by infra/scripts/fetch-env.ps1 on $timestamp
# Source: resource group $ResourceGroup
#
# Auth: DefaultAzureCredential (az login) used for all service auth.
# Set LOCAL_DEV=true to use in-memory storage and skip auth validation.

# Enables in-memory storage, auth bypass, local stubs for unconfigured services
LOCAL_DEV=true

# --- Cosmos DB (leave empty for in-memory) ---
COSMOS_DB_ENDPOINT=$cosmosEndpoint
COSMOS_DB_DATABASE=ChatApp

# --- Azure OpenAI ---
AZURE_OPENAI_ENDPOINT=$azureOpenAiEndpoint

# --- AI Foundry (Agent Framework) ---
AI_FOUNDRY_ENDPOINT=$aiFoundryEndpoint
AI_PROJECT_NAME=$aiProject

# --- Speech Agent Model ---
SPEECH_MODEL_DEPLOYMENT=$speechModelDeployment

# --- Azure AI Services (Content Safety, PII) ---
AZURE_AI_SERVICES_ENDPOINT=$aiServicesEndpoint

# --- Document Intelligence ---
DOC_INTELLIGENCE_ENDPOINT=$docIntelEndpoint

# --- Azure AI Search ---
AZURE_SEARCH_ENDPOINT=$searchEndpoint

# --- Speech Service ---
SPEECH_ENDPOINT=$speechEndpoint
SPEECH_REGION=$speechRegion

# --- Immersive Reader ---
IR_ENDPOINT=$irEndpoint

# --- Storage ---
STORAGE_ACCOUNT_NAME=$storageName

# --- Key Vault ---
KEY_VAULT_URI=$keyVaultUri

# --- Service Bus (empty if not deployed) ---
SERVICE_BUS_NAMESPACE=$sbNamespace

# --- Auth (leave empty to skip Entra token validation) ---
ENTRA_CLIENT_ID=
STATIC_WEB_APP_HOSTNAME=$swaHostname
"@

$envContent | Set-Content -Path $EnvFile -Encoding UTF8 -NoNewline

Write-Host ""
Write-Host "=========================================="
Write-Host "  Done! $EnvFile written successfully."
Write-Host "=========================================="
Write-Host ""
Write-Host "  To start local dev:"
Write-Host "    cd backend; uvicorn main:app --reload --port 8000"
Write-Host ""
Write-Host "  To connect to real Azure services, set LOCAL_DEV=false in $EnvFile"
Write-Host "=========================================="
