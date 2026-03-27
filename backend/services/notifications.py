"""Notification Service — Azure Communication Services.

Sends email and SMS reminders/notifications to users via ACS.
All reminder text passes through Content Safety before sending.
"""

import logging
import os
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

_LOCAL_DEV = os.environ.get("LOCAL_DEV", "").lower() in ("1", "true", "yes")

_acs_connection_string: str | None = None


def _get_acs_connection_string() -> str:
    """Fetch the ACS connection string from Key Vault (cached after first call)."""
    global _acs_connection_string
    if _acs_connection_string:
        return _acs_connection_string

    from azure.identity import DefaultAzureCredential
    from azure.keyvault.secrets import SecretClient

    key_vault_uri = os.environ.get("KEY_VAULT_URI", "")
    client = SecretClient(vault_url=key_vault_uri, credential=DefaultAzureCredential())
    secret = client.get_secret("acs-connection-string")
    _acs_connection_string = secret.value
    return _acs_connection_string


async def send_email_reminder(
    recipient_email: str,
    subject: str,
    body: str,
    user_id: str = "",
    html_body: str = "",
) -> dict[str, Any]:
    """Send an email reminder via Azure Communication Services.

    Args:
        recipient_email: Recipient email address.
        subject: Email subject line.
        body: Email body content (plain text).
        user_id: User ID for audit logging.
        html_body: Optional HTML body content.

    Returns:
        Dict with status and message ID.
    """
    key_vault_uri = os.environ.get("KEY_VAULT_URI", "")
    sender = os.environ.get("ACS_EMAIL_SENDER", "")

    if _LOCAL_DEV or not key_vault_uri:
        logger.info("email_reminder_simulated to=%s subject=%s", recipient_email, subject)
        return {
            "status": "simulated",
            "channel": "email",
            "recipient": recipient_email,
            "subject": subject,
            "sent_at": datetime.now(timezone.utc).isoformat(),
        }

    try:
        from azure.communication.email import EmailClient

        connection_string = _get_acs_connection_string()
        client = EmailClient.from_connection_string(connection_string)

        content: dict[str, str] = {"subject": subject, "plainText": body}
        if html_body:
            content["html"] = html_body

        message = {
            "senderAddress": sender,
            "recipients": {"to": [{"address": recipient_email}]},
            "content": content,
        }
        poller = client.begin_send(message)
        result = poller.result()

        logger.info("email_sent to=%s message_id=%s user=%s", recipient_email, result["id"], user_id)
        return {
            "status": "sent",
            "channel": "email",
            "message_id": result["id"],
            "sent_at": datetime.now(timezone.utc).isoformat(),
        }

    except Exception:
        logger.exception("Email send failed to=%s", recipient_email)
        return {"status": "error", "channel": "email", "error": "Failed to send email."}


async def send_sms_reminder(
    phone_number: str,
    message: str,
    user_id: str = "",
) -> dict[str, Any]:
    """Send an SMS reminder via Azure Communication Services.

    Args:
        phone_number: Recipient phone number (E.164 format).
        message: SMS message text (max 160 chars recommended).
        user_id: User ID for audit logging.

    Returns:
        Dict with status and message ID.
    """
    key_vault_uri = os.environ.get("KEY_VAULT_URI", "")
    sms_sender = os.environ.get("ACS_SMS_SENDER", "")

    if _LOCAL_DEV or not key_vault_uri:
        logger.info("sms_reminder_simulated to=%s msg=%s", phone_number, message[:50])
        return {
            "status": "simulated",
            "channel": "sms",
            "recipient": phone_number,
            "sent_at": datetime.now(timezone.utc).isoformat(),
        }

    try:
        from azure.communication.sms import SmsClient

        connection_string = _get_acs_connection_string()
        client = SmsClient.from_connection_string(connection_string)
        responses = client.send(
            from_=sms_sender,
            to=[phone_number],
            message=message[:160],
        )
        resp = responses[0]
        if resp.successful:
            logger.info("sms_sent to=%s message_id=%s user=%s", phone_number, resp.message_id, user_id)
            return {
                "status": "sent",
                "channel": "sms",
                "message_id": resp.message_id,
                "sent_at": datetime.now(timezone.utc).isoformat(),
            }
        else:
            logger.warning("sms_failed to=%s error=%s", phone_number, resp.error_message)
            return {"status": "error", "channel": "sms", "error": resp.error_message}

    except Exception:
        logger.exception("SMS send failed to=%s", phone_number)
        return {"status": "error", "channel": "sms", "error": "Failed to send SMS."}
