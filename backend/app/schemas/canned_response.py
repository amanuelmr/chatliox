import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, StringConstraints, model_validator

from app.schemas.conversation import ConversationResponse
from app.schemas.message import MessageResponse

NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


def _normalize_shortcut(value: object) -> object:
    # Accept " /Refund " the way people type it.
    return value.strip().lstrip("/").lower() if isinstance(value, str) else value


Shortcut = Annotated[
    str, BeforeValidator(_normalize_shortcut), StringConstraints(pattern=r"^[a-z0-9][a-z0-9-]{0,31}$")
]
Tag = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
Content = Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)]


class MacroActions(BaseModel):
    add_tags: list[Tag] = Field(default_factory=list, max_length=5)
    # "me" assigns whoever runs the macro.
    assign: Literal["me", "unassign"] | None = None
    resolve: bool = False

    def any(self) -> bool:
        return bool(self.add_tags or self.assign or self.resolve)


def has_actions(actions: dict | None) -> bool:
    return MacroActions.model_validate(actions or {}).any()


class CreateCannedResponseRequest(BaseModel):
    title: NonEmptyStr
    content: Content = ""
    shortcut: Shortcut | None = None
    actions: MacroActions = Field(default_factory=MacroActions)

    @model_validator(mode="after")
    def does_something(self) -> "CreateCannedResponseRequest":
        if not self.content and not self.actions.any():
            raise ValueError("Add reply text or at least one action")
        return self


class UpdateCannedResponseRequest(BaseModel):
    # Only the fields sent are changed; send "shortcut": null to remove it.
    title: NonEmptyStr | None = None
    content: Content | None = None
    shortcut: Shortcut | None = None
    actions: MacroActions | None = None


class CannedResponseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    content: str
    shortcut: str | None
    actions: MacroActions
    use_count: int
    created_at: datetime


class ApplyMacroRequest(BaseModel):
    conversation_id: uuid.UUID
    # The reply as the agent left it after editing; empty sends no reply.
    content: Content = ""


class ApplyMacroResponse(BaseModel):
    conversation: ConversationResponse
    message: MessageResponse | None
