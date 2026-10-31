import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization


async def create_organization(db: AsyncSession, name: str) -> Organization:
    org = Organization(
        name=name,
        widget_key=str(uuid.uuid4()),
        invite_token=str(uuid.uuid4()),
    )
    db.add(org)
    await db.flush()
    return org


async def get_organization_by_widget_key(
    db: AsyncSession, widget_key: str
) -> Organization | None:
    result = await db.execute(
        select(Organization).where(Organization.widget_key == widget_key)
    )
    return result.scalar_one_or_none()


async def get_organization_by_invite_token(
    db: AsyncSession, token: str
) -> Organization | None:
    result = await db.execute(
        select(Organization).where(Organization.invite_token == token)
    )
    return result.scalar_one_or_none()


async def get_organization_by_id(db: AsyncSession, org_id: uuid.UUID) -> Organization | None:
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    return result.scalar_one_or_none()


async def rotate_invite_token(db: AsyncSession, org_id: uuid.UUID) -> Organization | None:
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if org is None:
        return None
    org.invite_token = str(uuid.uuid4())
    await db.commit()
    await db.refresh(org)
    return org


async def update_widget_config(
    db: AsyncSession,
    org_id: uuid.UUID,
    widget_color: str | None,
    widget_greeting: str | None,
    widget_position: str | None = None,
    widget_icon_url: str | None = None,
    widget_width: int | None = None,
    widget_height: int | None = None,
    widget_offset_x: int | None = None,
    widget_offset_y: int | None = None,
) -> Organization | None:
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if org is None:
        return None
    if widget_color is not None:
        org.widget_color = widget_color
    if widget_greeting is not None:
        org.widget_greeting = widget_greeting
    if widget_position is not None:
        org.widget_position = widget_position
    if widget_icon_url is not None:
        # An empty string is the "reset to default icon" signal from the request schema.
        org.widget_icon_url = widget_icon_url or None
    if widget_width is not None:
        org.widget_width = widget_width
    if widget_height is not None:
        org.widget_height = widget_height
    if widget_offset_x is not None:
        org.widget_offset_x = widget_offset_x
    if widget_offset_y is not None:
        org.widget_offset_y = widget_offset_y
    await db.commit()
    await db.refresh(org)
    return org


async def update_business_hours(
    db: AsyncSession,
    org_id: uuid.UUID,
    enabled: bool,
    timezone: str,
    schedule: list[dict],
    away_message: str,
) -> Organization | None:
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if org is None:
        return None
    org.business_hours_enabled = enabled
    org.business_hours_timezone = timezone
    org.business_hours = schedule
    org.away_message = away_message
    await db.commit()
    await db.refresh(org)
    return org


async def update_pre_chat_form(
    db: AsyncSession,
    org_id: uuid.UUID,
    name_requirement: str,
    email_requirement: str,
    fields: list[dict],
) -> Organization | None:
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if org is None:
        return None
    org.pre_chat_name = name_requirement
    org.pre_chat_email = email_requirement
    org.pre_chat_fields = fields
    await db.commit()
    await db.refresh(org)
    return org
