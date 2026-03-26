# Copilot CLR — Documentation

> **Challenge:** Cognitive Accessibility — AI Assistant for Neurodiverse Users  
> AI-powered assistant to reduce cognitive load for individuals with ADHD, autism, and dyslexia.

## Judging Criteria Quick Links

| Criterion (25% each) | Document | Readiness |
|-----------------------|----------|-----------|
| Performance | [04-performance-benchmarks.md](./04-performance-benchmarks.md) | :green_circle: OpenTelemetry + App Insights instrumented, KQL queries ready |
| Innovation | [01-problem-statement.md](./01-problem-statement.md) | :green_circle: Full accessibility AI assistant with 6 agent tools |
| Breadth of Azure Services | [05-azure-services-matrix.md](./05-azure-services-matrix.md) | :green_circle: 16/16 services active with real integrations |
| Responsible AI | [03-responsible-ai.md](./03-responsible-ai.md) | :green_circle: All 6 principles implemented with code references |

## Architecture & Design

- [01-problem-statement.md](./01-problem-statement.md) — Cognitive accessibility challenge
- [02-architecture.md](./02-architecture.md) — End-to-end design, service roles, data flow
- [07-model-card.md](./07-model-card.md) — gpt-4o-mini model card (capabilities, limitations, ethical considerations)

## Pre-Submission Checklist

- [x] Challenge category selected — Cognitive Accessibility
- [x] Bicep modules created for Azure Speech Service and Azure Immersive Reader
- [x] Task decomposer agent tool implemented in `backend/agents/tools.py`
- [x] Document simplifier agent tool implemented in `backend/agents/tools.py`
- [x] Focus support (reminders via Service Bus) implemented in `backend/agents/tools.py`
- [x] Accessibility preferences stored in Cosmos DB and applied per session
- [x] Text-to-speech wired to Azure Speech Service SDK
- [x] Immersive Reader panel embedded in `frontend/src/components/ImmersiveReaderButton.tsx`
- [x] Content Safety integrated in `backend/main.py` (text chat path + voice transcript)
- [x] AI-generated badge + Report button for human-in-the-loop
- [x] `AI_FOUNDRY_ENDPOINT` env var added to `infra/modules/container-apps.bicep`
- [x] AI Search connected in `backend/agents/tools.py` — `search_knowledge_base()`
- [x] Service Bus producer implemented in `backend/agents/tools.py` — `schedule_reminder()`
- [x] OpenTelemetry + App Insights SDK instrumented (`azure-monitor-opentelemetry`)
- [x] Performance KQL queries documented
- [ ] Performance baselines measured after deployment
- [x] Architecture diagram exported to `docs/images/arch.drawio.png`
- [ ] Video demo recorded
- [ ] PowerPoint deck prepared
- [ ] Repository made public

## Repository Structure

```
backend/              Python FastAPI backend (Azure Container Apps)
  agents/             Agent Framework (chat_agent.py, tools.py)
  auth/               Entra ID JWT validation (entra.py)
  main.py             FastAPI app — HTTP + WebSocket entrypoint
  function_app.py     Legacy Azure Functions stub (not deployed)
frontend/             React + Vite frontend (Static Web Apps)
infra/                Bicep IaC (16 Azure services)
  modules/            One module per service
  scripts/            Deployment scripts
docs/                 You are here
```

## Key Audit Findings (Pre-Hackathon)

### Must-Fix Before Submission (P0)

1. **Content Safety is provisioned but never called.**
   `azure-ai-contentsafety` is in `requirements.txt` but is not imported in any
   backend file. The voice relay (`/ws/realtime`) has a `# TODO (P0)` comment but no
   implementation. The text chat path (`POST /api/chat` in `backend/main.py`) has no
   Content Safety call at all. Every user message and agent response must pass
   through Content Safety before storage or display.

2. **`AI_FOUNDRY_ENDPOINT` env var is missing from the Container App.**
   `backend/agents/chat_agent.py` checks `os.environ.get("AI_FOUNDRY_ENDPOINT")` and
   returns a local stub response when it is unset. `infra/modules/container-apps.bicep`
   only injects `AI_PROJECT_NAME`. The AI Foundry Agent Service is therefore never
   reached in any deployed environment.

3. **PII detection is absent.** Azure Language PII detection should screen user
   input before logging to Cosmos. No implementation exists in `backend/`.

4. **AI Search is a placeholder.** `backend/agents/tools.py:search_knowledge_base()`
   returns an empty list with a TODO comment. Must connect to the provisioned AI
   Search index.

5. **Service Bus is completely unintegrated.** The `agent-tasks` and `notifications`
   queues are provisioned and RBAC is assigned, but there is no producer or consumer
   anywhere in `backend/`. The old comment "Producer scaffolded in `agents/tools.py`"
   was incorrect — no Service Bus code exists in that file.

6. **No App Insights SDK instrumentation.** All telemetry is plain `logger.info()`
   output to stdout. Container Apps routes this to Log Analytics `AppTraces`. The KQL
   queries in `04-performance-benchmarks.md` target `customMetrics` which will return
   zero rows until SDK instrumentation is added.
