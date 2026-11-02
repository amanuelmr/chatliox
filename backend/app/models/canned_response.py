from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class CannedResponse(UUIDMixin, TimestampMixin, Base):
    """A saved reply. With actions it works as a macro: one step that replies,
    tags, assigns and resolves."""

    __tablename__ = "canned_responses"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    # May be empty when the macro only runs actions.
    content: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    # Typed after "/" in the reply box, unique within the org.
    shortcut: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # {"add_tags": [...], "assign": "me" | "unassign" | None, "resolve": bool}
    actions: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb"))
    use_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    __table_args__ = (
        Index("ix_canned_responses_organization_id", "organization_id"),
        Index(
            "uq_canned_responses_org_shortcut",
            "organization_id",
            "shortcut",
            unique=True,
            postgresql_where=text("shortcut IS NOT NULL"),
        ),
    )

    def __repr__(self) -> str:
        return f"<CannedResponse {self.title}>"
