"""Live updates over WebSockets. These use Starlette's synchronous TestClient,
which drives the app on its own event loop."""
import time
import uuid

import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.core.ws_manager import manager
from app.main import app
from tests.conftest import token_from


@pytest.fixture
def http(sent_emails) -> TestClient:
    # Not used as a context manager, so the background email loop doesn't start.
    return TestClient(app)


@pytest.fixture
def setup(http: TestClient, sent_emails) -> dict:
    """A verified agent and a chat with one visitor message."""
    email = f"ws-{uuid.uuid4().hex[:8]}@example.com"
    http.post(
        "/auth/register",
        json={"email": email, "password": "s3cret-pass", "full_name": "Wes", "org_name": "Acme"},
    )
    token = http.post("/auth/verify-email", json={"token": token_from(sent_emails[-1]["url"])}).json()["access_token"]
    widget_key = http.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["organization"]["widget_key"]
    visitor_id = str(uuid.uuid4())
    conv = http.post("/conversations", json={"visitor_id": visitor_id, "widget_key": widget_key}).json()
    return {"token": token, "visitor_id": visitor_id, "conv_id": conv["id"], "widget_key": widget_key}


def _joined(expected: int) -> None:
    """websocket_connect returns once the socket is accepted, but the server joins a
    room only after checking credentials. Wait for that so no broadcast is missed."""
    deadline = time.monotonic() + 5
    while sum(len(room) for room in manager._rooms.values()) < expected:
        assert time.monotonic() < deadline, "socket never joined its room"
        time.sleep(0.01)


def _open() -> int:
    return sum(len(room) for room in manager._rooms.values())


def _assert_rejected(http: TestClient, url: str) -> None:
    with pytest.raises(WebSocketDisconnect) as exc:
        with http.websocket_connect(url) as ws:
            ws.receive_json()
    assert exc.value.code == 1008


def test_bad_credentials_are_rejected(http: TestClient, setup: dict):
    conv = setup["conv_id"]
    _assert_rejected(http, "/ws/dashboard")
    _assert_rejected(http, "/ws/dashboard?token=nonsense")
    _assert_rejected(http, f"/ws/conversations/{conv}")
    _assert_rejected(http, f"/ws/conversations/{conv}?visitor_id={uuid.uuid4()}")
    _assert_rejected(http, f"/ws/conversations/{uuid.uuid4()}?visitor_id={setup['visitor_id']}")


def test_presence_typing_and_messages_reach_the_agent(http: TestClient, setup: dict):
    conv, token, visitor_id = setup["conv_id"], setup["token"], setup["visitor_id"]
    before = _open()
    with http.websocket_connect(f"/ws/conversations/{conv}?token={token}") as agent:
        _joined(before + 1)
        with http.websocket_connect(f"/ws/conversations/{conv}?visitor_id={visitor_id}") as visitor:
            assert agent.receive_json() == {"type": "presence", "user_id": visitor_id, "status": "online"}

            visitor.send_json({"type": "typing", "is_typing": True})
            assert agent.receive_json() == {"type": "typing", "user_id": visitor_id, "is_typing": True}

            http.post("/messages", json={"conversation_id": conv, "content": "Hi!", "sender_type": "visitor"})
            for ws in (agent, visitor):
                event = ws.receive_json()
                assert (event["type"], event["content"]) == ("message", "Hi!")
    # The "offline" event isn't checked here: TestClient cancels the server task when a
    # socket closes, so the disconnect cleanup never gets to broadcast it.


def test_internal_notes_are_not_broadcast_to_the_visitor(http: TestClient, setup: dict):
    conv, token, visitor_id = setup["conv_id"], setup["token"], setup["visitor_id"]
    headers = {"Authorization": f"Bearer {token}"}
    before = _open()
    with http.websocket_connect(f"/ws/conversations/{conv}?visitor_id={visitor_id}") as visitor:
        _joined(before + 1)
        http.post(
            "/messages",
            headers=headers,
            json={"conversation_id": conv, "content": "secret", "sender_type": "admin", "is_internal": True},
        )
        http.post("/messages", headers=headers, json={"conversation_id": conv, "content": "Hello", "sender_type": "admin"})
        # The first thing the visitor hears about is the public reply.
        assert visitor.receive_json()["content"] == "Hello"


def test_dashboard_hears_about_new_and_updated_chats(http: TestClient, setup: dict):
    before = _open()
    with http.websocket_connect(f"/ws/dashboard?token={setup['token']}") as dashboard:
        _joined(before + 1)
        res = http.post("/conversations", json={"visitor_id": "someone", "widget_key": setup["widget_key"]})
        created = dashboard.receive_json()
        assert (created["type"], created["id"]) == ("conversation_created", res.json()["id"])

        http.patch(
            f"/conversations/{setup['conv_id']}/status",
            headers={"Authorization": f"Bearer {setup['token']}"},
            json={"status": "closed"},
        )
        updated = dashboard.receive_json()
        assert (updated["type"], updated["id"], updated["status"]) == ("conversation_updated", setup["conv_id"], "closed")
