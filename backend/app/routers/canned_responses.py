import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_verified_user
from app.models.canned_response import CannedResponse
from app.models.conversation import ConversationStatus
from app.models.user import User
from app.schemas.canned_response import (
    ApplyMacroRequest,
    ApplyMacroResponse,
    CannedResponseResponse,
    CreateCannedResponseRequest,
    UpdateCannedResponseRequest,
    has_actions,
)
from app.services.canned_response import (
    ShortcutTaken,
    apply_macro,
    create_canned_response,
    delete_canned_response,
    get_canned_response,
    get_canned_responses,
    update_canned_response,
)
from app.services.conversation import get_conversation
from app.services.realtime import publish_conversation, publish_message, publish_status

router = APIRouter(prefix="/canned-responses", tags=["canned-responses"])

_SHORTCUT_TAKEN = HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Another saved reply uses that shortcut")


async def _get_own(db: AsyncSession, response_id: uuid.UUID, user: User) -> CannedResponse:
    response = await get_canned_response(db, response_id)
    if response is None or response.organization_id != user.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Canned response not found")
    return response


@router.get("", response_model=list[CannedResponseResponse])
async def list_all(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_verified_user),
) -> list[CannedResponseResponse]:
    return await get_canned_responses(db, current_user.organization_id)


@router.post("", response_model=CannedResponseResponse, status_code=status.HTTP_201_CREATED)
async def create(
    body: CreateCannedResponseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_verified_user),
) -> CannedResponseResponse:
    try:
        return await create_canned_response(
            db, current_user.organization_id, body.title, body.content, body.shortcut, body.actions.model_dump()
        )
    except ShortcutTaken:
        raise _SHORTCUT_TAKEN


@router.patch("/{response_id}", response_model=CannedResponseResponse)
async def update(
    response_id: uuid.UUID,
    body: UpdateCannedResponseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_verified_user),
) -> CannedResponseResponse:
    response = await _get_own(db, response_id, current_user)
    changes = body.model_dump(include=body.model_fields_set)
    # Title and content can't be cleared, only changed.
    for field in ("title", "content", "actions"):
        if changes.get(field, ...) is None:
            del changes[field]
    if not changes.get("content", response.content) and not has_actions(changes.get("actions", response.actions)):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Add reply text or at least one action"
        )
    try:
        return await update_canned_response(db, response, changes)
    except ShortcutTaken:
        raise _SHORTCUT_TAKEN


@router.delete("/{response_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    response_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_verified_user),
) -> None:
    await delete_canned_response(db, await _get_own(db, response_id, current_user))


@router.post("/{response_id}/apply", response_model=ApplyMacroResponse)
async def apply(
    response_id: uuid.UUID,
    body: ApplyMacroRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_verified_user),
) -> ApplyMacroResponse:
    """Run a saved reply on a conversation: send the (edited) text and apply its actions."""
    macro = await _get_own(db, response_id, current_user)
    conv = await get_conversation(db, body.conversation_id)
    if conv is None or conv.organization_id != current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    if not body.content and not has_actions(macro.actions):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Nothing to send")

    was_closed = conv.status == ConversationStatus.CLOSED
    updated, posted = await apply_macro(db, macro, conv, current_user, body.content)
    for message in posted:
        await publish_message(message)
    if was_closed != (updated.status == ConversationStatus.CLOSED):
        await publish_status(updated)
    await publish_conversation(updated)

    reply = next((m for m in posted if not m.is_internal), None)
    return ApplyMacroResponse(conversation=updated, message=reply)
