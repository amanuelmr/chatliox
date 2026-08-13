import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_verified_user
from app.core.limiter import limiter
from app.core.ws_manager import manager as ws_manager
from app.models.conversation import ConversationStatus
from app.models.user import User
from app.schemas.conversation import (
    ConversationResponse,
    CreateConversationRequest,
    SubmitCsatRequest,
    UpdateConversationStatusRequest,
    UpdateConversationTagsRequest,
)
from app.schemas.message import MessageResponse
from app.services.conversation import (
    create_conversation,
    get_conversation,
    get_conversations,
    mark_visitor_messages_read,
    submit_csat,
    update_conversation_status,
    update_conversation_tags,
)
from app.services.message import get_messages
from app.services.organization import get_organization_by_widget_key
from app.websockets.router import org_room

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def create(
    request: Request,
    body: CreateConversationRequest,
    db: AsyncSession = Depends(get_db),
) -> ConversationResponse:
    org = await get_organization_by_widget_key(db, body.widget_key)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid widget key")

    conversation = await create_conversation(
        db,
        body.visitor_id,
        body.visitor_name,
        body.visitor_email,
        org.id,
    )
    await ws_manager.broadcast(
        org_room(org.id),
        {"type": "conversation_created", **ConversationResponse.model_validate(conversation).model_dump(mode="json")},
    )
    return conversation


@router.get("", response_model=list[ConversationResponse])
async def list_all(
    status: ConversationStatus | None = None,
    tag: str | None = None,
    q: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_verified_user),
) -> list[ConversationResponse]:
    return await get_conversations(db, current_user.organization_id, status, tag, q)


@router.get("/{conversation_id}/messages", response_model=list[MessageResponse])
async def list_messages(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_verified_user),
) -> list[MessageResponse]:
    conv = await get_conversation(db, conversation_id)
    if not conv or conv.organization_id != current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    await mark_visitor_messages_read(db, conversation_id)
    return await get_messages(db, conversation_id)


@router.patch("/{conversation_id}/status", response_model=ConversationResponse)
async def update_status(
    conversation_id: uuid.UUID,
    body: UpdateConversationStatusRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_verified_user),
) -> ConversationResponse:
    conv = await get_conversation(db, conversation_id)
    if not conv or conv.organization_id != current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    updated = await update_conversation_status(db, conversation_id, body.status)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    await ws_manager.broadcast(
        str(conversation_id),
        {"type": "status", "status": body.status.value},
    )
    await ws_manager.broadcast(
        org_room(updated.organization_id),
        {"type": "conversation_updated", **ConversationResponse.model_validate(updated).model_dump(mode="json")},
    )
    return updated


@router.patch("/{conversation_id}/tags", response_model=ConversationResponse)
async def update_tags(
    conversation_id: uuid.UUID,
    body: UpdateConversationTagsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_verified_user),
) -> ConversationResponse:
    conv = await get_conversation(db, conversation_id)
    if not conv or conv.organization_id != current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    updated = await update_conversation_tags(db, conversation_id, body.tags)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    await ws_manager.broadcast(
        org_room(updated.organization_id),
        {"type": "conversation_updated", **ConversationResponse.model_validate(updated).model_dump(mode="json")},
    )
    return updated


@router.post("/{conversation_id}/csat", response_model=ConversationResponse)
@limiter.limit("5/minute")
async def submit_conversation_csat(
    request: Request,
    conversation_id: uuid.UUID,
    body: SubmitCsatRequest,
    db: AsyncSession = Depends(get_db),
) -> ConversationResponse:
    updated = await submit_csat(db, conversation_id, body.visitor_id, body.rating)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    await ws_manager.broadcast(
        org_room(updated.organization_id),
        {"type": "conversation_updated", **ConversationResponse.model_validate(updated).model_dump(mode="json")},
    )
    return updated


@router.get("/{conversation_id}/visitor-status")
async def get_visitor_status(
    conversation_id: uuid.UUID,
    visitor_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    conv = await get_conversation(db, conversation_id)
    if not conv or str(conv.visitor_id) != visitor_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return {"status": conv.status.value}


@router.get("/{conversation_id}/visitor-messages", response_model=list[MessageResponse])
async def list_visitor_messages(
    conversation_id: uuid.UUID,
    visitor_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
) -> list[MessageResponse]:
    conv = await get_conversation(db, conversation_id)
    if not conv or str(conv.visitor_id) != visitor_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    messages = await get_messages(db, conversation_id)
    return [m for m in messages if not m.is_internal]
