#!/bin/bash
# ============================================================================
# Low-Cost Deployment Script for Azure Chat App (Free Tiers Only)
# Usage: ./deploy-lowcost.sh [environment] [location]
#   environment: dev (default), staging, prod
#   location: eastus (default)
#
# This script deploys using free tier configurations where possible.
# Estimated monthly cost: ~$6-8 (see docs/06-low-cost-deployment.md)
# ============================================================================

set -euo pipefail

ENVIRONMENT="${1:-dev}"
LOCATION="${2:-eastus}"
PROJECT_NAME="chatapp"
RESOURCE_GROUP="rg-${PROJECT_NAME}-${ENVIRONMENT}"

echo "=========================================="
echo "  Azure Chat App — Low-Cost Deploy (Free Tiers)"
echo "=========================================="
echo "  Environment: ${ENVIRONMENT}"
echo "  Location:    ${LOCATION}"
echo "  RG:          ${RESOURCE_GROUP}"
echo "=========================================="

# 1. Azure Login
echo ""
echo "[1/5] Logging into Azure..."
az login --use-device-code || {
    echo "Login failed. Please try again."
    exit 1
}

# 2. Verify login
echo ""
echo "[2/5] Verifying Azure login..."
az account show --query "{subscription:name, id:id}" -o table

# 3. Create resource group
echo ""
echo "[3/5] Creating resource group..."
az group create \
    --name "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --tags project="$PROJECT_NAME" environment="$ENVIRONMENT" managed-by=bicep cost-optimized=true \
    -o none

# 4. Deploy Bicep with low-cost parameters
echo ""
echo "[4/5] Deploying Bicep template (low-cost configuration)..."
DEPLOY_OUTPUT=$(az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-file infra/main.bicep \
    --parameters infra/main.lowcost.bicepparam \
    --query "properties.outputs" \
    -o json)

# 5. Output results
echo ""
echo "[5/5] Deployment complete!"
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
echo "     cd backend && func azure functionapp publish <func-name>"
echo ""
echo "  3. Deploy Static Web App frontend:"
echo "     cd frontend && npm install && npm run build"
echo "     swa deploy ./dist --resource-group $RESOURCE_GROUP"
echo ""
echo "  4. Set up GitHub Actions secrets:"
echo "     AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID"
echo ""
echo "=========================================="
echo "  Cost Estimate: ~\$6-8/month (Free tiers + minimal usage)"
echo "  See docs/06-low-cost-deployment.md for details"
echo "=========================================="