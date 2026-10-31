import uuid

from httpx import AsyncClient


async def test_health(client: AsyncClient):
    res = await client.get("/health")
    assert res.status_code == 200


async def test_register_refused_without_email_configured(client: AsyncClient, monkeypatch):
    monkeypatch.setattr("app.core.config.settings.RESEND_API_KEY", "")
    email = f"nobody-{uuid.uuid4().hex[:8]}@example.com"
    res = await client.post(
        "/auth/register",
        json={"email": email, "password": "s3cret-pass", "full_name": "No One", "org_name": "Acme"},
    )
    assert res.status_code == 503

    # Nothing was created, so the address can't log in.
    res = await client.post("/auth/login", json={"email": email, "password": "s3cret-pass"})
    assert res.status_code == 401


async def test_register_sends_verification_and_verifies(client: AsyncClient, admin: dict, sent_emails):
    assert sent_emails[-1]["to"] == admin["email"]
    assert admin["me"]["is_verified"] is True
    assert admin["me"]["role"] == "admin"


async def test_unverified_user_is_blocked(client: AsyncClient, sent_emails):
    email = f"pending-{uuid.uuid4().hex[:8]}@example.com"
    res = await client.post(
        "/auth/register",
        json={"email": email, "password": "s3cret-pass", "full_name": "Pat", "org_name": "Acme"},
    )
    headers = {"Authorization": f"Bearer {res.json()['access_token']}"}
    res = await client.get("/conversations", headers=headers)
    assert res.status_code == 403


async def test_login_rejects_wrong_password(client: AsyncClient, admin: dict):
    res = await client.post("/auth/login", json={"email": admin["email"], "password": "wrong"})
    assert res.status_code == 401

    res = await client.post("/auth/login", json={"email": admin["email"], "password": "s3cret-pass"})
    assert res.status_code == 200
