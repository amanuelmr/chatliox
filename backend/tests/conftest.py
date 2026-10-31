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
def sent_emails(monkeypatch) -> list[dict]:
    """Pretend email is configured and capture what would have been sent."""
    sent: list[dict] = []

    async def fake_verification(to_email: str, full_name: str, verify_url: str) -> None:
        sent.append({"to": to_email, "url": verify_url})

    monkeypatch.setattr(settings, "RESEND_API_KEY", "test-key")
    monkeypatch.setattr("app.routers.auth.send_verification_email", fake_verification)
    return sent


@pytest.fixture
async def admin(client: AsyncClient, sent_emails: list[dict]) -> dict:
    """A freshly registered, verified admin with its own organization."""
    email = f"admin-{uuid.uuid4().hex[:8]}@example.com"
    res = await client.post(
        "/auth/register",
        json={"email": email, "password": "s3cret-pass", "full_name": "Ada Admin", "org_name": "Acme"},
    )
    assert res.status_code == 201, res.text

    token = parse_qs(urlparse(sent_emails[-1]["url"]).query)["token"][0]
    res = await client.post("/auth/verify-email", json={"token": token})
    assert res.status_code == 200, res.text

    headers = {"Authorization": f"Bearer {res.json()['access_token']}"}
    me = (await client.get("/auth/me", headers=headers)).json()
    return {"email": email, "headers": headers, "me": me}
