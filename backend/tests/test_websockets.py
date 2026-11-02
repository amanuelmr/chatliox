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
        assert agent.receive_json()["type"] == "viewers"
        with http.websocket_connect(f"/ws/conversations/{conv}?visitor_id={visitor_id}") as visitor:
            assert agent.receive_json() == {"type": "presence", "user_id": visitor_id, "status": "online"}

            visitor.send_json({"type": "typing", "is_typing": True})
            assert agent.receive_json() == {
                "type": "typing", "user_id": visitor_id, "sender_type": "visitor", "name": None, "is_typing": True,
            }

            http.post(
                "/messages",
                json={"conversation_id": conv, "content": "Hi!", "sender_type": "visitor", "visitor_id": visitor_id},
            )
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


def test_an_open_dashboard_makes_the_agent_available_for_new_chats(http: TestClient, setup: dict):
    headers = {"Authorization": f"Bearer {setup['token']}"}
    http.put("/organizations/auto-assign", headers=headers, json={"auto_assign": True})
    before = _open()
    with http.websocket_connect(f"/ws/dashboard?token={setup['token']}") as dashboard:
        _joined(before + 1)
        http.post("/conversations", json={"visitor_id": "someone", "widget_key": setup["widget_key"]})
        assert dashboard.receive_json()["assigned_to_name"] == "Wes"


def _teammate(http: TestClient, setup: dict, name: str) -> dict:
    headers = {"Authorization": f"Bearer {setup['token']}"}
    invite = http.get("/auth/me", headers=headers).json()["organization"]["invite_token"]
    res = http.post(
        f"/auth/invite/{invite}",
        json={"email": f"mate-{uuid.uuid4().hex[:8]}@example.com", "password": "s3cret-pass", "full_name": name},
    )
    token = res.json()["access_token"]
    me = http.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    return {"token": token, "id": me["id"]}


def test_agents_on_the_same_chat_see_each_other(http: TestClient, setup: dict):
    conv, visitor_id = setup["conv_id"], setup["visitor_id"]
    sam = _teammate(http, setup, "Sam")
    before = _open()
    with http.websocket_connect(f"/ws/conversations/{conv}?visitor_id={visitor_id}") as visitor:
        _joined(before + 1)
        with http.websocket_connect(f"/ws/conversations/{conv}?token={setup['token']}") as wes:
            _joined(before + 2)
            assert [a["name"] for a in wes.receive_json()["agents"]] == ["Wes"]
            with http.websocket_connect(f"/ws/conversations/{conv}?token={sam['token']}") as sam_ws:
                _joined(before + 3)
                assert wes.receive_json()["type"] == "presence"
                assert sorted(a["name"] for a in wes.receive_json()["agents"]) == ["Sam", "Wes"]
                assert sorted(a["name"] for a in sam_ws.receive_json()["agents"]) == ["Sam", "Wes"]

                sam_ws.send_json({"type": "typing", "is_typing": True})
                typing = wes.receive_json()
                assert (typing["sender_type"], typing["name"], typing["user_id"]) == ("admin", "Sam", sam["id"])

                # The visitor hears the typing, but never who has the chat open.
                seen = [visitor.receive_json() for _ in range(3)]
                assert [e["type"] for e in seen] == ["presence", "presence", "typing"]


def test_viewers_are_counted_per_socket():
    conv, first, second = str(uuid.uuid4()), object(), object()
    manager.viewer_joined(conv, "u1", "Wes", first)
    manager.viewer_joined(conv, "u1", "Wes", second)
    manager.viewer_joined(conv, "u2", "Sam", object())
    assert [v["name"] for v in manager.viewers(conv)] == ["Wes", "Sam"]

    manager.viewer_left(conv, "u1", first)
    assert [v["name"] for v in manager.viewers(conv)] == ["Wes", "Sam"]
    manager.viewer_left(conv, "u1", second)
    assert [v["name"] for v in manager.viewers(conv)] == ["Sam"]


def test_internal_notes_reach_teammates_live(http: TestClient, setup: dict):
    conv, visitor_id = setup["conv_id"], setup["visitor_id"]
    headers = {"Authorization": f"Bearer {setup['token']}"}
    sam = _teammate(http, setup, "Sam")
    before = _open()
    with http.websocket_connect(f"/ws/conversations/{conv}?visitor_id={visitor_id}") as visitor:
        _joined(before + 1)
        with http.websocket_connect(f"/ws/conversations/{conv}?token={sam['token']}") as sam_ws:
            _joined(before + 2)
            assert sam_ws.receive_json()["type"] == "viewers"
            http.post(
                "/messages",
                headers=headers,
                json={"conversation_id": conv, "content": "VIP", "sender_type": "admin", "is_internal": True},
            )
            http.patch(f"/conversations/{conv}/assignee", headers=headers, json={"assignee_id": sam["id"]})
            assert [sam_ws.receive_json()["content"] for _ in range(2)] == ["VIP", "Assigned this chat to Sam."]

            http.post("/messages", headers=headers, json={"conversation_id": conv, "content": "Hello", "sender_type": "admin"})
            # The visitor's first message event is the public reply, not either note.
            event = visitor.receive_json()
            while event["type"] != "message":
                event = visitor.receive_json()
            assert event["content"] == "Hello"


def test_a_macro_reaches_the_visitor_and_the_inbox(http: TestClient, setup: dict):
    conv, visitor_id = setup["conv_id"], setup["visitor_id"]
    headers = {"Authorization": f"Bearer {setup['token']}"}
    macro = http.post(
        "/canned-responses",
        headers=headers,
        json={"title": "Done", "content": "All sorted!", "actions": {"resolve": True}},
    ).json()
    before = _open()
    with http.websocket_connect(f"/ws/dashboard?token={setup['token']}") as dashboard:
        with http.websocket_connect(f"/ws/conversations/{conv}?visitor_id={visitor_id}") as visitor:
            _joined(before + 2)
            http.post(f"/canned-responses/{macro['id']}/apply", headers=headers, json={"conversation_id": conv, "content": "All sorted!"})
            assert visitor.receive_json()["content"] == "All sorted!"
            assert visitor.receive_json() == {"type": "status", "status": "closed"}
            # One inbox update with the end result, not one per step.
            updated = dashboard.receive_json()
            assert (updated["type"], updated["status"]) == ("conversation_updated", "closed")


def test_agents_see_what_the_visitor_is_typing_unless_turned_off(http: TestClient, setup: dict):
    conv, visitor_id = setup["conv_id"], setup["visitor_id"]
    before = _open()
    with http.websocket_connect(f"/ws/conversations/{conv}?token={setup['token']}") as agent:
        _joined(before + 1)
        assert agent.receive_json()["type"] == "viewers"
        with http.websocket_connect(f"/ws/conversations/{conv}?visitor_id={visitor_id}") as visitor:
            assert agent.receive_json()["type"] == "presence"
            visitor.send_json({"type": "typing", "is_typing": True, "draft": "My order hasn't arr"})
            assert agent.receive_json()["draft"] == "My order hasn't arr"
            # A draft is never sent once the visitor stops typing.
            visitor.send_json({"type": "typing", "is_typing": False, "draft": "My order"})
            assert "draft" not in agent.receive_json()

        res = http.put(
            "/organizations/typing-preview",
            headers={"Authorization": f"Bearer {setup['token']}"},
            json={"typing_preview": False},
        )
        assert res.json()["typing_preview"] is False
        assert http.get(f"/organizations/widget/{setup['widget_key']}").json()["typing_preview"] is False
        with http.websocket_connect(f"/ws/conversations/{conv}?visitor_id={visitor_id}") as visitor:
            event = agent.receive_json()
            while event["type"] != "presence" or event["status"] != "online":
                event = agent.receive_json()
            visitor.send_json({"type": "typing", "is_typing": True, "draft": "secret"})
            event = agent.receive_json()
            assert (event["type"], event["is_typing"], "draft" in event) == ("typing", True, False)
