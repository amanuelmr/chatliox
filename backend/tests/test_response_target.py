"""The first-response target: how long chats have waited, and how often the target was met."""
from datetime import datetime, timedelta, timezone

from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation
from app.models.message import Message


async def _set_target(client: AsyncClient, admin: dict, minutes: int | None):
    return await client.put(
        "/organizations/response-target", headers=admin["headers"], json={"first_response_minutes": minutes}
    )


async def _listed(client: AsyncClient, admin: dict, conv: dict) -> dict:
    return next(c for c in (await client.get("/conversations", headers=admin["headers"])).json() if c["id"] == conv["id"])


async def _reply(client: AsyncClient, admin: dict, conv: dict) -> None:
    res = await client.post(
        "/messages",
        headers=admin["headers"],
        json={"conversation_id": conv["id"], "content": "On it", "sender_type": "admin"},
    )
    assert res.status_code == 201, res.text


async def test_the_target_is_set_by_admins_and_shown_to_the_widget(client: AsyncClient, admin: dict):
    assert (await _set_target(client, admin, 0)).status_code == 422
    assert (await _set_target(client, admin, 15)).json()["first_response_minutes"] == 15

    key = admin["me"]["organization"]["widget_key"]
    assert (await client.get(f"/organizations/widget/{key}")).json()["first_response_minutes"] == 15
    assert (await _set_target(client, admin, None)).json()["first_response_minutes"] is None


async def test_waiting_since_follows_the_chat(client: AsyncClient, admin: dict, start_chat):
    conv = await start_chat(admin, "Hi")
    assert conv["waiting_since"] is not None

    await _reply(client, admin, conv)
    assert (await _listed(client, admin, conv))["waiting_since"] is None

    await client.patch(f"/conversations/{conv['id']}/status", headers=admin["headers"], json={"status": "closed"})
    await client.post(
        "/messages",
        json={"conversation_id": conv["id"], "content": "One more thing", "sender_type": "visitor", "visitor_id": conv["visitor_id"]},
    )
    reopened = await _listed(client, admin, conv)
    assert reopened["status"] == "waiting" and reopened["waiting_since"] is not None


async def test_analytics_report_how_often_the_target_was_met(client: AsyncClient, db: AsyncSession, admin: dict, start_chat):
    summary = (await client.get("/analytics/summary", headers=admin["headers"])).json()
    assert summary["first_response_target_minutes"] is None
    assert summary["first_response_within_target_pct"] is None

    await _set_target(client, admin, 10)
    fast, slow = await start_chat(admin, "Quick one"), await start_chat(admin, "Slow one")
    for conv in (fast, slow):
        await _reply(client, admin, conv)
    # The slow chat started 30 minutes before its reply.
    started = datetime.now(timezone.utc) - timedelta(minutes=30)
    await db.execute(update(Conversation).where(Conversation.id == slow["id"]).values(created_at=started))
    await db.execute(
        update(Message).where(Message.conversation_id == slow["id"], Message.sender_type == "visitor").values(created_at=started)
    )
    await db.commit()

    summary = (await client.get("/analytics/summary", headers=admin["headers"])).json()
    assert summary["first_response_target_minutes"] == 10
    assert summary["first_response_within_target_pct"] == 50
