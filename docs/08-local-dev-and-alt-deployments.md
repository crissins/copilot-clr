# Local Development & Alternative Deployments

> The main [README](../README.md) covers the **Standard** deployment (full 17-service production stack).
> This document covers local development setup and alternative deployment tiers for cost-conscious or early-stage development.

---

## Local Development

### Prerequisites

- [Python](https://python.org/) 3.11+
- [Node.js](https://nodejs.org/) 18+
- Azure subscription with at least the Development tier deployed (see below)

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux

pip install -r requirements.txt

# Create .env with your Azure resource endpoints
# (use infra/scripts/fetch-env.ps1 to pull from your deployment outputs)
LOCAL_DEV=true uvicorn main:app --reload --port 8000
```

When `LOCAL_DEV=true`:
- Entra ID auth is bypassed (all requests run as `local-dev-user`)
- Content Safety filtering is skipped
- All Azure AI services (OpenAI, Speech, Immersive Reader, etc.) still require cloud endpoints

### Frontend

```bash
cd frontend
npm install
npm run dev
# Opens http://localhost:5173 with Vite proxy to localhost:8000
```

The frontend `.env.development` sets `VITE_LOCAL_DEV=true` to bypass Entra ID auth locally.

---

## Alternative Deployment Tiers

Copilot CLR supports three deployment tiers using the same `main.bicep` template with different parameter files.

### Tier Comparison

| | Development | Low-Cost | Standard |
|---|---|---|---|
| **Parameter file** | `main.dev.bicepparam` | `main.lowcost.bicepparam` | `main.bicepparam` |
| **Estimated cost** | ~$0–2/mo | ~$6–8/mo | ~$10–14/mo |
| **Azure services** | 14 | 17 | 17 |
| **Backend runs** | Locally (`uvicorn`) | Azure Container Apps | Azure Container Apps |
| **Frontend runs** | Locally (`vite dev`) | Azure Static Web Apps | Azure Static Web Apps |
| **Voice (Realtime)** | ❌ | ❌ | ✅ |
| **Auth (Entra ID)** | ❌ (anonymous) | ✅ | ✅ |
| **Best for** | Local dev & testing | Budget-conscious full deploy | Full-featured production / demos |

### Feature Comparison

| Feature | Development | Low-Cost | Standard |
|---|---|---|---|
| Chat (gpt-4o-mini) | ✅ | ✅ | ✅ |
| Embeddings | ✅ 1K TPM | ✅ 1K TPM | ✅ 10K TPM |
| Voice (Realtime API) | ❌ | ❌ | ✅ |
| Text-to-Speech | ✅ | ✅ | ✅ |
| Immersive Reader | ✅ | ✅ | ✅ |
| Document upload & simplification | ✅ | ✅ | ✅ |
| Content Safety filtering | ❌ (skipped locally) | ✅ | ✅ |
| Async reminders (Service Bus) | ❌ (in-process) | ✅ | ✅ |
| Scale to zero | N/A | ✅ | ✅ |
| OpenTelemetry / App Insights | ❌ (skipped locally) | ✅ | ✅ |

---

### Option A: Development Tier (~$0–2/mo)

Deploys 14 Azure services — the AI and data layer only. No compute or hosting. Backend and frontend run locally.

```bash
az login --use-device-code

REGION="eastus2"
RG_NAME="rg-copilot-clr-dev"

az group create --name $RG_NAME --location $REGION \
  --tags project=copilot-clr environment=dev managed-by=bicep -o none

az deployment group create \
  --resource-group $RG_NAME \
  --template-file infra/main.bicep \
  --parameters infra/main.dev.bicepparam \
  --parameters location=$REGION \
  -o json
```

Then run locally (see [Local Development](#local-development) above).

### Option B: Low-Cost Tier (~$6–8/mo)

Full cloud deployment with reduced capacity: OpenAI limited to 1K TPM, Container App at 0.25 vCPU / 0.5 GiB, voice disabled.

```bash
az login --use-device-code

REGION="eastus2"
RG_NAME="rg-copilot-clr-lowcost"

az group create --name $RG_NAME --location $REGION \
  --tags project=copilot-clr environment=dev cost-optimized=true managed-by=bicep -o none

az deployment group create \
  --resource-group $RG_NAME \
  --template-file infra/main.bicep \
  --parameters infra/main.lowcost.bicepparam \
  --parameters location=$REGION \
  -o json
```

After deployment, follow Steps 4–9 from the main [README](../README.md#step-4-capture-deployment-outputs) to configure Entra ID, build/deploy the backend container, and deploy the frontend.

### Switching Between Tiers

Bicep is idempotent — simply re-deploy with a different parameter file:

```bash
# Upgrade from low-cost to standard
az deployment group create \
  --resource-group $RG_NAME \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam \
  --parameters location=$REGION \
  -o json
```

No data migration required. Cosmos DB data, Container App images, and SWA content remain intact.

---

## Parameter Reference

| Parameter | Standard | Low-Cost | Dev | Description |
|---|---|---|---|---|
| `openAiChatCapacity` | `10` | `1` | `1` | gpt-4o-mini TPM capacity (1K per unit) |
| `openAiEmbeddingCapacity` | `10` | `1` | `1` | text-embedding-ada-002 TPM capacity |
| `deployVoice` | `true` | `false` | `false` | Deploy realtime preview model for voice |
| `containerCpu` | `'0.5'` | `'0.25'` | N/A | Container App vCPU |
| `containerMemory` | `'1Gi'` | `'0.5Gi'` | N/A | Container App memory |
| `logRetentionDays` | `30` | `30` | `30` | Log Analytics retention |

---

## Cost Optimization Tips

- **Delete when not in use**: `az group delete --name $RG_NAME --yes --no-wait` — redeploy fresh next session
- **Replace ACR with GHCR**: GitHub Container Registry is free for public repos, saving ~$5/mo
- **Azure Dev/Test pricing**: Available with Visual Studio subscriptions for discounted rates
- **Cost alerts**: Set a budget alert at $20/mo via Azure Cost Management

For detailed cost analysis, see [Low-Cost Deployment Guide](06-low-cost-deployment.md).

## Cleanup

```bash
# Delete all resources
az group delete --name $RG_NAME --yes --no-wait

# If redeploying, purge soft-deleted Cognitive Services first
az cognitiveservices account list-deleted --query "[].name" -o tsv
az cognitiveservices account purge --location $REGION --resource-group $RG_NAME --name <name>
```
