import uuid
from collections.abc import AsyncGenerator
from urllib.parse import parse_qs, urlparse

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.database import get_db
from app.core.limiter import limiter
from app.main import app

# The tests run against a real, migrated Postgres (DATABASE_URL). NullPool keeps
# connections from leaking between pytest-asyncio's per-test event loops.
_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
_sessions = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)


async def _get_test_db() -> AsyncGenerator[AsyncSession, None]:
    async with _sessions() as session:
        yield session


app.dependency_overrides[get_db] = _get_test_db


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    limiter.reset()


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    async with _sessions() as session:
        yield session


@pytest.fixture
def sent_emails(monkeypatch) -> list[dict]:
    """Pretend email is configured and capture what would have been sent."""
    sent: list[dict] = []

    def capture(kind: str):
        async def fake(to_email: str, *args) -> None:
            sent.append({"kind": kind, "to": to_email, "args": args, "url": args[-1] if args else None})

        return fake

    monkeypatch.setattr(settings, "RESEND_API_KEY", "test-key")
    monkeypatch.setattr("app.routers.auth.send_verification_email", capture("verify"))
    monkeypatch.setattr("app.routers.auth.send_password_reset_email", capture("reset"))
    monkeypatch.setattr("app.routers.organizations.send_invite_email", capture("invite"))
    return sent


def token_from(url: str) -> str:
    """The token in an emailed link, whether it's a query parameter or the last path segment."""
    query = parse_qs(urlparse(url).query)
    return query["token"][0] if "token" in query else url.rstrip("/").rsplit("/", 1)[-1]


@pytest.fixture
def make_admin(client: AsyncClient, sent_emails: list[dict]):
    """Registers and verifies a new admin, each with its own organization."""

    async def make(full_name: str = "Ada Admin") -> dict:
        email = f"admin-{uuid.uuid4().hex[:8]}@example.com"
        res = await client.post(
            "/auth/register",
            json={"email": email, "password": "s3cret-pass", "full_name": full_name, "org_name": "Acme"},
        )
        assert res.status_code == 201, res.text

        res = await client.post("/auth/verify-email", json={"token": token_from(sent_emails[-1]["url"])})
        assert res.status_code == 200, res.text

        headers = {"Authorization": f"Bearer {res.json()['access_token']}"}
        me = (await client.get("/auth/me", headers=headers)).json()
        return {"email": email, "headers": headers, "me": me}

    return make


@pytest.fixture
async def admin(make_admin) -> dict:
    return await make_admin()


@pytest.fixture
def start_chat(client: AsyncClient):
    """Starts a conversation from the widget of `admin`'s organization."""

    async def start(admin: dict, message: str | None = None, **visitor) -> dict:
        visitor_id = str(uuid.uuid4())
        res = await client.post(
            "/conversations",
            json={"visitor_id": visitor_id, "widget_key": admin["me"]["organization"]["widget_key"], **visitor},
        )
        assert res.status_code == 201, res.text
        conv = res.json()
        if message:
            res = await client.post(
                "/messages",
                json={
                    "conversation_id": conv["id"],
                    "content": message,
                    "sender_type": "visitor",
                    "visitor_id": visitor_id,
                },
            )
            assert res.status_code == 201, res.text
        return {**conv, "visitor_id": visitor_id}

    return start
