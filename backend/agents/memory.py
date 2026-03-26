"""
Memory & Persistence Providers for the Agent Framework.

Provides:
  - UserMemoryProvider: Extracts/injects user info (name, etc.) to/from session state.
  - CosmosDBHistoryProvider: Persists conversation history to Cosmos DB 'messages' container.
"""

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional

from agent_framework import (
    BaseContextProvider,
    BaseHistoryProvider,
    Message,
    SessionContext,
)

from agents.agent_tools import get_messages_container

logger = logging.getLogger(__name__)


class UserMemoryProvider(BaseContextProvider):
    """A context provider that remembers user info in session state."""

    DEFAULT_SOURCE_ID = "user_memory"

    def __init__(self):
        super().__init__(self.DEFAULT_SOURCE_ID)

    async def before_run(
        self,
        *,
        agent: Any,
        session: Any | None,
        context: SessionContext,
        state: dict[str, Any],
    ) -> None:
        """Inject personalization instructions based on stored user info."""
        user_name = state.get("user_name")
        if user_name:
            context.extend_instructions(
                self.source_id,
                f"The user's name is {user_name}. Always address them by name.",
            )
        else:
            context.extend_instructions(
                self.source_id,
                "You don't know the user's name yet. Ask for it politely if it feels natural.",
            )

    async def after_run(
        self,
        *,
        agent: Any,
        session: Any | None,
        context: SessionContext,
        state: dict[str, Any],
    ) -> None:
        """Extract and store user info in session state after each call."""
        # Check input messages for self-introductions
        for msg in context.input_messages:
            text = msg.content if hasattr(msg, "content") else ""
            if isinstance(text, str) and "my name is" in text.lower():
                name_part = text.lower().split("my name is")[-1].strip()
                if name_part:
                    state["user_name"] = name_part.split()[0].capitalize()


class CosmosDBHistoryProvider(BaseHistoryProvider):
    """A history provider that persists messages to Cosmos DB."""

    DEFAULT_SOURCE_ID = "cosmos_history"

    def __init__(self, session_id: str, user_id: str, load_messages: bool = True):
        super().__init__(self.DEFAULT_SOURCE_ID, load_messages=load_messages)
        self.session_id = session_id
        self.user_id = user_id

    async def get_messages(self, session_id: str | None = None, **kwargs) -> List[Message]:
        """Load recent messages for this session from Cosmos DB."""
        container = get_messages_container()
        if not container:
            return []

        try:
            # Query the last 20 messages for context
            query = (
                "SELECT TOP 20 * FROM c "
                "WHERE c.sessionId = @sid ORDER BY c.createdAt DESC"
            )
            items = await asyncio.to_thread(
                lambda: list(container.query_items(
                    query=query,
                    parameters=[{"name": "@sid", "value": self.session_id}],
                    enable_cross_partition_query=False,
                ))
            )
            
            # Framework expects oldest first
            messages = []
            for item in reversed(items):
                role = item.get("role", "user")
                content = item.get("content", "")
                messages.append(Message(role=role, content=content))
            
            return messages
        except Exception:
            logger.exception("Failed to load history from Cosmos DB for session=%s", self.session_id)
            return []

    async def save_messages(self, session_id: str | None = None, messages: list[Message] | None = None, **kwargs) -> None:
        """Store new messages into Cosmos DB."""
        if not messages:
            return
        container = get_messages_container()
        if not container:
            return

        for msg in messages:
            try:
                # Avoid duplicates by checking if we already saved this message if necessary,
                # but usually we can just upsert.
                doc = {
                    "id": str(uuid.uuid4()),
                    "sessionId": self.session_id,
                    "userId": self.user_id,
                    "role": msg.role,
                    "content": msg.content,
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                }
                await asyncio.to_thread(container.upsert_item, doc)
            except Exception:
                logger.exception("Failed to store message to Cosmos DB for session=%s", self.session_id)
