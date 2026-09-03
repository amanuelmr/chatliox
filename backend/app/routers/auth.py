import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.email import send_password_reset_email, send_verification_email
from app.core.limiter import limiter
from app.core.security import create_access_token, verify_password
from app.models.user import User
from app.schemas.auth import (
    AcceptInviteRequest,
    ForgotPasswordRequest,
    InviteInfoResponse,
    LoginRequest,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    TokenResponse,
    VerifyEmailRequest,
)
from app.schemas.user import UserResponse
from app.models.user import UserRole
from app.services.organization import create_organization, get_organization_by_invite_token
from app.services.user import create_user, get_user_by_email
from app.services.verification import (
    consume_verification_token,
    create_password_reset_token,
    create_verification_token,
    reset_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


def _base_url() -> str:
    return settings.ALLOWED_ORIGINS.split(",")[0].strip().rstrip("/")


async def _send_verification(db: AsyncSession, user: User) -> None:
    try:
        raw_token = await create_verification_token(db, user.id)
        if raw_token is None:
            return
        verify_url = f"{_base_url()}/verify-email?token={raw_token}"
        await send_verification_email(user.email, user.full_name, verify_url)
    except Exception as exc:
        logger.exception("Failed to send verification email to %s: %s", user.email, exc)


async def _send_password_reset(db: AsyncSession, user: User) -> None:
    try:
        raw_token = await create_password_reset_token(db, user.id)
        if raw_token is None:
            return
        reset_url = f"{_base_url()}/reset-password/{raw_token}"
        await send_password_reset_email(user.email, user.full_name, reset_url)
    except Exception as exc:
        logger.exception("Failed to send password reset email to %s: %s", user.email, exc)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    if await get_user_by_email(db, body.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    org = await create_organization(db, body.org_name)
    user = await create_user(db, body.email, body.password, body.full_name, org.id, role=UserRole.ADMIN)
    await _send_verification(db, user)
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    user = await get_user_by_email(db, body.email)
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.get("/invite/{token}", response_model=InviteInfoResponse)
async def get_invite_info(token: str, db: AsyncSession = Depends(get_db)) -> InviteInfoResponse:
    org = await get_organization_by_invite_token(db, token)
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid invite link")
    return InviteInfoResponse(org_name=org.name)


@router.post("/invite/{token}", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def accept_invite(token: str, body: AcceptInviteRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    org = await get_organization_by_invite_token(db, token)
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid invite link")
    if await get_user_by_email(db, body.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    user = await create_user(db, body.email, body.password, body.full_name, org.id)
    # Accepting an emailed invite link already proves ownership of the address.
    user.is_verified = True
    await db.commit()
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.post("/verify-email", response_model=TokenResponse)
async def verify_email(body: VerifyEmailRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    user = await consume_verification_token(db, body.token)
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification link")
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.post("/resend-verification", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
async def resend_verification(
    request: Request, body: ResendVerificationRequest, db: AsyncSession = Depends(get_db)
) -> None:
    user = await get_user_by_email(db, body.email)
    if user is not None and not user.is_verified:
        await _send_verification(db, user)
    # Always return the same response — don't reveal whether the address exists or is verified.


@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
async def forgot_password(
    request: Request, body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)
) -> None:
    user = await get_user_by_email(db, body.email)
    if user is not None:
        await _send_password_reset(db, user)
    # Always return the same response — don't reveal whether the address is registered.


@router.post("/reset-password/{token}", response_model=TokenResponse)
async def reset_password_endpoint(
    token: str, body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    user = await reset_password(db, token, body.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset link")
    return TokenResponse(access_token=create_access_token(str(user.id)))
