from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_optional_user
from app.core.limiter import limiter
from app.core.ws_manager import manager as ws_manager
from app.models.conversation import ConversationStatus
from app.models.message import SenderType
from app.models.user import User
from app.schemas.conversation import ConversationResponse
from app.schemas.message import CreateMessageRequest, MessageResponse
from app.services.conversation import get_conversation, get_conversation_with_assignee
from app.services.message import create_message
from app.websockets.router import org_room

router = APIRouter(prefix="/messages", tags=["messages"])


@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("60/minute")
async def create(
    request: Request,
    body: CreateMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
) -> MessageResponse:
    if body.sender_type == SenderType.ADMIN and current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to send as admin",
        )

    if body.is_internal and body.sender_type != SenderType.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only admins can post internal notes",
        )

    # Verify conversation exists; for admins also enforce org boundary
    conv = await get_conversation(db, body.conversation_id)
    if current_user is not None:
        if conv is None or conv.organization_id != current_user.organization_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    elif conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

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

    if not body.is_internal:
        payload = {"type": "message", **MessageResponse.model_validate(message).model_dump(mode="json")}
        await ws_manager.broadcast(str(body.conversation_id), payload)

        # Visitor reply to a resolved conversation — broadcast the reopen so widget updates live
        if body.sender_type == SenderType.VISITOR and was_closed:
            await ws_manager.broadcast(
                str(body.conversation_id),
                {"type": "status", "status": "waiting"},
            )

        conv_for_broadcast = await get_conversation_with_assignee(db, body.conversation_id)
        if conv_for_broadcast is not None:
            await ws_manager.broadcast(
                org_room(conv_for_broadcast.organization_id),
                {
                    "type": "conversation_updated",
                    **ConversationResponse.model_validate(conv_for_broadcast).model_dump(mode="json"),
                },
            )

    return message
