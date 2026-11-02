import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def pick_assignee(
    db: AsyncSession, organization_id: uuid.UUID, online_ids: set[str]
) -> uuid.UUID | None:
    """The online teammate who was assigned a chat longest ago, or None if nobody's
    online. Leaves the choice uncommitted so it lands with the new conversation."""
    if not online_ids:
        return None
    result = await db.execute(
        select(User)
        .where(
            User.organization_id == organization_id,
            User.id.in_([uuid.UUID(i) for i in online_ids]),
            User.is_active.is_(True),
            User.is_verified.is_(True),
        )
        .order_by(User.last_assigned_at.asc().nulls_first(), User.created_at)
        .limit(1)
        # Two chats arriving together each lock a different teammate instead of
        # both going to the same one.
        .with_for_update(skip_locked=True)
    )
    user = result.scalar_one_or_none()
    if user is None:
        return None
    user.last_assigned_at = datetime.now(timezone.utc)
    return user.id
