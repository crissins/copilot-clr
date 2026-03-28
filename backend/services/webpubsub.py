"""Azure Web PubSub voice relay — bridges browser clients to Voice Live + Foundry Agent.

Azure Static Web Apps don't support WebSocket proxying to linked backends.
This service uses Azure Web PubSub Service as the real-time transport layer
with CloudEvent-based event handlers.

Flow:
  1. POST /api/voice/negotiate → Web PubSub client access URL
  2. Client connects to Web PubSub directly (WebSocket)
  3. Web PubSub → CloudEvent HTTP callbacks → Backend event handler
  4. Backend ↔ Voice Live ↔ Foundry Agent Service
  5. Backend → Web PubSub REST API (send_to_connection) → Client
"""

import asyncio
import base64
import json
import logging
import os
import time
from typing import Callable, Optional

logger = logging.getLogger(__name__)

_LOCAL_DEV = os.environ.get("LOCAL_DEV", "").lower() in ("1", "true", "yes")

# Hub name for voice sessions
VOICE_HUB = "voice"

# Type alias for content safety callback
ContentSafetyFn = Callable[[str, str], tuple[bool, str]]


# ============================================================================
# Web PubSub Service Client helpers
# ============================================================================

def _get_service_client_sync():
    """Build a synchronous WebPubSubServiceClient.

    Supports Managed Identity (WEBPUBSUB_ENDPOINT) or connection string
    (WEBPUBSUB_CONNECTION_STRING) authentication.
    """
    from azure.messaging.webpubsubservice import WebPubSubServiceClient  # noqa: PLC0415

    endpoint = os.environ.get("WEBPUBSUB_ENDPOINT", "")
    if endpoint:
        from azure.identity import DefaultAzureCredential  # noqa: PLC0415
        return WebPubSubServiceClient(
            endpoint=endpoint,
            hub=VOICE_HUB,
            credential=DefaultAzureCredential(),
        )

    conn_str = os.environ.get("WEBPUBSUB_CONNECTION_STRING", "")
    if conn_str:
        return WebPubSubServiceClient.from_connection_string(
            conn_str, hub=VOICE_HUB
        )

    raise ValueError(
        "Set WEBPUBSUB_ENDPOINT (Managed Identity) or "
        "WEBPUBSUB_CONNECTION_STRING to enable Web PubSub."
    )


def get_client_access_url(user_id: str) -> str:
    """Generate a Web PubSub client access URL with userId claim."""
    logger.info("webpubsub_get_url user=%s", user_id)
    client = _get_service_client_sync()
    # Explicitly grant roles for PubSub subprotocol (json.webpubsub.azure.v1)
    token = client.get_client_access_token(
        user_id=user_id,
        roles=["webpubsub.sendToGroup", "webpubsub.joinLeaveGroup"],
    )
    logger.info("webpubsub_url_ok user=%s", user_id)
    return token["url"]


async def send_to_connection(connection_id: str, message: str) -> None:
    """Send a text message to a specific Web PubSub connection."""
    client = _get_service_client_sync()
    await asyncio.to_thread(
        client.send_to_connection,
        connection_id,
        message,
        content_type="text/plain",
    )


# ============================================================================
# Voice Session — manages a single Voice Live ↔ Web PubSub bridge
# ============================================================================

class VoiceSession:
    """Manages a Voice Live session for a single Web PubSub connection.

    Lifecycle:
      1. start()    — opens Voice Live, configures calm session, starts relay
      2. forward_audio() — called per client audio message
      3. cancel_response() — called on barge-in
      4. stop()     — tears down Voice Live and background task
    """

    def __init__(
        self,
        connection_id: str,
        user_id: str,
        content_safety_fn: Optional[ContentSafetyFn] = None,
        content_safety_fallback: str = "",
    ):
        self.connection_id = connection_id
        self.user_id = user_id
        self.start_time = time.monotonic()
        self._content_safety_fn = content_safety_fn
        self._content_safety_fallback = content_safety_fallback
        self._vl_conn = None
        self._lifecycle_task: Optional[asyncio.Task] = None
        self._ready = asyncio.Event()

    async def start(self) -> None:
        """Start Voice Live session in a background task."""
        logger.info(
            "voice_session_start conn=%s user=%s", self.connection_id, self.user_id,
        )
        self._lifecycle_task = asyncio.create_task(
            self._lifecycle(), name=f"voice-{self.connection_id}"
        )
        try:
            await asyncio.wait_for(self._ready.wait(), timeout=30.0)
            logger.info("voice_session_ready conn=%s", self.connection_id)
        except asyncio.TimeoutError:
            logger.error("voice_session_timeout conn=%s user=%s", self.connection_id, self.user_id)
            await self._send({
                "type": "error",
                "error": {"message": "Voice connection timeout"},
            })
            raise

    async def forward_audio(self, audio_base64: str) -> None:
        """Forward client audio to Voice Live (drop if not ready)."""
        if self._vl_conn and self._ready.is_set():
            await self._vl_conn.input_audio_buffer.append(audio=audio_base64)

    async def cancel_response(self) -> None:
        """Cancel in-progress Voice Live response (barge-in)."""
        if self._vl_conn:
            try:
                await self._vl_conn.response.cancel()
            except Exception:
                pass

    async def stop(self) -> None:
        """Tear down the Voice Live session."""
        if self._lifecycle_task and not self._lifecycle_task.done():
            self._lifecycle_task.cancel()
            try:
                await self._lifecycle_task
            except (asyncio.CancelledError, Exception):
                pass
        duration_s = int(time.monotonic() - self.start_time)
        logger.info(
            "voice_session_end conn=%s user=%s duration_s=%d",
            self.connection_id, self.user_id, duration_s,
        )

    # ── Internal helpers ─────────────────────────────────────────────────

    async def _send(self, message: dict) -> None:
        """Push JSON message to client via Web PubSub."""
        try:
            await send_to_connection(self.connection_id, json.dumps(message))
        except Exception:
            logger.warning("Failed to send to conn=%s", self.connection_id)

    async def _lifecycle(self) -> None:
        """Voice Live connection lifecycle (runs as background task)."""
        from azure.ai.voicelive.aio import connect as voicelive_connect  # noqa: PLC0415
        from azure.ai.voicelive.models import (  # noqa: PLC0415
            ServerEventType,
            MessageItem,
            InputTextContentPart,
        )
        from azure.identity.aio import (  # noqa: PLC0415
            DefaultAzureCredential as AsyncDefaultAzureCredential,
        )
        from agents.speech_agent import (  # noqa: PLC0415
            get_voicelive_agent_config,
            build_calm_session_request,
        )

        voicelive_endpoint = os.environ.get("VOICELIVE_ENDPOINT", "")
        agent_config = get_voicelive_agent_config()

        logger.info(
            "voice_lifecycle_start conn=%s VOICELIVE_ENDPOINT=%s",
            self.connection_id,
            "set" if voicelive_endpoint else "MISSING",
        )

        try:
            async with voicelive_connect(
                endpoint=voicelive_endpoint,
                credential=AsyncDefaultAzureCredential(),
                api_version="2026-01-01-preview",
                agent_config=agent_config,
            ) as vl_conn:
                self._vl_conn = vl_conn

                # Configure calm voice session (SSML-equivalent settings)
                calm_session = build_calm_session_request()
                await vl_conn.session.update(session=calm_session)

                self._ready.set()
                await self._send({"type": "ready", "userId": self.user_id})

                # Proactive calm greeting
                try:
                    await vl_conn.conversation.item.create(
                        item=MessageItem(
                            role="system",
                            content=[
                                InputTextContentPart(
                                    text="Welcome the user warmly in English. "
                                         "Use a calm, reassuring tone."
                                )
                            ],
                        )
                    )
                    await vl_conn.response.create()
                except Exception:
                    logger.warning(
                        "Failed to send greeting conn=%s", self.connection_id
                    )

                # Relay Voice Live events → client
                async for event in vl_conn:
                    await self._handle_event(event, ServerEventType)

        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception(
                "Voice Live error conn=%s user=%s",
                self.connection_id, self.user_id,
            )
            await self._send({
                "type": "error",
                "error": {"message": "Voice session ended unexpectedly."},
            })

    async def _handle_event(self, event, ServerEventType) -> None:
        """Map Voice Live server events to client-facing JSON messages."""
        if event.type == ServerEventType.SESSION_UPDATED:
            await self._send({"type": "session.updated"})

        elif event.type == ServerEventType.RESPONSE_AUDIO_DELTA:
            delta = event.delta
            if isinstance(delta, (bytes, bytearray)):
                delta = base64.b64encode(delta).decode("ascii")
            await self._send({"type": "response.audio.delta", "delta": delta})

        elif event.type == ServerEventType.RESPONSE_AUDIO_TRANSCRIPT_DONE:
            transcript = event.get("transcript", "")
            if self._content_safety_fn:
                is_safe, reason = await asyncio.to_thread(
                    self._content_safety_fn, transcript, self.user_id
                )
                if not is_safe:
                    logger.warning(
                        "voice_transcript_blocked conn=%s reason=%s",
                        self.connection_id, reason,
                    )
                    transcript = self._content_safety_fallback
            await self._send({
                "type": "response.audio_transcript.done",
                "transcript": transcript,
            })

        elif event.type == ServerEventType.CONVERSATION_ITEM_INPUT_AUDIO_TRANSCRIPTION_COMPLETED:
            await self._send({
                "type": "conversation.item.input_audio_transcription.completed",
                "transcript": event.get("transcript", ""),
            })

        elif event.type == ServerEventType.INPUT_AUDIO_BUFFER_SPEECH_STARTED:
            await self._send({"type": "input_audio_buffer.speech_started"})

        elif event.type == ServerEventType.INPUT_AUDIO_BUFFER_SPEECH_STOPPED:
            await self._send({"type": "input_audio_buffer.speech_stopped"})

        elif event.type == ServerEventType.RESPONSE_CREATED:
            await self._send({"type": "response.created"})

        elif event.type == ServerEventType.RESPONSE_AUDIO_DONE:
            await self._send({"type": "response.audio.done"})

        elif event.type == ServerEventType.RESPONSE_DONE:
            await self._send({"type": "response.done"})

        elif event.type == ServerEventType.ERROR:
            msg = getattr(event.error, "message", str(event))
            if "no active response" not in msg.lower():
                logger.error(
                    "voicelive_error conn=%s msg=%s", self.connection_id, msg
                )
                await self._send({"type": "error", "error": {"message": msg}})


# ============================================================================
# Session store (in-memory, per Container App instance)
# ============================================================================

_sessions: dict[str, VoiceSession] = {}


def get_session(connection_id: str) -> Optional[VoiceSession]:
    """Get active voice session by Web PubSub connection ID."""
    return _sessions.get(connection_id)


async def start_session(
    connection_id: str,
    user_id: str,
    content_safety_fn: Optional[ContentSafetyFn] = None,
    content_safety_fallback: str = "",
) -> VoiceSession:
    """Create and start a new voice session."""
    session = VoiceSession(
        connection_id=connection_id,
        user_id=user_id,
        content_safety_fn=content_safety_fn,
        content_safety_fallback=content_safety_fallback,
    )
    _sessions[connection_id] = session
    await session.start()
    return session


async def stop_session(connection_id: str) -> None:
    """Stop and remove a voice session."""
    session = _sessions.pop(connection_id, None)
    if session:
        await session.stop()
