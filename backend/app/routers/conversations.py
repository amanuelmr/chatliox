import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_email_configured, require_verified_user
from app.core.limiter import limiter
from app.core.ws_manager import manager as ws_manager
from app.models.conversation import Conversation, ConversationStatus
from app.models.user import User
from app.schemas.conversation import (
    ConversationResponse,
    CreateConversationRequest,
    SubmitCsatRequest,
    UpdateConversationStatusRequest,
    UpdateConversationTagsRequest,
    VisitorTranscriptRequest,
)
from app.schemas.message import MessageResponse
from app.services.conversation import (
    create_conversation,
    get_conversation,
    get_conversations,
    set_visitor_email,
    mark_visitor_messages_read,
    submit_csat,
    touch_visitor_last_seen,
    update_conversation_status,
    update_conversation_tags,
)
from app.services.business_hours import is_within_business_hours
from app.services.message import get_messages
from app.services.organization import get_organization_by_id, get_organization_by_widget_key
from app.services.pre_chat import PreChatError, collect_pre_chat_answers
from app.services.transcript import email_transcript
from app.websockets.router import org_room

router = APIRouter(prefix="/conversations", tags=["conversations"])
logger = logging.getLogger(__name__)


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

    # Outside business hours nobody will reply live, so the visitor must leave
    # an email or the team has no way to follow up.
    if not body.visitor_email and not is_within_business_hours(org):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="An email address is required outside business hours",
        )

    try:
        answers = collect_pre_chat_answers(org, body)
    except PreChatError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    conversation = await create_conversation(
        db,
        body.visitor_id,
        (body.visitor_name or "").strip() or None,
        body.visitor_email,
        org.id,
        answers,
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
    return {"status": conv.status.value, "has_email": conv.visitor_email is not None}


async def _send_transcript(db: AsyncSession, conv: Conversation, to_email: str) -> None:
    org = await get_organization_by_id(db, conv.organization_id)
    try:
        await email_transcript(db, conv, org, to_email)
    except Exception as exc:
        logger.exception("Failed to email transcript for %s", conv.id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Couldn't send the transcript. Please try again.",
        ) from exc


@router.post(
    "/{conversation_id}/transcript",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_email_configured)],
)
@limiter.limit("10/hour")
async def send_transcript_to_visitor(
    request: Request,
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_verified_user),
) -> None:
    """An agent emails the transcript to the address the visitor left."""
    conv = await get_conversation(db, conversation_id)
    if not conv or conv.organization_id != current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    if not conv.visitor_email:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This visitor didn't leave an email address",
        )
    await _send_transcript(db, conv, conv.visitor_email)


@router.post(
    "/{conversation_id}/visitor-transcript",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_email_configured)],
)
@limiter.limit("3/hour")
async def send_transcript_to_self(
    request: Request,
    conversation_id: uuid.UUID,
    body: VisitorTranscriptRequest,
    db: AsyncSession = Depends(get_db),
) -> None:
    """The visitor asks for a copy. It always goes to the email on the conversation;
    a visitor who never left one can add it here, which also lets the team follow up."""
    conv = await get_conversation(db, conversation_id)
    if not conv or str(conv.visitor_id) != body.visitor_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    if not conv.visitor_email:
        if not body.email:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Please enter your email",
            )
        conv = await set_visitor_email(db, conv, body.email)
        await ws_manager.broadcast(
            org_room(conv.organization_id),
            {"type": "conversation_updated", **ConversationResponse.model_validate(conv).model_dump(mode="json")},
        )
    await _send_transcript(db, conv, conv.visitor_email)


@router.get("/{conversation_id}/visitor-messages", response_model=list[MessageResponse])
async def list_visitor_messages(
    conversation_id: uuid.UUID,
    visitor_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
) -> list[MessageResponse]:
    conv = await get_conversation(db, conversation_id)
    if not conv or str(conv.visitor_id) != visitor_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    await touch_visitor_last_seen(db, conversation_id)
    messages = await get_messages(db, conversation_id)
    return [m for m in messages if not m.is_internal]
