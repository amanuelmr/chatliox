import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import hash_password
from app.models.user import User, UserRole


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await db.execute(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.organization))
    )
    return result.scalar_one_or_none()


async def get_members_by_org(db: AsyncSession, organization_id: uuid.UUID) -> list[User]:
    result = await db.execute(
        select(User)
        .where(User.organization_id == organization_id)
        .where(User.is_active == True)  # noqa: E712
        .order_by(User.created_at.asc())
    )
    return list(result.scalars().all())


async def get_teammates(db: AsyncSession, organization_id: uuid.UUID) -> list[User]:
    result = await db.execute(
        select(User)
        .where(
            User.organization_id == organization_id,
            User.is_active.is_(True),
            User.is_verified.is_(True),
        )
        .order_by(User.full_name)
    )
    return list(result.scalars().all())


async def create_user(
    db: AsyncSession,
    email: str,
    password: str,
    full_name: str,
    organization_id: uuid.UUID,
    role: UserRole = UserRole.AGENT,
) -> User:
    user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
        organization_id=organization_id,
        role=role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    # Load org so UserResponse serialization works immediately
    await db.refresh(user, ["organization"])
    return user
