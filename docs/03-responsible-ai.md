# Responsible AI Implementation

Copilot CLR implements all six Microsoft Responsible AI principles with specific code integrations across the Azure AI Foundry Agent Framework, not just documentation.

## Implementation Status

| Principle | Implemented? | Key Files |
|-----------|-------------|----------|
| Fairness | ✅ Yes | `backend/agents/chat_agent.py` (Assistants API persona), `backend/agents/speech_agent.py` (Foundry Agent persona), `backend/main.py` |
| Reliability & Safety | ✅ Yes | `backend/main.py` (Content Safety on all I/O — text chat, speech chat, TTS, voice transcripts) |
| Privacy & Security | ✅ Yes | `backend/main.py`, `infra/modules/security.bicep`, `infra/foundry-agent-setup.bicep` |
| Inclusiveness | ✅ Yes | `frontend/src/components/`, `backend/agents/tools.py`, `backend/agents/speech_agent.py` (Voice Live calm config) |
| Transparency | ✅ Yes | `frontend/src/components/MessageList.tsx`, `backend/main.py` |
| Accountability | ✅ Yes | `frontend/src/components/ReportButton.tsx`, `backend/main.py` |

---

## 1. Fairness

**Goal:** Ensure the assistant adapts to individual needs without bias toward neurotypical norms.

- **Adaptive preferences:** Users set their own reading level, preferred format, voice speed, and font size. Both agents respect these choices without overriding or assuming capability (`backend/agents/chat_agent.py` — Assistants API agent with `AGENT_INSTRUCTIONS`, `backend/agents/speech_agent.py` — Foundry Agent with calm voice `PromptAgentDefinition`).
- **No fixed "normal":** Reading level is a preference slider (Grade 2–12), not a deficit label. The same information is available at every level with equal care.
- **Fairness metadata:** Each AI response is tagged as AI-generated in the frontend (`frontend/src/components/MessageList.tsx` — `.ai-badge`), ensuring users understand the source.
- **Explainability on demand:** The agent offers to explain its simplification choices when asked ("If the user asks why you simplified something, explain your reasoning").

## 2. Reliability & Safety

**Goal:** Every AI response is filtered for harmful content before reaching the user.

- **Input filtering:** `backend/main.py` — `_check_content_safety(text, user_id)` runs Azure AI Content Safety `analyze_text()` on every user message across all endpoints: `POST /api/chat` (text chat), `POST /api/speech/chat` (Foundry Agent), and `POST /api/speech/synthesize` (TTS). Messages exceeding severity threshold 2 (low severity and above) are blocked with a safe fallback response before reaching any agent.
- **Output filtering:** Agent responses from both the Assistants API (`chat_agent.py`) and the Foundry Agent Service (`speech_agent.py`) are checked with `_check_content_safety()` before being returned to the client. Flagged output is replaced with `_CONTENT_SAFETY_FALLBACK`; blocked audio is also dropped.
- **Voice path safety:** In the Web PubSub + Voice Live relay (`backend/services/webpubsub.py`), transcript events from Voice Live are passed through the `content_safety_fn` callback before forwarding to the client via `send_to_connection()`.
- **Latency telemetry:** Every Content Safety call logs `content_safety_duration_ms` and `direction` for monitoring in App Insights.
- **Timeout + retry:** All external service calls (AI Foundry, Content Safety, Cosmos, Speech) use explicit timeouts via `DefaultAzureCredential` and SDK defaults — no unbounded awaits.

## 3. Privacy & Security

**Goal:** Protect user data at rest, in transit, and in processing.

- **Zero-secret architecture:** All service-to-service auth uses Managed Identity with RBAC role assignments (`infra/modules/security.bicep`). The Foundry Account is provisioned via `infra/foundry-agent-setup.bicep` with Entra-first auth. No API keys or shared secrets in code or environment variables.
- **Entra ID authentication:** Every API endpoint validates JWT tokens via `backend/auth/entra.py`. Unauthenticated requests are rejected at the middleware level.
- **Input validation:** `PUT /api/prefs` whitelist-validates all preference fields before storing in Cosmos DB. Only allowed keys (`reading_level`, `preferred_format`, `voice_speed`, `font_size`, `high_contrast`, `theme`) are persisted.
- **Partition isolation:** All Cosmos DB queries are scoped to the authenticated user's `userId` partition key. Users cannot access other users' sessions, messages, or preferences.
- **HTTPS only:** `frontend/staticwebapp.config.json` sets strict security headers (CSP, X-Frame-Options, X-Content-Type-Options). Container Apps environment enforces HTTPS.
- **Secrets in Key Vault:** All external API keys and connection strings are stored in Azure Key Vault and accessed via MI-based references.

## 4. Inclusiveness

**Goal:** Ensure the assistant serves users across the full spectrum of neurodivergent needs.

- **Reading level adaptation:** The `simplify_document` tool (`backend/agents/tools.py`) rewrites content at selectable grade levels (2, 5, 8, 12) measured by Flesch-Kincaid Grade Level (FKGL) via the `textstat` library.
- **Task decomposition:** The `task_decompose` tool breaks complex instructions into numbered, time-boxed steps with priority levels — directly addressing executive function challenges.
- **Text-to-speech:** `POST /api/speech/synthesize` (`backend/main.py`) provides neural voice read-aloud via Azure Speech Service with calm SSML (JennyNeural calm style, slow rate). `POST /api/speech/chat` returns text + base64 TTS audio from the Foundry Agent pipeline. Users with dyslexia or reading difficulties can listen instead of read.
- **Real-time voice:** The Voice Live SDK (`backend/services/webpubsub.py`) connects to the Foundry Speech Agent (`CopilotCLR-SpeechAssistant`) with calm voice configuration — low temperature (0.5), Azure Semantic VAD for patient turn-taking, and deep noise suppression for clean input.
- **Immersive Reader:** `POST /api/ir-token` enables the Azure Immersive Reader SDK to launch for any message — providing line focus, syllabification, picture dictionary, and bilingual translation.
- **Adjustable UI:** Preferences panel (`frontend/src/components/PreferencesPanel.tsx`) allows font size, high contrast mode, and theme selection — serving users with visual processing differences.
- **Focus support:** `schedule_reminder` tool (`backend/agents/tools.py`) sends reminders via Azure Service Bus for users who need task-completion nudges.

## 5. Transparency

**Goal:** Users always know they are interacting with AI and can understand how it works.

- **AI-generated badge:** Every assistant message in the UI displays an "AI-Generated" badge (`frontend/src/components/MessageList.tsx` — `.ai-badge` class).
- **Model identification:** The agent system prompt identifies itself as "Copilot CLR, an AI accessibility assistant" — never pretends to be human.
- **Explainable simplification:** The agent is instructed to explain its simplification reasoning when asked, including which reading level it targeted and why.
- **Structured logging:** Every request logs model name, processing duration, and Content Safety results to App Insights via OpenTelemetry (`backend/main.py` — `configure_azure_monitor()`). Voice sessions log `voice_session_end` with duration and connection IDs.
- **Reading level measurement:** The `get_reading_level` tool provides a numeric FKGL score for any text, making the simplification process measurable and transparent.

## 6. Accountability

**Goal:** Humans can review, intervene, and correct AI behavior.

- **Report button:** Every AI message has a "Report" button (`frontend/src/components/ReportButton.tsx`) that prompts for a reason and stores the flagged response in a dedicated `reports` Cosmos DB container for human review.
- **Reports storage:** `POST /api/report` (`backend/main.py`) stores flagged messages with `userId`, `sessionId`, `messageId`, `reason`, and `timestamp` in the `reports` container with 90-day TTL.
- **Content Safety logging:** All Content Safety decisions (pass or flag) are logged with category, severity, direction, and latency — enabling auditors to query patterns in Log Analytics.
- **Preferences audit trail:** User preferences are stored with `updatedAt` timestamps in Cosmos DB, providing a history of changes.
- **Infrastructure accountability:** All RBAC assignments are defined declaratively in `infra/modules/security.bicep` — auditable, versioned, and reproducible.

---

## Incident Response

If Content Safety flags spike or a user reports harmful content:

1. **Detection:** App Insights alerts on `content_safety_flagged` log events exceeding threshold
2. **Triage:** Query `reports` container in Cosmos DB for flagged responses
3. **Mitigation:** Adjust Content Safety threshold or update agent system prompt
4. **Root cause:** Review agent tool outputs and AI Search knowledge base content
5. **Resolution:** Deploy updated system prompt or Content Safety configuration via Bicep
