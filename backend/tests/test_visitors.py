"""The widget reports which pages a visitor moves through, and their chat keeps that trail."""
import time
import uuid

import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.core.visitor_tracker import MAX_PAGES, VisitorTracker, visitor_tracker
from tests.test_websockets import _joined, _open, http, setup  # noqa: F401  (fixtures)


def _wait_for(check) -> None:
    deadline = time.monotonic() + 5
    while not check():
        assert time.monotonic() < deadline, "the server never caught up"
        time.sleep(0.01)


def _pages(visitor_id: str) -> list[str]:
    for visitors in visitor_tracker._orgs.values():
        if visitor_id in visitors:
            return [p["url"] for p in visitors[visitor_id].pages]
    return []


def _page(url: str, title: str = "", referrer: str = "") -> dict:
    return {"type": "page", "url": url, "title": title, "referrer": referrer}


def test_only_a_known_widget_can_report_pages(http: TestClient):
    for url in ("/ws/visitors?visitor_id=v1", "/ws/visitors?widget_key=nope&visitor_id=v1", "/ws/visitors?widget_key=nope"):
        with pytest.raises(WebSocketDisconnect) as exc:
            with http.websocket_connect(url) as ws:
                ws.receive_json()
        assert exc.value.code == 1008


def test_a_new_chat_starts_with_the_pages_already_seen(http: TestClient, setup: dict):
    visitor_id = str(uuid.uuid4())
    with http.websocket_connect(f"/ws/visitors?widget_key={setup['widget_key']}&visitor_id={visitor_id}") as ws:
        ws.send_json(_page("https://shop.test/", "  Shop\n home ", referrer="https://search.test/?q=boots"))
        ws.send_json(_page("javascript:alert(1)"))
        ws.send_json(_page("https://shop.test/boots", "Boots"))
        ws.send_json(_page("https://shop.test/boots", "Boots"))
        _wait_for(lambda: len(_pages(visitor_id)) == 2)

        conv = http.post("/conversations", json={"visitor_id": visitor_id, "widget_key": setup["widget_key"]}).json()

    assert [(p["url"], p["title"]) for p in conv["visitor_pages"]] == [
        ("https://shop.test/", "Shop home"),
        ("https://shop.test/boots", "Boots"),
    ]
    assert conv["visitor_referrer"] == "https://search.test/?q=boots"
    assert conv["visitor_user_agent"] == "testclient"


def test_pages_seen_while_chatting_reach_the_inbox(http: TestClient, setup: dict):
    conv, visitor_id = setup["conv_id"], setup["visitor_id"]
    headers = {"Authorization": f"Bearer {setup['token']}"}
    before = _open()
    with http.websocket_connect(f"/ws/dashboard?token={setup['token']}") as dashboard:
        _joined(before + 1)
        with http.websocket_connect(f"/ws/visitors?widget_key={setup['widget_key']}&visitor_id={visitor_id}") as ws:
            ws.send_json(_page("https://shop.test/checkout", "Checkout"))
            updated = dashboard.receive_json()
            assert (updated["type"], updated["id"]) == ("conversation_updated", conv)
            assert [p["title"] for p in updated["visitor_pages"]] == ["Checkout"]

            # Once the chat is resolved, its trail stops growing.
            http.patch(f"/conversations/{conv}/status", headers=headers, json={"status": "closed"})
            assert dashboard.receive_json()["status"] == "closed"
            ws.send_json(_page("https://shop.test/thanks", "Thanks"))
            _wait_for(lambda: "https://shop.test/thanks" in _pages(visitor_id))

    chats = http.get("/conversations", headers=headers).json()
    assert [p["title"] for p in next(c for c in chats if c["id"] == conv)["visitor_pages"]] == ["Checkout"]


def test_the_tracker_counts_tabs_and_keeps_recent_pages():
    tracker = VisitorTracker()
    tracker.connected("org", "v", "Firefox")
    tracker.connected("org", "v", "Firefox")
    for n in range(MAX_PAGES + 5):
        tracker.page_viewed("org", "v", {"url": f"https://a.test/{n}"}, "https://first.test/" if n == 0 else "https://later.test/")
    visitor = tracker.get("org", "v")
    assert len(visitor.pages) == MAX_PAGES
    assert visitor.pages[-1]["url"] == f"https://a.test/{MAX_PAGES + 4}"
    assert visitor.referrer == "https://first.test/"

    assert tracker.disconnected("org", "v") is False
    assert [v.visitor_id for v in tracker.online("org")] == ["v"]
    assert tracker.disconnected("org", "v") is True
    assert tracker.online("org") == []
