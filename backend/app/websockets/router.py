import json
import uuid as _uuid

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.ws_manager import manager
from app.services.conversation import get_conversation, touch_visitor_last_seen
from app.services.organization import get_organization_by_id
from app.services.user import get_user_by_id

router = APIRouter()

_POLICY_VIOLATION = 1008  # RFC 6455 — used to signal auth/authz failures
# Longest visitor draft passed on to agents as a typing preview.
_MAX_DRAFT = 1000


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

    # The socket stays open for the whole session; don't hold a connection that long.
    await db.close()

    room = org_room(user.organization_id)
    manager.add_connection(room, websocket)
    manager.agent_connected(str(user.id))

    try:
        while True:
            # No client-originated events on this channel — just keep the
            # connection open and detect disconnects.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(room, websocket)
        manager.agent_disconnected(str(user.id))


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
    agent_name: str | None = None

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
        agent_name = user.full_name

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
    is_visitor = token is None
    # Read once per connection; the widget also stops sending drafts once its
    # config refresh sees the setting turned off.
    org = await get_organization_by_id(db, conv.organization_id) if is_visitor else None
    share_drafts = org is not None and org.typing_preview
    manager.add_connection(conversation_id, websocket)
    if is_visitor:
        manager.visitor_connected(conversation_id)
        await touch_visitor_last_seen(db, conv_uuid)
    # The socket stays open for the whole chat; don't hold a connection that long.
    # The session reconnects by itself if it's used again on the way out.
    await db.close()
    await manager.broadcast_except(
        conversation_id,
        {"type": "presence", "user_id": effective_user_id, "status": "online"},
        exclude=websocket,
    )
    if not is_visitor:
        manager.viewer_joined(conversation_id, effective_user_id, agent_name, websocket)
        await manager.broadcast_viewers(conversation_id)

    # ── 4. Message loop ───────────────────────────────────────────────────────
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                continue

            if event.get("type") == "typing":
                is_typing = bool(event.get("is_typing", False))
                typing = {
                    "type": "typing",
                    "user_id": effective_user_id,
                    "sender_type": "visitor" if is_visitor else "admin",
                    "name": agent_name,
                    "is_typing": is_typing,
                }
                if not is_visitor:
                    await manager.broadcast_except(conversation_id, typing, exclude=websocket)
                    continue
                draft = event.get("draft")
                if share_drafts and is_typing and isinstance(draft, str) and draft.strip():
                    typing["draft"] = draft[:_MAX_DRAFT]
                # The draft is for the team only, so this never goes to the visitor's other tabs.
                await manager.broadcast_to_agents(conversation_id, typing)

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(conversation_id, websocket)
        if is_visitor:
            manager.visitor_disconnected(conversation_id)
            # Everything sent up to now was delivered live, so it isn't "missed".
            await touch_visitor_last_seen(db, conv_uuid)
        else:
            manager.viewer_left(conversation_id, effective_user_id, websocket)
            await manager.broadcast_viewers(conversation_id)
        await manager.broadcast(
            conversation_id,
            {"type": "presence", "user_id": effective_user_id, "status": "offline"},
        )
