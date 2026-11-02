import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.visitor_tracker import MAX_PAGES
from app.models.conversation import Conversation, ConversationStatus

MAX_URL = 2048
MAX_TITLE = 300


def clean_url(value: object) -> str | None:
    """An http(s) URL, or None for anything else the browser could report."""
    if not isinstance(value, str) or not value or len(value) > MAX_URL:
        return None
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return None
    return value


def clean_page(event: dict) -> dict | None:
    url = clean_url(event.get("url"))
    if url is None:
        return None
    title = event.get("title")
    title = " ".join(title.split())[:MAX_TITLE] if isinstance(title, str) else ""
    return {"url": url, "title": title, "at": datetime.now(timezone.utc).isoformat()}


async def record_page(
    db: AsyncSession, organization_id: uuid.UUID, visitor_id: str, page: dict
) -> Conversation | None:
    """Adds the page to the trail of the visitor's ongoing chat, if they have one.
    Returns the chat when it changed."""
    conv = await db.scalar(
        select(Conversation)
        .where(
            Conversation.organization_id == organization_id,
            Conversation.visitor_id == visitor_id,
            Conversation.status != ConversationStatus.CLOSED,
        )
        .order_by(Conversation.created_at.desc())
        .limit(1)
        .options(selectinload(Conversation.assigned_to))
    )
    if conv is None or (conv.visitor_pages and conv.visitor_pages[-1]["url"] == page["url"]):
        return None
    conv.visitor_pages = [*conv.visitor_pages, page][-MAX_PAGES:]
    await db.commit()
    return conv
