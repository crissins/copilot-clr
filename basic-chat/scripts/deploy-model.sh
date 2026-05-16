#!/usr/bin/env sh
set -eu

echo "Loading azd environment variables..."

# Resolve azd command for Windows shells (Git Bash/MSYS) and Unix-like shells
if command -v azd.exe >/dev/null 2>&1; then
  AZD_CMD="azd.exe"
elif command -v azd >/dev/null 2>&1; then
  AZD_CMD="azd"
else
  echo "ERROR: azd was not found in this shell."
  exit 1
fi

# Export azd environment variables into this shell session
# Expected input lines like: KEY="value"
while IFS='=' read -r key value; do
  [ -n "${key:-}" ] || continue

  # Strip surrounding double quotes if present
  value=$(printf '%s' "$value" | sed 's/^"//' | sed 's/"$//')

  export "$key=$value"
done <<EOF
$("$AZD_CMD" env get-values)
EOF

: "${FOUNDRY_ACCOUNT_NAME:?FOUNDRY_ACCOUNT_NAME is required}"
: "${AZURE_RESOURCE_GROUP:?AZURE_RESOURCE_GROUP is required}"
: "${MODEL_DEPLOYMENT_NAME:?MODEL_DEPLOYMENT_NAME is required}"

# Defaults based on the current Foundry quickstart example for a basic agent setup.
MODEL_NAME="${MODEL_NAME:-gpt-4.1-mini}"
MODEL_VERSION="${MODEL_VERSION:-2025-04-14}"
MODEL_FORMAT="${MODEL_FORMAT:-OpenAI}"
SKU_NAME="${SKU_NAME:-Standard}"
SKU_CAPACITY="${SKU_CAPACITY:-10}"

# Resolve Azure CLI command too, for consistency in Windows shells
if command -v az.exe >/dev/null 2>&1; then
  AZ_CMD="az.exe"
elif command -v az >/dev/null 2>&1; then
  AZ_CMD="az"
else
  echo "ERROR: Azure CLI (az) was not found in this shell."
  exit 1
fi

echo "Checking whether deployment already exists..."
if "$AZ_CMD" cognitiveservices account deployment show \
  --name "$FOUNDRY_ACCOUNT_NAME" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --deployment-name "$MODEL_DEPLOYMENT_NAME" \
  >/dev/null 2>&1; then
  echo "Model deployment '$MODEL_DEPLOYMENT_NAME' already exists. Skipping creation."
  exit 0
fi

echo "Creating model deployment '$MODEL_DEPLOYMENT_NAME'..."
"$AZ_CMD" cognitiveservices account deployment create \
  --only-show-errors \
  --name "$FOUNDRY_ACCOUNT_NAME" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --deployment-name "$MODEL_DEPLOYMENT_NAME" \
  --model-name "$MODEL_NAME" \
  --model-version "$MODEL_VERSION" \
  --model-format "$MODEL_FORMAT" \
  --sku-capacity "$SKU_CAPACITY" \
  --sku-name "$SKU_NAME"

echo "Verifying deployment provisioning state..."
"$AZ_CMD" cognitiveservices account deployment show \
  --only-show-errors \
  --name "$FOUNDRY_ACCOUNT_NAME" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --deployment-name "$MODEL_DEPLOYMENT_NAME" \
  --query properties.provisioningState -o tsv