import json
import uuid as _uuid

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.ws_manager import manager
from app.services.conversation import get_conversation
from app.services.user import get_user_by_id

router = APIRouter()

_POLICY_VIOLATION = 1008  # RFC 6455 — used to signal auth/authz failures


def org_room(organization_id: _uuid.UUID | str) -> str:
    return f"org:{organization_id}"


@router.websocket("/ws/dashboard")
async def dashboard_ws(
    websocket: WebSocket,
    token: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Org-wide channel — pushes conversation_created/conversation_updated so the
    dashboard list stays live without polling."""
    await websocket.accept()

    if token is None:
        await websocket.close(code=_POLICY_VIOLATION)
        return

    sub = decode_access_token(token)
    if sub is None:
        await websocket.close(code=_POLICY_VIOLATION)
        return

    try:
        user_uuid = _uuid.UUID(sub)
    except ValueError:
        await websocket.close(code=_POLICY_VIOLATION)
        return

    user = await get_user_by_id(db, user_uuid)
    if user is None or not user.is_active or not user.is_verified:
        await websocket.close(code=_POLICY_VIOLATION)
        return

    room = org_room(user.organization_id)
    manager.add_connection(room, websocket)

    try:
        while True:
            # No client-originated events on this channel — just keep the
            # connection open and detect disconnects.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(room, websocket)


@router.websocket("/ws/conversations/{conversation_id}")
async def conversation_ws(
    websocket: WebSocket,
    conversation_id: str,
    token: str | None = Query(default=None),
    visitor_id: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> None:
    # The HTTP upgrade (101) must complete before we can send a WS close frame,
    # so we accept unconditionally and validate immediately after.
    await websocket.accept()

    # ── 1. Resolve conversation ───────────────────────────────────────────────
    try:
        conv_uuid = _uuid.UUID(conversation_id)
    except ValueError:
        await websocket.close(code=_POLICY_VIOLATION)
        return

    conv = await get_conversation(db, conv_uuid)
    if conv is None:
        await websocket.close(code=_POLICY_VIOLATION)
        return

    # ── 2. Authenticate and authorize ─────────────────────────────────────────
    #
    # Exactly one credential must be present:
    #   • token      → admin JWT; validated against conversation's organization
    #   • visitor_id → anonymous visitor; validated against conversation.visitor_id
    #
    # JWT decode is pure in-process CPU work (HMAC-SHA256) — no thread pool needed.

    effective_user_id: str

    if token is not None:
        sub = decode_access_token(token)
        if sub is None:
            await websocket.close(code=_POLICY_VIOLATION)
            return
        try:
            user_uuid = _uuid.UUID(sub)
        except ValueError:
            await websocket.close(code=_POLICY_VIOLATION)
            return

        user = await get_user_by_id(db, user_uuid)
        if (
            user is None
            or not user.is_active
            or not user.is_verified
            or user.organization_id != conv.organization_id
        ):
            await websocket.close(code=_POLICY_VIOLATION)
            return

        effective_user_id = str(user.id)

    elif visitor_id is not None:
        if str(conv.visitor_id) != visitor_id:
            await websocket.close(code=_POLICY_VIOLATION)
            return

        effective_user_id = visitor_id

    else:
        # No credential provided at all
        await websocket.close(code=_POLICY_VIOLATION)
        return

    # ── 3. Join room and announce presence ────────────────────────────────────
    manager.add_connection(conversation_id, websocket)
    await manager.broadcast_except(
        conversation_id,
        {"type": "presence", "user_id": effective_user_id, "status": "online"},
        exclude=websocket,
    )

    # ── 4. Message loop ───────────────────────────────────────────────────────
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                continue

            if event.get("type") == "typing":
                await manager.broadcast_except(
                    conversation_id,
                    {
                        "type": "typing",
                        "user_id": effective_user_id,
                        "is_typing": bool(event.get("is_typing", False)),
                    },
                    exclude=websocket,
                )

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(conversation_id, websocket)
        await manager.broadcast(
            conversation_id,
            {"type": "presence", "user_id": effective_user_id, "status": "offline"},
        )
