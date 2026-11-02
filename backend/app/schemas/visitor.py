from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PageViewResponse(BaseModel):
    url: str
    title: str
    at: datetime


class LiveVisitorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    visitor_id: str
    arrived_at: datetime
    user_agent: str | None
    referrer: str | None
    # Oldest first; the last one is the page they're on now.
    pages: list[PageViewResponse]
