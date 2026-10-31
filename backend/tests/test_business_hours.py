import uuid
from datetime import datetime, timezone

from httpx import AsyncClient

from app.models.organization import Organization
from app.services.business_hours import is_within_business_hours

WEEKDAY_9_TO_5 = [{"enabled": True, "start": "09:00", "end": "17:00"}] * 5 + [
    {"enabled": False, "start": "09:00", "end": "17:00"}
] * 2
CLOSED_ALL_WEEK = [{"enabled": False, "start": "09:00", "end": "17:00"}] * 7


def _org(enabled: bool = True, tz: str = "UTC", hours=WEEKDAY_9_TO_5) -> Organization:
    return Organization(
        business_hours_enabled=enabled, business_hours_timezone=tz, business_hours=hours
    )


def test_schedule_off_is_always_online():
    assert is_within_business_hours(_org(enabled=False, hours=CLOSED_ALL_WEEK))


def test_inside_and_outside_hours():
    monday = datetime(2026, 10, 26, tzinfo=timezone.utc)
    assert is_within_business_hours(_org(), monday.replace(hour=10))
    assert not is_within_business_hours(_org(), monday.replace(hour=17))
    assert not is_within_business_hours(_org(), monday.replace(hour=8, minute=59))
    saturday = datetime(2026, 10, 31, 10, tzinfo=timezone.utc)
    assert not is_within_business_hours(_org(), saturday)


def test_uses_the_org_timezone():
    # 15:00 UTC on a Monday is 08:00 in Los Angeles, before opening.
    now = datetime(2026, 10, 26, 15, tzinfo=timezone.utc)
    assert is_within_business_hours(_org(), now)
    assert not is_within_business_hours(_org(tz="America/Los_Angeles"), now)


async def test_offline_widget_requires_visitor_email(client: AsyncClient, admin: dict):
    res = await client.put(
        "/organizations/business-hours",
        headers=admin["headers"],
        json={
            "business_hours_enabled": True,
            "business_hours_timezone": "UTC",
            "business_hours": CLOSED_ALL_WEEK,
            "away_message": "We're away, leave your email.",
        },
    )
    assert res.status_code == 200, res.text

    widget_key = admin["me"]["organization"]["widget_key"]
    config = (await client.get(f"/organizations/widget/{widget_key}")).json()
    assert config["is_online"] is False

    body = {"visitor_id": str(uuid.uuid4()), "widget_key": widget_key}
    res = await client.post("/conversations", json=body)
    assert res.status_code == 422

    res = await client.post("/conversations", json={**body, "visitor_email": "v@example.com"})
    assert res.status_code == 201


async def test_rejects_closing_before_opening(client: AsyncClient, admin: dict):
    hours = [{"enabled": True, "start": "17:00", "end": "09:00"}] * 7
    res = await client.put(
        "/organizations/business-hours",
        headers=admin["headers"],
        json={
            "business_hours_enabled": True,
            "business_hours_timezone": "UTC",
            "business_hours": hours,
            "away_message": "Away",
        },
    )
    assert res.status_code == 422
