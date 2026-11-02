"""Welcome messages, quick replies, proactive messages and where the widget shows."""
from httpx import AsyncClient

from tests.conftest import join_team


def _widget(client: AsyncClient, admin: dict):
    return client.get(f"/organizations/widget/{admin['me']['organization']['widget_key']}")


async def test_welcome_messages_and_quick_replies_reach_the_widget(client: AsyncClient, admin: dict):
    res = await client.put(
        "/organizations/welcome",
        headers=admin["headers"],
        json={"welcome_messages": [" Hi there! ", "Ask us anything."], "quick_replies": ["Pricing", " Pricing", "Shipping"]},
    )
    assert res.status_code == 200, res.text
    widget = (await _widget(client, admin)).json()
    assert widget["welcome_messages"] == ["Hi there!", "Ask us anything."]
    assert widget["quick_replies"] == ["Pricing", "Shipping"]

    too_many = await client.put(
        "/organizations/welcome", headers=admin["headers"], json={"welcome_messages": ["a", "b", "c", "d"]}
    )
    assert too_many.status_code == 422
    long_reply = await client.put("/organizations/welcome", headers=admin["headers"], json={"quick_replies": ["x" * 41]})
    assert long_reply.status_code == 422


async def test_only_admins_change_engagement_settings(client: AsyncClient, admin: dict):
    agent = await join_team(client, admin)
    for path, body in (
        ("/organizations/welcome", {"welcome_messages": ["Hi"]}),
        ("/organizations/proactive-messages", {"proactive_messages": []}),
        ("/organizations/display-rules", {"widget_devices": "mobile"}),
    ):
        assert (await client.put(path, headers=agent["headers"], json=body)).status_code == 403


async def test_proactive_messages_get_ids_and_count_the_chats_they_start(client: AsyncClient, admin: dict, start_chat):
    res = await client.put(
        "/organizations/proactive-messages",
        headers=admin["headers"],
        json={"proactive_messages": [
            {"message": "Questions about pricing?", "page_contains": "/pricing", "delay_seconds": 5},
            {"message": "Welcome back!", "min_visits": 2, "frequency": "every_visit", "enabled": False},
        ]},
    )
    assert res.status_code == 200, res.text
    pricing, welcome_back = res.json()["proactive_messages"]
    assert len(pricing["id"]) == 8 and pricing["id"] != welcome_back["id"]
    assert (pricing["min_visits"], pricing["frequency"], pricing["enabled"]) == (1, "once", True)

    # Saving again keeps the ids, so earlier chats still count.
    res = await client.put(
        "/organizations/proactive-messages",
        headers=admin["headers"],
        json={"proactive_messages": [{**pricing, "message": "Need help choosing a plan?"}, welcome_back]},
    )
    assert [m["id"] for m in res.json()["proactive_messages"]] == [pricing["id"], welcome_back["id"]]

    # The widget only gets the ones that can show.
    assert [m["id"] for m in (await _widget(client, admin)).json()["proactive_messages"]] == [pricing["id"]]

    chat = await start_chat(admin, "Is there a yearly plan?", proactive_message_id=pricing["id"])
    assert chat["proactive_message_id"] == pricing["id"]
    await start_chat(admin, "Hi", proactive_message_id=pricing["id"])
    # An id the team doesn't have is ignored rather than stored.
    assert (await start_chat(admin, "Hi", proactive_message_id="deadbeef"))["proactive_message_id"] is None

    stats = (await client.get("/organizations/proactive-messages/stats", headers=admin["headers"])).json()
    assert stats == [{"id": pricing["id"], "chats": 2}]

    invalid = await client.put(
        "/organizations/proactive-messages",
        headers=admin["headers"],
        json={"proactive_messages": [{"message": "Hi", "delay_seconds": 601}]},
    )
    assert invalid.status_code == 422


async def test_display_rules_are_cleaned_up_and_reach_the_widget(client: AsyncClient, admin: dict):
    res = await client.put(
        "/organizations/display-rules",
        headers=admin["headers"],
        json={
            "widget_devices": "desktop",
            "widget_hidden_paths": ["/checkout", "/checkout", "/admin"],
            "widget_allowed_domains": ["https://www.Shop.com/pricing", "blog.shop.com", "localhost:5176"],
        },
    )
    assert res.status_code == 200, res.text
    widget = (await _widget(client, admin)).json()
    assert widget["widget_devices"] == "desktop"
    assert widget["widget_hidden_paths"] == ["/checkout", "/admin"]
    assert widget["widget_allowed_domains"] == ["shop.com", "blog.shop.com", "localhost:5176"]

    for bad in ({"widget_devices": "tablet"}, {"widget_allowed_domains": ["shop .com"]}):
        assert (await client.put("/organizations/display-rules", headers=admin["headers"], json=bad)).status_code == 422
