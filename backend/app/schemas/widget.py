from typing import Annotated, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

HexColor = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]
GreetingStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=280)]
IconUrl = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500, pattern=r"^https?://.+")]
WidgetPosition = Literal["left", "right"]
ClockTime = Annotated[str, StringConstraints(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]
FieldRequirement = Literal["hidden", "optional", "required"]
ShortLabel = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]


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
    business_hours_enabled: bool
    away_message: str
    pre_chat_name: FieldRequirement
    pre_chat_email: FieldRequirement
    pre_chat_fields: list[dict]
    # Computed per request from the org's schedule; always true when the schedule is off.
    is_online: bool = True


class BusinessHoursDay(BaseModel):
    enabled: bool
    start: ClockTime
    end: ClockTime

    @model_validator(mode="after")
    def end_after_start(self) -> "BusinessHoursDay":
        if self.enabled and self.end <= self.start:
            raise ValueError("Closing time must be after opening time")
        return self


class UpdateBusinessHoursRequest(BaseModel):
    business_hours_enabled: bool
    business_hours_timezone: str = Field(max_length=64)
    # Monday first.
    business_hours: list[BusinessHoursDay] = Field(min_length=7, max_length=7)
    away_message: GreetingStr

    @field_validator("business_hours_timezone")
    @classmethod
    def known_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError("Unknown timezone") from exc
        return value


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


class PreChatField(BaseModel):
    # Omitted for new questions; the server assigns one.
    id: Annotated[str, StringConstraints(pattern=r"^[a-z0-9]{1,16}$")] | None = None
    label: ShortLabel
    type: Literal["text", "select"]
    options: list[ShortLabel] = Field(default_factory=list, max_length=10)
    required: bool = False

    @model_validator(mode="after")
    def options_match_type(self) -> "PreChatField":
        if self.type == "select":
            if len(self.options) < 2:
                raise ValueError("A dropdown needs at least two options")
            if len(set(self.options)) != len(self.options):
                raise ValueError("Dropdown options must be unique")
        else:
            self.options = []
        return self


class UpdatePreChatFormRequest(BaseModel):
    pre_chat_name: FieldRequirement
    pre_chat_email: FieldRequirement
    pre_chat_fields: list[PreChatField] = Field(default_factory=list, max_length=5)

    @model_validator(mode="after")
    def unique_labels(self) -> "UpdatePreChatFormRequest":
        labels = [f.label.lower() for f in self.pre_chat_fields]
        if len(set(labels)) != len(labels):
            raise ValueError("Each question needs a different label")
        return self
