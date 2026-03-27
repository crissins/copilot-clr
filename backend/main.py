"""
FastAPI backend — Azure Container Apps entrypoint.

HTTP Endpoints:
  POST   /api/chat                — Text chat via AI Foundry Agent Framework
  GET    /api/sessions            — List user chat sessions
  POST   /api/sessions            — Create a new session
  GET    /api/sessions/{id}       — Get session with all messages
  DELETE /api/sessions/{id}       — Delete a session and its messages
  GET    /api/health              — Health check
  POST   /api/voice/negotiate     — Web PubSub client access URL for voice
  POST   /api/webpubsub/voice     — CloudEvent handler for Web PubSub voice hub
  POST   /api/task-plans/decompose — Break a complex goal into time-boxed steps
  GET    /api/task-plans          — List all task plans for the authenticated user
  GET    /api/task-plans/{id}     — Get a specific task plan
  PATCH  /api/task-plans/{id}/steps/{step_id} — Toggle step completion
  DELETE /api/task-plans/{id}     — Delete a task plan
  POST   /api/task-plans/{id}/remind — Queue a Service Bus reminder

Real-time voice uses Azure Web PubSub Service instead of direct WebSockets
because Azure Static Web Apps don't support WebSocket proxying to linked
backends.  Clients connect to Web PubSub directly; the backend acts as the
event handler and bridges each connection to Voice Live + Foundry Agent.
"""

import asyncio
import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

from azure.cosmos import CosmosClient, ContainerProxy
from azure.identity import DefaultAzureCredential
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from agents.chat_agent import get_agent_response
from agents.task_decomposer import decompose_task
from agents.speech_agent import get_speech_agent_response, ensure_speech_agent
from auth.entra import AuthError, validate_token
from routes import content

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# When LOCAL_DEV=true: in-memory stores replace Cosmos DB, auth is bypassed,
# and the realtime WebSocket endpoint stubs out the OpenAI connection.
_LOCAL_DEV = os.environ.get("LOCAL_DEV", "").lower() in ("1", "true", "yes")

app = FastAPI(title="Copilot CLR API", version="1.0.0")

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
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
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
        partition_key: str | None = None,
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
    _content_container: _InMemoryContainer | ContainerProxy = _InMemoryContainer()
    _adapted_container: _InMemoryContainer | ContainerProxy = _InMemoryContainer()
    _audio_container: _InMemoryContainer | ContainerProxy = _InMemoryContainer()
    _preferences_container: _InMemoryContainer | ContainerProxy = _InMemoryContainer()
    _reminders_container: _InMemoryContainer | ContainerProxy = _InMemoryContainer()
    _tasks_container: _InMemoryContainer | ContainerProxy = _InMemoryContainer()
    _feedback_container: _InMemoryContainer | ContainerProxy = _InMemoryContainer()
    _reports_container: _InMemoryContainer | ContainerProxy = _InMemoryContainer()
else:
    _credential = DefaultAzureCredential()
    _cosmos_client = CosmosClient(
        url=os.environ["COSMOS_DB_ENDPOINT"],
        credential=_credential,
    )
    _database = _cosmos_client.get_database_client(os.environ["COSMOS_DB_DATABASE"])
    _sessions_container = _database.get_container_client("sessions")
    _messages_container = _database.get_container_client("messages")
    _content_container = _database.get_container_client("content")
    _adapted_container = _database.get_container_client("adapted")
    _audio_container = _database.get_container_client("audio")
    _preferences_container = _database.get_container_client("preferences")
    _reminders_container = _database.get_container_client("reminders")
    _tasks_container = _database.get_container_client("tasks")
    _feedback_container = _database.get_container_client("feedback")
    _reports_container = _database.get_container_client("reports")


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


def _get_user_profile(authorization: str | None) -> dict:
    """Extract user OID, display name, and email from Entra ID Bearer token.

    Returns:
        Dict with keys: userId, displayName, email.
    """
    if _LOCAL_DEV:
        return {"userId": "local-dev-user", "displayName": "Local Dev User", "email": "dev@localhost"}

    client_id = os.environ.get("ENTRA_CLIENT_ID", "")
    if not client_id:
        return {"userId": "anonymous", "displayName": "Anonymous", "email": ""}

    if not authorization or not authorization.startswith("Bearer "):
        raise AuthError("Missing or invalid Authorization header")

    claims = validate_token(authorization[7:], client_id)
    return {
        "userId": claims.get("oid", claims.get("sub", "unknown")),
        "displayName": claims.get("name", ""),
        "email": claims.get("preferred_username", claims.get("email", "")),
    }


# ============================================================================
# POST /api/speech/token — Issue short-lived auth token for browser Speech SDK
# ============================================================================

@app.post("/api/speech/token")
async def speech_token(req: Request) -> JSONResponse:
    """Return a short-lived authorization token for the browser Speech SDK.

    The browser uses this token with SpeechConfig.fromAuthorizationToken()
    for STT via microphone. TTS stays on the backend (Azure Foundry Speech).
    Token format: aad#<resource_id>#<entra_token>  (valid ~10 min)
    """
    try:
        _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    speech_region = os.environ.get("SPEECH_REGION", "eastus2")
    speech_resource_id = os.environ.get("SPEECH_RESOURCE_ID", "")

    if _LOCAL_DEV or not speech_resource_id:
        return JSONResponse(
            {"error": "Speech token requires Azure Speech Service."},
            status_code=503,
        )

    try:
        credential = DefaultAzureCredential()
        token = credential.get_token("https://cognitiveservices.azure.com/.default")
        auth_token = f"aad#{speech_resource_id}#{token.token}"
    except Exception:
        logger.exception("Failed to issue speech token")
        return JSONResponse({"error": "Could not issue speech token."}, status_code=502)

    return JSONResponse({"authToken": auth_token, "region": speech_region})


# ============================================================================
# POST /api/ir-token — Immersive Reader auth token
# ============================================================================

@app.post("/api/ir-token")
async def ir_token(req: Request) -> JSONResponse:
    """Return an Entra ID token + subdomain for the Immersive Reader SDK.

    The frontend calls ImmersiveReader.launchAsync(token, subdomain, content)
    to provide line focus, syllabification, picture dictionary, read aloud,
    and bilingual translation.
    """
    try:
        _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    ir_endpoint = os.environ.get("IR_ENDPOINT", "")

    if _LOCAL_DEV or not ir_endpoint:
        return JSONResponse(
            {"error": "Immersive Reader requires Azure Cognitive Services."},
            status_code=503,
        )

    # Extract subdomain from the endpoint URL (e.g. "https://ir-kvhky.cognitiveservices.azure.com/")
    try:
        from urllib.parse import urlparse
        subdomain = urlparse(ir_endpoint).hostname.split(".")[0]
    except Exception:
        return JSONResponse({"error": "Invalid IR_ENDPOINT configuration."}, status_code=500)

    try:
        credential = DefaultAzureCredential()
        token = credential.get_token("https://cognitiveservices.azure.com/.default")
    except Exception:
        logger.exception("Failed to issue Immersive Reader token")
        return JSONResponse({"error": "Could not issue IR token."}, status_code=502)

    return JSONResponse({"token": token.token, "subdomain": subdomain})


# ============================================================================
# POST /api/speech/synthesize — TTS via Speech Agent (Feature 7)
# ============================================================================

@app.post("/api/speech/synthesize")
async def speech_synthesize(req: Request):
    """Generate TTS audio with calm SSML. Returns MP3 audio bytes."""
    from fastapi.responses import Response
    from services.speech import synthesize_speech_sync

    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        body = await req.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    text = body.get("text", "").strip()
    if not text:
        return JSONResponse({"error": "Text is required."}, status_code=400)
    if len(text) > 5000:
        return JSONResponse({"error": "Text must be under 5000 characters."}, status_code=400)

    # ── RAI: Input content safety check on TTS text ──
    tts_safe, tts_reason = await asyncio.to_thread(
        _check_content_safety, text, user_id
    )
    if not tts_safe:
        logger.warning("rai_input_blocked endpoint=synthesize user=%s reason=%s", user_id, tts_reason)
        return JSONResponse(
            {"error": "Content filtered by safety policy.", "reason": tts_reason},
            status_code=400,
        )

    # Validate voice and rate at API boundary (defense in depth — also validated in SSML builder)
    voice = body.get("voice", "en-US-EmmaMultilingualNeural")
    style = body.get("style", "calm")
    rate = body.get("rate", "slow")
    lang = body.get("lang", None)  # e.g. "es", "de", "ja"
    if not isinstance(voice, str) or len(voice) > 100:
        voice = "en-US-EmmaMultilingualNeural"
    if not isinstance(style, str) or len(style) > 50:
        style = "calm"
    if not isinstance(rate, str) or len(rate) > 20:
        rate = "slow"
    if lang is not None and (not isinstance(lang, str) or len(lang) > 10):
        lang = None

    try:
        result = await asyncio.to_thread(
            synthesize_speech_sync,
            text,
            voice,
            style,
            rate,
            lang,
        )
    except Exception:
        logger.exception("TTS synthesis error for user=%s", user_id)
        return JSONResponse({"error": "Speech synthesis service error."}, status_code=502)

    if result.get("local_dev"):
        return JSONResponse({"message": "TTS requires Azure Speech Service.", "ssml": result.get("ssml", "")})

    audio_bytes = result.get("audio_bytes", b"")
    if not audio_bytes:
        return JSONResponse({"error": result.get("error", "Synthesis failed.")}, status_code=502)

    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={"X-TTS-Latency-Ms": str(result.get("durationMs", 0))},
    )


# ============================================================================
# POST /api/speech/onboarding — Multilingual SSML for onboarding greeting
# ============================================================================

@app.post("/api/speech/onboarding")
async def speech_onboarding(req: Request):
    """Synthesize a pre-built multilingual SSML string for the onboarding flow.

    Accepts { "ssml": "<speak>...</speak>" } with per-language <voice> tags.
    Returns MP3 audio bytes.
    """
    from fastapi.responses import Response
    from services.speech import synthesize_ssml_raw_sync

    try:
        _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        body = await req.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    ssml = body.get("ssml", "").strip()
    if not ssml or not ssml.startswith("<speak"):
        return JSONResponse({"error": "Valid SSML is required."}, status_code=400)
    if len(ssml) > 10000:
        return JSONResponse({"error": "SSML too long."}, status_code=400)

    try:
        result = await asyncio.to_thread(synthesize_ssml_raw_sync, ssml)
    except Exception:
        logger.exception("TTS onboarding synthesis error")
        return JSONResponse({"error": "Speech synthesis service error."}, status_code=502)

    if result.get("local_dev"):
        return JSONResponse({"message": "TTS requires Azure Speech Service.", "ssml": ssml})

    audio_bytes = result.get("audio_bytes", b"")
    if not audio_bytes:
        return JSONResponse({"error": result.get("error", "Synthesis failed.")}, status_code=502)

    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={"X-TTS-Latency-Ms": str(result.get("durationMs", 0))},
    )


# ============================================================================
# POST /api/speech/chat — Full speech pipeline via Agent Framework (Feature 7)
# ============================================================================

@app.post("/api/speech/chat")
async def speech_chat(req: Request) -> JSONResponse:
    """Send text to the Speech Assistant agent. Returns response + optional audio."""
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

    # ── RAI: Input content safety check ──
    input_safe, input_reason = await asyncio.to_thread(
        _check_content_safety, message, user_id
    )
    if not input_safe:
        logger.warning(
            "rai_input_blocked endpoint=speech_chat user=%s reason=%s",
            user_id, input_reason,
        )
        return JSONResponse({
            "sessionId": session_id or "",
            "message": {"role": "assistant", "content": _CONTENT_SAFETY_FALLBACK},
            "audio_base64": "",
            "meta": {"filtered": True, "direction": "input", "reason": input_reason},
        })

    if not session_id:
        session_id = str(uuid.uuid4())
        _sessions_container.upsert_item({
            "id": session_id,
            "userId": user_id,
            "title": message[:50],
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        })

    # Persist user message
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
        result = await get_speech_agent_response(
            message=message,
            session_id=session_id,
            user_id=user_id,
        )
    except Exception:
        logger.exception("Speech agent error for session=%s", session_id)
        result = {
            "text": "I'm sorry, I had a little trouble with that. Please try again.",
            "audio_base64": "",
            "sessionId": session_id,
        }

    # ── RAI: Output content safety check ──
    output_safe, output_reason = await asyncio.to_thread(
        _check_content_safety, result["text"], user_id
    )
    if not output_safe:
        logger.warning(
            "rai_output_blocked endpoint=speech_chat session=%s reason=%s",
            session_id, output_reason,
        )
        result["text"] = _CONTENT_SAFETY_FALLBACK
        result["audio_base64"] = ""  # Drop audio for filtered response

    # Persist assistant response
    _messages_container.upsert_item({
        "id": str(uuid.uuid4()),
        "sessionId": session_id,
        "role": "assistant",
        "content": result["text"],
        "userId": user_id,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })

    duration_ms = int((time.monotonic() - start) * 1000)
    logger.info("speech_chat_duration_ms=%d session=%s", duration_ms, session_id)

    return JSONResponse({
        "sessionId": result.get("sessionId", session_id),
        "message": {
            "role": "assistant",
            "content": result["text"],
        },
        "audio_base64": result.get("audio_base64", ""),
        "meta": {
            "latencyMs": duration_ms,
            "filtered": not output_safe,
        },
    })


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
    ground_with_bing = bool(body.get("groundWithBing", False))

    if not message:
        return JSONResponse({"error": "Message is required"}, status_code=400)

    # ── RAI: Input content safety check ──
    input_safe, input_reason = await asyncio.to_thread(
        _check_content_safety, message, user_id
    )
    if not input_safe:
        logger.warning(
            "rai_input_blocked session=%s user=%s reason=%s",
            session_id or "new", user_id, input_reason,
        )
        return JSONResponse({
            "sessionId": session_id or "",
            "message": {
                "role": "assistant",
                "content": _CONTENT_SAFETY_FALLBACK,
            },
            "meta": {"filtered": True, "direction": "input", "reason": input_reason},
        })

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
            ground_with_bing=ground_with_bing,
        )
    except Exception:
        logger.exception("Agent error for session=%s", session_id)
        agent_response = (
            "I'm sorry, I had a little trouble with that. "
            "Let's try again — feel free to rephrase your question."
        )

    # ── RAI: Output content safety check ──
    output_safe, output_reason = await asyncio.to_thread(
        _check_content_safety, agent_response, user_id
    )
    if not output_safe:
        logger.warning(
            "rai_output_blocked session=%s user=%s reason=%s",
            session_id, user_id, output_reason,
        )
        agent_response = _CONTENT_SAFETY_FALLBACK

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
        "meta": {
            "latencyMs": duration_ms,
            "filtered": not output_safe,
            "direction": "output" if not output_safe else None,
        },
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

    try:
        sessions = list(_sessions_container.query_items(
            query="SELECT * FROM c WHERE c.userId = @userId ORDER BY c.updatedAt DESC",
            parameters=[{"name": "@userId", "value": user_id}],
            enable_cross_partition_query=True,
        ))
    except Exception:
        logger.exception("Failed to list sessions for user=%s", user_id)
        return JSONResponse({"error": "Failed to load sessions."}, status_code=502)

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

    try:
        messages = list(_messages_container.query_items(
            query="SELECT * FROM c WHERE c.sessionId = @sid ORDER BY c.createdAt ASC",
            parameters=[{"name": "@sid", "value": session_id}],
            enable_cross_partition_query=True,
        ))
    except Exception:
        logger.exception("Failed to load messages for session=%s", session_id)
        messages = []
    return JSONResponse({
        "session": {k: v for k, v in session.items() if not k.startswith("_")},
        "messages": [
            {k: v for k, v in m.items() if not k.startswith("_")} for m in messages
        ],
    })


content.init_routes(_content_container, _adapted_container, _audio_container, _get_user_id, _check_content_safety)
app.include_router(content.router)

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
        enable_cross_partition_query=True,
    ))
    for msg in messages:
        try:
            _messages_container.delete_item(item=msg["id"], partition_key=session_id)
        except Exception:
            pass  # Best-effort cleanup

    return Response(status_code=204)


# ============================================================================
# GET /api/settings — Get neurodiverse user settings
# ============================================================================

_DEFAULT_SETTINGS: dict = {
    "readingLevel": "Grade 5",
    "preferredFormat": "bullet points",
    "voiceSpeed": "1.0",
    "fontSize": "medium",
    "highContrast": False,
    "theme": "system",
    "language": "en",
    "fontFamily": "default",
    "lineSpacing": "normal",
    "reducedMotion": False,
    "focusTimerMinutes": 25,
    "breakReminderMinutes": 5,
    "notificationStyle": "calm",
    "responseLengthPreference": "medium",
    "dyslexiaFont": False,
    "colorOverlay": "none",
    "autoReadResponses": False,
    "preferredVoice": "default",
    "textAlignment": "left",
}


@app.get("/api/settings")
def get_settings(req: Request) -> JSONResponse:
    """Return the authenticated user's neurodiverse-friendly settings."""
    try:
        profile = _get_user_profile(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    user_id = profile["userId"]
    try:
        doc = _preferences_container.read_item(item=user_id, partition_key=user_id)
        return JSONResponse({k: v for k, v in doc.items() if not k.startswith("_")})
    except Exception:
        # No saved settings yet — return defaults with profile info
        defaults = {
            **_DEFAULT_SETTINGS,
            "id": user_id,
            "userId": user_id,
            "displayName": profile["displayName"],
            "email": profile["email"],
        }
        return JSONResponse(defaults)


# ============================================================================
# PUT /api/settings — Update neurodiverse user settings
# ============================================================================

@app.put("/api/settings")
async def update_settings(req: Request) -> JSONResponse:
    """Upsert the authenticated user's neurodiverse-friendly settings."""
    try:
        profile = _get_user_profile(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        body = await req.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    user_id = profile["userId"]

    # Merge incoming values into a safe base, enforce id/userId/profile
    allowed_keys = set(_DEFAULT_SETTINGS.keys())
    settings_doc: dict = {
        **_DEFAULT_SETTINGS,
        **{k: v for k, v in body.items() if k in allowed_keys},
        "id": user_id,
        "userId": user_id,
        "displayName": profile["displayName"],
        "email": profile["email"],
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    try:
        _preferences_container.upsert_item(settings_doc)
    except Exception:
        logger.exception("Failed to save settings for user=%s", user_id)
        return JSONResponse({"error": "Failed to save settings."}, status_code=502)
    return JSONResponse({k: v for k, v in settings_doc.items() if not k.startswith("_")})


# ============================================================================
# GET /api/prefs — Alias for settings (used by PreferencesPanel)
# ============================================================================

@app.get("/api/prefs")
def get_prefs(req: Request) -> JSONResponse:
    return get_settings(req)


@app.put("/api/prefs")
async def update_prefs(req: Request) -> JSONResponse:
    return await update_settings(req)


# ============================================================================
# POST /api/report — Flag a message for human review (RAI accountability)
# ============================================================================

@app.post("/api/report")
async def report_message(req: Request) -> JSONResponse:
    """Store a user-reported message in the reports container.

    Requires a valid Entra ID token. Stores messageId, sessionId, and reason
    with a 90-day TTL for human review.
    """
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        body = await req.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    message_id = body.get("messageId", "").strip()
    session_id = body.get("sessionId", "").strip()
    reason = body.get("reason", "").strip()

    if not message_id or not session_id:
        return JSONResponse(
            {"error": "messageId and sessionId are required."}, status_code=400
        )
    if not reason:
        return JSONResponse({"error": "reason is required."}, status_code=400)
    if len(reason) > 2000:
        return JSONResponse(
            {"error": "reason must be under 2000 characters."}, status_code=400
        )

    report_id = str(uuid.uuid4())
    report_doc = {
        "id": report_id,
        "userId": user_id,
        "sessionId": session_id,
        "messageId": message_id,
        "reason": reason,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "ttl": 90 * 24 * 60 * 60,  # 90-day TTL
    }

    try:
        _reports_container.upsert_item(report_doc)
    except Exception:
        logger.exception("Failed to store report for user=%s message=%s", user_id, message_id)
        return JSONResponse({"error": "Failed to store report."}, status_code=502)

    logger.info(
        "report_created user=%s session=%s message=%s report=%s",
        user_id, session_id, message_id, report_id,
    )
    return JSONResponse({"id": report_id, "status": "created"}, status_code=201)


# ============================================================================
# POST /api/task-plans/decompose — Break a complex goal into time-boxed steps
# ============================================================================

# ============================================================================
# GET /api/task-plans — List all task plans for the authenticated user
# ============================================================================

@app.get("/api/task-plans")
def list_task_plans(req: Request) -> JSONResponse:
    """List all task decomposition plans for the user, newest first."""
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    tasks = list(_tasks_container.query_items(
        query="SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC",
        parameters=[{"name": "@userId", "value": user_id}],
        partition_key=user_id,
    ))
    return JSONResponse({"tasks": [
        {k: v for k, v in t.items() if not k.startswith("_")} for t in tasks
    ]})


# ============================================================================
# GET /api/task-plans/{task_id} — Get a specific task plan
# ============================================================================

@app.get("/api/task-plans/{task_id}")
def get_task_plan(task_id: str, req: Request) -> JSONResponse:
    """Return a task plan document with all steps."""
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        task = _tasks_container.read_item(item=task_id, partition_key=user_id)
    except Exception:
        return JSONResponse({"error": "Task plan not found"}, status_code=404)

    return JSONResponse({
        "task": {k: v for k, v in task.items() if not k.startswith("_")},
    })


# ============================================================================
# PATCH /api/task-plans/{task_id}/steps/{step_id} — Toggle step completion
# ============================================================================

@app.patch("/api/task-plans/{task_id}/steps/{step_id}")
async def toggle_step(task_id: str, step_id: str, req: Request) -> JSONResponse:
    """Mark a step as completed or uncompleted."""
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        body = await req.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    completed = body.get("completed", False)

    try:
        task = _tasks_container.read_item(item=task_id, partition_key=user_id)
    except Exception:
        return JSONResponse({"error": "Task plan not found"}, status_code=404)

    step_found = False
    now = datetime.now(timezone.utc).isoformat()
    for step in task.get("steps", []):
        if step["id"] == step_id:
            step["completed"] = completed
            step["completedAt"] = now if completed else None
            step_found = True
            break

    if not step_found:
        return JSONResponse({"error": "Step not found"}, status_code=404)

    task["updatedAt"] = now
    _tasks_container.upsert_item(task)

    return JSONResponse({
        "task": {k: v for k, v in task.items() if not k.startswith("_")},
    })


# ============================================================================
# DELETE /api/task-plans/{task_id} — Delete a task plan
# ============================================================================

@app.delete("/api/task-plans/{task_id}")
def delete_task_plan(task_id: str, req: Request) -> Response:
    """Delete a task decomposition plan."""
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        _tasks_container.delete_item(item=task_id, partition_key=user_id)
    except Exception:
        return JSONResponse({"error": "Task plan not found"}, status_code=404)

    return Response(status_code=204)


# ============================================================================
# POST /api/task-plans/{task_id}/remind — Queue a Service Bus reminder
# ============================================================================

@app.post("/api/task-plans/{task_id}/remind")
async def send_reminder(task_id: str, req: Request) -> JSONResponse:
    """Queue a reminder for a specific task step via Service Bus.

    The reminder will be picked up by a Service Bus trigger and delivered
    via Azure Communication Services (email/SMS).
    """
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        body = await req.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    step_id = body.get("stepId", "")
    notify_email = body.get("email", "")

    try:
        task = _tasks_container.read_item(item=task_id, partition_key=user_id)
    except Exception:
        return JSONResponse({"error": "Task plan not found"}, status_code=404)

    # Find the step
    target_step = None
    for step in task.get("steps", []):
        if step["id"] == step_id:
            target_step = step
            break

    if not target_step:
        return JSONResponse({"error": "Step not found"}, status_code=404)

    # Queue reminder to Service Bus
    sb_conn_str = os.environ.get("SERVICE_BUS_CONNECTION_STRING", "")
    queue_name = os.environ.get("SERVICE_BUS_QUEUE_NAME", "task-reminders")

    reminder_payload = {
        "taskId": task_id,
        "stepId": step_id,
        "stepTitle": target_step["title"],
        "estimatedMinutes": target_step["estimatedMinutes"],
        "userId": user_id,
        "email": notify_email,
        "goal": task.get("goal", ""),
        "queuedAt": datetime.now(timezone.utc).isoformat(),
    }

    if not sb_conn_str or _LOCAL_DEV:
        logger.info(
            "LOCAL_DEV or no Service Bus configured — reminder logged only: %s",
            json.dumps(reminder_payload),
        )
        return JSONResponse({
            "status": "queued",
            "message": "Reminder noted (Service Bus not configured — logged locally).",
            "reminder": reminder_payload,
        })

    try:
        from azure.servicebus import ServiceBusClient, ServiceBusMessage  # noqa: PLC0415

        sb_client = ServiceBusClient.from_connection_string(sb_conn_str)
        with sb_client:
            sender = sb_client.get_queue_sender(queue_name=queue_name)
            with sender:
                message = ServiceBusMessage(json.dumps(reminder_payload))
                sender.send_messages(message)
        logger.info("Reminder queued for task=%s step=%s", task_id, step_id)
    except Exception:
        logger.exception("Failed to queue reminder for task=%s step=%s", task_id, step_id)
        return JSONResponse(
            {"error": "Could not queue reminder. Please try again later."},
            status_code=500,
        )

    return JSONResponse({
        "status": "queued",
        "message": "Reminder has been queued. You will be notified when it is time.",
        "reminder": reminder_payload,
    })


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
# Tasks API — CRUD for user tasks (managed by agent + available to frontend)
# ============================================================================

@app.get("/api/tasks")
def api_list_tasks(req: Request) -> JSONResponse:
    """List all tasks for the authenticated user."""
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        tasks = list(_tasks_container.query_items(
            query="SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC",
            parameters=[{"name": "@userId", "value": user_id}],
            enable_cross_partition_query=True,
        ))
    except Exception:
        logger.exception("Failed to load tasks for user=%s", user_id)
        return JSONResponse({"error": "Failed to load tasks."}, status_code=502)
    return JSONResponse({"tasks": [
        {k: v for k, v in t.items() if not k.startswith("_")} for t in tasks
    ]})


@app.post("/api/tasks")
async def api_create_task(req: Request) -> JSONResponse:
    """Create a new task."""
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        body = await req.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    title = body.get("title", "").strip()
    if not title:
        return JSONResponse({"error": "Title is required"}, status_code=400)

    now = datetime.now(timezone.utc).isoformat()
    task_id = str(uuid.uuid4())
    task_doc = {
        "id": task_id,
        "taskId": task_id,
        "userId": user_id,
        "title": title,
        "description": body.get("description", ""),
        "priority": body.get("priority", "medium"),
        "status": "pending",
        "dueDate": body.get("dueDate", ""),
        "createdAt": now,
        "updatedAt": now,
    }
    _tasks_container.upsert_item(task_doc)
    return JSONResponse(
        {k: v for k, v in task_doc.items() if not k.startswith("_")},
        status_code=201,
    )


@app.put("/api/tasks/{task_id}")
async def api_update_task(task_id: str, req: Request) -> JSONResponse:
    """Update an existing task."""
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        body = await req.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    try:
        task = _tasks_container.read_item(item=task_id, partition_key=task_id)
    except Exception:
        return JSONResponse({"error": "Task not found"}, status_code=404)

    allowed = {"title", "description", "priority", "status", "dueDate"}
    for key in allowed:
        if key in body:
            task[key] = body[key]
    task["updatedAt"] = datetime.now(timezone.utc).isoformat()

    _tasks_container.upsert_item(task)
    return JSONResponse({k: v for k, v in task.items() if not k.startswith("_")})


@app.delete("/api/tasks/{task_id}")
def api_delete_task(task_id: str, req: Request) -> JSONResponse:
    """Delete a task."""
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        _tasks_container.delete_item(item=task_id, partition_key=task_id)
    except Exception:
        return JSONResponse({"error": "Task not found"}, status_code=404)

    return Response(status_code=204)


# ============================================================================
# POST /api/tasks/decompose — Break a complex goal into time-boxed steps
# ============================================================================

@app.post("/api/tasks/decompose")
async def decompose_goal(req: Request) -> JSONResponse:
    """Decompose a complex goal into numbered, time-boxed sub-tasks."""
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        body = await req.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    goal = body.get("goal", "").strip()
    reading_level = body.get("readingLevel", "")

    if not goal:
        return JSONResponse({"error": "Goal is required"}, status_code=400)

    start = time.monotonic()
    try:
        result = await decompose_task(
            goal=goal,
            user_id=user_id,
            reading_level=reading_level,
        )
    except Exception:
        logger.exception("Task decomposition error for user=%s", user_id)
        return JSONResponse(
            {"error": "Something went wrong while breaking down your goal. Please try again."},
            status_code=500,
        )

    duration_ms = int((time.monotonic() - start) * 1000)
    logger.info("task_decompose_duration_ms=%d user=%s", duration_ms, user_id)

    now = datetime.now(timezone.utc).isoformat()
    task_id = str(uuid.uuid4())

    task_doc = {
        "id": task_id,
        "taskId": task_id,
        "userId": user_id,
        "goal": goal,
        "steps": result.get("steps", []),
        "explanation": result.get("explanation", ""),
        "readingLevel": reading_level,
        "createdAt": now,
        "updatedAt": now,
    }
    _tasks_container.upsert_item(task_doc)

    return JSONResponse({
        "task": {k: v for k, v in task_doc.items() if not k.startswith("_")},
        "meta": {"latencyMs": duration_ms},
    }, status_code=201)


# ============================================================================
# GET /api/tasks/plans — List all task decomposition plans
# ============================================================================

@app.get("/api/tasks/plans")
def list_task_plans(req: Request) -> JSONResponse:
    """List all task decomposition plans for the user, newest first."""
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        tasks = list(_tasks_container.query_items(
            query="SELECT * FROM c WHERE c.userId = @userId AND IS_DEFINED(c.goal) ORDER BY c.createdAt DESC",
            parameters=[{"name": "@userId", "value": user_id}],
            enable_cross_partition_query=True,
        ))
    except Exception:
        logger.exception("Failed to load task plans for user=%s", user_id)
        return JSONResponse({"error": "Failed to load task plans."}, status_code=502)
    return JSONResponse({"tasks": [
        {k: v for k, v in t.items() if not k.startswith("_")} for t in tasks
    ]})


# ============================================================================
# GET /api/tasks/plans/{task_id} — Get a specific task plan
# ============================================================================

@app.get("/api/tasks/plans/{task_id}")
def get_task_plan(task_id: str, req: Request) -> JSONResponse:
    """Return a task plan document with all steps."""
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        task = _tasks_container.read_item(item=task_id, partition_key=task_id)
    except Exception:
        return JSONResponse({"error": "Task plan not found"}, status_code=404)

    return JSONResponse({
        "task": {k: v for k, v in task.items() if not k.startswith("_")},
    })


# ============================================================================
# PATCH /api/tasks/plans/{task_id}/steps/{step_id} — Toggle step completion
# ============================================================================

@app.patch("/api/tasks/plans/{task_id}/steps/{step_id}")
async def toggle_step(task_id: str, step_id: str, req: Request) -> JSONResponse:
    """Mark a step as completed or uncompleted."""
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        body = await req.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    completed = body.get("completed", False)

    try:
        task = _tasks_container.read_item(item=task_id, partition_key=task_id)
    except Exception:
        return JSONResponse({"error": "Task plan not found"}, status_code=404)

    step_found = False
    now = datetime.now(timezone.utc).isoformat()

    for step in task.get("steps", []):
        if step["id"] == step_id:
            step["completed"] = completed
            step["completedAt"] = now if completed else None
            step_found = True
            break

    if not step_found:
        return JSONResponse({"error": "Step not found"}, status_code=404)

    task["updatedAt"] = now
    _tasks_container.upsert_item(task)

    return JSONResponse({
        "task": {k: v for k, v in task.items() if not k.startswith("_")},
    })


# ============================================================================
# DELETE /api/tasks/plans/{task_id} — Delete a task plan
# ============================================================================

@app.delete("/api/tasks/plans/{task_id}")
def delete_task_plan(task_id: str, req: Request) -> JSONResponse:
    """Delete a task decomposition plan."""
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        _tasks_container.delete_item(item=task_id, partition_key=task_id)
    except Exception:
        return JSONResponse({"error": "Task plan not found"}, status_code=404)

    return JSONResponse(None, status_code=204)


# ============================================================================
# POST /api/tasks/plans/{task_id}/remind — Queue a Service Bus reminder
# ============================================================================

@app.post("/api/tasks/plans/{task_id}/remind")
async def send_reminder(task_id: str, req: Request) -> JSONResponse:
    """Queue a reminder for a specific task step via Service Bus."""
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        body = await req.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    step_id = body.get("stepId", "")
    notify_email = body.get("email", "")

    try:
        task = _tasks_container.read_item(item=task_id, partition_key=task_id)
    except Exception:
        return JSONResponse({"error": "Task plan not found"}, status_code=404)

    # Find the step
    target_step = None
    for step in task.get("steps", []):
        if step["id"] == step_id:
            target_step = step
            break

    if not target_step:
        return JSONResponse({"error": "Step not found"}, status_code=404)

    # Queue reminder to Service Bus
    sb_conn_str = os.environ.get("SERVICE_BUS_CONNECTION_STRING", "")
    queue_name = os.environ.get("SERVICE_BUS_QUEUE_NAME", "task-reminders")

    reminder_payload = {
        "taskId": task_id,
        "stepId": step_id,
        "stepTitle": target_step["title"],
        "estimatedMinutes": target_step["estimatedMinutes"],
        "userId": user_id,
        "email": notify_email,
        "goal": task.get("goal", ""),
        "queuedAt": datetime.now(timezone.utc).isoformat(),
    }

    if not sb_conn_str or _LOCAL_DEV:
        logger.info(
            "LOCAL_DEV or no Service Bus configured — reminder logged only: %s",
            json.dumps(reminder_payload),
        )
        return JSONResponse({
            "status": "queued",
            "message": "Reminder noted (Service Bus not configured — logged locally).",
            "reminder": reminder_payload,
        })

    try:
        from azure.servicebus import ServiceBusClient, ServiceBusMessage  # noqa: PLC0415
        sb_client = ServiceBusClient.from_connection_string(sb_conn_str)
        with sb_client:
            sender = sb_client.get_queue_sender(queue_name=queue_name)
            with sender:
                message = ServiceBusMessage(json.dumps(reminder_payload))
                sender.send_messages(message)
        logger.info("Reminder queued for task=%s step=%s", task_id, step_id)
    except Exception:
        logger.exception("Failed to queue reminder for task=%s step=%s", task_id, step_id)
        return JSONResponse(
            {"error": "Could not queue reminder. Please try again later."},
            status_code=500,
        )

    return JSONResponse({
        "status": "queued",
        "message": "Reminder has been queued. You will be notified when it is time.",
        "reminder": reminder_payload,
    })


# ============================================================================
# Feedback API — Submit and list user feedback
# ============================================================================

@app.post("/api/feedback")
async def submit_feedback(req: Request) -> JSONResponse:
    """Submit user feedback (rating, comment, category)."""
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        body = await req.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    comment = body.get("comment", "").strip()
    rating = body.get("rating", 0)
    category = body.get("category", "general")

    if not comment and not rating:
        return JSONResponse({"error": "Provide a comment or rating."}, status_code=400)
    if not isinstance(rating, (int, float)) or rating < 0 or rating > 5:
        rating = 0
    if not isinstance(category, str) or len(category) > 50:
        category = "general"
    if len(comment) > 2000:
        comment = comment[:2000]

    now = datetime.now(timezone.utc).isoformat()
    feedback_id = str(uuid.uuid4())
    feedback_doc = {
        "id": feedback_id,
        "userId": user_id,
        "comment": comment,
        "rating": rating,
        "category": category,
        "createdAt": now,
    }
    _feedback_container.upsert_item(feedback_doc)
    logger.info("feedback_submitted id=%s user=%s category=%s", feedback_id, user_id, category)
    return JSONResponse(
        {k: v for k, v in feedback_doc.items() if not k.startswith("_")},
        status_code=201,
    )


@app.get("/api/feedback")
def list_feedback(req: Request) -> JSONResponse:
    """List all feedback submitted by the authenticated user."""
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    items = list(_feedback_container.query_items(
        query="SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC",
        parameters=[{"name": "@userId", "value": user_id}],
        enable_cross_partition_query=True,
    ))
    return JSONResponse({"feedback": [
        {k: v for k, v in item.items() if not k.startswith("_")} for item in items
    ]})


# ============================================================================
# GET /api/insights — Adaptive behavior: user interaction insights
# ============================================================================

@app.get("/api/insights")
def get_user_insights(req: Request) -> JSONResponse:
    """Return adaptive insights based on the user's interaction history.

    Aggregates: total sessions, messages, tasks created, tasks completed,
    preferred reading level, average task completion rate, content uploads,
    and personalized suggestions.
    """
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    # Count sessions
    sessions = list(_sessions_container.query_items(
        query="SELECT VALUE COUNT(1) FROM c WHERE c.userId = @uid",
        parameters=[{"name": "@uid", "value": user_id}],
        partition_key=user_id,
    ))
    total_sessions = sessions[0] if sessions else 0

    # Count messages
    messages = list(_messages_container.query_items(
        query="SELECT VALUE COUNT(1) FROM c WHERE c.userId = @uid",
        parameters=[{"name": "@uid", "value": user_id}],
        enable_cross_partition_query=True,
    ))
    total_messages = messages[0] if messages else 0

    # Estimate token usage from message content when explicit usage is unavailable.
    message_rows = list(_messages_container.query_items(
        query="SELECT c.content, c.meta, c.tokenUsage FROM c WHERE c.userId = @uid",
        parameters=[{"name": "@uid", "value": user_id}],
        enable_cross_partition_query=True,
    ))
    total_tokens_used = 0
    for msg in message_rows:
        token_usage = msg.get("tokenUsage") or {}
        explicit_total = token_usage.get("totalTokens")
        if explicit_total is None:
            meta = msg.get("meta") or {}
            explicit_total = meta.get("totalTokens")
        if explicit_total is not None:
            try:
                total_tokens_used += int(explicit_total)
                continue
            except (TypeError, ValueError):
                pass

        content = (msg.get("content") or "").strip()
        word_count = len(content.split()) if content else 0
        total_tokens_used += int(word_count * 1.3)

    # Task plans and completion
    tasks = list(_tasks_container.query_items(
        query="SELECT c.steps, c.readingLevel FROM c WHERE c.userId = @uid",
        parameters=[{"name": "@uid", "value": user_id}],
        partition_key=user_id,
    ))
    total_task_plans = len(tasks)
    total_steps = 0
    completed_steps = 0
    reading_levels_used: dict[str, int] = {}
    for t in tasks:
        steps = t.get("steps", [])
        total_steps += len(steps)
        completed_steps += sum(1 for s in steps if s.get("completed"))
        rl = t.get("readingLevel", "")
        if rl:
            reading_levels_used[rl] = reading_levels_used.get(rl, 0) + 1

    completion_rate = round(completed_steps / total_steps * 100, 1) if total_steps else 0.0

    # Content uploads
    content_items = list(_content_container.query_items(
        query="SELECT VALUE COUNT(1) FROM c WHERE c.userId = @uid",
        parameters=[{"name": "@uid", "value": user_id}],
        partition_key=user_id,
    ))
    total_uploads = content_items[0] if content_items else 0

    # Adaptation savings metrics
    source_rows = list(_content_container.query_items(
        query="SELECT c.id, c.extractedText FROM c WHERE c.userId = @uid",
        parameters=[{"name": "@uid", "value": user_id}],
        partition_key=user_id,
    ))
    source_words_by_id = {
        row.get("id", ""): len((row.get("extractedText") or "").split())
        for row in source_rows
        if row.get("id")
    }

    adapted_rows = list(_adapted_container.query_items(
        query="SELECT c.sourceContentId, c.adaptedText FROM c WHERE c.userId = @uid",
        parameters=[{"name": "@uid", "value": user_id}],
        partition_key=user_id,
    ))
    total_adaptations = len(adapted_rows)
    words_saved = 0
    for row in adapted_rows:
        source_id = row.get("sourceContentId", "")
        source_words = source_words_by_id.get(source_id, 0)
        adapted_words = len((row.get("adaptedText") or "").split())
        if source_words > adapted_words:
            words_saved += source_words - adapted_words

    # Preferred reading level (most frequently used)
    preferred_reading_level = ""
    if reading_levels_used:
        preferred_reading_level = max(reading_levels_used, key=reading_levels_used.get)

    # Build adaptive suggestions
    suggestions = []
    if total_sessions == 0:
        suggestions.append("Try starting a conversation — I can help simplify complex topics.")
    if total_task_plans == 0:
        suggestions.append("The Task Decomposer can break big goals into small, manageable steps.")
    if total_uploads == 0:
        suggestions.append("Upload a document and I can simplify it to your preferred reading level.")
    if completion_rate > 0 and completion_rate < 50:
        suggestions.append("You've started some tasks — try completing one step at a time. No rush!")
    if completion_rate >= 80:
        suggestions.append("You're completing tasks consistently — great momentum!")
    if total_messages > 20 and not preferred_reading_level:
        suggestions.append("Setting a reading level in your preferences can personalize responses.")

    return JSONResponse({
        "totalSessions": total_sessions,
        "totalMessages": total_messages,
        "totalTokensUsed": total_tokens_used,
        "totalTaskPlans": total_task_plans,
        "totalSteps": total_steps,
        "completedSteps": completed_steps,
        "completionRate": completion_rate,
        "totalUploads": total_uploads,
        "totalAdaptations": total_adaptations,
        "wordsSaved": words_saved,
        "preferredReadingLevel": preferred_reading_level,
        "readingLevelsUsed": reading_levels_used,
        "suggestions": suggestions,
    })


# ============================================================================
# Real-time voice via Azure Web PubSub + Voice Live + Foundry Agent
#
# Architecture (replaces direct WebSocket because SWA can't proxy WS):
#   1. POST /api/voice/negotiate  → Client gets Web PubSub access URL
#   2. Client connects to Web PubSub directly (WebSocket)
#   3. Web PubSub → CloudEvent HTTP POST → /api/webpubsub/voice
#   4. Backend bridges each connection to Voice Live + Foundry Agent
#   5. Backend pushes Voice Live events to client via PubSub REST API
# ============================================================================

# Content Safety severity threshold (0–6). Flag at 2+ (low severity and above).
_CONTENT_SAFETY_THRESHOLD = 2

# Calm fallback returned to the client when a response is moderated.
_CONTENT_SAFETY_FALLBACK = (
    "I'm sorry, I wasn't able to process that response. "
    "Please try rephrasing your question."
)


_content_safety_client = None
_content_safety_client_inited = False


def _build_content_safety_client():
    """Return a cached Azure AI Content Safety client via Managed Identity.

    Returns None when AZURE_CONTENT_SAFETY_ENDPOINT is not set (e.g. LOCAL_DEV).
    Imports are deferred so the module loads cleanly even when the SDK is absent.
    """
    global _content_safety_client, _content_safety_client_inited
    if _content_safety_client_inited:
        return _content_safety_client
    endpoint = os.environ.get("AZURE_CONTENT_SAFETY_ENDPOINT", "")
    if not endpoint:
        _content_safety_client_inited = True
        return None
    from azure.ai.contentsafety import ContentSafetyClient  # noqa: PLC0415
    _content_safety_client = ContentSafetyClient(endpoint=endpoint, credential=DefaultAzureCredential())
    _content_safety_client_inited = True
    return _content_safety_client


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




# ---------------------------------------------------------------------------
# Register sub-routers from routes/ modules
# ---------------------------------------------------------------------------
from routes.content import router as content_router, init_routes as init_content
from routes.reminders import router as reminders_router, init_routes as init_reminders
from routes.avatar_routes import router as avatar_router, init_routes as init_avatar
from routes.speech_routes import router as speech_router, init_routes as init_speech_routes

init_content(_content_container, _adapted_container, _audio_container, _get_user_id, _check_content_safety)
init_reminders(_get_user_id, _reminders_container, _preferences_container)
init_avatar(_get_user_id, _preferences_container, _adapted_container)
init_speech_routes(_get_user_id)

app.include_router(content_router)
app.include_router(reminders_router)
app.include_router(avatar_router)
app.include_router(speech_router)


# ── POST /api/voice/negotiate ────────────────────────────────────────────────

@app.post("/api/voice/negotiate")
async def voice_negotiate(req: Request) -> JSONResponse:
    """Generate a Web PubSub client access URL for real-time voice sessions."""
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    pubsub_endpoint = os.environ.get("WEBPUBSUB_ENDPOINT", "")
    pubsub_conn_str = os.environ.get("WEBPUBSUB_CONNECTION_STRING", "")
    if not pubsub_endpoint and not pubsub_conn_str:
        return JSONResponse(
            {"error": "Web PubSub not configured"},
            status_code=503,
        )

    try:
        from services.webpubsub import get_client_access_url  # noqa: PLC0415
        url = await asyncio.to_thread(get_client_access_url, user_id)
        return JSONResponse({"url": url})
    except Exception:
        logger.exception("Failed to generate Web PubSub URL")
        return JSONResponse(
            {"error": "Voice service unavailable"}, status_code=502,
        )


# ── Web PubSub CloudEvent event handler ─────────────────────────────────────

@app.api_route("/api/webpubsub/voice", methods=["OPTIONS", "POST"])
async def webpubsub_voice_handler(req: Request):
    """Handle Web PubSub CloudEvent callbacks for the 'voice' hub.

    Events:
      OPTIONS                           — Abuse-protection validation
      azure.webpubsub.sys.connect       — Accept connection, start Voice Live
      azure.webpubsub.user.message      — Forward audio / control events
      azure.webpubsub.sys.disconnected  — Clean up Voice Live session
    """
    # Abuse protection (OPTIONS)
    if req.method == "OPTIONS":
        origin = req.headers.get("WebHook-Request-Origin", "")
        return JSONResponse(
            content={},
            headers={"WebHook-Allowed-Origin": origin},
        )

    ce_type = req.headers.get("ce-type", "")
    connection_id = req.headers.get("ce-connectionid", "")
    user_id = req.headers.get("ce-userid", "")

    from services.webpubsub import get_session, stop_session  # noqa: PLC0415

    # System: connect — accept the connection, start Voice Live in background
    if ce_type == "azure.webpubsub.sys.connect":
        logger.info(
            "voice_pubsub_connect conn=%s user=%s", connection_id, user_id,
        )
        asyncio.create_task(_start_voice_session(connection_id, user_id))
        return JSONResponse({"userId": user_id})

    # System: disconnected — tear down Voice Live session
    if ce_type == "azure.webpubsub.sys.disconnected":
        logger.info(
            "voice_pubsub_disconnect conn=%s user=%s", connection_id, user_id,
        )
        await stop_session(connection_id)
        return JSONResponse({})

    # User message — forward audio / control events to Voice Live
    if ce_type == "azure.webpubsub.user.message":
        body = await req.body()
        try:
            event = json.loads(body)
        except (json.JSONDecodeError, ValueError):
            return JSONResponse({})

        session = get_session(connection_id)
        if not session:
            return JSONResponse({})

        evt_type = event.get("type", "")
        if evt_type == "input_audio_buffer.append":
            await session.forward_audio(event.get("audio", ""))
        elif evt_type == "response.cancel":
            await session.cancel_response()

        return JSONResponse({})

    return JSONResponse({})


async def _start_voice_session(connection_id: str, user_id: str) -> None:
    """Start a Voice Live session for a Web PubSub connection (background)."""
    from services.webpubsub import start_session  # noqa: PLC0415

    try:
        await start_session(
            connection_id=connection_id,
            user_id=user_id,
            content_safety_fn=_check_content_safety,
            content_safety_fallback=_CONTENT_SAFETY_FALLBACK,
        )
    except Exception:
        logger.exception(
            "Failed to start voice session conn=%s user=%s",
            connection_id, user_id,
        )
