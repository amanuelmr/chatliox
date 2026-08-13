import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.core.email import send_invite_email
from app.models.user import User, UserRole
from app.schemas.user import MemberResponse, OrganizationInfo
from app.schemas.widget import UpdateWidgetConfigRequest, WidgetConfigResponse
from app.services.organization import get_organization_by_widget_key, rotate_invite_token, update_widget_config
from app.services.user import get_members_by_org

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("/members", response_model=list[MemberResponse])
async def list_members(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> list[MemberResponse]:
    return await get_members_by_org(db, current_user.organization_id)


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


@router.post("/invite/send-email", status_code=status.HTTP_204_NO_CONTENT)
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
    org = await update_widget_config(db, current_user.organization_id, body.widget_color, body.widget_greeting)
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return org


@router.get("/widget/{widget_key}", response_model=WidgetConfigResponse)
async def get_widget_config(
    widget_key: str,
    db: AsyncSession = Depends(get_db),
) -> WidgetConfigResponse:
    org = await get_organization_by_widget_key(db, widget_key)
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid widget key")
    return org
