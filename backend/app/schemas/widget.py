from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

HexColor = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]
GreetingStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=280)]


class WidgetConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    widget_color: str
    widget_greeting: str


class UpdateWidgetConfigRequest(BaseModel):
    widget_color: HexColor | None = Field(default=None)
    widget_greeting: GreetingStr | None = Field(default=None)
