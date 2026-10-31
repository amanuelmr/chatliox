import uuid

from httpx import AsyncClient


async def test_visitor_rates_a_chat_an_agent_answered(client: AsyncClient, admin: dict):
    visitor_id = str(uuid.uuid4())
    widget_key = admin["me"]["organization"]["widget_key"]
    conv = (await client.post("/conversations", json={"visitor_id": visitor_id, "widget_key": widget_key})).json()
    await client.post(
        "/messages",
        headers=admin["headers"],
        json={"conversation_id": conv["id"], "content": "Sorted!", "sender_type": "admin"},
    )
    await client.patch(f"/conversations/{conv['id']}/status", headers=admin["headers"], json={"status": "closed"})

    res = await client.post(f"/conversations/{conv['id']}/csat", json={"visitor_id": visitor_id, "rating": 5})
    assert res.status_code == 200, res.text
    assert res.json()["csat_rating"] == 5
    assert res.json()["assigned_to_name"] == "Ada Admin"
