import uuid

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.canned_response import CannedResponse
from app.models.conversation import Conversation, ConversationStatus
from app.models.message import Message, SenderType
from app.models.user import User
from app.services.conversation import (
    assign_conversation,
    get_conversation_with_assignee,
    update_conversation_status,
    update_conversation_tags,
)
from app.services.message import create_message


class ShortcutTaken(Exception):
    pass


async def _save(db: AsyncSession, response: CannedResponse) -> CannedResponse:
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise ShortcutTaken from exc
    await db.refresh(response)
    return response


async def create_canned_response(
    db: AsyncSession,
    organization_id: uuid.UUID,
    title: str,
    content: str,
    shortcut: str | None = None,
    actions: dict | None = None,
) -> CannedResponse:
    response = CannedResponse(
        organization_id=organization_id, title=title, content=content, shortcut=shortcut, actions=actions or {}
    )
    db.add(response)
    return await _save(db, response)


async def get_canned_responses(db: AsyncSession, organization_id: uuid.UUID) -> list[CannedResponse]:
    result = await db.execute(
        select(CannedResponse)
        .where(CannedResponse.organization_id == organization_id)
        .order_by(CannedResponse.title.asc())
    )
    return list(result.scalars().all())


async def get_canned_response(db: AsyncSession, response_id: uuid.UUID) -> CannedResponse | None:
    return await db.get(CannedResponse, response_id)


async def update_canned_response(db: AsyncSession, response: CannedResponse, changes: dict) -> CannedResponse:
    for field, value in changes.items():
        setattr(response, field, value)
    return await _save(db, response)


async def delete_canned_response(db: AsyncSession, response: CannedResponse) -> None:
    await db.delete(response)
    await db.commit()


async def apply_macro(
    db: AsyncSession, macro: CannedResponse, conv: Conversation, agent: User, content: str
) -> tuple[Conversation, list[Message]]:
    """Send the reply (if any), then run the macro's actions in order: assign,
    tag, resolve. Returns the updated conversation and every message it posted."""
    actions = macro.actions or {}
    posted: list[Message] = []

    if content:
        reply = await create_message(db, conv.id, content, SenderType.ADMIN, agent.id)
        reply.sender = agent
        posted.append(reply)
        # The reply may have claimed the chat; read the assignee fresh.
        await db.refresh(conv)

    assign = actions.get("assign")
    if assign == "me" and conv.assigned_to_id != agent.id:
        posted.append(await assign_conversation(db, conv, agent, agent, ""))
    elif assign == "unassign" and conv.assigned_to_id is not None:
        posted.append(await assign_conversation(db, conv, agent, None, ""))

    if actions.get("add_tags"):
        await update_conversation_tags(db, conv.id, [*conv.tags, *actions["add_tags"]])
    if actions.get("resolve") and conv.status != ConversationStatus.CLOSED:
        await update_conversation_status(db, conv.id, ConversationStatus.CLOSED)

    await db.execute(
        update(CannedResponse)
        .where(CannedResponse.id == macro.id)
        .values(use_count=CannedResponse.use_count + 1)
    )
    await db.commit()
    return await get_conversation_with_assignee(db, conv.id), posted
