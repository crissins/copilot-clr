#!/bin/bash
# ============================================================================
# Fetch Azure resource endpoints and write backend/.env for local development.
#
# Usage:
#   ./infra/scripts/fetch-env.sh [resource-group]
#
# Defaults to rg-chatapp-prod. Requires `az login` and `jq`.
# Auth uses DefaultAzureCredential (az login) — no keys stored.
# ============================================================================

set -euo pipefail

RESOURCE_GROUP="${1:-rg-chatapp-prod}"
ENV_FILE="backend/.env"

echo "=========================================="
echo "  Fetch Azure Endpoints → ${ENV_FILE}"
echo "=========================================="
echo "  Resource Group: ${RESOURCE_GROUP}"
echo "=========================================="

# --- Verify prerequisites ----
command -v az  >/dev/null 2>&1 || { echo "ERROR: az CLI not found. Install: https://aka.ms/install-azure-cli"; exit 1; }
command -v jq  >/dev/null 2>&1 || { echo "ERROR: jq not found. Install: https://stedolan.github.io/jq/download/"; exit 1; }

echo ""
echo "[1/6] Checking Azure login..."
az account show --query "{subscription:name, id:id}" -o table || {
    echo "Not logged in. Run: az login"
    exit 1
}

# --- Discover resource names from resource group ----
echo ""
echo "[2/6] Listing resources in ${RESOURCE_GROUP}..."
RESOURCES=$(az resource list --resource-group "$RESOURCE_GROUP" -o json)

get_name() {
    # Find the first resource whose type contains $1
    echo "$RESOURCES" | jq -r --arg t "$1" '[.[] | select(.type | ascii_downcase | contains($t | ascii_downcase))][0].name // empty'
}

OPENAI_NAME=$(get_name "Microsoft.CognitiveServices/accounts" | while read -r n; do
    # OpenAI account has kind=OpenAI — filter via a second query
    :
done 2>/dev/null || true)

# More reliable: query by resource type + kind
OPENAI_NAME=$(echo "$RESOURCES" | jq -r '[.[] | select(.type=="Microsoft.CognitiveServices/accounts" and .kind=="OpenAI")][0].name // empty')
SPEECH_NAME=$(echo "$RESOURCES" | jq -r '[.[] | select(.type=="Microsoft.CognitiveServices/accounts" and .kind=="SpeechServices")][0].name // empty')
AI_SERVICES_NAME=$(echo "$RESOURCES" | jq -r '[.[] | select(.type=="Microsoft.CognitiveServices/accounts" and .kind=="CognitiveServices")][0].name // empty')
DOC_INTEL_NAME=$(echo "$RESOURCES" | jq -r '[.[] | select(.type=="Microsoft.CognitiveServices/accounts" and .kind=="FormRecognizer")][0].name // empty')
IR_NAME=$(echo "$RESOURCES" | jq -r '[.[] | select(.type=="Microsoft.CognitiveServices/accounts" and .kind=="ImmersiveReader")][0].name // empty')
SEARCH_NAME=$(echo "$RESOURCES" | jq -r '[.[] | select(.type=="Microsoft.Search/searchServices")][0].name // empty')
COSMOS_NAME=$(echo "$RESOURCES" | jq -r '[.[] | select(.type=="Microsoft.DocumentDB/databaseAccounts")][0].name // empty')
KV_NAME=$(echo "$RESOURCES" | jq -r '[.[] | select(.type=="Microsoft.KeyVault/vaults")][0].name // empty')
STORAGE_NAME=$(echo "$RESOURCES" | jq -r '[.[] | select(.type=="Microsoft.Storage/storageAccounts")][0].name // empty')
SB_NAME=$(echo "$RESOURCES" | jq -r '[.[] | select(.type=="Microsoft.ServiceBus/namespaces")][0].name // empty')
PROJECT_NAME=$(echo "$RESOURCES" | jq -r '[.[] | select(.type=="Microsoft.MachineLearningServices/workspaces" and .kind=="Project")][0].name // empty')
SWA_NAME=$(echo "$RESOURCES" | jq -r '[.[] | select(.type=="Microsoft.Web/staticSites")][0].name // empty')

echo "  Found resources:"
echo "    OpenAI:              ${OPENAI_NAME:-<not found>}"
echo "    Speech:              ${SPEECH_NAME:-<not found>}"
echo "    AI Services:         ${AI_SERVICES_NAME:-<not found>}"
echo "    Doc Intelligence:    ${DOC_INTEL_NAME:-<not found>}"
echo "    Immersive Reader:    ${IR_NAME:-<not found>}"
echo "    AI Search:           ${SEARCH_NAME:-<not found>}"
echo "    Cosmos DB:           ${COSMOS_NAME:-<not found>}"
echo "    Key Vault:           ${KV_NAME:-<not found>}"
echo "    Storage:             ${STORAGE_NAME:-<not found>}"
echo "    Service Bus:         ${SB_NAME:-<not found>}"
echo "    AI Foundry Project:  ${PROJECT_NAME:-<not found>}"
echo "    Static Web App:      ${SWA_NAME:-<not found>}"

# --- Fetch endpoints from each resource ----
echo ""
echo "[3/6] Querying resource endpoints..."

fetch_cog_endpoint() {
    local name="$1"
    [ -z "$name" ] && return
    az cognitiveservices account show --name "$name" --resource-group "$RESOURCE_GROUP" \
        --query "properties.endpoint" -o tsv 2>/dev/null || true
}

AZURE_OPENAI_ENDPOINT=$(fetch_cog_endpoint "$OPENAI_NAME")
SPEECH_ENDPOINT=$(fetch_cog_endpoint "$SPEECH_NAME")
SPEECH_REGION=$([ -n "$SPEECH_NAME" ] && az cognitiveservices account show --name "$SPEECH_NAME" --resource-group "$RESOURCE_GROUP" --query "location" -o tsv 2>/dev/null || true)
AZURE_AI_SERVICES_ENDPOINT=$(fetch_cog_endpoint "$AI_SERVICES_NAME")
DOC_INTELLIGENCE_ENDPOINT=$(fetch_cog_endpoint "$DOC_INTEL_NAME")
IR_ENDPOINT=$(fetch_cog_endpoint "$IR_NAME")

AZURE_SEARCH_ENDPOINT=""
[ -n "$SEARCH_NAME" ] && AZURE_SEARCH_ENDPOINT="https://${SEARCH_NAME}.search.windows.net"

COSMOS_DB_ENDPOINT=""
[ -n "$COSMOS_NAME" ] && COSMOS_DB_ENDPOINT=$(az cosmosdb show --name "$COSMOS_NAME" --resource-group "$RESOURCE_GROUP" --query "documentEndpoint" -o tsv 2>/dev/null || true)

KEY_VAULT_URI=""
[ -n "$KV_NAME" ] && KEY_VAULT_URI=$(az keyvault show --name "$KV_NAME" --resource-group "$RESOURCE_GROUP" --query "properties.vaultUri" -o tsv 2>/dev/null || true)

SERVICE_BUS_NAMESPACE=""
[ -n "$SB_NAME" ] && SERVICE_BUS_NAMESPACE="$SB_NAME"

SWA_HOSTNAME=""
[ -n "$SWA_NAME" ] && SWA_HOSTNAME=$(az staticwebapp show --name "$SWA_NAME" --resource-group "$RESOURCE_GROUP" --query "defaultHostname" -o tsv 2>/dev/null || true)

# --- AI Foundry endpoint (requires project discovery URL) ----
echo ""
echo "[4/6] Resolving AI Foundry project endpoint..."

AI_FOUNDRY_ENDPOINT=""
AI_PROJECT=""
if [ -n "$PROJECT_NAME" ]; then
    AI_PROJECT="$PROJECT_NAME"
    # The AI Services account's endpoint + project workspace ID form the Agent Framework endpoint
    if [ -n "$AI_SERVICES_NAME" ]; then
        WORKSPACE_ID=$(az resource show \
            --name "$PROJECT_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --resource-type "Microsoft.MachineLearningServices/workspaces" \
            --query "properties.workspaceId" -o tsv 2>/dev/null || true)
        if [ -n "$WORKSPACE_ID" ] && [ -n "$AZURE_AI_SERVICES_ENDPOINT" ]; then
            # Derive the AI Foundry endpoint: https://<ai-services-subdomain>.services.ai.azure.com/api/projects/<workspaceId>
            AI_SERVICES_HOST=$(echo "$AZURE_AI_SERVICES_ENDPOINT" | sed 's|https://||;s|\.cognitiveservices\.azure\.com.*||')
            AI_FOUNDRY_ENDPOINT="https://${AI_SERVICES_HOST}.services.ai.azure.com/api/projects/${WORKSPACE_ID}"
        fi
    fi
fi

# --- Detect model deployments ----
echo ""
echo "[5/6] Checking OpenAI model deployments..."

SPEECH_MODEL_DEPLOYMENT=""
if [ -n "$OPENAI_NAME" ]; then
    # List deployments and pick the one that looks like the speech/nano model
    DEPLOYMENTS=$(az cognitiveservices account deployment list \
        --name "$OPENAI_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        -o json 2>/dev/null || echo "[]")
    # Prefer gpt-5.4-nano, fall back to first gpt model
    SPEECH_MODEL_DEPLOYMENT=$(echo "$DEPLOYMENTS" | jq -r '[.[] | select(.properties.model.name | test("nano|5\\.4"; "i"))][0].name // empty')
    if [ -z "$SPEECH_MODEL_DEPLOYMENT" ]; then
        SPEECH_MODEL_DEPLOYMENT=$(echo "$DEPLOYMENTS" | jq -r '[.[] | select(.properties.model.name | test("gpt"; "i"))][0].name // empty')
    fi
    echo "  Model deployments found:"
    echo "$DEPLOYMENTS" | jq -r '.[] | "    \(.name) → \(.properties.model.name) (\(.properties.model.version // "n/a"))"' 2>/dev/null || true
fi

# --- Write the .env file ----
echo ""
echo "[6/6] Writing ${ENV_FILE}..."

cat > "$ENV_FILE" << ENVEOF
# Local development environment variables.
# Auto-generated by infra/scripts/fetch-env.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Source: resource group ${RESOURCE_GROUP}
#
# Auth: DefaultAzureCredential (az login) used for all service auth.
# Set LOCAL_DEV=true to use in-memory storage and skip auth validation.

# Enables in-memory storage, auth bypass, local stubs for unconfigured services
LOCAL_DEV=true

# --- Cosmos DB (leave empty for in-memory) ---
COSMOS_DB_ENDPOINT=${COSMOS_DB_ENDPOINT}
COSMOS_DB_DATABASE=ChatApp

# --- Azure OpenAI ---
AZURE_OPENAI_ENDPOINT=${AZURE_OPENAI_ENDPOINT}

# --- AI Foundry (Agent Framework) ---
AI_FOUNDRY_ENDPOINT=${AI_FOUNDRY_ENDPOINT}
AI_PROJECT_NAME=${AI_PROJECT}

# --- Speech Agent Model ---
SPEECH_MODEL_DEPLOYMENT=${SPEECH_MODEL_DEPLOYMENT}

# --- Azure AI Services (Content Safety, PII) ---
AZURE_AI_SERVICES_ENDPOINT=${AZURE_AI_SERVICES_ENDPOINT}

# --- Document Intelligence ---
DOC_INTELLIGENCE_ENDPOINT=${DOC_INTELLIGENCE_ENDPOINT}

# --- Azure AI Search ---
AZURE_SEARCH_ENDPOINT=${AZURE_SEARCH_ENDPOINT}

# --- Speech Service ---
SPEECH_ENDPOINT=${SPEECH_ENDPOINT}
SPEECH_REGION=${SPEECH_REGION}

# --- Immersive Reader ---
IR_ENDPOINT=${IR_ENDPOINT}

# --- Storage ---
STORAGE_ACCOUNT_NAME=${STORAGE_NAME}

# --- Key Vault ---
KEY_VAULT_URI=${KEY_VAULT_URI}

# --- Service Bus (empty if not deployed) ---
SERVICE_BUS_NAMESPACE=${SERVICE_BUS_NAMESPACE}

# --- Auth (leave empty to skip Entra token validation) ---
ENTRA_CLIENT_ID=
STATIC_WEB_APP_HOSTNAME=${SWA_HOSTNAME}
ENVEOF

echo ""
echo "=========================================="
echo "  Done! ${ENV_FILE} written successfully."
echo "=========================================="
echo ""
echo "  To start local dev:"
echo "    cd backend && uvicorn main:app --reload --port 8000"
echo ""
echo "  To connect to real Azure services, set LOCAL_DEV=false in ${ENV_FILE}"
echo "=========================================="
