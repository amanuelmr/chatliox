import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.conversation import Conversation, ConversationStatus
from app.models.message import Message, SenderType


async def create_message(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    content: str,
    sender_type: SenderType,
    sender_id: uuid.UUID | None = None,
    is_internal: bool = False,
) -> Message | None:
    conversation = await db.get(Conversation, conversation_id)
    if conversation is None:
        return None

    now = datetime.now(timezone.utc)

    message = Message(
        conversation_id=conversation_id,
        sender_type=sender_type,
        sender_id=sender_id,
        content=content,
        is_read=sender_type == SenderType.ADMIN,
        is_internal=is_internal,
    )

    # Internal notes don't affect conversation status or last_message_at
    if not is_internal:
        conversation.last_message_at = now
        if sender_type == SenderType.ADMIN:
            conversation.status = ConversationStatus.OPEN
            if sender_id is not None:
                conversation.assigned_to_id = sender_id
        elif sender_type == SenderType.VISITOR:
            # Visitor reply to a resolved conversation reopens it
            if conversation.status == ConversationStatus.CLOSED:
                conversation.status = ConversationStatus.WAITING
            # New visitor activity restarts the "gone quiet" clock so a later
            # silence on this conversation can trigger another alert.
            conversation.waiting_alert_sent_at = None

    db.add(message)
    await db.commit()
    await db.refresh(message)
    return message


async def get_messages(db: AsyncSession, conversation_id: uuid.UUID) -> list[Message]:
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .options(selectinload(Message.sender))
        .order_by(Message.created_at.asc())
    )
    return list(result.scalars().all())
