"""
Hardcoded test to verify email reminders are sent via Azure Communication Services.
Recipient: cristopherwin8@outlook.com
"""
import asyncio
import os
import logging

logging.basicConfig(level=logging.INFO)

# Prevent LOCAL_DEV simulation mode
os.environ["LOCAL_DEV"] = "false"

# Inject ACS connection string directly so Key Vault is NOT needed
ACS_CONN_STR = (
    "endpoint=https://azure-communication-services-kvhky.unitedstates.communication.azure.com/;"
    "accesskey=6ny6x0k1l78cx62SKdKSgZhkGIbjnukh4GS6j4pg3xFastGvW6k6JQQJ99CCACULyCp2n9vXAAAAAZCSYfjn"
)

async def send_test_email():
    from azure.communication.email import EmailClient
    from datetime import datetime, timezone

    recipient = "cristopherwin8@outlook.com"
    subject  = "🔔 Contest Reminder — Test Email (Urgent!)"
    body     = (
        "Hi Cristopher,\n\n"
        "This is a hardcoded integration test confirming that email reminders "
        "are being sent correctly from the Base Innovation platform.\n\n"
        "Today is the LAST DAY of the contest — make sure everything is working!\n\n"
        "— Base Innovation Notification Service"
    )
    sender = "DoNotReply@abd4c8f2-f483-4189-bc8e-de176c88b11a.azurecomm.net"

    print(f"\n📧 Sending test email to {recipient} ...")

    client = EmailClient.from_connection_string(ACS_CONN_STR)
    message = {
        "senderAddress": sender,
        "recipients": {"to": [{"address": recipient}]},
        "content": {
            "subject": subject,
            "plainText": body,
        },
    }
    poller = client.begin_send(message)
    result = poller.result()

    print(f"\n✅ Email sent successfully!")
    print(f"   Message ID : {result.get('id', 'n/a')}")
    print(f"   Status     : {result.get('status', 'n/a')}")
    print(f"   Sent at    : {datetime.now(timezone.utc).isoformat()}")
    return result


if __name__ == "__main__":
    asyncio.run(send_test_email())
