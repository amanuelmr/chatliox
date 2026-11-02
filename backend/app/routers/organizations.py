import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin, require_email_configured, require_verified_user
from app.core.email import send_invite_email
from app.models.conversation import Conversation
from app.models.user import User, UserRole
from app.schemas.user import MemberResponse, OrganizationInfo, TeammateResponse
from app.schemas.widget import (
    ProactiveMessageStats,
    UpdateDisplayRulesRequest,
    UpdateProactiveMessagesRequest,
    UpdateWelcomeRequest,
    UpdateBusinessHoursRequest,
    UpdatePreChatFormRequest,
    UpdateWidgetConfigRequest,
    WidgetConfigResponse,
)
from app.services.business_hours import is_within_business_hours
from app.services.pre_chat import assign_field_ids
from app.services.organization import (
    get_organization_by_widget_key,
    rotate_invite_token,
    update_auto_assign,
    update_response_target,
    update_organization,
    update_typing_preview,
    update_business_hours,
    update_pre_chat_form,
    update_widget_config,
)
from app.services.user import get_members_by_org, get_teammates

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("/members", response_model=list[MemberResponse])
async def list_members(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> list[MemberResponse]:
    return await get_members_by_org(db, current_user.organization_id)


@router.get("/teammates", response_model=list[TeammateResponse])
async def list_teammates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_verified_user),
) -> list[TeammateResponse]:
    """Who a chat can be handed to. Unlike /members, any teammate may ask."""
    return await get_teammates(db, current_user.organization_id)


class UpdateRoleRequest(BaseModel):
    role: UserRole


@router.patch("/members/{member_id}/role", response_model=MemberResponse)
async def update_member_role(
    member_id: uuid.UUID,
    body: UpdateRoleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> MemberResponse:
    from sqlalchemy import select
    from app.models.user import User as UserModel
    result = await db.execute(
        select(UserModel).where(
            UserModel.id == member_id,
            UserModel.organization_id == current_user.organization_id,
            UserModel.is_active == True,  # noqa: E712
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    if member.id == current_user.id and body.role != UserRole.ADMIN:
        # Prevent self-demotion — ensure at least one admin remains
        from sqlalchemy import func
        count_result = await db.execute(
            select(func.count()).select_from(UserModel).where(
                UserModel.organization_id == current_user.organization_id,
                UserModel.role == UserRole.ADMIN,
                UserModel.is_active == True,  # noqa: E712
            )
        )
        if (count_result.scalar() or 0) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the only admin",
            )
    member.role = body.role
    await db.commit()
    await db.refresh(member)
    return member


@router.delete("/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    member_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> None:
    if member_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove yourself")
    from sqlalchemy import select
    from app.models.user import User as UserModel
    result = await db.execute(
        select(UserModel).where(
            UserModel.id == member_id,
            UserModel.organization_id == current_user.organization_id,
            UserModel.is_active == True,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    member.is_active = False
    await db.commit()


@router.post("/invite/rotate", response_model=OrganizationInfo)
async def rotate_invite(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> OrganizationInfo:
    org = await rotate_invite_token(db, current_user.organization_id)
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return org


class SendInviteRequest(BaseModel):
    email: EmailStr


@router.post(
    "/invite/send-email",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_email_configured)],
)
async def send_invite(
    body: SendInviteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> None:
    from app.services.organization import get_organization_by_id
    org = await get_organization_by_id(db, current_user.organization_id)
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    from app.core.config import settings
    base_url = settings.ALLOWED_ORIGINS.split(",")[0].strip().rstrip("/")
    invite_url = f"{base_url}/join/{org.invite_token}"

    try:
        await send_invite_email(body.email, org.name, invite_url)
    except Exception as exc:
        logger.exception("Failed to send invite email to %s: %s", body.email, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to send invite email. Check your Resend settings.",
        ) from exc


@router.patch("/widget", response_model=OrganizationInfo)
async def update_widget(
    body: UpdateWidgetConfigRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> OrganizationInfo:
    org = await update_widget_config(
        db,
        current_user.organization_id,
        body.widget_color,
        body.widget_greeting,
        body.widget_position,
        body.widget_icon_url,
        body.widget_width,
        body.widget_height,
        body.widget_offset_x,
        body.widget_offset_y,
        body.widget_launcher,
        body.widget_custom_css,
    )
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return org


@router.put("/business-hours", response_model=OrganizationInfo)
async def set_business_hours(
    body: UpdateBusinessHoursRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> OrganizationInfo:
    org = await update_business_hours(
        db,
        current_user.organization_id,
        body.business_hours_enabled,
        body.business_hours_timezone,
        [day.model_dump() for day in body.business_hours],
        body.away_message,
    )
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return org


@router.put("/pre-chat-form", response_model=OrganizationInfo)
async def set_pre_chat_form(
    body: UpdatePreChatFormRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> OrganizationInfo:
    org = await update_pre_chat_form(
        db,
        current_user.organization_id,
        body.pre_chat_name,
        body.pre_chat_email,
        assign_field_ids(body.pre_chat_fields),
    )
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return org


class UpdateAutoAssignRequest(BaseModel):
    auto_assign: bool


@router.put("/auto-assign", response_model=OrganizationInfo)
async def set_auto_assign(
    body: UpdateAutoAssignRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> OrganizationInfo:
    org = await update_auto_assign(db, current_user.organization_id, body.auto_assign)
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return org


class UpdateTypingPreviewRequest(BaseModel):
    typing_preview: bool


@router.put("/typing-preview", response_model=OrganizationInfo)
async def set_typing_preview(
    body: UpdateTypingPreviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> OrganizationInfo:
    org = await update_typing_preview(db, current_user.organization_id, body.typing_preview)
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return org


class UpdateResponseTargetRequest(BaseModel):
    # None turns the target off.
    first_response_minutes: int | None = Field(default=None, ge=1, le=1440)


@router.put("/response-target", response_model=OrganizationInfo)
async def set_response_target(
    body: UpdateResponseTargetRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> OrganizationInfo:
    org = await update_response_target(db, current_user.organization_id, body.first_response_minutes)
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return org


async def _save(db: AsyncSession, user: User, values: dict) -> OrganizationInfo:
    org = await update_organization(db, user.organization_id, values)
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return org


@router.put("/welcome", response_model=OrganizationInfo)
async def set_welcome(
    body: UpdateWelcomeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> OrganizationInfo:
    return await _save(db, current_user, body.model_dump())


@router.put("/proactive-messages", response_model=OrganizationInfo)
async def set_proactive_messages(
    body: UpdateProactiveMessagesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> OrganizationInfo:
    # New messages get an id, which chats started from them refer back to.
    messages, seen = [], set()
    for message in body.proactive_messages:
        if message.id is None or message.id in seen:
            message.id = uuid.uuid4().hex[:8]
        seen.add(message.id)
        messages.append(message.model_dump())
    return await _save(db, current_user, {"proactive_messages": messages})


@router.get("/proactive-messages/stats", response_model=list[ProactiveMessageStats])
async def proactive_message_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_verified_user),
) -> list[ProactiveMessageStats]:
    """How many chats each proactive message has started."""
    rows = await db.execute(
        select(Conversation.proactive_message_id, func.count())
        .where(
            Conversation.organization_id == current_user.organization_id,
            Conversation.proactive_message_id.is_not(None),
        )
        .group_by(Conversation.proactive_message_id)
    )
    return [ProactiveMessageStats(id=id_, chats=count) for id_, count in rows.all()]


@router.put("/display-rules", response_model=OrganizationInfo)
async def set_display_rules(
    body: UpdateDisplayRulesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> OrganizationInfo:
    return await _save(db, current_user, body.model_dump())


@router.get("/widget/{widget_key}", response_model=WidgetConfigResponse)
async def get_widget_config(
    widget_key: str,
    db: AsyncSession = Depends(get_db),
) -> WidgetConfigResponse:
    org = await get_organization_by_widget_key(db, widget_key)
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid widget key")
    return WidgetConfigResponse.model_validate(org).model_copy(
        update={"is_online": is_within_business_hours(org)}
    )
