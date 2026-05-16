#!/usr/bin/env sh
set -eu

if command -v azd.exe >/dev/null 2>&1; then
  AZD_CMD="azd.exe"
elif command -v azd >/dev/null 2>&1; then
  AZD_CMD="azd"
else
  echo "ERROR: azd not found"
  exit 1
fi

while IFS='=' read -r key value; do
  [ -n "${key:-}" ] || continue
  value=$(printf '%s' "$value" | sed 's/^"//' | sed 's/"$//')
  export "$key=$value"
done <<EOF
$("$AZD_CMD" env get-values)
EOF

: "${KEY_VAULT_NAME:?KEY_VAULT_NAME is required}"
: "${FOUNDRY_PROJECT_ENDPOINT:?FOUNDRY_PROJECT_ENDPOINT is required}"

AGENT_NAME="${AGENT_NAME:-cognitive-load-agent}"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-http://localhost:5173}"

az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name foundry-project-endpoint --value "$FOUNDRY_PROJECT_ENDPOINT" >/dev/null
az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name agent-name --value "$AGENT_NAME" >/dev/null


echo "Key Vault secrets set successfully."