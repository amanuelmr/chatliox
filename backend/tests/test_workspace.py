"""Saved replies, widget appearance and analytics."""
from httpx import AsyncClient


async def test_saved_replies_crud(client: AsyncClient, admin: dict):
    res = await client.post(
        "/canned-responses", headers=admin["headers"], json={"title": "Greeting", "content": "Hi, how can I help?"}
    )
    assert res.status_code == 201
    reply_id = res.json()["id"]

    res = await client.patch(f"/canned-responses/{reply_id}", headers=admin["headers"], json={"content": "Hello!"})
    assert res.json() == {**res.json(), "title": "Greeting", "content": "Hello!"}

    listed = (await client.get("/canned-responses", headers=admin["headers"])).json()
    assert [r["id"] for r in listed] == [reply_id]

    assert (await client.delete(f"/canned-responses/{reply_id}", headers=admin["headers"])).status_code == 204
    assert (await client.get("/canned-responses", headers=admin["headers"])).json() == []


async def test_saved_replies_are_private_to_the_org(client: AsyncClient, admin: dict, make_admin):
    res = await client.post("/canned-responses", headers=admin["headers"], json={"title": "T", "content": "C"})
    reply_id = res.json()["id"]
    other = await make_admin("Olga Other")
    assert (await client.get("/canned-responses", headers=other["headers"])).json() == []
    res = await client.patch(f"/canned-responses/{reply_id}", headers=other["headers"], json={"title": "X"})
    assert res.status_code == 404
    assert (await client.delete(f"/canned-responses/{reply_id}", headers=other["headers"])).status_code == 404


async def test_saved_reply_needs_content(client: AsyncClient, admin: dict):
    res = await client.post("/canned-responses", headers=admin["headers"], json={"title": "T", "content": "  "})
    assert res.status_code == 422


async def test_widget_appearance_reaches_the_widget(client: AsyncClient, admin: dict):
    res = await client.patch(
        "/organizations/widget",
        headers=admin["headers"],
        json={"widget_color": "#112233", "widget_greeting": "Hey!", "widget_position": "left", "widget_width": 400},
    )
    assert res.status_code == 200, res.text

    widget_key = admin["me"]["organization"]["widget_key"]
    config = (await client.get(f"/organizations/widget/{widget_key}")).json()
    assert (config["widget_color"], config["widget_greeting"], config["widget_position"], config["widget_width"]) == (
        "#112233", "Hey!", "left", 400
    )
    # Settings not sent are left alone.
    assert config["widget_height"] == admin["me"]["organization"]["widget_height"]


async def test_widget_appearance_validation(client: AsyncClient, admin: dict):
    for body in (
        {"widget_color": "red"},
        {"widget_position": "top"},
        {"widget_width": 100},
        {"widget_icon_url": "javascript:alert(1)"},
    ):
        res = await client.patch("/organizations/widget", headers=admin["headers"], json=body)
        assert res.status_code == 422, body


async def test_custom_icon_can_be_reset(client: AsyncClient, admin: dict):
    url = "https://example.com/icon.png"
    res = await client.patch("/organizations/widget", headers=admin["headers"], json={"widget_icon_url": url})
    assert res.json()["widget_icon_url"] == url
    res = await client.patch("/organizations/widget", headers=admin["headers"], json={"widget_icon_url": ""})
    assert res.json()["widget_icon_url"] is None


async def test_unknown_widget_key(client: AsyncClient):
    assert (await client.get("/organizations/widget/nope")).status_code == 404


async def test_analytics_summary(client: AsyncClient, admin: dict, start_chat):
    empty = (await client.get("/analytics/summary", headers=admin["headers"])).json()
    assert empty["total_conversations"] == 0
    assert empty["avg_first_response_minutes"] is None and empty["avg_csat"] is None

    answered = await start_chat(admin, "Hi")
    await start_chat(admin, "Anyone there?")
    await client.post(
        "/messages",
        headers=admin["headers"],
        json={"conversation_id": answered["id"], "content": "Hello!", "sender_type": "admin"},
    )
    await client.patch(f"/conversations/{answered['id']}/status", headers=admin["headers"], json={"status": "closed"})
    await client.post(
        f"/conversations/{answered['id']}/csat", json={"visitor_id": answered["visitor_id"], "rating": 4}
    )

    summary = (await client.get("/analytics/summary", headers=admin["headers"])).json()
    assert (summary["total_conversations"], summary["waiting_count"], summary["closed_count"]) == (2, 1, 1)
    assert summary["avg_first_response_minutes"] >= 0
    assert (summary["avg_csat"], summary["csat_response_count"]) == (4, 1)
    assert sum(day["count"] for day in summary["volume_by_day"]) == 2
    assert summary["per_agent"] == [{"agent_name": "Ada Admin", "resolved_count": 1}]
