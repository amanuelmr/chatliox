import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_optional_user
from app.core.limiter import limiter
from app.core.ws_manager import manager as ws_manager
from app.models.conversation import ConversationStatus
from app.models.message import Message, SenderType
from app.models.user import User
from app.schemas.conversation import ConversationResponse
from app.schemas.message import CreateMessageRequest, MessageResponse
from app.services.conversation import get_conversation, get_conversation_with_assignee
from app.services.message import create_message
from app.services.storage import save_attachment
from app.websockets.router import org_room

router = APIRouter(prefix="/messages", tags=["messages"])


def _authorize_sender(
    sender_type: SenderType, is_internal: bool, current_user: User | None
) -> None:
    if sender_type == SenderType.ADMIN and current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to send as admin",
        )
    if sender_type == SenderType.ADMIN and current_user is not None and not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email to continue",
        )
    if is_internal and sender_type != SenderType.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only admins can post internal notes",
        )


async def _authorize_conversation(
    db: AsyncSession, conversation_id: uuid.UUID, current_user: User | None
):
    conv = await get_conversation(db, conversation_id)
    if current_user is not None:
        if conv is None or conv.organization_id != current_user.organization_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    elif conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return conv


async def _broadcast_new_message(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    message: Message,
    sender_type: SenderType,
    was_closed: bool,
    is_internal: bool,
) -> None:
    if is_internal:
        return

    payload = {"type": "message", **MessageResponse.model_validate(message).model_dump(mode="json")}
    await ws_manager.broadcast(str(conversation_id), payload)

    # Visitor reply to a resolved conversation — broadcast the reopen so widget updates live
    if sender_type == SenderType.VISITOR and was_closed:
        await ws_manager.broadcast(str(conversation_id), {"type": "status", "status": "waiting"})

    conv_for_broadcast = await get_conversation_with_assignee(db, conversation_id)
    if conv_for_broadcast is not None:
        await ws_manager.broadcast(
            org_room(conv_for_broadcast.organization_id),
            {
                "type": "conversation_updated",
                **ConversationResponse.model_validate(conv_for_broadcast).model_dump(mode="json"),
            },
        )


@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("60/minute")
async def create(
    request: Request,
    body: CreateMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
) -> MessageResponse:
    _authorize_sender(body.sender_type, body.is_internal, current_user)
    conv = await _authorize_conversation(db, body.conversation_id, current_user)
    was_closed = conv.status == ConversationStatus.CLOSED

    sender_id = current_user.id if body.sender_type == SenderType.ADMIN else None
    message = await create_message(
        db, body.conversation_id, body.content, body.sender_type, sender_id, body.is_internal
    )
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    # Populate sender in-memory so sender_name is available without async lazy-load
    if body.sender_type == SenderType.ADMIN and current_user is not None:
        message.sender = current_user

    await _broadcast_new_message(db, body.conversation_id, message, body.sender_type, was_closed, body.is_internal)
    return message


@router.post("/attachments", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def create_attachment(
    request: Request,
    conversation_id: uuid.UUID = Form(...),
    sender_type: SenderType = Form(...),
    is_internal: bool = Form(False),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
) -> MessageResponse:
    _authorize_sender(sender_type, is_internal, current_user)
    conv = await _authorize_conversation(db, conversation_id, current_user)
    was_closed = conv.status == ConversationStatus.CLOSED

    url, name, mime = await save_attachment(str(conversation_id), file)

    sender_id = current_user.id if sender_type == SenderType.ADMIN else None
    message = await create_message(
        db, conversation_id, name, sender_type, sender_id, is_internal,
        attachment_url=url, attachment_name=name, attachment_mime=mime,
    )
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    if sender_type == SenderType.ADMIN and current_user is not None:
        message.sender = current_user

    await _broadcast_new_message(db, conversation_id, message, sender_type, was_closed, is_internal)
    return message
