# Deployment Types

Copilot CLR supports three deployment tiers, each using the same `main.bicep` template with a different parameter file. Choose the tier that fits your stage of development.

## Tier Overview

| | Development | Low-Cost | Standard |
|---|---|---|---|
| **Parameter file** | `main.dev.bicepparam` | `main.lowcost.bicepparam` | `main.bicepparam` |
| **Estimated cost** | ~$0–2/mo | ~$6–8/mo | ~$10–14/mo |
| **Azure services** | 14 | 18 | 18 |
| **Backend runs** | Locally (`uvicorn`) | Azure Container Apps | Azure Container Apps |
| **Frontend runs** | Locally (`vite dev`) | Azure Static Web Apps | Azure Static Web Apps |
| **Best for** | Local development & testing | Budget-conscious full deploy | Full-featured production |

---

## Service Comparison

| Azure Service | SKU | Development | Low-Cost | Standard |
|---|---|---|---|---|
| Storage Account | Standard LRS | ✅ | ✅ | ✅ |
| Key Vault | Standard | ✅ | ✅ | ✅ |
| Log Analytics + App Insights | Free (5 GB) | ✅ (30-day retention) | ✅ (30-day retention) | ✅ (30-day retention) |
| Azure OpenAI | S0 | ✅ 1K TPM | ✅ 1K TPM | ✅ 10K TPM |
| AI Foundry Hub | Basic | ✅ | ✅ | ✅ |
| AI Foundry Project | — | ✅ | ✅ | ✅ |
| AI Search | Free | ✅ | ✅ | ✅ |
| AI Services (Content Safety) | S0 | ✅ | ✅ | ✅ |
| Azure Speech Service | F0 | ✅ | ✅ | ✅ |
| Azure Immersive Reader | S0 | ✅ | ✅ | ✅ |
| Document Intelligence | F0 | ✅ | ✅ | ✅ |
| Cosmos DB | Serverless | ✅ | ✅ | ✅ |
| RBAC Role Assignments | — | ✅ | ✅ | ✅ |
| Entra ID | Free | ✅ | ✅ | ✅ |
| Container Registry | Basic (~$5/mo) | ❌ | ✅ | ✅ |
| Container Apps | Consumption | ❌ | ✅ (0.25 vCPU / 0.5 Gi) | ✅ (0.5 vCPU / 1 Gi) |
| Static Web Apps | Free | ❌ | ✅ | ✅ |
| Service Bus | Basic | ❌ | ✅ | ✅ |

## Feature Comparison

| Feature | Development | Low-Cost | Standard |
|---|---|---|---|
| Chat (gpt-4o-mini) | ✅ | ✅ | ✅ |
| Embeddings (text-embedding-ada-002) | ✅ 1K TPM | ✅ 1K TPM | ✅ 10K TPM |
| Voice (Realtime API) | ❌ | ❌ | ✅ |
| Text-to-Speech | ✅ | ✅ | ✅ |
| Immersive Reader | ✅ | ✅ | ✅ |
| Document upload & simplification | ✅ | ✅ | ✅ |
| Content Safety filtering | ❌ (skipped locally) | ✅ | ✅ |
| Async reminders (Service Bus) | ❌ (in-process) | ✅ | ✅ |
| Scale to zero | N/A | ✅ | ✅ |
| OpenTelemetry / App Insights | ❌ (skipped locally) | ✅ | ✅ |
| Auth (Entra ID JWT) | ❌ (anonymous) | ✅ | ✅ |

---

## Development Tier

**Use when:** You're building features locally and only need cloud API services.

Deploys 14 Azure services — the AI and data layer only. No compute or hosting resources. The backend runs locally via `uvicorn` and the frontend via `vite dev`. Auth is bypassed (all requests run as `local-dev-user`), Content Safety is skipped, and storage uses an in-memory mock.

```bash
az login --use-device-code
az group create --name "rg-chatapp-dev" --location "eastus" --tags project=chatapp environment=dev -o none
az deployment group create --resource-group "rg-chatapp-dev" \
  --template-file infra/main.bicep \
  --parameters infra/main.dev.bicepparam \
  --parameters location=eastus -o json
```

Then run locally:

```bash
# Backend
cd backend && pip install -r requirements.txt
LOCAL_DEV=true uvicorn main:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev
```

## Low-Cost Tier

**Use when:** You want a full cloud deployment with minimal spend.

Deploys all 18 Azure services but with reduced capacity: OpenAI limited to 1K TPM, Container App sized at 0.25 vCPU / 0.5 Gi, and voice (Realtime API) disabled. Cost is dominated by Container Registry Basic (~$5/mo).

```bash
az login --use-device-code
az group create --name "rg-chatapp-dev" --location "eastus" --tags project=chatapp environment=dev cost-optimized=true -o none
az deployment group create --resource-group "rg-chatapp-dev" \
  --template-file infra/main.bicep \
  --parameters infra/main.lowcost.bicepparam \
  --parameters location=eastus -o json
```

## Standard Tier

**Use when:** You need the full feature set for demos, judging, or production.

Deploys all 18 Azure services at standard capacity: 10K TPM for OpenAI, 0.5 vCPU / 1 Gi Container App, voice (Realtime API) enabled, and full monitoring retention.

```bash
az login --use-device-code
az group create --name "rg-chatapp-dev" --location "eastus" --tags project=chatapp environment=dev -o none
az deployment group create --resource-group "rg-chatapp-dev" \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam \
  --parameters location=eastus -o json
```

---

## Region Selection

Pick a region with Azure OpenAI availability:

| Region | Code |
|---|---|
| East US | `eastus` |
| East US 2 | `eastus2` |
| West US | `westus` |
| West US 2 | `westus2` |
| West US 3 | `westus3` |
| South Central US | `southcentralus` |
| Sweden Central | `swedencentral` |
| UK South | `uksouth` |
| Canada East | `canadaeast` |

Override the default region by appending `--parameters location=<region>` to the deployment command.

## Cleanup

To delete all resources and avoid ongoing charges:

```bash
az group delete --name "rg-chatapp-dev" --yes --no-wait
```

If you redeploy after deletion, purge any soft-deleted Cognitive Services accounts first:

```bash
az cognitiveservices account list-deleted --query "[].name" -o tsv
az cognitiveservices account purge --location <region> --resource-group <rg> --name <name>
```
