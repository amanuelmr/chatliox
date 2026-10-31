import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints

from app.models.conversation import ConversationStatus


class CreateConversationRequest(BaseModel):
    visitor_id: str
    visitor_name: str | None = None
    visitor_email: EmailStr | None = None
    widget_key: str
    # Answers to the org's custom pre-chat questions, keyed by question id.
    pre_chat_answers: dict[str, Annotated[str, StringConstraints(max_length=500)]] = Field(
        default_factory=dict, max_length=5
    )


class UpdateConversationStatusRequest(BaseModel):
    status: ConversationStatus


class UpdateConversationTagsRequest(BaseModel):
    tags: list[str]


class SubmitCsatRequest(BaseModel):
    visitor_id: str
    rating: int = Field(ge=1, le=5)


class VisitorTranscriptRequest(BaseModel):
    visitor_id: str
    # Only needed when the visitor didn't leave an email when starting the chat.
    email: EmailStr | None = None


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
    csat_rating: int | None = None
    pre_chat_answers: list[dict] = []
