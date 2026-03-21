# Copilot CLR — AI Accessibility Assistant for Neurodiverse Users

## Project Overview

Copilot CLR is an AI-powered accessibility assistant designed to help neurodiverse individuals (including those with ADHD, autism, and dyslexia) reduce cognitive overload. The assistant transforms complex information into clear, structured, and personalized formats, supporting users with step-by-step task breakdowns, document simplification, reminders, and adaptive accessibility features. Built on Azure AI Foundry and the Microsoft Agent Framework SDK, the project emphasizes responsible AI, security, and user-centric design.

## Current Status & Next Steps

- All major features and deliverables are currently marked as "To Do" (see table below).
- Team members should prioritize foundational infrastructure, authentication, and agent scaffolding.
- Next steps: finalize architecture, set up Azure resources, and begin implementing core agent features.

---
## Azure Innovation Challenge Submission

AI-powered accessibility assistant built on Azure AI Foundry with the Microsoft Agent Framework SDK. Designed to reduce cognitive load for individuals with ADHD, autism, and dyslexia by transforming complex information into clear, structured, personalized formats.


## The Challenge

> Neurodiverse individuals—including people with ADHD, autism, and dyslexia—often face cognitive overload when interacting with complex tasks, dense documents, or unstructured schedules. Build an AI-powered assistant that reduces cognitive load by transforming information into clear, structured, and personalized formats aligned to individual accessibility preferences. Your solution should decompose complex instructions into step‑by‑step, time‑boxed tasks; simplify and summarize documents at adjustable reading levels; and provide focus support through reminders, timers, or contextual nudges. User accessibility preferences should be securely stored and applied across interactions, and responsible AI safeguards must ensure calm, supportive, and non‑anxiety‑inducing language.


## Documentation

- [Architecture](docs/02-architecture.md)
- [Responsible AI](docs/03-responsible-ai.md)
- [Performance Benchmarks](docs/04-performance-benchmarks.md)
- [Azure Services Matrix](docs/05-azure-services-matrix.md)
- [Low-Cost Deployment](docs/06-low-cost-deployment.md)
- [Model Card](docs/07-model-card.md)

## Architecture

![Architecture Diagram](docs/images/arch.drawio.png)

## Azure Services (16)

| Service | SKU | Cost | Purpose |
|---------|-----|------|---------|
| AI Foundry Hub | Basic | $0 | AI governance, connected services |
| AI Foundry Project | — | $0 | Agent deployment, Agent Service |
| Azure OpenAI | S0 | ~$1–5/mo | LLM inference (gpt-4o-mini, embeddings) |
| Cosmos DB | Serverless | ~$0–2/mo | Chat history, sessions, user preferences |
| Blob Storage | Standard LRS | ~$0 | Files, agent data, uploaded documents |
| Azure Container Apps | Consumption | ~$0–5/mo | Python FastAPI backend (scale to zero) |
| Container Registry | Basic | ~$5/mo | Docker image storage |
| Static Web Apps | Free | $0 | React frontend + built-in Entra ID auth |
| AI Search | Free | $0 | RAG knowledge base for accessibility content |
| AI Services | S0 | ~$0 | Content Safety, PII detection |
| **Azure Speech Service** | S0 | ~$0–3/mo | **Text-to-speech read-aloud, speech-to-text input** |
| **Azure Immersive Reader** | S0 | ~$0 | **Embedded reading tool — line focus, syllabification, read-aloud** |
| Service Bus | Basic | ~$0.05/mo | Async reminder and notification delivery |
| Key Vault | Standard | ~$0 | Secrets management |
| Monitor + App Insights | Free | $0 (5 GB) | Observability, latency telemetry |
| Entra ID | Free | $0 | User authentication and identity |

**Estimated dev cost: ~$8–$15/month**

## Deliverables

| # | Deliverable | Description | Status |
|---|-------------|-------------|--------|
| 1 | **Task Decomposer** | Breaks complex multi-step instructions into individually time-boxed steps with priority and estimated duration | To Do |
| 2 | **Document Simplifier** | Summarizes and rewrites documents at selectable reading levels (Grades 2 / 5 / 8 / 12) | To Do |
| 3 | **Focus Support** | In-chat reminders via Service Bus, contextual nudges to help users stay on task | To Do |
| 4 | **Accessibility Preferences Store** | Per-user preferences (reading level, voice speed, theme, font size) stored securely in Cosmos DB and applied across all sessions | To Do |
| 5 | **Speech I/O** | Agent responses read aloud via Azure Text-to-Speech with adjustable pace; real-time voice via OpenAI Realtime API | To Do |
| 6 | **Immersive Reader Panel** | One-click Immersive Reader embed for any agent response — line focus, syllabification, picture vocabulary, bilingual support | To Do |
| 7 | **Responsible AI Safeguards** | Calm and supportive tone enforcement, Content Safety filtering on all input/output, PII awareness, human-in-the-loop reporting | To Do |
| 8 | **Adaptive Personalization** | Agent adapts responses to user preferences (reading level, format, tone); explains simplification choices on request | To Do |
| 9 | **Deployed Azure Infrastructure** | All 16 Azure services active and integrated with zero-secret managed identity + RBAC | To Do |
| 10 | **Performance Benchmarks** | Measured Content Safety latency, agent response time, reading level (FKGL) scores with OpenTelemetry + App Insights | To Do |
| 11 | **Architecture Documentation** | End-to-end architecture diagram, service roles, data flow, and RBAC assignments in `docs/` | To Do |
| 12 | **Responsible AI Documentation** | All six Microsoft RAI principles addressed with file:line code references in `docs/03-responsible-ai.md` | To Do |
| 13 | **Video Demo** | 3 minute walkthrough showing all major features, live Azure telemetry, and RAI safeguards in action | To Do |
| 14 | **PowerPoint Deck** | Judging-ready slide deck covering problem, architecture, RAI, performance, and innovation angle | To Do |

## Prerequisites

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) (2.50+)
- [Node.js](https://nodejs.org/) (18+)
- [Python](https://python.org/) (3.11+)
- Azure subscription with OpenAI access

## Quick Start

### 1. Deploy Infrastructure

First, login and choose your region:

```bash
az login --use-device-code
az account show --query "{subscription:name, id:id}" -o table
```

Pick a region with Azure OpenAI availability. Common choices:

| Region | Name |
|--------|------|
| East US | `eastus` |
| East US 2 | `eastus2` |
| West US | `westus` |
| West US 2 | `westus2` |
| West US 3 | `westus3` |
| South Central US | `southcentralus` |
| Sweden Central | `swedencentral` |
| UK South | `uksouth` |
| Canada East | `canadaeast` |

Then choose one of the three deployment tiers (replace `eastus` with your region):

#### Option A: Development (Local Dev — API services only, ~$0–2/mo)

```bash
az group create --name "rg-chatapp-dev" --location "eastus" --tags project=chatapp environment=dev managed-by=bicep deployment-tier=development -o none
az deployment group create --resource-group "rg-chatapp-dev" --template-file infra/main.bicep --parameters infra/main.dev.bicepparam --parameters location=eastus -o json
```

#### Option B: Low-Cost (Full deploy with free tiers, ~$6–8/mo)

```bash
az group create --name "rg-chatapp-dev" --location "eastus" --tags project=chatapp environment=dev managed-by=bicep cost-optimized=true -o none
az deployment group create --resource-group "rg-chatapp-dev" --template-file infra/main.bicep --parameters infra/main.lowcost.bicepparam --parameters location=eastus -o json
```

#### Option C: Standard (Full deploy, ~$8–15/mo)

```bash
az group create --name "rg-chatapp-dev" --location "eastus" --tags project=chatapp environment=dev managed-by=bicep -o none
az deployment group create --resource-group "rg-chatapp-dev" --template-file infra/main.bicep --parameters infra/main.bicepparam --parameters location=eastus -o json
```

### 2. Create Entra ID App Registration

```bash
az ad app create --display-name "Copilot CLR-dev" --sign-in-audience "AzureADMyOrg" --web-redirect-uris "http://localhost:5173" "https://YOUR_SWA_HOSTNAME"
# Note the appId — this is your ENTRA_CLIENT_ID
```

### 3. Run Backend Locally

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
LOCAL_DEV=true uvicorn main:app --reload --port 8000
```

### 4. Run Frontend Locally

```bash
cd frontend
npm install
npm run dev
```

### 5. Deploy Application

```bash
# Build and push Container App image
az acr build --registry $REGISTRY --image Copilot CLR-api:latest backend/

# Deploy Static Web App
cd frontend
npm run build
npx @azure/static-web-apps-cli deploy ./dist
```

## Project Structure

```
├── infra/                          # Bicep IaC
│   ├── main.bicep                  # Orchestrator (16 Azure services)
│   ├── main.bicepparam             # Parameters
│   ├── modules/
│   │   ├── storage.bicep             # Blob Storage
│   │   ├── keyvault.bicep            # Key Vault
│   │   ├── monitoring.bicep          # Log Analytics + App Insights
│   │   ├── openai.bicep              # Azure OpenAI + models
│   │   ├── ai-foundry-hub.bicep      # AI Foundry Hub
│   │   ├── ai-foundry-project.bicep  # AI Foundry Project
│   │   ├── cosmosdb.bicep            # Cosmos DB serverless
│   │   ├── search.bicep              # AI Search
│   │   ├── cognitiveservices.bicep   # AI Services (Content Safety)
│   │   ├── speech.bicep              # Azure Speech Service (TTS/STT)
│   │   ├── immersive-reader.bicep    # Immersive Reader
│   │   ├── servicebus.bicep          # Service Bus
│   │   ├── container-apps.bicep      # Container Apps backend
│   │   ├── container-registry.bicep  # Container Registry
│   │   ├── staticwebapp.bicep        # Static Web App
│   │   └── security.bicep            # RBAC role assignments
│   └── scripts/
│       └── deploy.sh               # Deployment script
├── backend/                        # Python FastAPI (Container Apps)
│   ├── main.py                     # FastAPI entrypoint (12 endpoints + WebSocket)
│   ├── agents/
│   │   ├── chat_agent.py           # Copilot CLR AI Foundry Agent
│   │   └── tools.py                # Agent tools (decompose, simplify, search, remind)
│   ├── auth/
│   │   └── entra.py                # JWT validation
│   ├── Dockerfile                  # Container image
│   └── requirements.txt
├── frontend/                       # React + Vite frontend
│   ├── src/
│   │   ├── App.tsx                  # Main app with auth + preferences
│   │   ├── components/
│   │   │   ├── Chat.tsx             # Chat interface + file upload
│   │   │   ├── MessageList.tsx      # Message display + TTS/IR/Report buttons
│   │   │   ├── PreferencesPanel.tsx # Accessibility preferences modal
│   │   │   ├── TTSButton.tsx        # Text-to-speech playback
│   │   │   ├── ImmersiveReaderButton.tsx  # Immersive Reader embed
│   │   │   ├── ReportButton.tsx     # Human-in-the-loop AI reporting
│   │   │   ├── FileUpload.tsx       # Document upload for RAG
│   │   │   └── LoginButton.tsx      # MSAL login
│   │   ├── hooks/
│   │   │   └── useAuth.ts          # Auth hook
│   │   ├── services/
│   │   │   └── api.ts              # Backend API client
│   │   └── auth/
│   │       └── msalConfig.ts       # MSAL config
│   ├── staticwebapp.config.json    # SWA routing + security headers
│   └── package.json
└── .github/workflows/
    ├── deploy-infra.yml            # Bicep deployment
    ├── deploy-api.yml              # Functions deployment
    └── deploy-app.yml              # SWA deployment
```

## Security

- **Authentication**: Microsoft Entra ID (MSAL React + JWT validation)
- **Authorization**: RBAC role assignments, no shared keys
- **Secrets**: Azure Key Vault, managed identity references
- **Transport**: HTTPS only, TLS 1.2 minimum
- **Headers**: CSP, X-Frame-Options, X-Content-Type-Options

## CI/CD (GitHub Actions)

Three separate workflows triggered by path changes:

| Workflow | Trigger Path | Action |
|----------|-------------|--------|
| `deploy-infra.yml` | `infra/**` | Deploys Bicep templates |
| `deploy-api.yml` | `backend/**` | Deploys Python Functions |
| `deploy-app.yml` | `frontend/**` | Deploys React SWA |

### Setup GitHub Actions OIDC

```bash
# Create service principal with federated credentials (no secrets!)
az ad app create --display-name "github-chatapp-deploy"
# Follow: https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure

# Set GitHub secrets:
# AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID
```


