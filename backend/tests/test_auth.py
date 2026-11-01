import uuid

from httpx import AsyncClient

from tests.conftest import token_from


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


async def test_password_reset_flow(client: AsyncClient, admin: dict, sent_emails):
    res = await client.post("/auth/forgot-password", json={"email": admin["email"]})
    assert res.status_code == 204
    reset = sent_emails[-1]
    assert reset["kind"] == "reset" and reset["to"] == admin["email"]

    token = token_from(reset["url"])
    res = await client.post(f"/auth/reset-password/{token}", json={"password": "n3w-pass-123"})
    assert res.status_code == 200

    # The link is single use, and only the new password works.
    res = await client.post(f"/auth/reset-password/{token}", json={"password": "again-123"})
    assert res.status_code == 400
    res = await client.post("/auth/login", json={"email": admin["email"], "password": "s3cret-pass"})
    assert res.status_code == 401
    res = await client.post("/auth/login", json={"email": admin["email"], "password": "n3w-pass-123"})
    assert res.status_code == 200


async def test_forgot_password_does_not_reveal_unknown_emails(client: AsyncClient, sent_emails):
    res = await client.post("/auth/forgot-password", json={"email": "nobody@example.com"})
    assert res.status_code == 204
    assert sent_emails == []


async def test_invalid_verification_and_reset_links(client: AsyncClient):
    res = await client.post("/auth/verify-email", json={"token": "not-a-token"})
    assert res.status_code == 400
    res = await client.post("/auth/reset-password/not-a-token", json={"password": "whatever-123"})
    assert res.status_code == 400


async def test_register_rejects_duplicate_email(client: AsyncClient, admin: dict):
    res = await client.post(
        "/auth/register",
        json={"email": admin["email"], "password": "s3cret-pass", "full_name": "Dup", "org_name": "Acme"},
    )
    assert res.status_code == 400


async def test_me_requires_a_valid_token(client: AsyncClient):
    assert (await client.get("/auth/me")).status_code == 401
    res = await client.get("/auth/me", headers={"Authorization": "Bearer nonsense"})
    assert res.status_code == 401
