import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.models.message import SenderType

NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class CreateMessageRequest(BaseModel):
    conversation_id: uuid.UUID
    content: NonEmptyStr
    sender_type: SenderType
    is_internal: bool = False


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_type: SenderType
    sender_id: uuid.UUID | None
    sender_name: str | None = None
    content: str
    is_read: bool
    is_internal: bool
    created_at: datetime
    attachment_url: str | None = None
    attachment_name: str | None = None
    attachment_mime: str | None = None
