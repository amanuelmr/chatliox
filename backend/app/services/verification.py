import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.verification_token import VerificationPurpose, VerificationToken
from app.services.user import get_user_by_id

TOKEN_TTL = timedelta(hours=24)
RESEND_COOLDOWN = timedelta(seconds=60)
RESEND_HOURLY_LIMIT = 5


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


async def _resend_allowed(db: AsyncSession, user_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(VerificationToken.created_at)
        .where(
            VerificationToken.user_id == user_id,
            VerificationToken.purpose == VerificationPurpose.EMAIL_VERIFY,
        )
        .order_by(VerificationToken.created_at.desc())
    )
    created_ats = [row[0] for row in result.all()]
    if not created_ats:
        return True

    now = datetime.now(timezone.utc)
    if now - created_ats[0] < RESEND_COOLDOWN:
        return False
    if sum(1 for ts in created_ats if now - ts < timedelta(hours=1)) >= RESEND_HOURLY_LIMIT:
        return False
    return True


async def create_verification_token(db: AsyncSession, user_id: uuid.UUID) -> str | None:
    """Issue a fresh email-verification token, subject to resend rate limiting.

    Returns None if the caller is resending too fast/too often — the caller
    should still respond generically to avoid leaking rate-limit state.
    """
    if not await _resend_allowed(db, user_id):
        return None

    await db.execute(
        update(VerificationToken)
        .where(
            VerificationToken.user_id == user_id,
            VerificationToken.purpose == VerificationPurpose.EMAIL_VERIFY,
            VerificationToken.consumed_at.is_(None),
        )
        .values(consumed_at=datetime.now(timezone.utc))
    )

    raw_token = secrets.token_urlsafe(32)
    db.add(
        VerificationToken(
            user_id=user_id,
            token_hash=_hash_token(raw_token),
            purpose=VerificationPurpose.EMAIL_VERIFY,
            expires_at=datetime.now(timezone.utc) + TOKEN_TTL,
        )
    )
    await db.commit()
    return raw_token


async def consume_verification_token(db: AsyncSession, raw_token: str) -> User | None:
    result = await db.execute(
        select(VerificationToken).where(
            VerificationToken.token_hash == _hash_token(raw_token),
            VerificationToken.purpose == VerificationPurpose.EMAIL_VERIFY,
        )
    )
    token = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if token is None or token.consumed_at is not None or token.expires_at < now:
        return None

    user = await get_user_by_id(db, token.user_id)
    if user is None:
        return None

    token.consumed_at = now
    user.is_verified = True
    await db.commit()
    await db.refresh(user, ["organization"])
    return user
