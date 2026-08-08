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
) -> Organization | None:
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if org is None:
        return None
    if widget_color is not None:
        org.widget_color = widget_color
    if widget_greeting is not None:
        org.widget_greeting = widget_greeting
    await db.commit()
    await db.refresh(org)
    return org
