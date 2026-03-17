"""
FastAPI backend — Azure Container Apps entrypoint.

HTTP Endpoints:
  POST   /api/chat                — Text chat via AI Foundry Agent Framework
  GET    /api/sessions            — List user chat sessions
  POST   /api/sessions            — Create a new session
  GET    /api/sessions/{id}       — Get session with all messages
  DELETE /api/sessions/{id}       — Delete a session and its messages
  GET    /api/health              — Health check

WebSocket Endpoint:
  WS     /ws/realtime             — Bidirectional voice relay to Azure OpenAI
                                    GPT Realtime API (gpt-4o-mini-realtime-preview)
                                    Audio format: PCM16 mono 24kHz
                                    VAD: semantic_vad (natural speech detection)

Changes vs original:
  - _VOICE_INSTRUCTIONS updated to CognitiveClear calm/supportive persona
  - Content Safety check integrated into _openai_to_client (was TODO P0)
  - _build_content_safety_client / _check_content_safety helpers added
"""

import asyncio
import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone

import websockets
from azure.cosmos import CosmosClient, ContainerProxy
from azure.identity import DefaultAzureCredential
from azure.identity.aio import DefaultAzureCredential as AsyncDefaultAzureCredential
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from agents.chat_agent import get_agent_response
from auth.entra import AuthError, validate_token

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# When LOCAL_DEV=true: in-memory stores replace Cosmos DB, auth is bypassed,
# and the realtime WebSocket endpoint stubs out the OpenAI connection.
_LOCAL_DEV = os.environ.get("LOCAL_DEV", "").lower() in ("1", "true", "yes")

app = FastAPI(title="CognitiveClear API", version="1.0.0")

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
_swa_hostname = os.environ.get("STATIC_WEB_APP_HOSTNAME", "")
_allowed_origins = (
    [f"https://{_swa_hostname}", "http://localhost:5173"]
    if _swa_hostname
    else ["http://localhost:5173"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# ---------------------------------------------------------------------------
# Storage layer — Cosmos DB in production, in-memory dict in LOCAL_DEV mode
# ---------------------------------------------------------------------------

class _InMemoryContainer:
    """Minimal Cosmos container interface for local development.

    Implements the subset of methods used by main.py so the rest of the
    application code is identical in both modes.
    """

    def __init__(self) -> None:
        self._store: dict[str, dict] = {}

    def upsert_item(self, doc: dict) -> dict:
        self._store[doc["id"]] = doc
        return doc

    def read_item(self, item: str, partition_key: str) -> dict:
        if item not in self._store:
            raise KeyError(item)
        return self._store[item]

    def delete_item(self, item: str, partition_key: str) -> None:
        if item not in self._store:
            raise KeyError(item)
        del self._store[item]

    def query_items(
        self,
        query: str,
        parameters: list,
        enable_cross_partition_query: bool = False,
    ) -> list:
        docs = list(self._store.values())
        for param in parameters:
            name, value = param["name"], param["value"]
            if name == "@userId":
                docs = [d for d in docs if d.get("userId") == value]
            elif name == "@sid":
                docs = [d for d in docs if d.get("sessionId") == value]
        if "ORDER BY c.updatedAt DESC" in query:
            docs.sort(key=lambda d: d.get("updatedAt", ""), reverse=True)
        elif "ORDER BY c.createdAt ASC" in query:
            docs.sort(key=lambda d: d.get("createdAt", ""))
        return docs

    def patch_item(
        self, item: str, partition_key: str, patch_operations: list
    ) -> dict:
        doc = self._store.get(item, {})
        for op in patch_operations:
            if op.get("op") in ("replace", "add"):
                doc[op["path"].lstrip("/")] = op["value"]
        self._store[item] = doc
        return doc


if _LOCAL_DEV or not os.environ.get("COSMOS_DB_ENDPOINT"):
    logger.info("LOCAL_DEV mode: using in-memory storage (no Cosmos DB required)")
    _sessions_container: _InMemoryContainer | ContainerProxy = _InMemoryContainer()
    _messages_container: _InMemoryContainer | ContainerProxy = _InMemoryContainer()
else:
    _credential = DefaultAzureCredential()
    _cosmos_client = CosmosClient(
        url=os.environ["COSMOS_DB_ENDPOINT"],
        credential=_credential,
    )
    _database = _cosmos_client.get_database_client(os.environ["COSMOS_DB_DATABASE"])
    _sessions_container = _database.get_container_client("sessions")
    _messages_container = _database.get_container_client("messages")


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def _get_user_id(authorization: str | None) -> str:
    """Extract and validate user OID from Entra ID Bearer token.

    Returns:
        User OID string. Falls back to 'local-dev-user' in LOCAL_DEV mode.

    Raises:
        AuthError: Token missing, expired, wrong audience, or invalid signature.
    """
    if _LOCAL_DEV:
        return "local-dev-user"

    client_id = os.environ.get("ENTRA_CLIENT_ID", "")
    if not client_id:
        return "anonymous"

    if not authorization or not authorization.startswith("Bearer "):
        raise AuthError("Missing or invalid Authorization header")

    claims = validate_token(authorization[7:], client_id)
    return claims.get("oid", claims.get("sub", "unknown"))


# ============================================================================
# POST /api/chat — Text chat via Agent Framework
# ============================================================================

@app.post("/api/chat")
async def chat(req: Request) -> JSONResponse:
    """Send a user message, receive an agent response."""
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        body = await req.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    message = body.get("message", "").strip()
    session_id = body.get("sessionId", "")

    if not message:
        return JSONResponse({"error": "Message is required"}, status_code=400)

    if not session_id:
        session_id = str(uuid.uuid4())
        _sessions_container.upsert_item({
            "id": session_id,
            "userId": user_id,
            "title": message[:50],
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        })

    _messages_container.upsert_item({
        "id": str(uuid.uuid4()),
        "sessionId": session_id,
        "role": "user",
        "content": message,
        "userId": user_id,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })

    start = time.monotonic()
    try:
        agent_response = await get_agent_response(
            message=message,
            session_id=session_id,
            user_id=user_id,
        )
    except Exception:
        logger.exception("Agent error for session=%s", session_id)
        agent_response = (
            "I'm sorry, I had a little trouble with that. "
            "Let's try again — feel free to rephrase your question."
        )

    duration_ms = int((time.monotonic() - start) * 1000)
    logger.info("chat_request_duration_ms=%d session=%s", duration_ms, session_id)

    assistant_msg = {
        "id": str(uuid.uuid4()),
        "sessionId": session_id,
        "role": "assistant",
        "content": agent_response,
        "userId": user_id,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    _messages_container.upsert_item(assistant_msg)

    _sessions_container.patch_item(
        item=session_id,
        partition_key=user_id,
        patch_operations=[{
            "op": "replace",
            "path": "/updatedAt",
            "value": datetime.now(timezone.utc).isoformat(),
        }],
    )

    return JSONResponse({
        "sessionId": session_id,
        "message": {
            "id": assistant_msg["id"],
            "role": "assistant",
            "content": agent_response,
            "createdAt": assistant_msg["createdAt"],
        },
        "meta": {"latencyMs": duration_ms},
    })


# ============================================================================
# GET /api/sessions — List user sessions
# ============================================================================

@app.get("/api/sessions")
def list_sessions(req: Request) -> JSONResponse:
    """List all chat sessions for the authenticated user, newest first."""
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    sessions = list(_sessions_container.query_items(
        query="SELECT * FROM c WHERE c.userId = @userId ORDER BY c.updatedAt DESC",
        parameters=[{"name": "@userId", "value": user_id}],
        enable_cross_partition_query=False,
    ))
    return JSONResponse({"sessions": [
        {k: v for k, v in s.items() if not k.startswith("_")} for s in sessions
    ]})


# ============================================================================
# POST /api/sessions — Create a new session
# ============================================================================

@app.post("/api/sessions")
async def create_session(req: Request) -> JSONResponse:
    """Create a new named chat session."""
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        body = await req.json()
    except Exception:
        body = {}

    now = datetime.now(timezone.utc).isoformat()
    session_doc = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "title": body.get("title", "New Chat"),
        "createdAt": now,
        "updatedAt": now,
    }
    _sessions_container.upsert_item(session_doc)
    return JSONResponse(session_doc, status_code=201)


# ============================================================================
# GET /api/sessions/{session_id} — Get session + all messages
# ============================================================================

@app.get("/api/sessions/{session_id}")
def get_session(session_id: str, req: Request) -> JSONResponse:
    """Return a session document and its ordered message list."""
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        session = _sessions_container.read_item(item=session_id, partition_key=user_id)
    except Exception:
        return JSONResponse({"error": "Session not found"}, status_code=404)

    messages = list(_messages_container.query_items(
        query="SELECT * FROM c WHERE c.sessionId = @sid ORDER BY c.createdAt ASC",
        parameters=[{"name": "@sid", "value": session_id}],
        enable_cross_partition_query=False,
    ))
    return JSONResponse({
        "session": {k: v for k, v in session.items() if not k.startswith("_")},
        "messages": [
            {k: v for k, v in m.items() if not k.startswith("_")} for m in messages
        ],
    })


# ============================================================================
# DELETE /api/sessions/{session_id} — Delete session and messages
# ============================================================================

@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: str, req: Request) -> JSONResponse:
    """Delete a session and perform best-effort cleanup of its messages."""
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        _sessions_container.delete_item(item=session_id, partition_key=user_id)
    except Exception:
        return JSONResponse({"error": "Session not found"}, status_code=404)

    messages = list(_messages_container.query_items(
        query="SELECT c.id FROM c WHERE c.sessionId = @sid",
        parameters=[{"name": "@sid", "value": session_id}],
        enable_cross_partition_query=False,
    ))
    for msg in messages:
        try:
            _messages_container.delete_item(item=msg["id"], partition_key=session_id)
        except Exception:
            pass  # Best-effort cleanup

    return JSONResponse(None, status_code=204)


# ============================================================================
# GET /api/health
# ============================================================================

@app.get("/api/health")
def health() -> JSONResponse:
    return JSONResponse({
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
    })


# ============================================================================
# WebSocket /ws/realtime — Voice relay to Azure OpenAI GPT Realtime API
#
# Protocol (client must follow this sequence):
#   1. Client connects:  wss://<host>/ws/realtime
#   2. Client sends:     {"type": "auth", "token": "Bearer <entra_jwt>"}
#   3. Server validates token; opens WS to Azure OpenAI Realtime API
#   4. Server sends:     {"type": "ready", "userId": "<oid>"}
#   5. All subsequent frames relayed bidirectionally as Azure OpenAI events
#   6. Audio format:     PCM16, mono, 24kHz, base64-encoded chunks
#   7. VAD mode:         semantic_vad — waits for natural end of speech
#   8. Transcripts from response.audio_transcript.done are screened by
#      Azure AI Content Safety before being forwarded to the client
#   9. On disconnect from either side — both connections are torn down cleanly
# ============================================================================

# Updated to CognitiveClear calm/supportive persona (Responsible AI requirement)
_VOICE_INSTRUCTIONS = (
    "You are CognitiveClear — a calm, warm, and patient voice assistant designed "
    "for people who find complex information challenging to process, including those "
    "with ADHD, autism, or dyslexia. "
    "Speak in short, clear sentences. Pause naturally between steps. "
    "Never use urgent, alarming, or pressuring language. "
    "When explaining something complex, always break it into numbered steps. "
    "Acknowledge the user's question before answering. "
    "If you don't know something, say so kindly and suggest a helpful next step."
)

_REALTIME_API_VERSION = "2025-04-01-preview"
_REALTIME_MODEL = "gpt-4o-mini-realtime-preview"

# Content Safety severity threshold (0–6). Flag at 2+ (low severity and above).
_CONTENT_SAFETY_THRESHOLD = 2

# Calm fallback returned to the client when a response is moderated.
_CONTENT_SAFETY_FALLBACK = (
    "I'm sorry, I wasn't able to process that response. "
    "Please try rephrasing your question."
)


def _build_content_safety_client():
    """Build Azure AI Content Safety client via Managed Identity.

    Returns None when AZURE_CONTENT_SAFETY_ENDPOINT is not set (e.g. LOCAL_DEV).
    Imports are deferred so the module loads cleanly even when the SDK is absent.
    """
    endpoint = os.environ.get("AZURE_CONTENT_SAFETY_ENDPOINT", "")
    if not endpoint:
        return None
    from azure.ai.contentsafety import ContentSafetyClient  # noqa: PLC0415
    return ContentSafetyClient(endpoint=endpoint, credential=DefaultAzureCredential())


def _check_content_safety(text: str, user_id: str) -> tuple[bool, str]:
    """Run Azure AI Content Safety on text synchronously.

    Called from an async context via asyncio.to_thread() when used in the
    voice relay — keep this function fully synchronous.

    Args:
        text:    Text to screen (first 10 000 chars checked; API limit).
        user_id: Used only for logging — never sent to Content Safety.

    Returns:
        (is_safe, reason) — is_safe=False means at least one category exceeded
        the threshold and the content should be replaced with the safe fallback.
    """
    cs_client = _build_content_safety_client()

    if cs_client is None:
        if not _LOCAL_DEV:
            logger.warning(
                "AZURE_CONTENT_SAFETY_ENDPOINT not set — "
                "skipping safety check for user=%s", user_id,
            )
        return True, ""

    from azure.ai.contentsafety.models import AnalyzeTextOptions, TextCategory  # noqa: PLC0415

    try:
        response = cs_client.analyze_text(
            AnalyzeTextOptions(
                text=text[:10_000],
                categories=[
                    TextCategory.HATE,
                    TextCategory.SELF_HARM,
                    TextCategory.SEXUAL,
                    TextCategory.VIOLENCE,
                ],
            )
        )
        for result in response.categories_analysis:
            if result.severity >= _CONTENT_SAFETY_THRESHOLD:
                reason = f"{result.category} (severity={result.severity})"
                logger.warning(
                    "content_safety_flag user=%s category=%s severity=%d",
                    user_id, result.category, result.severity,
                )
                return False, reason
        return True, ""

    except Exception:
        # Fail open with a warning so a transient CS outage doesn't
        # break voice sessions entirely — log for investigation.
        logger.exception(
            "Content Safety check failed for user=%s — allowing through", user_id
        )
        return True, ""


async def _get_openai_bearer_token() -> str:
    """Acquire a short-lived bearer token for Azure OpenAI via managed identity."""
    async with AsyncDefaultAzureCredential() as credential:
        token = await credential.get_token("https://cognitiveservices.azure.com/.default")
        return token.token


@app.websocket("/ws/realtime")
async def realtime_voice(websocket: WebSocket) -> None:
    """Relay audio between browser client and Azure OpenAI GPT Realtime API."""
    await websocket.accept()

    # ── Auth: first message must be {"type":"auth","token":"Bearer <jwt>"} ──
    try:
        auth_frame = await asyncio.wait_for(websocket.receive_json(), timeout=10.0)
    except asyncio.TimeoutError:
        await websocket.close(code=4001, reason="Authentication timeout")
        return
    except Exception:
        await websocket.close(code=4002, reason="Malformed auth frame")
        return

    raw_token = auth_frame.get("token", "")
    client_id = os.environ.get("ENTRA_CLIENT_ID", "")

    if _LOCAL_DEV:
        user_id = "local-dev-user"
    elif client_id:
        try:
            claims = validate_token(raw_token.replace("Bearer ", ""), client_id)
            user_id = claims.get("oid", claims.get("sub", "unknown"))
        except AuthError as e:
            await websocket.send_json({"type": "error", "error": str(e)})
            await websocket.close(code=4001)
            return
    else:
        user_id = "anonymous"

    logger.info("voice_session_start user=%s", user_id)

    # ── LOCAL_DEV stub ───────────────────────────────────────────────────────
    if _LOCAL_DEV:
        await websocket.send_json({"type": "ready", "userId": user_id})
        try:
            async for frame in websocket.iter_text():
                event = json.loads(frame)
                if event.get("type") == "input_audio_buffer.commit":
                    await websocket.send_text(json.dumps({
                        "type": "response.audio_transcript.done",
                        "transcript": (
                            "[Local dev mode — voice relay disabled. "
                            "Set deployVoice=true and point AZURE_OPENAI_ENDPOINT "
                            "at a real deployment to enable.]"
                        ),
                    }))
        except WebSocketDisconnect:
            pass
        finally:
            logger.info("voice_session_end user=%s duration_s=0 (local-dev)", user_id)
        return

    # ── Connect to Azure OpenAI Realtime API ─────────────────────────────────
    endpoint = os.environ["AZURE_OPENAI_ENDPOINT"].rstrip("/")
    host = endpoint.replace("https://", "")
    realtime_url = (
        f"wss://{host}/openai/realtime"
        f"?api-version={_REALTIME_API_VERSION}"
        f"&deployment={_REALTIME_MODEL}"
    )

    try:
        openai_token = await _get_openai_bearer_token()
    except Exception:
        logger.exception("Failed to acquire OpenAI bearer token for voice session")
        await websocket.send_json({"type": "error", "error": "Backend auth failed"})
        await websocket.close(code=1011)
        return

    session_start = time.monotonic()

    try:
        async with websockets.connect(
            realtime_url,
            additional_headers={"Authorization": f"Bearer {openai_token}"},
        ) as openai_ws:

            # Configure the Realtime session
            await openai_ws.send(json.dumps({
                "type": "session.update",
                "session": {
                    "instructions": _VOICE_INSTRUCTIONS,
                    "voice": "alloy",
                    "input_audio_format": "pcm16",
                    "output_audio_format": "pcm16",
                    "input_audio_transcription": {"model": "whisper-1"},
                    "turn_detection": {
                        "type": "semantic_vad",
                        "create_response": True,
                    },
                    "tools": [],
                },
            }))

            await websocket.send_json({"type": "ready", "userId": user_id})

            # ── Relay: client → OpenAI ───────────────────────────────────────
            async def _client_to_openai() -> None:
                try:
                    async for frame in websocket.iter_text():
                        await openai_ws.send(frame)
                except WebSocketDisconnect:
                    pass

            # ── Relay: OpenAI → client (with Content Safety check) ───────────
            async def _openai_to_client() -> None:
                try:
                    async for raw in openai_ws:
                        try:
                            event = json.loads(raw)
                        except json.JSONDecodeError:
                            await websocket.send_text(raw)
                            continue

                        if event.get("type") == "response.audio_transcript.done":
                            transcript = event.get("transcript", "")

                            # ── Content Safety check (was TODO P0) ──────────
                            # Run synchronous SDK call in a thread to avoid
                            # blocking the event loop.
                            is_safe, reason = await asyncio.to_thread(
                                _check_content_safety, transcript, user_id
                            )

                            if not is_safe:
                                logger.warning(
                                    "voice_transcript_blocked user=%s reason=%s chars=%d",
                                    user_id, reason, len(transcript),
                                )
                                # Replace flagged content with safe fallback
                                safe_event = {
                                    **event,
                                    "transcript": _CONTENT_SAFETY_FALLBACK,
                                    "_moderated": True,
                                }
                                await websocket.send_text(json.dumps(safe_event))
                                continue  # Don't forward the original event

                            # Log transcript metadata only (not raw content)
                            logger.info(
                                "voice_transcript user=%s chars=%d safe=True",
                                user_id, len(transcript),
                            )
                            # ────────────────────────────────────────────────

                        await websocket.send_text(raw)

                except websockets.exceptions.ConnectionClosed:
                    pass

            await asyncio.gather(_client_to_openai(), _openai_to_client())

    except websockets.exceptions.InvalidHandshake as exc:
        logger.error("OpenAI Realtime handshake failed: %s", exc)
        try:
            await websocket.send_json({"type": "error", "error": "OpenAI connection failed"})
        except Exception:
            pass
    except Exception:
        logger.exception("Unexpected voice relay error user=%s", user_id)
    finally:
        duration_s = int(time.monotonic() - session_start)
        logger.info("voice_session_end user=%s duration_s=%d", user_id, duration_s)
