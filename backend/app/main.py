import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.email import email_configured
from app.core.limiter import limiter
from app.routers import analytics, auth, canned_responses, conversations, health, messages, organizations
from app.services.alerts import email_notification_loop
from app.services.storage import MEDIA_ROOT
from app.websockets import router as ws_router


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not email_configured():
        logger.error(
            "RESEND_API_KEY is not set: sign-up, password reset and invite emails are disabled "
            "and those endpoints will return 503."
        )
    task = asyncio.create_task(email_notification_loop())
    try:
        yield
    finally:
        task.cancel()


app = FastAPI(
    title="Chatliox API",
    version="0.1.0",
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url=None,
    lifespan=lifespan,
)

# ── Rate limiter ──────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────────────────────
# The widget iframe loads from our own domain, so widget API calls are
# same-origin — no special CORS rule needed for the widget.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Security headers ──────────────────────────────────────────────────────────
@app.middleware("http")
async def security_headers(request: Request, call_next: Callable) -> Response:
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "0"  # disable legacy auditor; rely on CSP
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    # HSTS only in production — local dev uses plain HTTP
    if settings.ENVIRONMENT != "development":
        response.headers["Strict-Transport-Security"] = (
            "max-age=63072000; includeSubDomains; preload"
        )
    return response

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(conversations.router)
app.include_router(messages.router)
app.include_router(ws_router.router)
app.include_router(organizations.router)
app.include_router(canned_responses.router)
app.include_router(analytics.router)

# ── Attachment storage ──────────────────────────────────────────────────────────
app.mount("/media", StaticFiles(directory=str(MEDIA_ROOT)), name="media")
