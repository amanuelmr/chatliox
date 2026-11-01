import uuid

from httpx import AsyncClient


async def _reply(client: AsyncClient, admin: dict, conv: dict, content: str, **extra) -> dict:
    res = await client.post(
        "/messages",
        headers=admin["headers"],
        json={"conversation_id": conv["id"], "content": content, "sender_type": "admin", **extra},
    )
    assert res.status_code == 201, res.text
    return res.json()


async def test_unknown_widget_key(client: AsyncClient):
    res = await client.post("/conversations", json={"visitor_id": "v", "widget_key": str(uuid.uuid4())})
    assert res.status_code == 404


async def test_new_chat_waits_then_opens_and_is_assigned_on_reply(client: AsyncClient, admin: dict, start_chat):
    conv = await start_chat(admin, "Hi there", visitor_name="Vi")
    assert conv["status"] == "waiting"

    await _reply(client, admin, conv, "Hello!")
    [listed] = (await client.get("/conversations", headers=admin["headers"])).json()
    assert listed["status"] == "open"
    assert listed["assigned_to_name"] == "Ada Admin"


async def test_internal_notes_stay_internal(client: AsyncClient, admin: dict, start_chat):
    conv = await start_chat(admin, "Hi")
    await _reply(client, admin, conv, "VIP customer", is_internal=True)

    # A note isn't a reply: the chat is still waiting and unassigned.
    [listed] = (await client.get("/conversations", headers=admin["headers"])).json()
    assert listed["status"] == "waiting" and listed["assigned_to_name"] is None

    agent_view = (await client.get(f"/conversations/{conv['id']}/messages", headers=admin["headers"])).json()
    assert [m["content"] for m in agent_view] == ["Hi", "VIP customer"]

    visitor_view = await client.get(
        f"/conversations/{conv['id']}/visitor-messages", params={"visitor_id": conv["visitor_id"]}
    )
    assert [m["content"] for m in visitor_view.json()] == ["Hi"]


async def test_visitors_cannot_post_internal_notes_or_pose_as_agents(client: AsyncClient, admin: dict, start_chat):
    conv = await start_chat(admin)
    note = {"conversation_id": conv["id"], "content": "x", "sender_type": "visitor", "is_internal": True}
    assert (await client.post("/messages", json=note)).status_code == 400
    agent = {"conversation_id": conv["id"], "content": "x", "sender_type": "admin"}
    assert (await client.post("/messages", json=agent)).status_code == 401


async def test_visitor_endpoints_check_the_visitor(client: AsyncClient, admin: dict, start_chat):
    conv = await start_chat(admin, "Hi")
    stranger = {"visitor_id": str(uuid.uuid4())}
    for url in ("visitor-status", "visitor-messages"):
        res = await client.get(f"/conversations/{conv['id']}/{url}", params=stranger)
        assert res.status_code == 404, url
    res = await client.post(f"/conversations/{conv['id']}/csat", json={**stranger, "rating": 5})
    assert res.status_code == 404


async def test_resolve_csat_and_reopen(client: AsyncClient, admin: dict, start_chat):
    conv = await start_chat(admin, "Hi")
    res = await client.patch(f"/conversations/{conv['id']}/status", headers=admin["headers"], json={"status": "closed"})
    assert res.json()["status"] == "closed"

    res = await client.post(f"/conversations/{conv['id']}/csat", json={"visitor_id": conv["visitor_id"], "rating": 4})
    assert res.json()["csat_rating"] == 4
    res = await client.post(f"/conversations/{conv['id']}/csat", json={"visitor_id": conv["visitor_id"], "rating": 6})
    assert res.status_code == 422

    # Writing again after it was resolved puts it back in the queue.
    res = await client.post(
        "/messages", json={"conversation_id": conv["id"], "content": "One more thing", "sender_type": "visitor"}
    )
    assert res.status_code == 201
    status = await client.get(f"/conversations/{conv['id']}/visitor-status", params={"visitor_id": conv["visitor_id"]})
    assert status.json()["status"] == "waiting"


async def test_filter_by_status_tag_and_search(client: AsyncClient, admin: dict, start_chat):
    billing = await start_chat(admin, "My invoice is wrong", visitor_name="Bea")
    shipping = await start_chat(admin, "Where is my parcel?", visitor_email="sam@example.com")
    await client.patch(f"/conversations/{billing['id']}/tags", headers=admin["headers"], json={"tags": ["billing"]})
    await client.patch(f"/conversations/{shipping['id']}/status", headers=admin["headers"], json={"status": "closed"})

    async def ids(**params) -> set[str]:
        res = await client.get("/conversations", headers=admin["headers"], params=params)
        return {c["id"] for c in res.json()}

    assert await ids() == {billing["id"], shipping["id"]}
    assert await ids(status="closed") == {shipping["id"]}
    assert await ids(tag="billing") == {billing["id"]}
    assert await ids(q="parcel") == {shipping["id"]}  # message text
    assert await ids(q="bea") == {billing["id"]}  # visitor name
    assert await ids(q="sam@") == {shipping["id"]}  # visitor email


async def test_other_orgs_conversations_are_invisible(client: AsyncClient, admin: dict, make_admin, start_chat):
    conv = await start_chat(admin, "Hi")
    other = await make_admin("Olga Other")
    assert (await client.get("/conversations", headers=other["headers"])).json() == []
    for method, url, body in (
        ("get", f"/conversations/{conv['id']}/messages", None),
        ("patch", f"/conversations/{conv['id']}/status", {"status": "closed"}),
        ("patch", f"/conversations/{conv['id']}/tags", {"tags": ["x"]}),
    ):
        res = await client.request(method, url, headers=other["headers"], json=body)
        assert res.status_code == 404, url
    res = await client.post(
        "/messages",
        headers=other["headers"],
        json={"conversation_id": conv["id"], "content": "hi", "sender_type": "admin"},
    )
    assert res.status_code == 404


async def test_opening_a_chat_marks_visitor_messages_read(client: AsyncClient, admin: dict, start_chat):
    conv = await start_chat(admin, "Hi")
    visitor_view = await client.get(
        f"/conversations/{conv['id']}/visitor-messages", params={"visitor_id": conv["visitor_id"]}
    )
    assert visitor_view.json()[0]["is_read"] is False
    agent_view = await client.get(f"/conversations/{conv['id']}/messages", headers=admin["headers"])
    assert agent_view.json()[0]["is_read"] is True
