from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.models.organization import Organization


def _parse_hhmm(value: str) -> time:
    hours, minutes = value.split(":")
    return time(int(hours), int(minutes))


def is_within_business_hours(org: Organization, now: datetime | None = None) -> bool:
    """Whether the team is inside its weekly schedule right now.

    Orgs that haven't turned the schedule on are always treated as online, so
    the widget behaves exactly as before for them.
    """
    if not org.business_hours_enabled:
        return True

    try:
        tz = ZoneInfo(org.business_hours_timezone)
    except ZoneInfoNotFoundError:
        tz = ZoneInfo("UTC")

    local_now = (now or datetime.now(timezone.utc)).astimezone(tz)
    day = org.business_hours[local_now.weekday()]
    if not day.get("enabled"):
        return False
    return _parse_hhmm(day["start"]) <= local_now.time() < _parse_hhmm(day["end"])
