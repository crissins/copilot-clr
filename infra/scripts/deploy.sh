#!/bin/bash
# ============================================================================
# One-command deployment script for Azure Chat App
# Usage: ./deploy.sh [environment] [location]
#   environment: dev (default), staging, prod
#   location: eastus (default)
# ============================================================================

set -euo pipefail

ENVIRONMENT="${1:-dev}"
LOCATION="${2:-eastus}"
PROJECT_NAME="chatapp"
RESOURCE_GROUP="rg-${PROJECT_NAME}-${ENVIRONMENT}"

echo "=========================================="
echo "  Azure Chat App — Infrastructure Deploy"
echo "=========================================="
echo "  Environment: ${ENVIRONMENT}"
echo "  Location:    ${LOCATION}"
echo "  RG:          ${RESOURCE_GROUP}"
echo "=========================================="

# 1. Login check
echo ""
echo "[1/4] Checking Azure login..."
az account show --query "{subscription:name, id:id}" -o table || {
    echo "Not logged in. Run: az login"
    exit 1
}

# 2. Create resource group
echo ""
echo "[2/4] Creating resource group..."
az group create \
    --name "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --tags project="$PROJECT_NAME" environment="$ENVIRONMENT" managed-by=bicep \
    -o none

# 3. Deploy Bicep
echo ""
echo "[3/4] Deploying Bicep template..."
DEPLOY_OUTPUT=$(az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-file infra/main.bicep \
    --parameters \
        location="$LOCATION" \
        environmentName="$ENVIRONMENT" \
        projectName="$PROJECT_NAME" \
    --query "properties.outputs" \
    -o json)

# 4. Output results
echo ""
echo "[4/4] Deployment complete!"
echo ""
echo "=========================================="
echo "  Deployment Outputs"
echo "=========================================="
echo "$DEPLOY_OUTPUT" | python3 -c "
import sys, json
outputs = json.load(sys.stdin)
for key, val in outputs.items():
    print(f'  {key}: {val[\"value\"]}')
" 2>/dev/null || echo "$DEPLOY_OUTPUT"

echo ""
echo "=========================================="
echo "  Next Steps"
echo "=========================================="
echo "  1. Create Entra ID App Registration:"
echo "     az ad app create --display-name '${PROJECT_NAME}-${ENVIRONMENT}'"
echo ""
echo "  2. Deploy Functions backend:"
echo "     cd api && func azure functionapp publish <func-name>"
echo ""
echo "  3. Deploy Static Web App frontend:"
echo "     cd app && npm install && npm run build"
echo "     swa deploy ./dist"
echo ""
echo "  4. Set up GitHub Actions secrets:"
echo "     AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID"
echo "=========================================="
