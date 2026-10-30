import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.email import send_missed_replies_email, send_unanswered_alert_email
from app.core.ws_manager import manager as ws_manager
from app.services.conversation import (
    get_conversations_with_missed_replies,
    get_stale_waiting_conversations,
    mark_visitor_notified,
    mark_waiting_alert_sent,
)

logger = logging.getLogger(__name__)


def _visitor_label(conv) -> str:
    return conv.visitor_name or conv.visitor_email or "A visitor"


async def run_unanswered_alert_sweep(db: AsyncSession) -> None:
    if not settings.RESEND_API_KEY:
        return

    base_url = settings.ALLOWED_ORIGINS.split(",")[0].strip().rstrip("/")
    stale = await get_stale_waiting_conversations(db, settings.UNANSWERED_ALERT_MINUTES)

    for conv in stale:
        recipients = [u.email for u in conv.organization.users if u.is_active]
        if not recipients:
            continue

        conversation_url = f"{base_url}/app/c/{conv.id}"
        visitor_label = _visitor_label(conv)

        try:
            await asyncio.gather(*(
                send_unanswered_alert_email(
                    email, visitor_label, settings.UNANSWERED_ALERT_MINUTES, conversation_url
                )
                for email in recipients
            ))
        except Exception:
            logger.exception("Failed to send unanswered-conversation alert for %s", conv.id)
            continue

        await mark_waiting_alert_sent(db, conv.id)


async def run_missed_reply_sweep(db: AsyncSession) -> None:
    if not settings.RESEND_API_KEY:
        return

    pending = await get_conversations_with_missed_replies(db, settings.MISSED_REPLY_EMAIL_MINUTES)
    for conv, replies in pending:
        # Still on the page — they'll see the replies live.
        if ws_manager.is_visitor_connected(str(conv.id)):
            continue

        lines = [
            (
                m.sender_name or conv.organization.name,
                f"Sent a file: {m.attachment_name}" if m.attachment_url else m.content,
            )
            for m in replies
        ]
        try:
            await send_missed_replies_email(conv.visitor_email, conv.organization.name, lines)
        except Exception:
            logger.exception("Failed to email missed replies for %s", conv.id)
            continue

        await mark_visitor_notified(db, conv.id)


async def email_notification_loop() -> None:
    while True:
        for sweep in (run_unanswered_alert_sweep, run_missed_reply_sweep):
            try:
                async with AsyncSessionLocal() as db:
                    await sweep(db)
            except Exception:
                logger.exception("%s failed", sweep.__name__)
        await asyncio.sleep(settings.UNANSWERED_ALERT_POLL_SECONDS)
