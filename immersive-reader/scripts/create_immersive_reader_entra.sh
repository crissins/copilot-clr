#!/bin/sh
set -eu

RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-${RESOURCE_GROUP:-rg-immersive-reader}}"
IMMERSIVE_READER_NAME="${IMMERSIVE_READER_NAME:-ir-hackaton-danielx11}"
APP_REGISTRATION_NAME="${APP_REGISTRATION_NAME:-ir-hackaton-app}"

echo "Getting current tenant..."
TENANT_ID=$(az account show --query tenantId -o tsv)

echo "Creating Microsoft Entra application..."
APP_JSON=$(az ad app create \
  --display-name "$APP_REGISTRATION_NAME" \
  --sign-in-audience AzureADMyOrg)

APP_ID=$(echo "$APP_JSON" | python3 -c "import sys, json; print(json.load(sys.stdin)['appId'])")
OBJECT_ID=$(echo "$APP_JSON" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

echo "Creating service principal..."
az ad sp create --id "$APP_ID" >/dev/null

echo "Creating client secret..."
SECRET_JSON=$(az ad app credential reset \
  --id "$APP_ID" \
  --append \
  --display-name "immersive-reader-secret")

CLIENT_SECRET=$(echo "$SECRET_JSON" | python3 -c "import sys, json; print(json.load(sys.stdin)['password'])")

echo "Reading Immersive Reader subdomain..."
SUBDOMAIN=$(az cognitiveservices account show \
  --name "$IMMERSIVE_READER_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query name -o tsv)

echo ""
echo "Add these values to your .env:"
echo "IMMERSIVE_READER_SUBDOMAIN=$SUBDOMAIN"
echo "IMMERSIVE_READER_TENANT_ID=$TENANT_ID"
echo "IMMERSIVE_READER_CLIENT_ID=$APP_ID"
echo "IMMERSIVE_READER_CLIENT_SECRET=$CLIENT_SECRET"