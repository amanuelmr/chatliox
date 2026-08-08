from __future__ import annotations

import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.conversation import Conversation
    from app.models.user import User


class SenderType(str, enum.Enum):
    ADMIN = "admin"
    VISITOR = "visitor"


class Message(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "messages"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
    )

    sender_type: Mapped[SenderType] = mapped_column(
        Enum(SenderType, name="sender_type", values_callable=lambda obj: [e.value for e in obj]), nullable=False
    )

    # Null when sender_type = VISITOR (anonymous)
    sender_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    content: Mapped[str] = mapped_column(Text, nullable=False)

    # True = admin has read this message.
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Internal notes are only visible to admins — never broadcast to visitor WS connections.
    is_internal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="false")

    attachment_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    attachment_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    attachment_mime: Mapped[str | None] = mapped_column(String(127), nullable=True)

    conversation: Mapped[Conversation] = relationship(
        "Conversation", back_populates="messages"
    )
    sender: Mapped[User | None] = relationship(
        "User", back_populates="messages"
    )

    __table_args__ = (
        # Primary access pattern: fetch all messages in a conversation, ordered by time
        Index("ix_messages_conversation_id_created_at", "conversation_id", "created_at"),
        Index("ix_messages_sender_id", "sender_id"),
    )

    @property
    def sender_name(self) -> str | None:
        return self.sender.full_name if self.sender else None

    def __repr__(self) -> str:
        return f"<Message {self.id} [{self.sender_type}]>"
