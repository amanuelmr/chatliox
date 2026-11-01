import uuid

import pytest
from httpx import AsyncClient

from app.core.config import settings


@pytest.fixture
def transcripts(monkeypatch) -> list[dict]:
    sent: list[dict] = []

    async def fake_send(to_email: str, org_name: str, started: str, lines: list) -> None:
        sent.append({"to": to_email, "org": org_name, "lines": lines})

    monkeypatch.setattr("app.services.transcript.send_transcript_email", fake_send)
    return sent


async def _conversation(client: AsyncClient, admin: dict, **visitor) -> dict:
    """A chat with a visitor message, an agent reply and an internal note."""
    visitor_id = str(uuid.uuid4())
    widget_key = admin["me"]["organization"]["widget_key"]
    res = await client.post(
        "/conversations", json={"visitor_id": visitor_id, "widget_key": widget_key, **visitor}
    )
    conv = res.json()
    for body, headers in (
        ({"content": "Where is my parcel?", "sender_type": "visitor", "visitor_id": visitor_id}, {}),
        ({"content": "On its way!", "sender_type": "admin"}, admin["headers"]),
        ({"content": "Customer seems upset", "sender_type": "admin", "is_internal": True}, admin["headers"]),
    ):
        res = await client.post("/messages", json={"conversation_id": conv["id"], **body}, headers=headers)
        assert res.status_code == 201, res.text
    return {**conv, "visitor_id": visitor_id}


async def test_agent_emails_transcript_without_internal_notes(client: AsyncClient, admin: dict, transcripts):
    conv = await _conversation(client, admin, visitor_name="Vi", visitor_email="vi@example.com")
    res = await client.post(f"/conversations/{conv['id']}/transcript", headers=admin["headers"])
    assert res.status_code == 204, res.text

    [sent] = transcripts
    assert sent["to"] == "vi@example.com"
    assert [(sender, text) for sender, _, text in sent["lines"]] == [
        ("Vi", "Where is my parcel?"),
        ("Ada Admin", "On its way!"),
    ]


async def test_agent_needs_a_visitor_email(client: AsyncClient, admin: dict, transcripts):
    conv = await _conversation(client, admin)
    res = await client.post(f"/conversations/{conv['id']}/transcript", headers=admin["headers"])
    assert res.status_code == 422
    assert transcripts == []


async def test_visitor_adds_email_to_get_a_copy(client: AsyncClient, admin: dict, transcripts):
    conv = await _conversation(client, admin)
    url = f"/conversations/{conv['id']}/visitor-transcript"
    status_url = f"/conversations/{conv['id']}/visitor-status?visitor_id={conv['visitor_id']}"
    assert (await client.get(status_url)).json()["has_email"] is False

    res = await client.post(url, json={"visitor_id": conv["visitor_id"]})
    assert res.status_code == 422

    res = await client.post(url, json={"visitor_id": conv["visitor_id"], "email": "new@example.com"})
    assert res.status_code == 204
    assert transcripts[-1]["to"] == "new@example.com"
    assert (await client.get(status_url)).json()["has_email"] is True


async def test_visitor_cannot_redirect_an_existing_email(client: AsyncClient, admin: dict, transcripts):
    conv = await _conversation(client, admin, visitor_email="vi@example.com")
    res = await client.post(
        f"/conversations/{conv['id']}/visitor-transcript",
        json={"visitor_id": conv["visitor_id"], "email": "someone-else@example.com"},
    )
    assert res.status_code == 204
    assert transcripts[-1]["to"] == "vi@example.com"


async def test_another_visitor_is_refused(client: AsyncClient, admin: dict, transcripts):
    conv = await _conversation(client, admin, visitor_email="vi@example.com")
    res = await client.post(
        f"/conversations/{conv['id']}/visitor-transcript", json={"visitor_id": str(uuid.uuid4())}
    )
    assert res.status_code == 404
    assert transcripts == []


async def test_refused_when_email_is_not_configured(client: AsyncClient, admin: dict, transcripts, monkeypatch):
    conv = await _conversation(client, admin, visitor_email="vi@example.com")
    monkeypatch.setattr(settings, "RESEND_API_KEY", "")
    res = await client.post(f"/conversations/{conv['id']}/transcript", headers=admin["headers"])
    assert res.status_code == 503
