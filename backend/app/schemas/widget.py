from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

HexColor = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]
GreetingStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=280)]
IconUrl = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500, pattern=r"^https?://.+")]
WidgetPosition = Literal["left", "right"]


class WidgetConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    widget_color: str
    widget_greeting: str
    widget_position: WidgetPosition
    widget_icon_url: str | None
    widget_width: int
    widget_height: int
    widget_offset_x: int
    widget_offset_y: int


class UpdateWidgetConfigRequest(BaseModel):
    widget_color: HexColor | None = Field(default=None)
    widget_greeting: GreetingStr | None = Field(default=None)
    widget_position: WidgetPosition | None = Field(default=None)
    # Empty string clears a previously-set custom icon back to the built-in default.
    widget_icon_url: IconUrl | Literal[""] | None = Field(default=None)
    widget_width: int | None = Field(default=None, ge=320, le=520)
    widget_height: int | None = Field(default=None, ge=400, le=800)
    widget_offset_x: int | None = Field(default=None, ge=0, le=200)
    widget_offset_y: int | None = Field(default=None, ge=0, le=200)
