"""Saved replies with actions: shortcuts, applying them to a chat, and usage counts."""
from httpx import AsyncClient

from tests.conftest import join_team


async def _macro(client: AsyncClient, member: dict, **body) -> dict:
    res = await client.post("/canned-responses", headers=member["headers"], json={"title": "Macro", **body})
    assert res.status_code == 201, res.text
    return res.json()


async def _apply(client: AsyncClient, member: dict, macro: dict, conv: dict, content: str | None = None):
    return await client.post(
        f"/canned-responses/{macro['id']}/apply",
        headers=member["headers"],
        json={"conversation_id": conv["id"], "content": macro["content"] if content is None else content},
    )


async def _messages(client: AsyncClient, member: dict, conv: dict) -> list[dict]:
    return (await client.get(f"/conversations/{conv['id']}/messages", headers=member["headers"])).json()


async def test_shortcuts_are_unique_per_team(client: AsyncClient, admin: dict, make_admin):
    first = await _macro(client, admin, content="Refunds take 5 days.", shortcut=" /Refund ")
    assert first["shortcut"] == "refund"

    res = await client.post(
        "/canned-responses", headers=admin["headers"], json={"title": "Again", "content": "x", "shortcut": "refund"}
    )
    assert res.status_code == 409
    for bad in ("with space", "-dash", "x" * 33):
        res = await client.post("/canned-responses", headers=admin["headers"], json={"title": "T", "content": "x", "shortcut": bad})
        assert res.status_code == 422, bad

    # Another team can use the same shortcut.
    other = await make_admin("Olga Other")
    assert (await _macro(client, other, content="Ours", shortcut="refund"))["shortcut"] == "refund"

    # Clearing it frees the shortcut up again.
    res = await client.patch(f"/canned-responses/{first['id']}", headers=admin["headers"], json={"shortcut": None})
    assert res.json()["shortcut"] is None
    assert (await _macro(client, admin, content="New", shortcut="refund"))["shortcut"] == "refund"


async def test_a_macro_must_do_something(client: AsyncClient, admin: dict):
    res = await client.post("/canned-responses", headers=admin["headers"], json={"title": "Empty"})
    assert res.status_code == 422

    actions_only = await _macro(client, admin, actions={"resolve": True})
    assert actions_only["content"] == ""
    res = await client.patch(f"/canned-responses/{actions_only['id']}", headers=admin["headers"], json={"actions": {}})
    assert res.status_code == 422


async def test_applying_replies_then_assigns_tags_and_resolves(client: AsyncClient, admin: dict, start_chat):
    sam = await join_team(client, admin, "Sam Agent")
    macro = await _macro(
        client,
        admin,
        content="Refunds take 5 days.",
        actions={"add_tags": ["refund", "billing"], "assign": "me", "resolve": True},
    )
    conv = await start_chat(admin, "Where is my refund?")
    await client.patch(f"/conversations/{conv['id']}/tags", headers=admin["headers"], json={"tags": ["billing"]})
    await client.patch(f"/conversations/{conv['id']}/assignee", headers=admin["headers"], json={"assignee_id": admin["me"]["id"]})

    res = await _apply(client, sam, macro, conv, content="Refunds take 5 days, Vi.")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["message"]["content"] == "Refunds take 5 days, Vi."
    assert body["message"]["sender_name"] == "Sam Agent"
    assert body["conversation"]["status"] == "closed"
    assert body["conversation"]["assigned_to_name"] == "Sam Agent"
    assert body["conversation"]["tags"] == ["billing", "refund"]

    contents = [m["content"] for m in await _messages(client, admin, conv)]
    assert contents[-2:] == ["Refunds take 5 days, Vi.", "Took this chat."]

    [listed] = (await client.get("/canned-responses", headers=admin["headers"])).json()
    assert listed["use_count"] == 1


async def test_actions_only_macro_sends_no_reply(client: AsyncClient, admin: dict, start_chat):
    macro = await _macro(client, admin, title="Spam", actions={"add_tags": ["spam"], "resolve": True})
    conv = await start_chat(admin, "Buy cheap stuff")

    body = (await _apply(client, admin, macro, conv)).json()
    assert body["message"] is None
    assert (body["conversation"]["status"], body["conversation"]["tags"]) == ("closed", ["spam"])
    assert [m["content"] for m in await _messages(client, admin, conv)] == ["Buy cheap stuff"]


async def test_unassign_runs_after_the_reply_claims_the_chat(client: AsyncClient, admin: dict, start_chat):
    macro = await _macro(client, admin, content="Passing this to the team.", actions={"assign": "unassign"})
    conv = await start_chat(admin, "Hi")
    body = (await _apply(client, admin, macro, conv)).json()
    assert body["conversation"]["assigned_to_id"] is None
    assert body["conversation"]["status"] == "open"


async def test_nothing_to_send_and_other_teams_are_refused(client: AsyncClient, admin: dict, make_admin, start_chat):
    plain = await _macro(client, admin, content="Hello")
    conv = await start_chat(admin, "Hi")
    assert (await _apply(client, admin, plain, conv, content="  ")).status_code == 422

    other = await make_admin("Olga Other")
    assert (await _apply(client, other, plain, conv)).status_code == 404
    theirs = await _macro(client, other, content="Theirs")
    assert (await _apply(client, admin, theirs, conv)).status_code == 404
