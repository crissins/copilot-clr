"""Reminders Routes — CRUD and notification dispatch.

Endpoints:
  POST   /api/reminders     — Create reminder
  GET    /api/reminders     — List user reminders
  PUT    /api/reminders/{id} — Update reminder
  DELETE /api/reminders/{id} — Delete reminder
"""

import logging
import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["reminders"])

_LOCAL_DEV = os.environ.get("LOCAL_DEV", "").lower() in ("1", "true", "yes")

_get_user_id = None
_reminders_container = None
_preferences_container = None


def init_routes(get_user_fn, reminders_ctr, preferences_ctr=None):
    """Wire dependencies."""
    global _get_user_id, _reminders_container, _preferences_container
    _get_user_id = get_user_fn
    _reminders_container = reminders_ctr
    _preferences_container = preferences_ctr


@router.post("/reminders")
async def create_reminder(req: Request) -> JSONResponse:
    """Create a new reminder.

    Body: {title, description?, scheduledTime, channel?, recurring?}
    channel: email | sms | push (default: push)
    recurring: daily | weekly | monthly | null
    """
    from auth.entra import AuthError
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
        return JSONResponse({"error": "Title is required."}, status_code=400)
    if len(title) > 200:
        return JSONResponse({"error": "Title must be under 200 characters."}, status_code=400)

    scheduled_time = body.get("scheduledTime", "")
    if not scheduled_time:
        return JSONResponse({"error": "scheduledTime is required."}, status_code=400)

    # Validate ISO 8601 timestamp
    try:
        parsed_time = datetime.fromisoformat(scheduled_time.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return JSONResponse({"error": "scheduledTime must be ISO 8601 format."}, status_code=400)

    channel = body.get("channel", "push")
    if channel not in ("email", "sms", "push"):
        return JSONResponse({"error": "Channel must be email, sms, or push."}, status_code=400)

    recurring = body.get("recurring")
    if recurring and recurring not in ("daily", "weekly", "weekdays", "monthly"):
        return JSONResponse({"error": "Recurring must be daily, weekly, weekdays, or monthly."}, status_code=400)

    interval_minutes = body.get("intervalMinutes")
    if interval_minutes is not None:
        try:
            interval_minutes = int(interval_minutes)
            if interval_minutes < 1 or interval_minutes > 525600:  # max 1 year
                return JSONResponse({"error": "intervalMinutes must be between 1 and 525600."}, status_code=400)
        except (ValueError, TypeError):
            return JSONResponse({"error": "intervalMinutes must be a number."}, status_code=400)

    description = body.get("description", "").strip()
    if len(description) > 2000:
        return JSONResponse({"error": "Description must be under 2000 characters."}, status_code=400)

    reminder_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    doc = {
        "id": reminder_id,
        "userId": user_id,
        "title": title,
        "description": description,
        "scheduledTime": parsed_time.isoformat(),
        "channel": channel,
        "recurring": recurring,
        "intervalMinutes": interval_minutes,
        "status": "active",
        "createdAt": now,
        "updatedAt": now,
    }

    _reminders_container.upsert_item(doc)

    # Queue reminder for processing
    sb_namespace = os.environ.get("SERVICE_BUS_NAMESPACE", "")
    if sb_namespace and not _LOCAL_DEV:
        try:
            from azure.servicebus import ServiceBusClient, ServiceBusMessage
            from azure.identity import DefaultAzureCredential
            import json

            sb = ServiceBusClient(
                fully_qualified_namespace=sb_namespace,
                credential=DefaultAzureCredential(),
            )
            with sb.get_queue_sender("reminders") as sender:
                sender.send_messages(ServiceBusMessage(
                    json.dumps({"reminderId": reminder_id, "userId": user_id, "action": "schedule"}),
                    content_type="application/json",
                ))
        except Exception:
            logger.warning("Failed to queue reminder %s", reminder_id)

    # ── Dispatch ACS notification ────────────────────────────────────
    try:
        from services.notifications import send_email_reminder, send_sms_reminder

        # Look up contact info from user preferences
        contact_email = ""
        contact_phone = ""
        if _preferences_container:
            try:
                prefs = _preferences_container.read_item(item=user_id, partition_key=user_id)
                contact_email = prefs.get("email", "")
                contact_phone = prefs.get("phone", "")
            except Exception:
                logger.debug("No preferences found for user=%s", user_id)

        reminder_msg = f"Hi there! 🌱\n\nJust a gentle nudge about: {title}"
        if description:
            reminder_msg += f"\n\n{description[:500]}"
        reminder_msg += "\n\nTake it at your own pace — you've got this! 💛\n\n— Copilot CLR"

        if channel == "sms" and contact_phone:
            await send_sms_reminder(
                phone_number=contact_phone,
                message=f"🌱 Reminder: {title}" + (f" — {description[:100]}" if description else ""),
                user_id=user_id,
            )
        elif contact_email:
            # email channel, or push channel with email fallback
            html_body = f"""\
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;">
  <div style="background:linear-gradient(135deg,#0078d4,#50e6ff);padding:20px 24px;border-radius:12px 12px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:22px;">&#127793; Copilot CLR</h1>
    <p style="color:rgba(255,255,255,0.9);margin:6px 0 0 0;font-size:14px;">Your friendly assistant</p>
  </div>
  <div style="background:#ffffff;padding:20px 24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 12px 12px;">
    <h2 style="color:#0078d4;margin:0 0 12px 0;">Friendly Reminder</h2>
    <p style="font-size:16px;margin:0 0 12px 0;">{title}</p>
    {"<p style='color:#555;margin:0 0 12px 0;'>" + description[:500] + "</p>" if description else ""}
    <p style="margin:16px 0 0 0;color:#666;">Take it at your own pace — you've got this! &#128155;</p>
  </div>
  <p style="text-align:center;color:#999;font-size:12px;margin-top:16px;">
    Sent with care by Copilot CLR
  </p>
</div>"""
            await send_email_reminder(
                recipient_email=contact_email,
                subject=f"🌱 Friendly Reminder: {title}",
                body=reminder_msg,
                user_id=user_id,
                html_body=html_body,
            )
        else:
            logger.warning(
                "No contact info for channel=%s user=%s", channel, user_id
            )
    except Exception:
        logger.exception("ACS notification failed for reminder %s", reminder_id)

    logger.info("reminder_created user=%s id=%s channel=%s", user_id, reminder_id, channel)
    return JSONResponse(doc, status_code=201)


@router.get("/reminders")
async def list_reminders(req: Request) -> JSONResponse:
    """List all reminders for the authenticated user.

    Query params: status=active|completed|all (default: active)
    """
    from auth.entra import AuthError
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    status_filter = req.query_params.get("status", "active")
    if status_filter not in ("active", "completed", "all"):
        status_filter = "active"

    if status_filter == "all":
        query = "SELECT * FROM c WHERE c.userId = @uid ORDER BY c.scheduledTime ASC"
    else:
        query = "SELECT * FROM c WHERE c.userId = @uid AND c.status = @status ORDER BY c.scheduledTime ASC"

    params = [{"name": "@uid", "value": user_id}]
    if status_filter != "all":
        params.append({"name": "@status", "value": status_filter})

    items = list(_reminders_container.query_items(query=query, parameters=params, partition_key=user_id))
    return JSONResponse(items)


@router.put("/reminders/{reminder_id}")
async def update_reminder(reminder_id: str, req: Request) -> JSONResponse:
    """Update an existing reminder.

    Body: {title?, description?, scheduledTime?, channel?, recurring?, status?}
    """
    from auth.entra import AuthError
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        body = await req.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    # Load existing
    try:
        doc = _reminders_container.read_item(item=reminder_id, partition_key=user_id)
    except Exception:
        return JSONResponse({"error": "Reminder not found."}, status_code=404)

    # Validate and apply updates
    if "title" in body:
        title = body["title"].strip()
        if not title or len(title) > 200:
            return JSONResponse({"error": "Title required, max 200 chars."}, status_code=400)
        doc["title"] = title

    if "description" in body:
        desc = body["description"].strip()
        if len(desc) > 2000:
            return JSONResponse({"error": "Description max 2000 chars."}, status_code=400)
        doc["description"] = desc

    if "scheduledTime" in body:
        try:
            pt = datetime.fromisoformat(body["scheduledTime"].replace("Z", "+00:00"))
            doc["scheduledTime"] = pt.isoformat()
        except (ValueError, AttributeError):
            return JSONResponse({"error": "Invalid scheduledTime."}, status_code=400)

    if "channel" in body:
        if body["channel"] not in ("email", "sms", "push"):
            return JSONResponse({"error": "Invalid channel."}, status_code=400)
        doc["channel"] = body["channel"]

    if "recurring" in body:
        r = body["recurring"]
        if r and r not in ("daily", "weekly", "monthly"):
            return JSONResponse({"error": "Invalid recurring value."}, status_code=400)
        doc["recurring"] = r

    if "status" in body:
        if body["status"] not in ("active", "completed", "snoozed"):
            return JSONResponse({"error": "Invalid status."}, status_code=400)
        doc["status"] = body["status"]

    doc["updatedAt"] = datetime.now(timezone.utc).isoformat()
    _reminders_container.upsert_item(doc)

    logger.info("reminder_updated user=%s id=%s", user_id, reminder_id)
    return JSONResponse(doc)


@router.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str, req: Request) -> JSONResponse:
    """Delete a reminder."""
    from auth.entra import AuthError
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        _reminders_container.delete_item(item=reminder_id, partition_key=user_id)
    except Exception:
        return JSONResponse({"error": "Reminder not found."}, status_code=404)

    logger.info("reminder_deleted user=%s id=%s", user_id, reminder_id)
    return JSONResponse({"deleted": True})
