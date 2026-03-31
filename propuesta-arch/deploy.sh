#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# deploy.sh - Script para desplegar CLRA con Bicep
# ═══════════════════════════════════════════════════════════════

set -e

# Configuración
ENVIRONMENT=${1:-dev}
RESOURCE_GROUP="clra-${ENVIRONMENT}-rg"
LOCATION="eastus"
PARAMETERS_FILE="parameters.${ENVIRONMENT}.json"

echo "🚀 CLRA Infrastructure Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Ambiente: $ENVIRONMENT"
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo ""

# Verificar autenticación
echo "✓ Verificando autenticación Azure..."
az account show > /dev/null || {
  echo "✗ No autenticado. Ejecuta: az login"
  exit 1
}

# Crear resource group
echo "✓ Creando Resource Group..."
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION \
  --tags project=clra environment=$ENVIRONMENT \
  --output none

# Validar Bicep
echo "✓ Validando Bicep..."
az bicep build --file main.bicep --output-format json > /dev/null

# Desplegar
echo "✓ Desplegando infraestructura (esto puede tardar 3-5 minutos)..."
DEPLOYMENT=$(az deployment group create \
  --name "clra-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S)" \
  --resource-group $RESOURCE_GROUP \
  --template-file main.bicep \
  --parameters @$PARAMETERS_FILE \
  --output json)

# Mostrar outputs
echo ""
echo "✅ ¡Deployment completado!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📌 INFORMACIÓN DE RECURSOS:"
echo ""

echo $DEPLOYMENT | jq '.properties.outputs' | jq 'to_entries[] | "\(.key): \(.value.value)"' -r

echo ""
echo "📝 Valores para .env:"
echo ""
echo $DEPLOYMENT | jq -r '.properties.outputs.environmentVars.value'

echo ""
echo "🔗 Comandos útiles:"
echo "  Ver recursos:"
echo "    az resource list -g $RESOURCE_GROUP -o table"
echo ""
echo "  Ver logs:"
echo "    az webapp log tail -g $RESOURCE_GROUP -n <app-name>"
echo ""
echo "  Limpiar (elimina TODO):"
echo "    az group delete -g $RESOURCE_GROUP --yes"
echo ""
