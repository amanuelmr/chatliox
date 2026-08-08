import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.conversation import ConversationStatus


class CreateConversationRequest(BaseModel):
    visitor_id: str
    visitor_name: str | None = None
    visitor_email: EmailStr | None = None
    widget_key: str


class UpdateConversationStatusRequest(BaseModel):
    status: ConversationStatus


class UpdateConversationTagsRequest(BaseModel):
    tags: list[str]


class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    visitor_id: str
    visitor_name: str | None
    visitor_email: str | None
    status: ConversationStatus
    last_message_at: datetime | None
    created_at: datetime
    assigned_to_name: str | None = None
    tags: list[str] = []
