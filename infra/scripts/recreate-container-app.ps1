# Recreate Container App with all env vars and the new backend image
# Run from: c:\Github Projects\base innovation

$rg = "rg-chatapp-prod"
$envName = "container-apps-environment-kvhky"
$appName = "container-apps-kvhky"
$acr = "containerregistrykvhky.azurecr.io"
$image = "${acr}/copilot-clr-api:latest"

Write-Host "Gathering resource endpoints..." -ForegroundColor Cyan

$cosmos   = (az cosmosdb show -n cosmos-kvhky -g $rg --query "documentEndpoint" -o tsv 2>$null).Trim()
$oai      = (az cognitiveservices account show -n open-ai-kvhky -g $rg --query "properties.endpoint" -o tsv 2>$null).Trim()
$search   = (az search service show -n search-kvhky -g $rg --query "name" -o tsv 2>$null).Trim()
$searchEp = "https://${search}.search.windows.net"
$kv       = (az keyvault show -n kv-app-kvhky --query "properties.vaultUri" -o tsv 2>$null).Trim()
$speech   = (az cognitiveservices account show -n speech-kvhky -g $rg --query "properties.endpoint" -o tsv 2>$null).Trim()
$ais      = (az cognitiveservices account show -n ais-kvhky -g $rg --query "properties.endpoint" -o tsv 2>$null).Trim()
$di       = (az cognitiveservices account show -n document-intelligence-kvhky -g $rg --query "properties.endpoint" -o tsv 2>$null).Trim()
$ir       = (az cognitiveservices account show -n ir-kvhky -g $rg --query "properties.endpoint" -o tsv 2>$null).Trim()
$appi     = (az resource show --ids "/subscriptions/edd0e1f4-aaca-4046-888f-dbd0c67914a0/resourceGroups/$rg/providers/Microsoft.Insights/components/appi-kvhky" --query "properties.ConnectionString" -o tsv 2>$null).Trim()
$swa      = (az staticwebapp show -n swa-kvhky -g $rg --query "defaultHostname" -o tsv 2>$null).Trim()
$sb       = "sb-kvhky.servicebus.windows.net"
$storage  = "staccountkvhky"
$speechId = (az cognitiveservices account show -n speech-kvhky -g $rg --query "id" -o tsv 2>$null).Trim()
# AI Foundry project discovery URL: standard pattern
$aiProject = "ai-project-kvhky"
$aiFoundry = "https://eastus2.api.azureml.ms/discovery"

Write-Host "COSMOS:  $cosmos"
Write-Host "OAI:     $oai"
Write-Host "SEARCH:  $searchEp"
Write-Host "KV:      $kv"
Write-Host "SPEECH:  $speech"
Write-Host "AIS:     $ais"
Write-Host "DI:      $di"
Write-Host "IR:      $ir"
Write-Host "APPI:    $($appi.Substring(0, [Math]::Min(50, $appi.Length)))..."
Write-Host "SWA:     $swa"
Write-Host ""

Write-Host "Creating Container App..." -ForegroundColor Cyan

$envId = (az containerapp env show -n $envName -g $rg --query "id" -o tsv 2>$null).Trim()

az containerapp create `
  --name $appName `
  --resource-group $rg `
  --environment $envId `
  --image $image `
  --registry-server $acr `
  --registry-identity system `
  --system-assigned `
  --ingress external `
  --target-port 8000 `
  --transport http `
  --cpu 0.5 `
  --memory 1Gi `
  --min-replicas 0 `
  --max-replicas 10 `
  --env-vars `
    APPLICATIONINSIGHTS_CONNECTION_STRING="$appi" `
    COSMOS_DB_ENDPOINT="$cosmos" `
    COSMOS_DB_DATABASE="ChatApp" `
    AZURE_OPENAI_ENDPOINT="$oai" `
    AZURE_SEARCH_ENDPOINT="$searchEp" `
    AZURE_AI_SERVICES_ENDPOINT="$ais" `
    SERVICE_BUS_NAMESPACE="$sb" `
    KEY_VAULT_URI="$kv" `
    AI_PROJECT_NAME="$aiProject" `
    PROJECT_ENDPOINT="$aiFoundry" `
    SPEECH_ENDPOINT="$speech" `
    SPEECH_RESOURCE_ID="$speechId" `
    SPEECH_REGION="eastus2" `
    STORAGE_ACCOUNT_NAME="$storage" `
    IR_ENDPOINT="$ir" `
    DOC_INTELLIGENCE_ENDPOINT="$di" `
    WEBPUBSUB_ENDPOINT="https://webpubsub-kvhky.webpubsub.azure.com" `
    AZURE_CONTENT_SAFETY_ENDPOINT="$ais" `
    STATIC_WEB_APP_HOSTNAME="$swa" `
    AZURE_CLIENT_ID="" `
  --query "{fqdn:properties.configuration.ingress.fqdn, state:properties.provisioningState}" `
  -o json 2>&1

Write-Host ""
Write-Host "Done! Exit code: $LASTEXITCODE" -ForegroundColor Green
