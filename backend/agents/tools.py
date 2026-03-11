"""
Custom Agent Tools

Define custom function tools that the agent can invoke.
These extend the Agent Framework's built-in tools (code_interpreter, file_search).
"""

import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def get_current_time() -> str:
    """Returns the current UTC time. Useful when the user asks about the current date or time."""
    return json.dumps({
        "utc_time": datetime.now(timezone.utc).isoformat(),
        "timezone": "UTC",
    })


def search_knowledge_base(query: str) -> str:
    """
    Search the knowledge base for relevant documents.
    This is a placeholder — will be connected to Azure AI Search.
    """
    # TODO: Integrate with Azure AI Search when index is populated
    logger.info(f"Knowledge base search: {query}")
    return json.dumps({
        "results": [],
        "message": "Knowledge base search is not yet configured. Please upload documents first.",
    })


# Registry of custom tools for the agent
CUSTOM_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_current_time",
            "description": "Returns the current UTC date and time",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_knowledge_base",
            "description": "Search the knowledge base for relevant information about a topic",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query",
                    },
                },
                "required": ["query"],
            },
        },
    },
]

# Map function names to callables
TOOL_FUNCTIONS = {
    "get_current_time": lambda **_: get_current_time(),
    "search_knowledge_base": lambda query="", **_: search_knowledge_base(query),
}
