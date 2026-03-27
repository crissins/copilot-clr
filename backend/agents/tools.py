"""
Custom Agent Tools

FIX: search_knowledge_base() now calls Azure AI Search via the
     azure-search-documents SDK instead of returning an empty placeholder.
     Reads AZURE_SEARCH_ENDPOINT and AZURE_SEARCH_INDEX_NAME from env.
     Uses DefaultAzureCredential (Managed Identity) — no API key in code.
"""

import json
import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


# ============================================================================
# Tool: get_current_time
# ============================================================================

def get_current_time() -> str:
    """Returns the current UTC time."""
    return json.dumps({
        "utc_time": datetime.now(timezone.utc).isoformat(),
        "timezone": "UTC",
    })


# ============================================================================
# Tool: search_knowledge_base  (FIX — was empty stub)
# ============================================================================

def _build_search_client():
    """Build an Azure AI Search client using Managed Identity."""
    from azure.search.documents import SearchClient  # noqa: PLC0415
    from azure.identity import DefaultAzureCredential  # noqa: PLC0415

    endpoint = os.environ.get("AZURE_SEARCH_ENDPOINT", "")
    index_name = os.environ.get("AZURE_SEARCH_INDEX_NAME", "documents")

    if not endpoint:
        return None, index_name

    client = SearchClient(
        endpoint=endpoint,
        index_name=index_name,
        credential=DefaultAzureCredential(),
    )
    return client, index_name


def search_knowledge_base(query: str, reading_level: str = "", user_id: str = "") -> str:
    """Search indexed documents for content relevant to the query.

    Args:
        query:         Natural language search query from the agent.
        reading_level: Optional reading level filter (e.g. "5" for Grade 5).
                       When provided, prefers chunks tagged at that level.
        user_id:       Optional user ID to scope results to a specific user.

    Returns:
        JSON string with list of matching chunks.
    """
    logger.info("Knowledge base search: %r (reading_level=%r, user_id=%r)", query, reading_level, user_id)

    search_client, index_name = _build_search_client()

    if search_client is None:
        logger.warning("AZURE_SEARCH_ENDPOINT not configured — returning empty results")
        return json.dumps({
            "results": [],
            "message": (
                "The knowledge base is not yet configured. "
                "Please upload a document first and wait for it to finish processing."
            ),
        })

    try:
        # Build optional OData filter
        filters = []
        if user_id:
            filters.append(f"userId eq '{user_id}'")
        if reading_level:
            try:
                import re
                m = re.search(r"(\d+)", str(reading_level))
                if m:
                    level = int(m.group(1))
                    filters.append(f"readingLevel ge {max(1, level - 1)} and readingLevel le {level + 1}")
            except (ValueError, TypeError):
                pass

        odata_filter = " and ".join(filters) if filters else None

        # Hybrid search: keyword (BM25) + vector semantic (if semantic ranker enabled)
        search_kwargs: dict = {
            "search_text": query,
            "select": ["content", "source", "pageNumber", "chunkIndex", "readingLevel", "documentId"],
            "top": 5,
        }
        if odata_filter:
            search_kwargs["filter"] = odata_filter

        results = list(search_client.search(**search_kwargs))

        if not results:
            return json.dumps({
                "results": [],
                "message": "No relevant documents found for this query. Try rephrasing or upload a related document.",
            })

        formatted = []
        for r in results:
            formatted.append({
                "content": r.get("content", ""),
                "source": r.get("source", "Unknown document"),
                "pageNumber": r.get("pageNumber"),
                "readingLevel": r.get("readingLevel"),
                "documentId": r.get("documentId"),
            })

        return json.dumps({
            "results": formatted,
            "count": len(formatted),
            "query": query,
        })

    except Exception:
        logger.exception("Azure AI Search query failed for query=%r", query)
        return json.dumps({
            "results": [],
            "message": "Document search is temporarily unavailable. Please try again.",
        })


# ============================================================================
# Tool: simplify_text
# ============================================================================

def simplify_text(text: str, reading_level: int = 5) -> str:
    """Placeholder — the agent can call this to request simplification.
    
    In practice the agent rewrites inline; this is registered so the
    agent has an explicit tool to cite simplification choices.
    """
    return json.dumps({
        "original_length": len(text),
        "requested_level": reading_level,
        "status": "Agent should rewrite the text inline at the requested reading level.",
    })


# ============================================================================
# Tool registry
# ============================================================================

CUSTOM_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_current_time",
            "description": "Returns the current UTC date and time",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_knowledge_base",
            "description": (
                "Search the user's uploaded documents for information relevant to a query. "
                "Always use this when the user asks a question that could be answered by "
                "their uploaded files, PDFs, audio transcripts, or videos."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query — phrase as a natural language question",
                    },
                    "reading_level": {
                        "type": "string",
                        "description": (
                            "Optional. Preferred reading grade level (1–12). "
                            "Filters results to chunks matching the user's accessibility preference."
                        ),
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "simplify_text",
            "description": "Request simplification of a passage to a target reading level",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "The text to simplify"},
                    "reading_level": {
                        "type": "integer",
                        "description": "Target grade level (1–12)",
                    },
                },
                "required": ["text"],
            },
        },
    },
]

TOOL_FUNCTIONS = {
    "get_current_time": lambda **_: get_current_time(),
    "search_knowledge_base": lambda query="", reading_level="", **_: search_knowledge_base(query, reading_level),
    "simplify_text": lambda text="", reading_level=5, **_: simplify_text(text, reading_level),
}
