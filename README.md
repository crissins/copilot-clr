# Cognitive Load Reduced Copilot  — AI Accessibility Assistant for Neurodiverse Users

<p align="center">
  <b>Azure Innovation Challenge 2026 Submission</b><br/>
  Built on Azure AI Foundry &bull; Microsoft Agent Framework SDK &bull; 17 Azure Services
</p>

---

## The Problem

> Neurodiverse individuals — including people with ADHD, autism, and dyslexia — often face cognitive overload when interacting with complex tasks, dense documents, or unstructured schedules.

Over 1 billion people worldwide live with neurodivergent conditions. Reading a multi-page document, managing a schedule, or following complex instructions can trigger cognitive fatigue, frustration, and disengagement. Existing tools treat accessibility as an afterthought — a font toggle or a screen reader — rather than a core experience.

## The Solution

**Copilot CLR** is an AI-powered assistant that reduces cognitive load by transforming information into clear, structured, and personalized formats. It doesn't just simplify — it **adapts** to each user's preferences, reads aloud in a calm voice, and provides real-time support through chat, voice, and an embedded reading environment.

### Key Features

| Feature | Description | Azure Service |
|---------|-------------|---------------|
| **Adaptive Chat** | Conversational AI that adjusts tone, reading level, and format to user preferences | Azure OpenAI (gpt-4o-mini) + AI Foundry Agent |
| **Task Decomposer** | Breaks complex goals into time-boxed, prioritized steps with focus tips | Agent Framework tools + Cosmos DB |
| **Document Simplifier** | Rewrites documents at selectable reading levels (Grade 2 / 5 / 8 / 12) | AI Search RAG + Content Adapter |
| **Immersive Reader** | One-click reading mode with line focus, syllabification, picture dictionary, and 13+ language translations | Azure Immersive Reader SDK |
| **Floating Chat in IR** | Keep chatting with the assistant while reading in Immersive Reader — responses auto-display in the reader with read-aloud | Custom component + IR SDK |
| **Voice Input/Output** | Speak to the assistant and hear responses read aloud in a calm voice at adjustable speed | Azure Speech (TTS/STT) |
| **Voice Live** | Real-time voice conversation with the AI agent using WebSocket audio streaming | Azure Web PubSub + Voice Live SDK + Foundry Agent |
| **Talking Avatar** | Visual avatar that reads responses aloud for users who benefit from face-to-face interaction | Azure Speech Avatar |
| **Focus Support** | In-app reminders, break timers, and contextual nudges to help users stay on task | Service Bus + Cosmos DB |
| **Accessibility Preferences** | Per-user settings (font, spacing, theme, reading level, voice speed, color overlay) stored and applied across all sessions | Cosmos DB + Onboarding Wizard |
| **Document Upload & RAG** | Upload PDFs and documents — the assistant can search and answer questions about them | Blob Storage + AI Search + Document Intelligence |
| **Starred Chats** | Pin important conversations for quick access | Cosmos DB |
| **Responsible AI** | Content Safety filtering, calm tone enforcement, PII awareness, human-in-the-loop reporting | Azure AI Content Safety |
| **Multi-language** | Full i18n support: English, Spanish, Italian, Portuguese, German, Japanese | Custom i18n system |

### Visual Demos

<table border="0">
  <tr>
    <td align="center"><b>Document Simplification</b><br/><img src="docs/images/simplified-content.gif" width="400" alt="Document Simplification Demo"/></td>
    <td align="center"><b>Multi-Agent RAG</b><br/><img src="docs/images/rag.gif" width="400" alt="RAG Demo"/></td>
  </tr>
</table>

## Architecture

![Architecture Diagram](docs/images/arch.drawio.png)

### Data Flow

```
┌──────────────┐     HTTPS/WSS      ┌────────────────────┐     Managed Identity     ┌──────────────────────┐
│   React SPA  │ ◄──────────────►   │   Azure Container  │ ◄──────────────────────► │   Azure AI Foundry   │
│  (Static Web │     SWA Proxy      │   Apps (FastAPI)    │        RBAC              │   Agent Service      │
│   App)       │                    │                    │                           │   (gpt-4o-mini)      │
└──────┬───────┘                    └────────┬───────────┘                           └──────────────────────┘
       │                                     │
       │  MSAL Auth                          ├── Cosmos DB (sessions, messages, preferences)
       │  (Entra ID)                         ├── Blob Storage (uploaded documents)
       │                                     ├── AI Search (RAG index, hybrid BM25+vector)
       │  Speech SDK                         ├── Azure Speech (TTS/STT)
       │  (browser STT)                      ├── Immersive Reader (token issuance)
       │                                     ├── Content Safety (input/output filtering)
       │  IR SDK                             ├── Service Bus (async reminders)
       │  (immersive reading)                ├── Web PubSub (voice transport)
       │                                     ├── Document Intelligence (PDF extraction)
       │                                     └── Key Vault (secrets)
       │
       └── Web PubSub WebSocket (real-time voice sessions)
```

## Azure Services (17)

| # | Service | SKU | Purpose |
|---|---------|-----|---------|
| 1 | **Azure OpenAI** | S0 | LLM inference — gpt-4o-mini (chat), text-embedding-ada-002, gpt-4o-mini-realtime (voice) |
| 2 | **AI Foundry Hub** | S0 (AIServices) | AI governance, connected services, model management |
| 3 | **AI Foundry Project** | — | Agent definitions, Agent Service endpoints |
| 4 | **Cosmos DB** | Serverless | Chat sessions, messages, user preferences, task plans, reminders, feedback |
| 5 | **Azure AI Search** | Basic | Hybrid RAG (semantic + BM25) for uploaded documents and accessibility content |
| 6 | **Azure Speech** | S0 | Text-to-speech (JennyNeural calm voice), speech-to-text token issuance |
| 7 | **Immersive Reader** | S0 | Embedded reading — line focus, syllabification, picture dictionary, translation |
| 8 | **AI Services** | S0 | Content Safety filtering (Hate, SelfHarm, Sexual, Violence) |
| 9 | **Container Apps** | Consumption | Python FastAPI backend (scale-to-zero) |
| 10 | **Container Registry** | Basic | Docker image storage |
| 11 | **Static Web Apps** | Standard | React frontend with linked backend API proxy |
| 12 | **Blob Storage** | Standard LRS | Uploaded documents, Foundry artifacts |
| 13 | **Service Bus** | Basic | Async reminder and notification delivery (2 queues) |
| 14 | **Web PubSub** | Free | Real-time WebSocket transport for voice sessions |
| 15 | **Key Vault** | Standard | Secrets management via RBAC |
| 16 | **Document Intelligence** | S0 | PDF/DOCX text extraction |
| 17 | **Log Analytics + App Insights** | Free (5 GB) | OpenTelemetry observability, latency metrics, Content Safety tracing |

**Additional**: Entra ID (free), Communication Services (email reminders)

## Security — Zero-Secret Architecture

All service-to-service authentication uses **Managed Identity + RBAC**. No connection strings, no shared keys, no secrets in code.

| Principal | Target | Role |
|-----------|--------|------|
| Container App MI | Azure OpenAI | Cognitive Services OpenAI User |
| Container App MI | Cosmos DB | Contributor + Data Plane |
| Container App MI | AI Search | Index Data Contributor |
| Container App MI | Blob Storage | Blob Data Contributor |
| Container App MI | Key Vault | Secrets User |
| Container App MI | Service Bus | Data Owner |
| Container App MI | Speech | Cognitive Services User |
| Container App MI | Immersive Reader | Cognitive Services User |
| Container App MI | Web PubSub | Service Owner |
| Container App MI | AI Foundry Project | Azure ML Data Scientist |
| Container App MI | Container Registry | AcrPull |

---

## Deploy to Your Azure Account

### Prerequisites

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) (2.50+)
- [Node.js](https://nodejs.org/) (18+)
- [Python](https://python.org/) (3.11+)
- Azure subscription with Azure OpenAI access approved

### Step 1: Login & Set Subscription

```bash
az login --use-device-code
az account show --query "{subscription:name, id:id}" -o table
```

### Step 2: Choose a Region

Pick a region with Azure OpenAI + Speech + Immersive Reader availability:

| Region | Recommended |
|--------|-------------|
| East US 2 | Yes (all services available) |
| East US | Yes |
| Sweden Central | Yes |
| West US 3 | Yes |

### Step 3: Deploy Infrastructure (17 Azure Services)

```bash
# Set your variables
REGION="eastus2"
RG_NAME="rg-copilot-clr"

# Create resource group
az group create --name $RG_NAME --location $REGION \
  --tags project=copilot-clr environment=prod managed-by=bicep -o none

# Deploy all 17 services (~10-15 minutes)
az deployment group create \
  --resource-group $RG_NAME \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam \
  --parameters location=$REGION \
  -o json
```

### Step 4: Capture Deployment Outputs

```bash
# Save all outputs to environment variables
REGISTRY=$(az deployment group show -g $RG_NAME -n main \
  --query properties.outputs.CONTAINER_REGISTRY_LOGIN_SERVER.value -o tsv)
APP_NAME=$(az deployment group show -g $RG_NAME -n main \
  --query properties.outputs.CONTAINER_APP_NAME.value -o tsv)
SWA_NAME=$(az deployment group show -g $RG_NAME -n main \
  --query properties.outputs.STATIC_WEB_APP_NAME.value -o tsv)
CLIENT_ID=$(az deployment group show -g $RG_NAME -n main \
  --query properties.outputs.ENTRA_CLIENT_ID.value -o tsv)

echo "Registry: $REGISTRY"
echo "Container App: $APP_NAME"
echo "Static Web App: $SWA_NAME"
echo "Entra Client ID: $CLIENT_ID"
```

### Step 5: Configure Entra ID (Authentication)

The Bicep deployment auto-creates an Entra App Registration. Verify it supports all account types:

```bash
# Enable personal Microsoft accounts (Outlook, Hotmail, Xbox)
az ad app update --id $CLIENT_ID \
  --sign-in-audience "AzureADandPersonalMicrosoftAccount"

# Get your SWA hostname
SWA_HOST=$(az staticwebapp show -n $SWA_NAME -g $RG_NAME \
  --query "defaultHostname" -o tsv)

# Add SPA redirect URIs
az ad app update --id $CLIENT_ID \
  --spa-redirect-uris "https://$SWA_HOST" "http://localhost:5173"

# Expose API scope
az ad app update --id $CLIENT_ID \
  --identifier-uris "api://$CLIENT_ID"
```

Then in [Azure Portal](https://portal.azure.com) → App Registrations → your app → **Expose an API** → Add scope `access_as_user` (Admins and users) → Grant admin consent.

### Step 6: Build & Deploy Backend

```bash
# Build Docker image in ACR (~3 minutes)
az acr build --registry $REGISTRY --image copilotclr-backend:latest backend/ --no-logs

# Update the Container App with the new image
SUFFIX="deploy$(date +%m%d%H%M)"
az containerapp update \
  --name $APP_NAME \
  --resource-group $RG_NAME \
  --image $REGISTRY/copilotclr-backend:latest \
  --revision-suffix $SUFFIX
```

### Step 7: Configure & Deploy Frontend

Update the frontend environment file with your deployment values:

```bash
# Create .env.production
cat > frontend/.env.production << EOF
VITE_LOCAL_DEV=false
VITE_ENTRA_CLIENT_ID=$CLIENT_ID
VITE_ENTRA_TENANT_ID=common
EOF
```

Build and deploy:

```bash
cd frontend
npm install
npm run build

# Get SWA deployment token
TOKEN=$(az staticwebapp secrets list --name $SWA_NAME -g $RG_NAME \
  --query "properties.apiKey" -o tsv)

# Deploy
npx @azure/static-web-apps-cli deploy "dist" --deployment-token $TOKEN --env production
```

### Step 8: Link SWA Backend (API Proxy)

```bash
# Get Container App hostname
APP_HOST=$(az containerapp show -n $APP_NAME -g $RG_NAME \
  --query "properties.configuration.ingress.fqdn" -o tsv)

# Link SWA to Container App backend
az staticwebapp backends link \
  --name $SWA_NAME \
  --resource-group $RG_NAME \
  --backend-resource-id $(az containerapp show -n $APP_NAME -g $RG_NAME --query id -o tsv) \
  --backend-region $REGION
```

### Step 9: Verify

Open your SWA URL:
```bash
echo "https://$SWA_HOST"
```

Sign in with any Microsoft account (personal Outlook, work/school, or Xbox).

> **Local development & alternative deployment tiers** (dev, low-cost) are documented in [Local Dev & Alt Deployments](docs/08-local-dev-and-alt-deployments.md).

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **AI Framework** | Microsoft Agent Framework SDK (`agent-framework-azure-ai` 1.0.0rc3) |
| **LLM** | Azure OpenAI gpt-4o-mini (chat + realtime voice) |
| **Backend** | Python 3.11, FastAPI, uvicorn |
| **Frontend** | React 18.3, TypeScript, Vite 5.4, Fluent UI v9 |
| **Auth** | Microsoft Entra ID (MSAL React + JWT validation) |
| **Voice** | Azure AI Voice Live SDK 1.2.0b4, Azure Speech SDK |
| **Reading** | Microsoft Immersive Reader SDK 1.4 |
| **Database** | Azure Cosmos DB (serverless, 7 containers) |
| **Search** | Azure AI Search (hybrid BM25 + vector) |
| **IaC** | Bicep (17 modules, 3 parameter tiers) |
| **Observability** | OpenTelemetry → Azure Monitor + App Insights |

## Project Structure

```
├── infra/                              # Bicep IaC (17 Azure services)
│   ├── main.bicep                      # Orchestrator
│   ├── main.bicepparam                 # Standard parameters
│   └── modules/                        # One module per service
├── backend/                            # Python FastAPI (Container Apps)
│   ├── main.py                         # API entrypoint (15+ endpoints)
│   ├── agents/
│   │   ├── chat_agent.py              # Fallback OpenAI chat agent
│   │   ├── workflow.py                # Main chat workflow agent (Agent Framework)
│   │   ├── speech_agent.py            # Voice conversation agent
│   │   ├── task_decomposer.py         # Goal → steps breakdown
│   │   ├── content_workflow.py        # 4-stage document pipeline (4 agents)
│   │   └── tools.py                   # Agent tools (search, tasks, preferences)
│   ├── services/
│   │   └── content_adapter.py         # Per-grade content simplifier agent
│   ├── auth/entra.py                  # JWT validation (multi-tenant)
│   ├── routes/                        # Route modules (avatar, content, speech, reminders)
│   └── Dockerfile                     # Container image
├── frontend/                           # React + TypeScript SPA
│   ├── src/
│   │   ├── App.tsx                    # Root app (view routing, themes, onboarding)
│   │   ├── components/                # Chat, FloatingChat, Sidebar, MessageList, etc.
│   │   ├── features/                  # Feature pages (simplify, reminders, tasks, etc.)
│   │   ├── hooks/                     # Auth, settings, immersive reader, focus timer
│   │   └── services/api.ts           # API client
│   └── staticwebapp.config.json       # SWA routing + security headers
└── docs/                               # Documentation
    ├── 02-architecture.md
    ├── 03-responsible-ai.md
    ├── 04-performance-benchmarks.md
    ├── 05-azure-services-matrix.md
    └── 07-model-card.md
```

## AI Agents (9)

The application runs **9 specialized AI agents** organized into 3 workflows. All agents use the Microsoft Agent Framework SDK with Azure AI Foundry.

| # | Agent | File | Triggering Route | Purpose |
|---|-------|------|------------------|---------|
| 1 | **Copilot CLRAssistant** | `agents/chat_agent.py` | `POST /api/chat` | Fallback direct chat when only Azure OpenAI is configured |
| 2 | **CopilotCLR-Workflow** | `agents/workflow.py` | `POST /api/chat` | Main conversational agent with tools (search, tasks, memory, history) |
| 3 | **CopilotCLR-RequestBuilder** | `agents/content_workflow.py` | `POST /api/content/process` | Builds structured content request from user input |
| 4 | **CopilotCLR-ContentAdapter** | `agents/content_workflow.py` | `POST /api/content/process` | Adapts content to target reading level |
| 5 | **CopilotCLR-TaskPlanner** | `agents/content_workflow.py` | `POST /api/content/process` | Decomposes content into micro-steps with time estimates |
| 6 | **CopilotCLR-AudiobookScripter** | `agents/content_workflow.py` | `POST /api/content/process` | Converts adapted content into TTS narration script |
| 7 | **Copilot-CLR-Task-Decomposer** | `agents/task_decomposer.py` | `POST /api/tasks/plans/decompose` | Breaks goals into time-boxed, prioritized sub-tasks |
| 8 | **CopilotCLR-SpeechAssistant** | `agents/speech_agent.py` | `POST /api/speech/chat`, `WS /ws/realtime` | Voice conversation with calm TTS delivery |
| 9 | **CopilotCLR-Simplifier-{grade}** | `services/content_adapter.py` | `POST /api/content/simplify`, `POST /api/content/{id}/adapt` | Dynamic per-grade-level content simplification |

### Agent Workflows

**Chat Workflow** — Agent #2 runs with document search, web search, task management, and goal decomposition tools. Agent #1 serves as fallback when only `AZURE_OPENAI_ENDPOINT` is set.

**Content Processing Pipeline** — Sequential 4-stage multi-agent workflow:
```
User input → #3 RequestBuilder → #4 ContentAdapter → #5 TaskPlanner → #6 AudiobookScripter
```

**Speech Pipeline** — Agent #8 with conversation memory (CosmosDB history) and calm Voice Live TTS synthesis.

**Standalone Simplification** — Agent #9 is invoked dynamically per reading level (Simplifier-2, Simplifier-5, Simplifier-8) for direct text or document adaptation.

## Responsible AI

Copilot CLR implements all six Microsoft Responsible AI principles:

| Principle | Implementation |
|-----------|----------------|
| **Fairness** | Equal accessibility across neurodivergent conditions; multi-language support; no bias in simplification |
| **Reliability & Safety** | Content Safety filtering on all input/output; graceful degradation; error boundaries |
| **Privacy & Security** | Zero-secret architecture; per-user data isolation in Cosmos DB; HTTPS-only; CSP headers |
| **Inclusiveness** | Immersive Reader, voice I/O, adjustable reading levels, color overlays, dyslexia fonts, OpenDyslexic |
| **Transparency** | Agent explains simplification choices; reading level shown; user controls all preferences |
| **Accountability** | Human-in-the-loop reporting on every AI response; feedback collection; App Insights telemetry |

See [docs/03-responsible-ai.md](docs/03-responsible-ai.md) for detailed code references.

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/02-architecture.md) | End-to-end system design, data flow, RBAC |
| [Responsible AI](docs/03-responsible-ai.md) | All 6 RAI principles with code references |
| [Performance Benchmarks](docs/04-performance-benchmarks.md) | Latency, FKGL scores, Content Safety metrics |
| [Azure Services Matrix](docs/05-azure-services-matrix.md) | All 17 services: SKUs, costs, roles |
| [Model Card](docs/07-model-card.md) | Model selection, capabilities, limitations |
| [Local Dev & Alt Deployments](docs/08-local-dev-and-alt-deployments.md) | Local setup, dev tier, low-cost tier, parameter reference |

## License

This project was built for the Azure Innovation Challenge 2026.


