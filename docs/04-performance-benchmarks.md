# Performance Benchmarks

Copilot CLR uses OpenTelemetry + Azure Monitor for production-grade observability. All critical paths emit structured telemetry to App Insights.

## Instrumentation

The backend uses `azure-monitor-opentelemetry` SDK with `opentelemetry-instrumentation-fastapi` for automatic request tracing, plus manual custom metrics for accessibility-specific KPIs.

**Configuration:** `backend/main.py` — `configure_azure_monitor()` connects to App Insights via the `APPLICATIONINSIGHTS_CONNECTION_STRING` environment variable, set automatically by Container Apps Log Analytics integration.

## Metrics Captured

| Metric | Where Captured | Log Field | Purpose |
|--------|---------------|-----------|---------|
| End-to-end latency | `main.py` — `POST /api/chat` | `chat_request_duration_ms` | Total request time including agent + Content Safety |
| Content Safety latency | `main.py` — `_check_content_safety()` | `content_safety_duration_ms` | Per-call Content Safety processing time |
| Content Safety direction | `main.py` — `_check_content_safety()` | `direction` (input/output) | Track input vs output filtering separately |
| Content Safety flags | `main.py` — `_check_content_safety()` | `content_safety_category`, `content_safety_severity` | Category and severity of flagged content |
| Voice session duration | `services/webpubsub.py` — Web PubSub + Voice Live | `voice_session_end`, `duration_s` | Real-time voice conversation length |
| TTS latency | `main.py` — `POST /api/speech/synthesize` | `X-TTS-Latency-Ms` header + `tts_latency_ms` log | Speech synthesis processing time (calm SSML via Azure Speech SDK) |
| Reading level (FKGL) | `agents/tools.py` — `get_reading_level()` | Agent response text | Flesch-Kincaid Grade Level measurement |
| Document upload | `main.py` — `POST /api/upload` | `chunks_indexed` | Number of chunks indexed per document |

## KQL Queries (Log Analytics)

### End-to-End Latency (P50/P95/P99)

```kusto
AppTraces
| where Message has "chat_request_duration_ms"
| extend latencyMs = toint(extract(@"chat_request_duration_ms=(\d+)", 1, Message))
| where isnotnull(latencyMs)
| summarize P50=percentile(latencyMs, 50), P95=percentile(latencyMs, 95), P99=percentile(latencyMs, 99)
  by bin(TimeGenerated, 1h)
| order by TimeGenerated desc
```

### Content Safety Performance

```kusto
AppTraces
| where Message has "content_safety_duration_ms"
| extend latencyMs = toint(extract(@"content_safety_duration_ms=(\d+)", 1, Message))
| extend direction = extract(@"direction=(\w+)", 1, Message)
| summarize avg(latencyMs), P95=percentile(latencyMs, 95), count() by direction, bin(TimeGenerated, 1h)
| order by TimeGenerated desc
```

### Content Safety Flagged Events

```kusto
AppTraces
| where Message has "content_safety_flagged"
| extend category = extract(@"category=(\w+)", 1, Message)
| extend severity = toint(extract(@"severity=(\d+)", 1, Message))
| extend direction = extract(@"direction=(\w+)", 1, Message)
| summarize count() by category, direction, bin(TimeGenerated, 1d)
| order by TimeGenerated desc
```

### Voice Session Durations

```kusto
AppTraces
| where Message has "voice_session_end"
| extend durationS = toint(extract(@"duration_s=(\d+)", 1, Message))
| where isnotnull(durationS)
| summarize avg(durationS), max(durationS), count() by bin(TimeGenerated, 1h)
| order by TimeGenerated desc
```

### Cold Start Detection

```kusto
AppTraces
| where Message has "chat_request_duration_ms"
| extend latencyMs = toint(extract(@"chat_request_duration_ms=(\d+)", 1, Message))
| where latencyMs > 5000
| summarize coldStarts=count() by bin(TimeGenerated, 1h)
| order by TimeGenerated desc
```

## Target SLOs

| Metric | Target | Rationale |
|--------|--------|-----------|
| Chat response (P50) | < 2s | Neurodiverse users benefit from predictable response times |
| Chat response (P95) | < 5s | Avoid anxiety from long waits |
| Content Safety latency | < 200ms | Should not noticeably delay responses |
| TTS synthesis | < 1.5s | Speech should begin within user attention span |
| Cold start | < 8s | Container Apps Consumption tier limitation |

## Optimization Strategies

1. **OpenTelemetry SDK** — `azure-monitor-opentelemetry` sends auto-instrumented spans, custom metrics, and traces to App Insights `customMetrics` and `traces` tables
2. **Connection pooling** — Cosmos, OpenAI, and Search clients are reused across requests (module-level singletons in `main.py`)
3. **Streaming** — Voice relay uses WebSocket streaming for sub-second TTFT
4. **Async processing** — Reminder delivery offloaded to Service Bus (non-blocking)
5. **Scale-to-zero** — Container Apps Consumption plan minimizes cost during idle periods
6. **Warm instances** — Set `minReplicas: 1` in `container-apps.bicep` to eliminate cold starts (~$1.50/mo)
