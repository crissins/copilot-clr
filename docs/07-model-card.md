# Model Card �Copilot CLRr

## Model Details

| Field | Value |
|-------|-------|
| Model | gpt-4o-mini (2024-07-18) |
| Provider | Azure OpenAI Service |
| Deployment | Via Azure AI Foundry Agent Service |
| Access | Azure AI Foundry Project endpoint, Managed Identity auth |
| Bicep Module | `infra/modules/openai.bicep` |

## Intended Use

Copilot CLR uses gpt-4o-mini as the reasoning engine for an AI accessibility assistant designed for neurodiverse users (ADHD, autism, dyslexia). The model:

- **Decomposes complex instructions** into numbered, time-boxed steps with priority levels
- **Simplifies documents** at selectable reading levels (Grade 2 / 5 / 8 / 12) measured by FKGL
- **Maintains a calm, supportive tone** � never uses urgent or anxiety-inducing language
- **Adapts to user preferences** � reading level, preferred format, tone, and pace
- **Explains its reasoning** when asked about simplification or task decomposition choices

## Out-of-Scope Uses

This model is NOT used for:

- Medical, legal, or financial advice
- Diagnostic assessment of neurodivergent conditions
- Autonomous decision-making without human oversight
- Processing of sensitive personal data (PII is detected and flagged before storage)

## Training Data

gpt-4o-mini is a general-purpose model trained by OpenAI. Copilot CLR does not fine-tune the model. All specialization is achieved through:

1. **System prompt engineering** � `backend/agents/chat_agent.py` defines thCopilot CLRar persona with 6 core behaviors
2. **Tool augmentation** � 6 custom tools provide structured capabilities (task decomposition, document simplification, reading level measurement, knowledge base search, reminders)
3. **RAG knowledge base** � Azure AI Search index Copilot CLRar-docs`) provides domain-specific accessibility content

## Ethical Considerations

### Content Safety
- All user inputs are filtered through Azure Content Safety (`analyze_text()`) before reaching the model
- All model outputs are filtered through Azure Content Safety before reaching the user
- Voice transcripts are filtered on the `response.audio_transcript.done` event
- Flagged content is blocked and replaced with safe fallback messages

### Bias Mitigation
- Reading level is a user-chosen preference, not an assumed limitation
- The model is instructed to treat all users as capable adults
- No gendered, ageist, or ableist language in the system prompt
- Explainability is built in � users can ask why the model made any choice

### Privacy
- No user data is sent to the model beyond the current conversation context
- PII is detected before Cosmos DB storage
- Zero-secret architecture � no API keys in environment variables
- All data is isolated by user partition key

### Human Oversight
- Every AI response displays an "AI-Generated" badge in the UI
- Every AI response has a "Report" button for human-in-the-loop review
- Reported responses are stored in a dedicated Cosmos DB container for human auditors
- Content Safety logs are queryable via KQL in Log Analytics

## Limitations

1. **Hallucination risk:** gpt-4o-mini may generate plausible but incorrect information. The RAG knowledge base mitigates this for accessibility topics, but general queries may produce inaccurate responses.
2. **Reading level measurement:** FKGL scores are approximations based on syllable counts and sentence length � they do not measure true comprehension difficulty for neurodiverse readers.
3. **Cultural context:** The tone calibration ("calm, supportive") reflects English-language Western norms and may not transfer across all cultural contexts.
4. **Latency:** Agent Service round-trip adds 1�3 seconds to response time, which may cause anxiety for some users. The UI displays a calming loading message to mitigate this.
5. **Voice quality:** Azure Neural TTS (en-US-JennyNeural) provides high-quality speech but may not match the user's preferred accent or speech pattern.

## Performance Metrics

See [04-performance-benchmarks.md](04-performance-benchmarks.md) for latency SLOs, KQL queries, and optimization strategies.

## Version History

| Date | Change |
|------|--------|
| 2025 | Initial deployment with gpt-4o-mini, 6 custom tools, Content Safety integration |
