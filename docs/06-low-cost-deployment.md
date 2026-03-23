# Low-Cost Deployment Guide

This guide explains how to deploy the full application at the lowest possible Azure cost for development, testing, and hackathon iteration. The same infrastructure code (`infra/main.bicep`) supports both modes — the difference is entirely in which parameter file you pass.

## Quick Start

```bash
# Low-cost deployment (~$6-8/month)
az deployment group create \
  --resource-group <your-rg> \
  --template-file infra/main.bicep \
  --parameters infra/main.lowcost.bicepparam

# Standard deployment (~$10-14/month, includes voice)
az deployment group create \
  --resource-group <your-rg> \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam
```

## Cost Breakdown

### Standard vs Low-Cost Side by Side

| Service | Standard | Low-Cost | Savings | Notes |
|---------|----------|----------|---------|-------|
| Storage Account | ~$0 | ~$0 | $0 | Standard LRS, minimal dev usage |
| Key Vault | ~$0 | ~$0 | $0 | Standard, RBAC-mode |
| Log Analytics | $0 | $0 | $0 | Free tier (5 GB/mo); 30d vs 7d retention |
| App Insights | $0 | $0 | $0 | Free tier (5 GB/mo) |
| **Azure OpenAI** | **~$3** | **~$1** | **~$2** | Reduced TPM capacity caps runaway spend |
| AI Foundry Hub | $0 | $0 | $0 | Basic tier |
| AI Foundry Project | $0 | $0 | $0 | Basic tier |
| Cosmos DB | ~$1 | ~$0.50 | ~$0.50 | Serverless, fewer ops in dev |
| AI Search | $0 | $0 | $0 | Free tier |
| AI Services | ~$0 | ~$0 | $0 | S0, pay-per-transaction |
| Service Bus | ~$0.05 | ~$0.05 | $0 | Basic tier is already minimal |
| **Container Registry** | **~$5** | **~$5** | **$0** | Basic tier is the minimum SKU |
| **Container Apps** | **~$3** | **~$1.50** | **~$1.50** | 0.25 vCPU vs 0.5 vCPU when active |
| Static Web Apps | $0 | $0 | $0 | Free tier |
| **Total** | **~$10-14** | **~$6-8** | **~$4-6** | |

> The biggest single cost is Container Registry Basic at ~$5/month (flat fee regardless of usage).
> See the GHCR section below if you want to eliminate this cost entirely.

## What Changes in Low-Cost Mode

### Voice Disabled (`deployVoice = false`)

The `gpt-4o-mini-realtime-preview` model deployment is skipped. The `/ws/realtime` WebSocket endpoint in the Container App will still compile and start, but calls to it will fail because the Azure OpenAI deployment does not exist.

**Why this matters:** A single 30-minute voice session costs approximately:
- Input audio: 30 min × $0.06/min = **$1.80**
- Output audio: 30 min × $0.24/min = **$7.20**
- Total: **~$9 per session**

In a hackathon where you run 10 test sessions, that is $90 in one afternoon. Disable voice unless you are actively testing the voice path.

To re-enable voice for a specific test run, deploy with an override:
```bash
az deployment group create \
  --resource-group <rg> \
  --template-file infra/main.bicep \
  --parameters infra/main.lowcost.bicepparam \
  --parameters deployVoice=true
```

### Reduced OpenAI Capacity (`openAiChatCapacity = 1`)

TPM (tokens per minute) capacity is set to 1 (1K TPM) instead of 10. This does not change the per-token price — it sets a rate limit that prevents a rogue loop or accidental batch job from consuming thousands of dollars in tokens quickly.

For interactive dev testing with one user at a time, 1K TPM is sufficient.

### Smaller Container App (`containerCpu = '0.25'`, `containerMemory = '0.5Gi'`)

Container Apps Consumption billing is per vCPU-second and per GiB-second when the container is active (not idle). Halving the CPU allocation halves the active compute cost.

| Allocation | Active cost (est. 4 hrs/day) |
|---|---|
| 0.5 vCPU, 1 GiB (standard) | ~$3/month |
| 0.25 vCPU, 0.5 GiB (low-cost) | ~$1.50/month |

> Note: 0.25 vCPU is sufficient for single-user dev testing but will throttle under concurrent load. The KEDA scaler will add replicas if HTTP concurrency exceeds 20.

### Log Retention (must be >= 30 days)

Log Analytics and App Insights retain data for 7 days instead of 30. No cost difference within the free 5 GB tier, but prevents unexpected storage charges if log volume grows unexpectedly during load testing.

## Further Cost Reductions (Manual Steps)

### Option 1: Delete the Resource Group When Not In Use

The cheapest deployment is no deployment. Delete the resource group at the end of each work session and redeploy the next day.

```bash
# Delete everything (irreversible — double-check the RG name)
az group delete --name <your-rg> --yes --no-wait

# Redeploy fresh
az group create --name <your-rg> --location eastus
az deployment group create \
  --resource-group <your-rg> \
  --template-file infra/main.bicep \
  --parameters infra/main.lowcost.bicepparam
```

Since all state is in Cosmos DB (serverless) and the Container App image is in ACR, a fresh deploy restores the full stack. The only manual step is re-deploying the Container App image after the ACR is recreated:

```bash
REGISTRY=$(az deployment group show -g <rg> -n main \
  --query properties.outputs.CONTAINER_REGISTRY_LOGIN_SERVER.value -o tsv)
az acr build --registry $REGISTRY --image chatapp-api:latest backend/
```

### Option 2: Replace ACR with GitHub Container Registry (Free)

Azure Container Registry Basic costs ~$5/month regardless of usage. GitHub Container Registry (ghcr.io) is free for public repositories and included in GitHub Pro/Teams for private ones.

To use GHCR:

1. Build and push manually from your CI pipeline:
   ```bash
   docker build -t ghcr.io/<your-org>/chatapp-api:latest backend/
   docker push ghcr.io/<your-org>/chatapp-api:latest
   ```

2. Update the Container App image reference (no Bicep change needed after first deploy):
   ```bash
   az containerapp update \
     --name $(az deployment group show -g <rg> -n main \
       --query properties.outputs.CONTAINER_APP_NAME.value -o tsv) \
     --resource-group <rg> \
     --image ghcr.io/<your-org>/chatapp-api:latest
   ```

3. In `infra/modules/container-apps.bicep`, remove the `registries` block from the `configuration` section (this block only applies to ACR). When using GHCR with a public image, no registry credential is needed. For a private GHCR image, add a secret for the PAT token.

> Skipping ACR saves ~$5/month, bringing the low-cost total to ~**$1-3/month**.

### Option 3: Use Azure Dev/Test Pricing

If you have a Visual Studio subscription (included in many Microsoft partner programs), you receive Azure Dev/Test pricing:
- No minimum charges on many PaaS services
- Discounted rates on VMs and compute
- Apply at the subscription level in the Azure portal under **Subscriptions → Change offer**

## Switching from Low-Cost to Standard

When you are ready to submit or demo:

```bash
az deployment group create \
  --resource-group <your-rg> \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam
```

Bicep is idempotent — this updates existing resources in place. The Container App will gain more CPU/memory, the realtime model will be deployed, and log retention extends automatically. No data migration required.

## Cost Monitoring

Set up a cost alert so you are notified before spending exceeds your budget:

```bash
# Alert when projected spend exceeds $20 for the month
az consumption budget create \
  --resource-group <rg> \
  --budget-name hackathon-budget \
  --amount 20 \
  --time-grain Monthly \
  --time-period start=2026-03-01 end=2026-12-31 \
  --notifications "[{\"enabled\":true,\"operator\":\"GreaterThanOrEqualTo\",\"threshold\":80,\"contactEmails\":[\"you@example.com\"]}]"
```

In the Azure portal, navigate to **Cost Management → Cost alerts** to configure email and action group notifications.

## Parameter Reference

All parameters below are defined in `infra/main.bicep` and can be overridden in any `.bicepparam` file.

| Parameter | Standard Default | Low-Cost Value | Type | Description |
|---|---|---|---|---|
| `openAiChatCapacity` | `10` | `1` | int | gpt-4o-mini TPM capacity (1K per unit) |
| `openAiEmbeddingCapacity` | `10` | `1` | int | text-embedding-ada-002 TPM capacity |
| `deployVoice` | `true` | `false` | bool | Deploy realtime preview model for voice |
| `containerCpu` | `'0.5'` | `'0.25'` | string | Container App vCPU (0.25/0.5/0.75/1.0) |
| `containerMemory` | `'1Gi'` | `'0.5Gi'` | string | Container App memory (must match CPU tier) |
| `logRetentionDays` | `30` | `30` | int | Log Analytics + App Insights retention (minimum enforced by SKU) |
