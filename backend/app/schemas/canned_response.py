import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class CreateCannedResponseRequest(BaseModel):
    title: NonEmptyStr
    content: NonEmptyStr


class UpdateCannedResponseRequest(BaseModel):
    title: NonEmptyStr | None = None
    content: NonEmptyStr | None = None


class CannedResponseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    content: str
    created_at: datetime
