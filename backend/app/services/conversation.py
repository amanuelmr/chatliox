import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.conversation import Conversation, ConversationStatus
from app.models.message import Message, SenderType


async def create_conversation(
    db: AsyncSession,
    visitor_id: str,
    visitor_name: str | None,
    visitor_email: str | None,
    organization_id: uuid.UUID,
) -> Conversation:
    conversation = Conversation(
        visitor_id=visitor_id,
        visitor_name=visitor_name,
        visitor_email=visitor_email,
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
) -> list[Conversation]:
    q = (
        select(Conversation)
        .where(Conversation.organization_id == organization_id)
        .options(selectinload(Conversation.assigned_to))
    )
    if status is not None:
        q = q.where(Conversation.status == status)
    q = q.order_by(
        Conversation.last_message_at.desc().nulls_last(),
        Conversation.created_at.desc(),
    )
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_conversation(db: AsyncSession, conversation_id: uuid.UUID) -> Conversation | None:
    return await db.get(Conversation, conversation_id)


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


async def mark_visitor_messages_read(db: AsyncSession, conversation_id: uuid.UUID) -> None:
    await db.execute(
        update(Message)
        .where(Message.conversation_id == conversation_id)
        .where(Message.sender_type == SenderType.VISITOR)
        .where(Message.is_read.is_(False))
        .values(is_read=True)
    )
    await db.commit()
