from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.email import send_transcript_email
from app.models.conversation import Conversation
from app.models.message import SenderType
from app.models.organization import Organization
from app.services.message import get_messages


def _formatter(timezone: str):
    try:
        tz = ZoneInfo(timezone)
    except ZoneInfoNotFoundError:
        tz = ZoneInfo("UTC")
    return lambda moment: moment.astimezone(tz).strftime("%d %b %Y, %H:%M %Z")


async def email_transcript(
    db: AsyncSession, conv: Conversation, org: Organization, to_email: str
) -> None:
    """Email the visitor-visible part of a conversation. Internal notes are never included.
    Times use the org's business hours timezone, which defaults to UTC."""
    fmt = _formatter(org.business_hours_timezone)
    visitor = conv.visitor_name or "You"
    lines = [
        (
            visitor if m.sender_type == SenderType.VISITOR else m.sender_name or org.name,
            fmt(m.created_at),
            f"Sent a file: {m.attachment_name}" if m.attachment_url else m.content,
        )
        for m in await get_messages(db, conv.id)
        if not m.is_internal
    ]
    await send_transcript_email(to_email, org.name, fmt(conv.created_at), lines)
