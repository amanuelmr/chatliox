import uuid

from httpx import AsyncClient

from tests.conftest import token_from


async def _join(client: AsyncClient, admin: dict, name: str = "Andy Agent") -> dict:
    """Accept the org's invite link as a new teammate."""
    invite_token = admin["me"]["organization"]["invite_token"]
    email = f"agent-{uuid.uuid4().hex[:8]}@example.com"
    res = await client.post(
        f"/auth/invite/{invite_token}",
        json={"email": email, "password": "s3cret-pass", "full_name": name},
    )
    assert res.status_code == 201, res.text
    headers = {"Authorization": f"Bearer {res.json()['access_token']}"}
    return {"email": email, "headers": headers, "me": (await client.get("/auth/me", headers=headers)).json()}


async def test_invite_link_creates_a_verified_agent(client: AsyncClient, admin: dict):
    invite_token = admin["me"]["organization"]["invite_token"]
    info = await client.get(f"/auth/invite/{invite_token}")
    assert info.json() == {"org_name": "Acme"}

    agent = await _join(client, admin)
    assert agent["me"]["role"] == "agent"
    assert agent["me"]["is_verified"] is True
    assert agent["me"]["organization"]["widget_key"] == admin["me"]["organization"]["widget_key"]


async def test_rotating_the_invite_link_revokes_the_old_one(client: AsyncClient, admin: dict):
    old = admin["me"]["organization"]["invite_token"]
    res = await client.post("/organizations/invite/rotate", headers=admin["headers"])
    assert res.status_code == 200
    assert res.json()["invite_token"] != old
    assert (await client.get(f"/auth/invite/{old}")).status_code == 404


async def test_invite_email(client: AsyncClient, admin: dict, sent_emails):
    res = await client.post(
        "/organizations/invite/send-email", headers=admin["headers"], json={"email": "new@example.com"}
    )
    assert res.status_code == 204
    invite = sent_emails[-1]
    assert invite["kind"] == "invite" and invite["to"] == "new@example.com"
    assert token_from(invite["url"]) == admin["me"]["organization"]["invite_token"]


async def test_agents_cannot_manage_the_team(client: AsyncClient, admin: dict):
    agent = await _join(client, admin)
    for method, url in (
        ("get", "/organizations/members"),
        ("post", "/organizations/invite/rotate"),
        ("delete", f"/organizations/members/{admin['me']['id']}"),
    ):
        res = await client.request(method, url, headers=agent["headers"])
        assert res.status_code == 403, url


async def test_promote_and_remove_members(client: AsyncClient, admin: dict):
    agent = await _join(client, admin)
    members = (await client.get("/organizations/members", headers=admin["headers"])).json()
    assert {m["email"] for m in members} == {admin["email"], agent["email"]}

    res = await client.patch(
        f"/organizations/members/{agent['me']['id']}/role", headers=admin["headers"], json={"role": "admin"}
    )
    assert res.json()["role"] == "admin"

    res = await client.delete(f"/organizations/members/{agent['me']['id']}", headers=admin["headers"])
    assert res.status_code == 204
    # A removed member is locked out.
    assert (await client.get("/auth/me", headers=agent["headers"])).status_code == 401


async def test_the_only_admin_cannot_demote_or_remove_themselves(client: AsyncClient, admin: dict):
    me = admin["me"]["id"]
    res = await client.patch(f"/organizations/members/{me}/role", headers=admin["headers"], json={"role": "agent"})
    assert res.status_code == 400
    res = await client.delete(f"/organizations/members/{me}", headers=admin["headers"])
    assert res.status_code == 400


async def test_members_of_other_orgs_are_out_of_reach(client: AsyncClient, admin: dict, make_admin):
    other = await make_admin("Olga Other")
    res = await client.patch(
        f"/organizations/members/{other['me']['id']}/role", headers=admin["headers"], json={"role": "agent"}
    )
    assert res.status_code == 404
    res = await client.delete(f"/organizations/members/{other['me']['id']}", headers=admin["headers"])
    assert res.status_code == 404
