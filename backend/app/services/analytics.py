import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation, ConversationStatus
from app.models.message import Message, SenderType
from app.models.user import User


async def get_analytics_summary(db: AsyncSession, organization_id: uuid.UUID) -> dict:
    status_rows = await db.execute(
        select(Conversation.status, func.count())
        .where(Conversation.organization_id == organization_id)
        .group_by(Conversation.status)
    )
    status_counts = {row[0].value: row[1] for row in status_rows.all()}
    total = sum(status_counts.values())

    # Average time from conversation start to the first non-internal admin reply.
    first_admin_reply = (
        select(
            Message.conversation_id.label("conversation_id"),
            func.min(Message.created_at).label("first_admin_at"),
        )
        .where(Message.sender_type == SenderType.ADMIN, Message.is_internal.is_(False))
        .group_by(Message.conversation_id)
        .subquery()
    )
    response_rows = await db.execute(
        select(Conversation.created_at, first_admin_reply.c.first_admin_at)
        .join(first_admin_reply, first_admin_reply.c.conversation_id == Conversation.id)
        .where(Conversation.organization_id == organization_id)
    )
    diffs_minutes = [
        (first_at - created_at).total_seconds() / 60
        for created_at, first_at in response_rows.all()
        if first_at is not None
    ]
    avg_first_response_minutes = sum(diffs_minutes) / len(diffs_minutes) if diffs_minutes else None

    since = datetime.now(timezone.utc) - timedelta(days=7)
    day_expr = func.date_trunc("day", Conversation.created_at)
    volume_rows = await db.execute(
        select(day_expr, func.count())
        .where(Conversation.organization_id == organization_id, Conversation.created_at >= since)
        .group_by(day_expr)
        .order_by(day_expr)
    )
    volume_by_day = [
        {"date": day.date().isoformat(), "count": count} for day, count in volume_rows.all()
    ]

    agent_rows = await db.execute(
        select(User.full_name, func.count())
        .join(Conversation, Conversation.assigned_to_id == User.id)
        .where(
            Conversation.organization_id == organization_id,
            Conversation.status == ConversationStatus.CLOSED,
        )
        .group_by(User.full_name)
        .order_by(func.count().desc())
    )
    per_agent = [{"agent_name": name, "resolved_count": count} for name, count in agent_rows.all()]

    return {
        "total_conversations": total,
        "waiting_count": status_counts.get("waiting", 0),
        "open_count": status_counts.get("open", 0),
        "closed_count": status_counts.get("closed", 0),
        "avg_first_response_minutes": avg_first_response_minutes,
        "volume_by_day": volume_by_day,
        "per_agent": per_agent,
    }
