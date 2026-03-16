#!/bin/bash
# ============================================================================
# Development Deployment Script — API Services Only (No Compute)
# Usage: ./deploy-dev.sh [location]
#   location: eastus (default)
#
# This deploys ONLY the cloud API services needed for local development:
#   OpenAI, AI Foundry Hub/Project, AI Search, Content Safety, Speech,
#   Immersive Reader, Document Intelligence, Cosmos DB, Storage, Key Vault,
#   Log Analytics + App Insights.
#
# NOT deployed: Container Registry, Container Apps, Static Web App, Service Bus
#
# Backend:  LOCAL_DEV=true uvicorn main:app --reload --port 8000
# Frontend: cd frontend && npm run dev
#
# Estimated monthly cost: ~$0-2 (free tiers + minimal OpenAI token usage)
# ============================================================================

set -euo pipefail

LOCATION="${1:-eastus}"
PROJECT_NAME="chatapp"
RESOURCE_GROUP="rg-${PROJECT_NAME}-dev"

echo "=========================================="
echo "  CognitiveClear — Dev Deploy (API Only)"
echo "  No compute — backend + frontend run locally"
echo "=========================================="
echo "  Location:    ${LOCATION}"
echo "  RG:          ${RESOURCE_GROUP}"
echo "=========================================="

# 1. Azure Login
echo ""
echo "[1/4] Logging into Azure..."
az login --use-device-code || {
    echo "Login failed. Please try again."
    exit 1
}

# 2. Verify login
echo ""
echo "[2/4] Verifying Azure login..."
az account show --query "{subscription:name, id:id}" -o table

# 3. Create resource group
echo ""
echo "[3/4] Creating resource group..."
az group create \
    --name "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --tags project="$PROJECT_NAME" environment=dev managed-by=bicep deployment-tier=development \
    -o none

# 4. Deploy Bicep with dev parameters (API services only)
echo ""
echo "[4/4] Deploying Bicep template (development — API services only)..."
DEPLOY_OUTPUT=$(az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-file infra/main.bicep \
    --parameters infra/main.dev.bicepparam \
    --query "properties.outputs" \
    -o json)

echo ""
echo "=========================================="
echo "  Deployment Complete!"
echo "=========================================="
echo ""

# Extract and display outputs, generate .env content
echo "--- Deployment Outputs ---"
echo "$DEPLOY_OUTPUT" | python3 -c "
import sys, json
outputs = json.load(sys.stdin)
env_lines = []
for key, val in outputs.items():
    v = val['value']
    print(f'  {key}: {v}')
    if v:  # Only non-empty values
        env_lines.append(f'{key}={v}')
print()
print('--- Copy to backend/.env ---')
print('LOCAL_DEV=true')
for line in env_lines:
    print(line)
" 2>/dev/null || echo "$DEPLOY_OUTPUT"

echo ""
echo "=========================================="
echo "  Next Steps"
echo "=========================================="
echo "  1. Copy the .env values above into backend/.env"
echo ""
echo "  2. Start the backend:"
echo "     cd backend"
echo "     pip install -r requirements.txt"
echo "     LOCAL_DEV=true uvicorn main:app --reload --port 8000"
echo ""
echo "  3. Start the frontend:"
echo "     cd frontend"
echo "     npm install"
echo "     npm run dev"
echo ""
echo "  4. Open http://localhost:5173 in your browser"
echo ""
echo "  5. (Optional) Create Entra ID App Registration:"
echo "     az ad app create --display-name '${PROJECT_NAME}-dev'"
echo "=========================================="
