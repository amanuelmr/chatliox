"""Handing chats between teammates."""
from httpx import AsyncClient

from tests.conftest import join_team


async def _assign(client: AsyncClient, member: dict, conv: dict, assignee: dict | None, note: str = ""):
    return await client.patch(
        f"/conversations/{conv['id']}/assignee",
        headers=member["headers"],
        json={"assignee_id": assignee["me"]["id"] if assignee else None, "note": note},
    )


async def _messages(client: AsyncClient, member: dict, conv: dict) -> list[dict]:
    return (await client.get(f"/conversations/{conv['id']}/messages", headers=member["headers"])).json()


async def test_transfer_leaves_an_internal_note(client: AsyncClient, admin: dict, start_chat):
    sam = await join_team(client, admin, "Sam Agent")
    conv = await start_chat(admin, "Hi")

    res = await _assign(client, admin, conv, sam, "Billing question, over to you.")
    assert res.status_code == 200, res.text
    assert (res.json()["assigned_to_id"], res.json()["assigned_to_name"]) == (sam["me"]["id"], "Sam Agent")

    note = (await _messages(client, admin, conv))[-1]
    assert note["is_internal"] is True and note["sender_name"] == "Ada Admin"
    assert note["content"] == "Assigned this chat to Sam Agent.\n\nBilling question, over to you."

    visitor_view = await client.get(
        f"/conversations/{conv['id']}/visitor-messages", params={"visitor_id": conv["visitor_id"]}
    )
    assert [m["content"] for m in visitor_view.json()] == ["Hi"]


async def test_taking_and_releasing_a_chat(client: AsyncClient, admin: dict, start_chat):
    sam = await join_team(client, admin, "Sam Agent")
    conv = await start_chat(admin, "Hi")

    assert (await _assign(client, sam, conv, sam)).json()["assigned_to_name"] == "Sam Agent"
    assert (await _assign(client, sam, conv, sam)).status_code == 409
    assert (await _assign(client, sam, conv, None)).json()["assigned_to_id"] is None
    assert [m["content"] for m in await _messages(client, admin, conv)][1:] == [
        "Took this chat.",
        "Unassigned this chat.",
    ]


async def test_a_reply_does_not_take_an_assigned_chat(client: AsyncClient, admin: dict, start_chat):
    sam = await join_team(client, admin, "Sam Agent")
    conv = await start_chat(admin, "Hi")
    await _assign(client, admin, conv, sam)

    await client.post(
        "/messages",
        headers=admin["headers"],
        json={"conversation_id": conv["id"], "content": "Jumping in", "sender_type": "admin"},
    )
    [listed] = (await client.get("/conversations", headers=admin["headers"])).json()
    assert (listed["status"], listed["assigned_to_name"]) == ("open", "Sam Agent")


async def test_only_teammates_can_be_assigned(client: AsyncClient, make_admin, start_chat):
    ours, theirs = await make_admin("Ada Admin"), await make_admin("Otto Other")
    removed = await join_team(client, ours, "Rita Removed")
    await client.delete(f"/organizations/members/{removed['me']['id']}", headers=ours["headers"])
    conv = await start_chat(ours, "Hi")

    assert (await _assign(client, ours, conv, theirs)).status_code == 422
    assert (await _assign(client, ours, conv, removed)).status_code == 422
    # And nobody outside the org can move the chat at all.
    assert (await _assign(client, theirs, conv, theirs)).status_code == 404


async def test_any_teammate_can_list_who_to_hand_to(client: AsyncClient, admin: dict):
    sam = await join_team(client, admin, "Sam Agent")
    res = await client.get("/organizations/teammates", headers=sam["headers"])
    assert res.status_code == 200
    assert [t["full_name"] for t in res.json()] == ["Ada Admin", "Sam Agent"]
