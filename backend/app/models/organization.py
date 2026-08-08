from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.conversation import Conversation
    from app.models.user import User


class Organization(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    widget_key: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    invite_token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))

    widget_color: Mapped[str] = mapped_column(String(7), nullable=False, server_default="#4f6ef7")
    widget_greeting: Mapped[str] = mapped_column(
        String(280),
        nullable=False,
        server_default="Send us a message and we'll get back to you shortly.",
    )

    users: Mapped[list[User]] = relationship("User", back_populates="organization")
    conversations: Mapped[list[Conversation]] = relationship(
        "Conversation", back_populates="organization"
    )

    __table_args__ = (Index("ix_organizations_widget_key", "widget_key"),)

    def __repr__(self) -> str:
        return f"<Organization {self.name}>"
