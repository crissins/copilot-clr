"""
Azure Functions Chat API — Main Entry Point

HTTP Triggers:
  POST /api/chat           — Send a message, get agent response
  GET  /api/sessions       — List user's chat sessions
  POST /api/sessions       — Create a new chat session
  GET  /api/sessions/{id}  — Get session with messages
  DELETE /api/sessions/{id} — Delete a session
  GET  /api/health         — Health check
"""

import json
import logging
import os
import uuid
from datetime import datetime, timezone

import azure.functions as func
from azure.identity import DefaultAzureCredential
from azure.cosmos import CosmosClient

from agents.chat_agent import get_agent_response
from auth.entra import validate_token, AuthError

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# ============================================================================
# Shared clients (initialized once, reused across invocations)
# ============================================================================

credential = DefaultAzureCredential()

cosmos_client = CosmosClient(
    url=os.environ["COSMOS_DB_ENDPOINT"],
    credential=credential,
)
database = cosmos_client.get_database_client(os.environ["COSMOS_DB_DATABASE"])
sessions_container = database.get_container_client("sessions")
messages_container = database.get_container_client("messages")


def get_user_id(req: func.HttpRequest) -> str:
    """Extract and validate user ID from Entra ID token."""
    client_id = os.environ.get("ENTRA_CLIENT_ID", "")
    if not client_id:
        # Dev mode: allow anonymous with a default user
        return req.headers.get("X-User-Id", "anonymous")

    auth_header = req.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise AuthError("Missing or invalid Authorization header")

    token = auth_header[7:]
    claims = validate_token(token, client_id)
    return claims.get("oid", claims.get("sub", "unknown"))


# ============================================================================
# POST /api/chat — Send message, get agent response
# ============================================================================
@app.route(route="chat", methods=["POST"])
async def chat(req: func.HttpRequest) -> func.HttpResponse:
    try:
        user_id = get_user_id(req)
    except AuthError as e:
        return func.HttpResponse(json.dumps({"error": str(e)}), status_code=401,
                                 mimetype="application/json")

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(json.dumps({"error": "Invalid JSON"}),
                                 status_code=400, mimetype="application/json")

    message = body.get("message", "").strip()
    session_id = body.get("sessionId", "")

    if not message:
        return func.HttpResponse(json.dumps({"error": "Message is required"}),
                                 status_code=400, mimetype="application/json")

    # Create session if not provided
    if not session_id:
        session_id = str(uuid.uuid4())
        session_doc = {
            "id": session_id,
            "userId": user_id,
            "title": message[:50],
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }
        sessions_container.upsert_item(session_doc)

    # Store user message
    user_msg_doc = {
        "id": str(uuid.uuid4()),
        "sessionId": session_id,
        "role": "user",
        "content": message,
        "userId": user_id,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    messages_container.upsert_item(user_msg_doc)

    # Get agent response
    try:
        agent_response = await get_agent_response(
            message=message,
            session_id=session_id,
            user_id=user_id,
        )
    except Exception as e:
        logging.exception("Agent error")
        agent_response = "I'm sorry, I encountered an error processing your request. Please try again."

    # Store assistant message
    assistant_msg_doc = {
        "id": str(uuid.uuid4()),
        "sessionId": session_id,
        "role": "assistant",
        "content": agent_response,
        "userId": user_id,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    messages_container.upsert_item(assistant_msg_doc)

    # Update session timestamp — patch to avoid overwriting title/createdAt
    sessions_container.patch_item(
        item=session_id,
        partition_key=user_id,
        patch_operations=[{
            "op": "replace",
            "path": "/updatedAt",
            "value": datetime.now(timezone.utc).isoformat(),
        }],
    )

    return func.HttpResponse(
        json.dumps({
            "sessionId": session_id,
            "message": {
                "id": assistant_msg_doc["id"],
                "role": "assistant",
                "content": agent_response,
                "createdAt": assistant_msg_doc["createdAt"],
            },
        }),
        mimetype="application/json",
    )


# ============================================================================
# GET /api/sessions — List user's sessions
# ============================================================================
@app.route(route="sessions", methods=["GET"])
def list_sessions(req: func.HttpRequest) -> func.HttpResponse:
    try:
        user_id = get_user_id(req)
    except AuthError as e:
        return func.HttpResponse(json.dumps({"error": str(e)}), status_code=401,
                                 mimetype="application/json")

    sessions = list(sessions_container.query_items(
        query="SELECT * FROM c WHERE c.userId = @userId ORDER BY c.updatedAt DESC",
        parameters=[{"name": "@userId", "value": user_id}],
        enable_cross_partition_query=False,
    ))

    # Strip Cosmos metadata
    cleaned = [
        {k: v for k, v in s.items() if not k.startswith("_")}
        for s in sessions
    ]

    return func.HttpResponse(json.dumps({"sessions": cleaned}),
                             mimetype="application/json")


# ============================================================================
# POST /api/sessions — Create a new session
# ============================================================================
@app.route(route="sessions", methods=["POST"])
def create_session(req: func.HttpRequest) -> func.HttpResponse:
    try:
        user_id = get_user_id(req)
    except AuthError as e:
        return func.HttpResponse(json.dumps({"error": str(e)}), status_code=401,
                                 mimetype="application/json")

    try:
        body = req.get_json()
    except ValueError:
        body = {}

    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    session_doc = {
        "id": session_id,
        "userId": user_id,
        "title": body.get("title", "New Chat"),
        "createdAt": now,
        "updatedAt": now,
    }
    sessions_container.upsert_item(session_doc)

    return func.HttpResponse(json.dumps(session_doc), status_code=201,
                             mimetype="application/json")


# ============================================================================
# GET /api/sessions/{sessionId} — Get session with messages
# ============================================================================
@app.route(route="sessions/{sessionId}", methods=["GET"])
def get_session(req: func.HttpRequest) -> func.HttpResponse:
    try:
        user_id = get_user_id(req)
    except AuthError as e:
        return func.HttpResponse(json.dumps({"error": str(e)}), status_code=401,
                                 mimetype="application/json")

    session_id = req.route_params.get("sessionId", "")

    # Verify session belongs to user
    try:
        session = sessions_container.read_item(item=session_id, partition_key=user_id)
    except Exception:
        return func.HttpResponse(json.dumps({"error": "Session not found"}),
                                 status_code=404, mimetype="application/json")

    # Get messages
    messages = list(messages_container.query_items(
        query="SELECT * FROM c WHERE c.sessionId = @sessionId ORDER BY c.createdAt ASC",
        parameters=[{"name": "@sessionId", "value": session_id}],
        enable_cross_partition_query=False,
    ))

    cleaned_messages = [
        {k: v for k, v in m.items() if not k.startswith("_")}
        for m in messages
    ]

    session_clean = {k: v for k, v in session.items() if not k.startswith("_")}

    return func.HttpResponse(
        json.dumps({"session": session_clean, "messages": cleaned_messages}),
        mimetype="application/json",
    )


# ============================================================================
# DELETE /api/sessions/{sessionId} — Delete a session and its messages
# ============================================================================
@app.route(route="sessions/{sessionId}", methods=["DELETE"])
def delete_session(req: func.HttpRequest) -> func.HttpResponse:
    try:
        user_id = get_user_id(req)
    except AuthError as e:
        return func.HttpResponse(json.dumps({"error": str(e)}), status_code=401,
                                 mimetype="application/json")

    session_id = req.route_params.get("sessionId", "")

    # Verify ownership then delete
    try:
        sessions_container.delete_item(item=session_id, partition_key=user_id)
    except Exception:
        return func.HttpResponse(json.dumps({"error": "Session not found"}),
                                 status_code=404, mimetype="application/json")

    # Delete associated messages
    messages = list(messages_container.query_items(
        query="SELECT c.id FROM c WHERE c.sessionId = @sessionId",
        parameters=[{"name": "@sessionId", "value": session_id}],
        enable_cross_partition_query=False,
    ))
    for msg in messages:
        try:
            messages_container.delete_item(item=msg["id"], partition_key=session_id)
        except Exception:
            pass  # Best effort cleanup

    return func.HttpResponse(status_code=204)


# ============================================================================
# GET /api/health — Health check
# ============================================================================
@app.route(route="health", methods=["GET"])
def health(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps({
            "status": "healthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "version": "1.0.0",
        }),
        mimetype="application/json",
    )
