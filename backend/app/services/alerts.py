import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.email import send_unanswered_alert_email
from app.services.conversation import get_stale_waiting_conversations, mark_waiting_alert_sent

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


async def unanswered_alert_loop() -> None:
    while True:
        try:
            async with AsyncSessionLocal() as db:
                await run_unanswered_alert_sweep(db)
        except Exception:
            logger.exception("Unanswered-conversation alert sweep failed")
        await asyncio.sleep(settings.UNANSWERED_ALERT_POLL_SECONDS)
