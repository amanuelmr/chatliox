from __future__ import annotations

import json
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Index, Integer, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.conversation import Conversation
    from app.models.user import User


# Mon–Fri 09:00–17:00, weekends off.
DEFAULT_BUSINESS_HOURS: list[dict] = [
    {"enabled": day < 5, "start": "09:00", "end": "17:00"} for day in range(7)
]
DEFAULT_BUSINESS_HOURS_JSON = json.dumps(DEFAULT_BUSINESS_HOURS)


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
    widget_position: Mapped[str] = mapped_column(String(10), nullable=False, server_default="right")
    widget_icon_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    widget_width: Mapped[int] = mapped_column(Integer, nullable=False, server_default="376")
    widget_height: Mapped[int] = mapped_column(Integer, nullable=False, server_default="600")
    widget_offset_x: Mapped[int] = mapped_column(Integer, nullable=False, server_default="20")
    widget_offset_y: Mapped[int] = mapped_column(Integer, nullable=False, server_default="20")

    # When enabled, the widget switches to an away mode outside the weekly schedule.
    # The schedule is 7 entries, Monday first: {"enabled": bool, "start": "HH:MM", "end": "HH:MM"}.
    business_hours_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    business_hours_timezone: Mapped[str] = mapped_column(String(64), nullable=False, server_default="UTC")
    business_hours: Mapped[list[dict]] = mapped_column(
        JSONB, nullable=False, server_default=text(f"'{DEFAULT_BUSINESS_HOURS_JSON}'::jsonb")
    )
    away_message: Mapped[str] = mapped_column(
        String(280),
        nullable=False,
        server_default="We're away right now. Leave a message and we'll get back to you by email.",
    )

    # Pre-chat form: name and email are "hidden", "optional" or "required", plus up
    # to five custom questions: {"id", "label", "type": "text"|"select", "options", "required"}.
    pre_chat_name: Mapped[str] = mapped_column(String(10), nullable=False, server_default="optional")
    pre_chat_email: Mapped[str] = mapped_column(String(10), nullable=False, server_default="optional")
    pre_chat_fields: Mapped[list[dict]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )

    # Hand each new chat to the next teammate with the dashboard open, in turn.
    auto_assign: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    users: Mapped[list[User]] = relationship("User", back_populates="organization")
    conversations: Mapped[list[Conversation]] = relationship(
        "Conversation", back_populates="organization"
    )

    __table_args__ = (Index("ix_organizations_widget_key", "widget_key"),)

    def __repr__(self) -> str:
        return f"<Organization {self.name}>"
