import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.user import UserRole


class OrganizationInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    widget_key: str
    invite_token: str
    widget_color: str
    widget_greeting: str
    widget_position: str
    widget_icon_url: str | None
    widget_width: int
    widget_height: int
    widget_offset_x: int
    widget_offset_y: int
    business_hours_enabled: bool
    business_hours_timezone: str
    business_hours: list[dict]
    away_message: str
    pre_chat_name: str
    pre_chat_email: str
    pre_chat_fields: list[dict]
    auto_assign: bool
    first_response_minutes: int | None
    typing_preview: bool
    welcome_messages: list[str]
    quick_replies: list[str]
    proactive_messages: list[dict]
    widget_devices: str
    widget_hidden_paths: list[str]
    widget_allowed_domains: list[str]


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str
    is_active: bool
    is_verified: bool
    role: UserRole
    created_at: datetime
    organization: OrganizationInfo


class TeammateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str


class MemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: UserRole
    created_at: datetime
