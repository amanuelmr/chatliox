from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.message import Message
    from app.models.organization import Organization
    from app.models.user import User


class ConversationStatus(str, enum.Enum):
    OPEN = "open"
    WAITING = "waiting"   # visitor sent a message, no admin reply yet
    CLOSED = "closed"


class Conversation(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "conversations"

    # Visitor identity — anonymous by default, enriched optionally
    visitor_id: Mapped[str] = mapped_column(String(255), nullable=False)
    visitor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    visitor_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    status: Mapped[ConversationStatus] = mapped_column(
        Enum(ConversationStatus, name="conversation_status", values_callable=lambda obj: [e.value for e in obj]),
        default=ConversationStatus.WAITING,
        nullable=False,
    )

    # Denormalized: updated on every new message so we can ORDER BY without
    # aggregating across the messages table — critical for the dashboard list.
    last_message_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Set once an "unanswered too long" email alert has fired, so the sweep
    # doesn't re-notify the team every poll cycle for the same silence.
    waiting_alert_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    tags: Mapped[list[str]] = mapped_column(
        ARRAY(String(50)), nullable=False, default=list, server_default="{}"
    )

    # 1-5, set by the visitor after a conversation is resolved.
    csat_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    assigned_to_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    organization: Mapped[Organization] = relationship(
        "Organization", back_populates="conversations"
    )
    assigned_to: Mapped[User | None] = relationship(
        "User", back_populates="assigned_conversations", foreign_keys=[assigned_to_id]
    )
    messages: Mapped[list[Message]] = relationship(
        "Message", back_populates="conversation", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_conversations_visitor_id", "visitor_id"),
        Index("ix_conversations_status", "status"),
        Index("ix_conversations_last_message_at", "last_message_at"),
        Index("ix_conversations_organization_id", "organization_id"),
    )

    @property
    def assigned_to_name(self) -> str | None:
        return self.assigned_to.full_name if self.assigned_to else None

    def __repr__(self) -> str:
        return f"<Conversation {self.id} [{self.status}]>"
