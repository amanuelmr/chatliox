"""The background sweeps that email the team about waiting chats and visitors about missed replies.

The sweeps scan the whole database, so assertions only look at emails about this test's chat.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ws_manager import manager
from app.models.conversation import Conversation
from app.models.message import Message
from app.services.alerts import run_missed_reply_sweep, run_unanswered_alert_sweep


@pytest.fixture
def outbox(monkeypatch) -> list[dict]:
    sent: list[dict] = []

    async def unanswered(to_email, visitor_label, minutes, conversation_url) -> None:
        sent.append({"kind": "unanswered", "to": to_email, "label": visitor_label, "url": conversation_url})

    async def missed(to_email, org_name, replies) -> None:
        sent.append({"kind": "missed", "to": to_email, "replies": replies})

    monkeypatch.setattr("app.services.alerts.send_unanswered_alert_email", unanswered)
    monkeypatch.setattr("app.services.alerts.send_missed_replies_email", missed)
    return sent


async def _age(db: AsyncSession, conv_id: str, minutes: int) -> None:
    """Pretend the chat and everything in it happened `minutes` ago."""
    past = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    cid = uuid.UUID(conv_id)
    # The chat started a minute before its messages, which keep their order.
    await db.execute(
        update(Conversation)
        .where(Conversation.id == cid)
        .values(created_at=past - timedelta(minutes=1), last_message_at=past)
    )
    await db.execute(
        update(Message)
        .where(Message.conversation_id == cid)
        .values(created_at=Message.created_at - (datetime.now(timezone.utc) - past))
    )
    await db.commit()


async def test_team_is_alerted_once_about_a_waiting_chat(db, admin: dict, start_chat, outbox):
    conv = await start_chat(admin, "Hello?", visitor_name="Vi")
    about_it = lambda: [e for e in outbox if e["kind"] == "unanswered" and conv["id"] in e["url"]]  # noqa: E731

    await run_unanswered_alert_sweep(db)
    assert about_it() == []  # not waiting long enough yet

    await _age(db, conv["id"], minutes=30)
    await run_unanswered_alert_sweep(db)
    await run_unanswered_alert_sweep(db)
    [alert] = about_it()
    assert (alert["to"], alert["label"]) == (admin["email"], "Vi")


async def test_answered_chats_are_not_alerted(client: AsyncClient, db, admin: dict, start_chat, outbox):
    conv = await start_chat(admin, "Hello?")
    await client.post(
        "/messages",
        headers=admin["headers"],
        json={"conversation_id": conv["id"], "content": "Hi!", "sender_type": "admin"},
    )
    await _age(db, conv["id"], minutes=30)
    await run_unanswered_alert_sweep(db)
    assert not [e for e in outbox if conv["id"] in e.get("url", "")]


async def test_missed_replies_are_emailed_once(client: AsyncClient, db, admin: dict, start_chat, outbox):
    email = f"vi-{uuid.uuid4().hex[:8]}@example.com"
    conv = await start_chat(admin, "Hello?", visitor_email=email)
    for content, internal in (("Thanks for waiting", False), ("note to self", True), ("Here's the answer", False)):
        await client.post(
            "/messages",
            headers=admin["headers"],
            json={"conversation_id": conv["id"], "content": content, "sender_type": "admin", "is_internal": internal},
        )
    to_visitor = lambda: [e for e in outbox if e["kind"] == "missed" and e["to"] == email]  # noqa: E731

    await run_missed_reply_sweep(db)
    assert to_visitor() == []  # replies are too fresh to count as missed

    await _age(db, conv["id"], minutes=30)
    await run_missed_reply_sweep(db)
    await run_missed_reply_sweep(db)
    [sent] = to_visitor()
    assert sent["replies"] == [("Ada Admin", "Thanks for waiting"), ("Ada Admin", "Here's the answer")]


async def test_no_email_while_the_visitor_is_on_the_page(client: AsyncClient, db, admin: dict, start_chat, outbox):
    email = f"here-{uuid.uuid4().hex[:8]}@example.com"
    conv = await start_chat(admin, "Hello?", visitor_email=email)
    await client.post(
        "/messages",
        headers=admin["headers"],
        json={"conversation_id": conv["id"], "content": "Hi!", "sender_type": "admin"},
    )
    await _age(db, conv["id"], minutes=30)
    manager.visitor_connected(conv["id"])
    try:
        await run_missed_reply_sweep(db)
    finally:
        manager.visitor_disconnected(conv["id"])
    assert not [e for e in outbox if e["to"] == email]


async def test_sweeps_do_nothing_without_email_configured(db, admin: dict, start_chat, outbox, monkeypatch):
    conv = await start_chat(admin, "Hello?")
    await _age(db, conv["id"], minutes=30)
    monkeypatch.setattr("app.core.config.settings.RESEND_API_KEY", "")
    await run_unanswered_alert_sweep(db)
    assert outbox == []
