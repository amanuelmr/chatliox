import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.conversation import Conversation, ConversationStatus
from app.models.message import Message, SenderType
from app.models.organization import Organization


async def create_conversation(
    db: AsyncSession,
    visitor_id: str,
    visitor_name: str | None,
    visitor_email: str | None,
    organization_id: uuid.UUID,
    pre_chat_answers: list[dict] | None = None,
) -> Conversation:
    conversation = Conversation(
        visitor_id=visitor_id,
        visitor_name=visitor_name,
        visitor_email=visitor_email,
        pre_chat_answers=pre_chat_answers or [],
        status=ConversationStatus.WAITING,
        organization_id=organization_id,
    )
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)
    return conversation


async def get_conversations(
    db: AsyncSession,
    organization_id: uuid.UUID,
    status: ConversationStatus | None = None,
    tag: str | None = None,
    search: str | None = None,
) -> list[Conversation]:
    q = (
        select(Conversation)
        .where(Conversation.organization_id == organization_id)
        .options(selectinload(Conversation.assigned_to))
    )
    if status is not None:
        q = q.where(Conversation.status == status)
    if tag:
        q = q.where(Conversation.tags.any(tag))
    if search:
        like = f"%{search}%"
        matching_conversation_ids = select(Message.conversation_id).where(Message.content.ilike(like))
        q = q.where(
            or_(
                Conversation.visitor_name.ilike(like),
                Conversation.visitor_email.ilike(like),
                Conversation.id.in_(matching_conversation_ids),
            )
        )
    q = q.order_by(
        Conversation.last_message_at.desc().nulls_last(),
        Conversation.created_at.desc(),
    )
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_conversation(db: AsyncSession, conversation_id: uuid.UUID) -> Conversation | None:
    return await db.get(Conversation, conversation_id)


async def set_visitor_email(db: AsyncSession, conv: Conversation, email: str) -> Conversation:
    conv.visitor_email = email
    await db.commit()
    return await get_conversation_with_assignee(db, conv.id)


async def get_conversation_with_assignee(
    db: AsyncSession, conversation_id: uuid.UUID
) -> Conversation | None:
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.assigned_to))
    )
    return result.scalar_one_or_none()


async def update_conversation_status(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    new_status: ConversationStatus,
) -> Conversation | None:
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.assigned_to))
    )
    conv = result.scalar_one_or_none()
    if conv is None:
        return None
    conv.status = new_status
    await db.commit()
    await db.refresh(conv)
    return conv


async def update_conversation_tags(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    tags: list[str],
) -> Conversation | None:
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.assigned_to))
    )
    conv = result.scalar_one_or_none()
    if conv is None:
        return None
    # Normalize: trim, drop empties, dedupe while preserving order.
    seen: set[str] = set()
    cleaned: list[str] = []
    for tag in tags:
        t = tag.strip()
        if t and t not in seen:
            seen.add(t)
            cleaned.append(t)
    conv.tags = cleaned
    await db.commit()
    await db.refresh(conv)
    return conv


async def submit_csat(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    visitor_id: str,
    rating: int,
) -> Conversation | None:
    # Load the assignee too: the response includes their name, and a lazy load
    # isn't possible once we're serializing outside the session's async context.
    conv = await get_conversation_with_assignee(db, conversation_id)
    if conv is None or str(conv.visitor_id) != visitor_id:
        return None
    conv.csat_rating = rating
    await db.commit()
    await db.refresh(conv)
    return conv


async def mark_visitor_messages_read(db: AsyncSession, conversation_id: uuid.UUID) -> None:
    await db.execute(
        update(Message)
        .where(Message.conversation_id == conversation_id)
        .where(Message.sender_type == SenderType.VISITOR)
        .where(Message.is_read.is_(False))
        .values(is_read=True)
    )
    await db.commit()


async def get_stale_waiting_conversations(
    db: AsyncSession, older_than_minutes: int
) -> list[Conversation]:
    """Conversations sitting in WAITING past the threshold that haven't
    already triggered an unanswered-alert email."""
    threshold = datetime.now(timezone.utc) - timedelta(minutes=older_than_minutes)
    q = (
        select(Conversation)
        .where(Conversation.status == ConversationStatus.WAITING)
        .where(Conversation.waiting_alert_sent_at.is_(None))
        .where(func.coalesce(Conversation.last_message_at, Conversation.created_at) < threshold)
        .options(selectinload(Conversation.organization).selectinload(Organization.users))
    )
    result = await db.execute(q)
    return list(result.scalars().all())


async def touch_visitor_last_seen(db: AsyncSession, conversation_id: uuid.UUID) -> None:
    await db.execute(
        update(Conversation)
        .where(Conversation.id == conversation_id)
        .values(visitor_last_seen_at=func.now())
    )
    await db.commit()


async def get_conversations_with_missed_replies(
    db: AsyncSession, older_than_minutes: int
) -> list[tuple[Conversation, list[Message]]]:
    """Conversations with an email on file whose visitor hasn't seen, and hasn't
    been emailed, agent replies older than the threshold — paired with those replies."""
    threshold = datetime.now(timezone.utc) - timedelta(minutes=older_than_minutes)
    unseen_since = func.greatest(
        func.coalesce(Conversation.visitor_last_seen_at, Conversation.created_at),
        func.coalesce(Conversation.visitor_notified_at, Conversation.created_at),
    )
    q = (
        select(Conversation, Message)
        .join(Message, Message.conversation_id == Conversation.id)
        .where(Conversation.visitor_email.is_not(None))
        .where(Message.sender_type == SenderType.ADMIN)
        .where(Message.is_internal.is_(False))
        .where(Message.created_at > unseen_since)
        .options(selectinload(Conversation.organization), selectinload(Message.sender))
        .order_by(Conversation.id, Message.created_at)
    )
    result = await db.execute(q)

    grouped: dict[uuid.UUID, tuple[Conversation, list[Message]]] = {}
    for conv, message in result.all():
        grouped.setdefault(conv.id, (conv, []))[1].append(message)
    # Wait until the newest reply has aged past the threshold, so a burst of
    # replies goes out as one email instead of one per message.
    return [(conv, msgs) for conv, msgs in grouped.values() if msgs[-1].created_at < threshold]


async def mark_visitor_notified(db: AsyncSession, conversation_id: uuid.UUID) -> None:
    await db.execute(
        update(Conversation)
        .where(Conversation.id == conversation_id)
        .values(visitor_notified_at=func.now())
    )
    await db.commit()


async def mark_waiting_alert_sent(db: AsyncSession, conversation_id: uuid.UUID) -> None:
    conv = await db.get(Conversation, conversation_id)
    if conv is not None:
        conv.waiting_alert_sent_at = datetime.now(timezone.utc)
        await db.commit()
