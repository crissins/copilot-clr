"""
Agent Tools — Copilot CLR Sequential Workflow

Provides tool functions for the Agent Framework workflow:
  - search_documents : Search uploaded documents via Azure AI Search
  - search_web       : Search the web via Bing Search API
  - create_task / list_tasks / update_task / delete_task : CosmosDB task CRUD
  - get_chat_history  : Retrieve previous messages from a session

User identity is passed via contextvars so tool signatures stay clean
for the Agent Framework SDK's schema introspection.
"""

import contextvars
import json
import logging
import os
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ============================================================================
# Async-safe context for user identity (set before each agent run)
# ============================================================================

_user_id_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "tool_user_id", default=""
)
_session_id_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "tool_session_id", default=""
)


def set_tool_context(user_id: str, session_id: str) -> None:
    """Set user/session context for tool functions. Call before running the agent."""
    _user_id_var.set(user_id)
    _session_id_var.set(session_id)


# ============================================================================
# Cosmos DB — lazy singleton container clients
# ============================================================================

_tasks_container = None
_messages_container = None
_preferences_container = None


def _get_cosmos_db():
    """Return a Cosmos DB database client, or None if not configured."""
    endpoint = os.environ.get("COSMOS_DB_ENDPOINT", "")
    if not endpoint:
        return None
    from azure.cosmos import CosmosClient  # noqa: PLC0415
    from azure.identity import DefaultAzureCredential  # noqa: PLC0415

    return CosmosClient(
        url=endpoint, credential=DefaultAzureCredential()
    ).get_database_client(os.environ.get("COSMOS_DB_DATABASE", "ChatApp"))


def get_tasks_container():
    global _tasks_container
    if _tasks_container is not None:
        return _tasks_container
    db = _get_cosmos_db()
    if db is None:
        return None
    _tasks_container = db.get_container_client("tasks")
    return _tasks_container


def get_messages_container():
    global _messages_container
    if _messages_container is not None:
        return _messages_container
    db = _get_cosmos_db()
    if db is None:
        return None
    _messages_container = db.get_container_client("messages")
    return _messages_container


def get_preferences_container():
    global _preferences_container
    if _preferences_container is not None:
        return _preferences_container
    db = _get_cosmos_db()
    if db is None:
        return None
    _preferences_container = db.get_container_client("preferences")
    return _preferences_container


# ============================================================================
# Tool: search_documents  (delegates to existing Azure AI Search wrapper)
# ============================================================================

def search_documents(query: str) -> str:
    """Search the user's uploaded documents and files for relevant information.

    Use this when the user asks about content from their uploaded PDFs,
    documents, audio transcripts, or videos.
    """
    from agents.tools import search_knowledge_base  # noqa: PLC0415

    user_id = _user_id_var.get("")
    return search_knowledge_base(query, user_id=user_id)


# ============================================================================
# Tool: search_web  (Bing Search API)
# ============================================================================

def search_web(query: str) -> str:
    """Search the web for current information, news, or facts not found in
    the user's uploaded documents. Use when the user asks about external
    topics, current events, or general knowledge."""
    import requests as _requests  # noqa: PLC0415

    api_key = os.environ.get("BING_SEARCH_API_KEY", "")
    if not api_key:
        return json.dumps({
            "results": [],
            "message": (
                "Web search is not configured. "
                "Please ask your administrator to set BING_SEARCH_API_KEY."
            ),
        })

    endpoint = os.environ.get(
        "BING_SEARCH_ENDPOINT",
        "https://api.bing.microsoft.com/v7.0/search",
    )
    try:
        resp = _requests.get(
            endpoint,
            headers={"Ocp-Apim-Subscription-Key": api_key},
            params={"q": query, "count": 5, "textFormat": "Raw"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        results = [
            {
                "title": p.get("name", ""),
                "url": p.get("url", ""),
                "snippet": p.get("snippet", ""),
            }
            for p in data.get("webPages", {}).get("value", [])
        ]
        return json.dumps({"results": results, "count": len(results), "query": query})
    except Exception:
        logger.exception("Web search failed for query=%r", query)
        return json.dumps({
            "results": [],
            "message": "Web search is temporarily unavailable.",
        })


# ============================================================================
# Tool: create_task
# ============================================================================

def create_task(
    title: str,
    description: str = "",
    priority: str = "medium",
    due_date: str = "",
) -> str:
    """Create a new task for the user. Use when the user asks to add, create,
    or remember a task, to-do item, or reminder."""
    user_id = _user_id_var.get()
    container = get_tasks_container()
    if container is None:
        return json.dumps({"error": "Task storage is not configured."})

    task = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "title": title,
        "description": description,
        "priority": priority,
        "status": "pending",
        "dueDate": due_date,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    container.upsert_item(task)
    clean = {k: v for k, v in task.items() if not k.startswith("_")}
    return json.dumps({
        "task": clean,
        "message": f"Task '{title}' created successfully.",
    })


# ============================================================================
# Tool: list_tasks
# ============================================================================

def list_tasks(status_filter: str = "") -> str:
    """List the user's tasks. Optionally filter by status: pending, in_progress,
    completed, or cancelled."""
    user_id = _user_id_var.get()
    container = get_tasks_container()
    if container is None:
        return json.dumps({"tasks": [], "message": "Task storage is not configured."})

    query = "SELECT * FROM c WHERE c.userId = @userId"
    params: list[dict] = [{"name": "@userId", "value": user_id}]

    if status_filter:
        query += " AND c.status = @status"
        params.append({"name": "@status", "value": status_filter})

    query += " ORDER BY c.createdAt DESC"

    try:
        tasks = list(container.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=False,
        ))
        clean = [
            {k: v for k, v in t.items() if not k.startswith("_")}
            for t in tasks
        ]
        return json.dumps({"tasks": clean, "count": len(clean)})
    except Exception:
        logger.exception("Failed to list tasks for user=%s", user_id)
        return json.dumps({"tasks": [], "message": "Could not retrieve tasks."})


# ============================================================================
# Tool: update_task
# ============================================================================

def update_task(
    task_id: str,
    title: str = "",
    description: str = "",
    status: str = "",
    priority: str = "",
    due_date: str = "",
) -> str:
    """Update an existing task. Provide the task_id and any fields to change.
    Valid statuses: pending, in_progress, completed, cancelled."""
    user_id = _user_id_var.get()
    container = get_tasks_container()
    if container is None:
        return json.dumps({"error": "Task storage is not configured."})

    try:
        task = container.read_item(item=task_id, partition_key=user_id)
    except Exception:
        return json.dumps({"error": f"Task '{task_id}' not found."})

    if title:
        task["title"] = title
    if description:
        task["description"] = description
    if status:
        task["status"] = status
    if priority:
        task["priority"] = priority
    if due_date:
        task["dueDate"] = due_date
    task["updatedAt"] = datetime.now(timezone.utc).isoformat()

    container.upsert_item(task)
    clean = {k: v for k, v in task.items() if not k.startswith("_")}
    return json.dumps({"task": clean, "message": "Task updated successfully."})


# ============================================================================
# Tool: delete_task
# ============================================================================

def delete_task(task_id: str) -> str:
    """Delete a task by its ID."""
    user_id = _user_id_var.get()
    container = get_tasks_container()
    if container is None:
        return json.dumps({"error": "Task storage is not configured."})

    try:
        container.delete_item(item=task_id, partition_key=user_id)
        return json.dumps({"message": f"Task '{task_id}' deleted successfully."})
    except Exception:
        return json.dumps({"error": f"Task '{task_id}' not found."})


# ============================================================================
# Tool: get_chat_history
# ============================================================================

def get_chat_history(limit: int = 10) -> str:
    """Retrieve recent chat messages from the current session. Use when the
    user references something said earlier in the conversation."""
    session_id = _session_id_var.get()
    container = get_messages_container()
    if container is None:
        return json.dumps({
            "messages": [],
            "message": "Chat history is not available.",
        })

    try:
        messages = list(container.query_items(
            query=(
                "SELECT TOP @limit * FROM c "
                "WHERE c.sessionId = @sid ORDER BY c.createdAt DESC"
            ),
            parameters=[
                {"name": "@sid", "value": session_id},
                {"name": "@limit", "value": limit},
            ],
            enable_cross_partition_query=False,
        ))
        clean = [
            {
                "role": m.get("role", ""),
                "content": m.get("content", ""),
                "createdAt": m.get("createdAt", ""),
            }
            for m in reversed(messages)
        ]
        return json.dumps({"messages": clean, "count": len(clean)})
    except Exception:
        logger.exception("Failed to get chat history for session=%s", session_id)
        return json.dumps({
            "messages": [],
            "message": "Could not retrieve chat history.",
        })


# ============================================================================
# Tool: decompose_goal  (Task Decomposer agent)
# ============================================================================

def decompose_goal(goal: str, reading_level: str = "") -> str:
    """Break down a complex goal into clear, numbered, time-boxed sub-tasks.

    Use this when the user asks to break down, decompose, plan, or split a
    complex task, project, or goal into smaller steps. Returns structured
    steps with estimated duration, priority, and focus tips designed for
    neurodiverse users.

    The plan is automatically saved so the user can come back to it later,
    toggle step completion, or set reminders on individual steps.
    """
    import asyncio as _asyncio  # noqa: PLC0415
    from agents.task_decomposer import decompose_task  # noqa: PLC0415

    user_id = _user_id_var.get()

    try:
        result = _asyncio.get_event_loop().run_until_complete(
            decompose_task(goal=goal, user_id=user_id, reading_level=reading_level)
        )
    except RuntimeError:
        # If there's already a running loop, use asyncio.run in a thread
        import concurrent.futures  # noqa: PLC0415

        with concurrent.futures.ThreadPoolExecutor() as pool:
            result = pool.submit(
                _asyncio.run,
                decompose_task(goal=goal, user_id=user_id, reading_level=reading_level),
            ).result()

    # Persist the task plan to Cosmos DB so the user can access it later
    container = get_tasks_container()
    task_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

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

    if container:
        try:
            container.upsert_item(task_doc)
            logger.info("task_plan_saved id=%s user=%s goal=%r", task_id, user_id, goal[:60])
        except Exception:
            logger.exception("Failed to save task plan for user=%s", user_id)

    result["taskPlanId"] = task_id
    result["message"] = (
        f"I've broken down your goal into {len(result.get('steps', []))} steps "
        f"and saved the plan. You can find it in your Task Plans anytime. "
        f"Would you like me to send this plan to your email as a reminder?"
    )
    return json.dumps(result)


# ============================================================================
# Tool: list_task_plans  (Cosmos DB)
# ============================================================================

def list_task_plans() -> str:
    """List the user's saved task plans (goal decompositions). Use this when
    the user asks to see their previous task plans, decompositions, or wants
    to review a plan they created earlier."""
    user_id = _user_id_var.get()
    container = get_tasks_container()
    if container is None:
        return json.dumps({"plans": [], "message": "Task storage is not configured."})

    try:
        plans = list(container.query_items(
            query=(
                "SELECT c.id, c.goal, c.createdAt, c.updatedAt, "
                "ARRAY_LENGTH(c.steps) AS stepCount "
                "FROM c WHERE c.userId = @userId AND IS_DEFINED(c.goal) "
                "ORDER BY c.createdAt DESC"
            ),
            parameters=[{"name": "@userId", "value": user_id}],
            enable_cross_partition_query=False,
        ))
        return json.dumps({"plans": plans, "count": len(plans)})
    except Exception:
        logger.exception("Failed to list task plans for user=%s", user_id)
        return json.dumps({"plans": [], "message": "Could not retrieve task plans."})


# ============================================================================
# Tool: get_task_plan  (Cosmos DB)
# ============================================================================

def get_task_plan(task_plan_id: str) -> str:
    """Retrieve a specific saved task plan by its ID, including all steps and
    their completion status. Use this when the user wants details about a
    specific plan or to check progress on their steps."""
    user_id = _user_id_var.get()
    container = get_tasks_container()
    if container is None:
        return json.dumps({"error": "Task storage is not configured."})

    try:
        doc = container.read_item(item=task_plan_id, partition_key=user_id)
        clean = {k: v for k, v in doc.items() if not k.startswith("_")}
        return json.dumps({"plan": clean})
    except Exception:
        return json.dumps({"error": f"Task plan '{task_plan_id}' not found."})


# ============================================================================
# Tool: send_reminder_email  (Azure Communication Services)
# ============================================================================

def send_reminder_email(
    subject: str,
    body: str,
    recipient_email: str = "",
) -> str:
    """Send a friendly reminder or task-plan email to the user via Azure Communication Services.

    Use this when the user asks you to set a reminder, send an email summary,
    or share a task plan via email. You write the subject and body — make
    them warm, clear, and supportive. Use markdown in the body; it will be
    converted to simple HTML automatically.

    If recipient_email is not provided, the tool will look up the user's
    email from their saved preferences.
    """
    import asyncio as _asyncio  # noqa: PLC0415

    user_id = _user_id_var.get()

    # Resolve recipient email
    email = recipient_email.strip() if recipient_email else ""
    if not email:
        try:
            container = get_preferences_container()
            if container:
                prefs = container.read_item(item=user_id, partition_key=user_id)
                email = prefs.get("email", "")
        except Exception:
            logger.debug("Could not load preferences for user=%s", user_id)

    if not email:
        return json.dumps({
            "status": "error",
            "message": (
                "I don't have an email address on file for you. "
                "Please provide one or save it in your profile settings."
            ),
        })

    # Convert markdown-ish body to simple HTML
    html_body = _markdown_to_html(body)

    # Send via ACS
    try:
        from services.notifications import send_email_reminder  # noqa: PLC0415

        try:
            loop = _asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            import concurrent.futures  # noqa: PLC0415
            with concurrent.futures.ThreadPoolExecutor() as pool:
                result = pool.submit(
                    _asyncio.run,
                    send_email_reminder(
                        recipient_email=email,
                        subject=subject,
                        body=body,
                        user_id=user_id,
                        html_body=html_body,
                    ),
                ).result()
        else:
            result = _asyncio.run(
                send_email_reminder(
                    recipient_email=email,
                    subject=subject,
                    body=body,
                    user_id=user_id,
                    html_body=html_body,
                )
            )

        return json.dumps({
            "status": result.get("status", "unknown"),
            "message": f"Email sent to {email} with subject: {subject}",
            "recipient": email,
        })
    except Exception:
        logger.exception("send_reminder_email failed for user=%s", user_id)
        return json.dumps({
            "status": "error",
            "message": "Failed to send the email. Please try again later.",
        })


def _markdown_to_html(text: str) -> str:
    """Convert simple markdown text to an HTML email body with friendly styling."""
    import re  # noqa: PLC0415

    lines = text.split("\n")
    html_lines: list[str] = []
    in_list = False

    for line in lines:
        stripped = line.strip()

        # Headings
        if stripped.startswith("### "):
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            html_lines.append(
                f'<h3 style="color:#0078d4;margin:16px 0 8px 0;">{stripped[4:]}</h3>'
            )
        elif stripped.startswith("## "):
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            html_lines.append(
                f'<h2 style="color:#0078d4;margin:18px 0 8px 0;">{stripped[3:]}</h2>'
            )
        elif stripped.startswith("# "):
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            html_lines.append(
                f'<h1 style="color:#0078d4;margin:20px 0 10px 0;">{stripped[2:]}</h1>'
            )
        # Bullet points
        elif stripped.startswith("- ") or stripped.startswith("* "):
            if not in_list:
                html_lines.append('<ul style="padding-left:20px;margin:8px 0;">')
                in_list = True
            html_lines.append(f"<li>{stripped[2:]}</li>")
        # Numbered lists
        elif re.match(r"^\d+\.\s", stripped):
            content = re.sub(r"^\d+\.\s", "", stripped)
            if not in_list:
                html_lines.append('<ul style="padding-left:20px;margin:8px 0;">')
                in_list = True
            html_lines.append(f"<li>{content}</li>")
        # Empty line
        elif not stripped:
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            html_lines.append("<br/>")
        # Regular paragraph
        else:
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            html_lines.append(f"<p style=\"margin:8px 0;\">{stripped}</p>")

    if in_list:
        html_lines.append("</ul>")

    # Wrap in a styled container
    inner = "\n".join(html_lines)
    return f"""\
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;">
  <div style="background:linear-gradient(135deg,#0078d4,#50e6ff);padding:20px 24px;border-radius:12px 12px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:22px;">&#127793; Copilot CLR</h1>
    <p style="color:rgba(255,255,255,0.9);margin:6px 0 0 0;font-size:14px;">Your friendly assistant</p>
  </div>
  <div style="background:#ffffff;padding:20px 24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 12px 12px;">
    {inner}
  </div>
  <p style="text-align:center;color:#999;font-size:12px;margin-top:16px;">
    Sent with care by Copilot CLR &mdash; take things at your own pace &#128155;
  </p>
</div>"""
