# Azure Services Matrix

> Breadth of Azure Services judging evidence.
> Every service has a real code integration — no hollow provisioning.

## Service Inventory (17 Services)

| # | Service | Bicep Module | Tier | Cost/mo | Role | Code Integration | Status |
|---|---------|--------------|------|---------|------|-----------------|--------|
| 1 | Storage Account | `modules/storage.bicep` | Standard LRS | ~$0 | Document storage (uploaded PDFs), Foundry artifacts | `main.py` — Blob upload in `POST /api/upload`, Foundry Account linkage | Active |
| 2 | Key Vault | `modules/keyvault.bicep` | Standard, RBAC-mode | ~$0 | Secrets management, Foundry connected service | RBAC in `security.bicep`, runtime via MI | Active |
| 3 | Log Analytics | `modules/monitoring.bicep` | Free (5 GB) | $0 | Centralized log aggregation | Container Apps stdout routed automatically | Active |
| 4 | App Insights | `modules/monitoring.bicep` | Free (5 GB) | $0 | Latency telemetry, request tracing, Content Safety metrics, voice session duration | `main.py` — `configure_azure_monitor()` OpenTelemetry SDK sends custom metrics to `customMetrics` and traces to `traces` | Active |
| 5 | Azure OpenAI | `modules/openai.bicep` | S0 | ~$3 | LLM (gpt-4o-mini) for text chat Assistants API + Foundry Agent inference | `agents/chat_agent.py` — `AzureOpenAI` client with Assistants API; `agents/speech_agent.py` — Foundry Agent via `AIProjectClient.get_openai_client()` | Active |
| 6 | Azure AI Foundry Account | `foundry-agent-setup.bicep` | S0 (AIServices) | ~$0 | AI governance — Foundry Account (`CognitiveServices/accounts` kind `AIServices`) with agent management | Central Foundry resource with `allowProjectManagement: true`, deploys gpt-4o-mini (GlobalStandard, capacity 50) | Active |
| 7 | Azure AI Foundry Project | `foundry-agent-setup.bicep` | Child of Foundry Account | $0 | Agent deployment via Agent Service endpoint (`PromptAgentDefinition`) | `agents/speech_agent.py` — `AIProjectClient` creates agents via `agents.create_version()` with Voice Live metadata; conversations via `responses.create(agent_reference=...)` | Active |
| 8 | Cosmos DB | `modules/cosmosdb.bicep` | Serverless | ~$1 | Sessions, messages, user preferences, agent thread/conversation IDs, reports | `main.py` — 7 containers: sessions, messages, content, adapted, audio, preferences, reminders. Thread IDs (chat) and conversation IDs (speech) persisted for agent continuity | Active |
| 9 | AI Search | `modules/search.bicep` | Free | $0 | RAG knowledge base (accessibility content), keyword + vector search | `agents/tools.py` — `search_knowledge_base()` uses `SearchClient` with hybrid search (BM25 + optional semantic ranker); `main.py` — `POST /api/upload` indexes document chunks | Active |
| 10 | AI Services | `modules/cognitiveservices.bicep` | S0 | ~$0 | Content Safety filtering on all input/output across text chat, speech chat, TTS, and voice transcripts | `main.py` — `_check_content_safety()` calls `ContentSafetyClient.analyze_text()` (Hate, SelfHarm, Sexual, Violence at severity ≥ 2); `webpubsub.py` — voice transcript filtering | Active |
| 11 | Service Bus | `modules/servicebus.bicep` | Basic (2 queues) | ~$0.05 | Async reminder delivery for focus support | `agents/tools.py` — `schedule_reminder()` sends to `notifications` queue via `ServiceBusClient` | Active |
| 12 | Container Registry | `modules/container-registry.bicep` | Basic | ~$5 | Stores Docker image; pulled via AcrPull MI | `Dockerfile` builds `backend/`; pushed via `az acr build` | Active |
| 13 | Container Apps | `modules/container-apps.bicep` | Consumption (scale-to-zero) | ~$2–5 | FastAPI backend — HTTP endpoints + Web PubSub CloudEvent handler for voice | `backend/main.py` — all endpoints, CORS, auth, Content Safety, routes | Active |
| 14 | Static Web Apps | `modules/staticwebapp.bicep` | Free | $0 | React frontend hosting + built-in Entra ID auth | `frontend/` deployed via `swa deploy` | Active |
| 15 | Azure Speech Service | `modules/speech.bicep` | S0 | ~$0–3 | TTS with calm SSML (JennyNeural calm style, slow rate), speech token issuance for browser STT SDK | `main.py` — `POST /api/speech/synthesize` with SSML, `POST /api/speech/token` for browser SDK auth; `services/speech.py` — `synthesize_speech_sync()` with allowlisted voice/style/rate | Active |
| 16 | Azure Immersive Reader | `modules/immersive-reader.bicep` | S0 | ~$0 | Embedded accessible reading — line focus, syllabification, picture vocab, bilingual | `main.py` — `POST /api/ir-token` returns Azure AD token + subdomain; `frontend/src/components/ImmersiveReaderButton.tsx` loads JS SDK | Active |
| 17 | Azure Web PubSub | `modules/webpubsub.bicep` | Free | $0 | Real-time voice transport (SWA can’t proxy WebSockets to linked backends) | `main.py` — `POST /api/voice/negotiate` generates client access URL; `services/webpubsub.py` — `VoiceSession` bridges Web PubSub ↔ Voice Live ↔ Foundry Agent with Content Safety on transcripts | Active |

**Estimated total dev cost: ~$8–$17/month** (17 services, most on free/consumption tiers)

## Integration Summary

- **17/17 active** — every provisioned service has real application code calling it
- **0 partial** — no hollow or scaffolded-only integrations
- **0 planned** — all services are implemented
- **Zero-secret architecture** — all service-to-service auth via Managed Identity + RBAC
- **Agent Framework** — `azure-ai-projects>=2.0.0b3` with `PromptAgentDefinition` for Foundry Agent Service
- **Voice Live SDK** — `azure-ai-voicelive>=1.2.0b4` for real-time voice sessions with Foundry agents

## RBAC Assignments (Zero-Secret Pattern)

All service-to-service authentication uses managed identity. Defined in `infra/modules/security.bicep`.

| Principal | Target | Role |
|-----------|--------|------|
| Container App MI | Container Registry | AcrPull |
| Container App MI | Cosmos DB | Contributor + data-plane RBAC |
| Container App MI | Storage | Blob Data Contributor |
| Container App MI | Key Vault | Secrets User |
| Container App MI | Azure OpenAI | Cognitive Services OpenAI User |
| Container App MI | AI Search | Index Data Contributor + Service Contributor |
| Container App MI | AI Services (Foundry) | Cognitive Services User |
| Container App MI | Service Bus | Data Owner |
| Container App MI | AI Foundry Project | Azure ML Data Scientist |
| Container App MI | Speech Service | Cognitive Services User |
| Container App MI | Immersive Reader | Cognitive Services User |
| Container App MI | Web PubSub | Web PubSub Service Owner |
| Foundry Account MI | OpenAI | OpenAI User |
| Foundry Account MI | Storage | Blob Data Contributor |
| Foundry Account MI | Key Vault | Secrets User |
| Foundry Project MI | OpenAI | OpenAI User |

## Container Build and Deploy Commands

```bash
# 1. After running az deployment group create, grab the registry login server
REGISTRY=$(az deployment group show \
  --resource-group <rg> --name main \
  --query properties.outputs.CONTAINER_REGISTRY_LOGIN_SERVER.value -o tsv)

# 2. Build and push image from backend/ directory
az acr build --registry $REGISTRY --image Copilot CLR-api:latest backend/

# 3. Update the running Container App to pull the new image
APP_NAME=$(az deployment group show \
  --resource-group <rg> --name main \
  --query properties.outputs.CONTAINER_APP_NAME.value -o tsv)

az containerapp update \
  --name $APP_NAME \
  --resource-group <rg> \
  --image $REGISTRY/Copilot CLR-api:latest
```
