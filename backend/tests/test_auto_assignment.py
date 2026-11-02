import uuid

import pytest
from httpx import AsyncClient

from app.core.ws_manager import manager
from tests.conftest import join_team


@pytest.fixture
def online():
    """Mark teammates as having the dashboard open, and close it again afterwards."""
    ids: list[str] = []

    def go_online(*members: dict) -> None:
        for member in members:
            ids.append(member["me"]["id"])
            manager.agent_connected(member["me"]["id"])

    yield go_online
    for user_id in ids:
        manager.agent_disconnected(user_id)


async def _enable(client: AsyncClient, admin: dict) -> None:
    res = await client.put("/organizations/auto-assign", headers=admin["headers"], json={"auto_assign": True})
    assert res.status_code == 200, res.text
    assert res.json()["auto_assign"] is True


async def _assignee(client: AsyncClient, admin: dict, start_chat) -> str | None:
    conv = await start_chat(admin)
    return conv["assigned_to_name"]


async def test_off_by_default(client: AsyncClient, admin: dict, start_chat, online):
    online(admin)
    assert admin["me"]["organization"]["auto_assign"] is False
    assert await _assignee(client, admin, start_chat) is None


async def test_chats_take_turns_between_online_teammates(client: AsyncClient, admin: dict, start_chat, online):
    agent = await join_team(client, admin, "Andy Agent")
    online(admin, agent)
    await _enable(client, admin)

    names = [await _assignee(client, admin, start_chat) for _ in range(4)]
    assert names[0] != names[1]
    assert names[:2] == names[2:]
    assert set(names) == {"Ada Admin", "Andy Agent"}


async def test_only_online_active_teammates_get_chats(client: AsyncClient, admin: dict, start_chat, online):
    await _enable(client, admin)
    assert await _assignee(client, admin, start_chat) is None

    agent = await join_team(client, admin, "Andy Agent")
    removed = await join_team(client, admin, "Rita Removed")
    await client.delete(f"/organizations/members/{removed['me']['id']}", headers=admin["headers"])
    online(agent, removed)
    assert [await _assignee(client, admin, start_chat) for _ in range(2)] == ["Andy Agent"] * 2


async def test_teammates_in_other_orgs_are_ignored(client: AsyncClient, make_admin, start_chat, online):
    ours, theirs = await make_admin("Ada Admin"), await make_admin("Otto Other")
    online(theirs)
    await _enable(client, ours)
    assert await _assignee(client, ours, start_chat) is None


async def test_assigned_chats_still_wait_for_a_reply(client: AsyncClient, admin: dict, start_chat, online):
    online(admin)
    await _enable(client, admin)
    conv = await start_chat(admin)
    res = await client.get("/conversations", headers=admin["headers"])
    listed = next(c for c in res.json() if c["id"] == conv["id"])
    assert (listed["status"], listed["assigned_to_name"]) == ("waiting", "Ada Admin")


async def test_only_admins_change_the_setting(client: AsyncClient, admin: dict):
    agent = await join_team(client, admin)
    res = await client.put("/organizations/auto-assign", headers=agent["headers"], json={"auto_assign": True})
    assert res.status_code == 403
    me = await client.get("/auth/me", headers=admin["headers"])
    assert me.json()["organization"]["auto_assign"] is False


def test_presence_counts_each_open_dashboard():
    user_id = str(uuid.uuid4())
    manager.agent_connected(user_id)
    manager.agent_connected(user_id)
    manager.agent_disconnected(user_id)
    assert user_id in manager.online_agent_ids()
    manager.agent_disconnected(user_id)
    assert user_id not in manager.online_agent_ids()
