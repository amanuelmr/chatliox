import asyncio
import json
from datetime import datetime

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.visitor_tracker import GRACE_SECONDS, LiveVisitor, visitor_tracker
from app.core.ws_manager import manager
from app.schemas.visitor import LiveVisitorResponse
from app.services.organization import get_organization_by_widget_key
from app.services.realtime import publish_conversation
from app.services.visitors import clean_page, clean_url, record_page
from app.websockets.router import org_room

router = APIRouter()

_POLICY_VIOLATION = 1008
# Holds the pending expiries so they aren't garbage collected mid-sleep.
_expiring: set[asyncio.Task] = set()


async def _expire_later(org_id: str, visitor_id: str, left_at: datetime) -> None:
    await asyncio.sleep(GRACE_SECONDS)
    if visitor_tracker.expire(org_id, visitor_id, left_at):
        await manager.broadcast(org_room(org_id), {"type": "visitor_left", "visitor_id": visitor_id})


async def _publish_visitor(org_id: str, visitor: LiveVisitor) -> None:
    event = {"type": "visitor_updated", **LiveVisitorResponse.model_validate(visitor).model_dump(mode="json")}
    await manager.broadcast(org_room(org_id), event)


@router.websocket("/ws/visitors")
async def visitor_ws(
    websocket: WebSocket,
    widget_key: str | None = Query(default=None),
    visitor_id: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Opened by the widget on every page of the customer's site, chat or not.
    It reports the pages the visitor moves through, which keeps the team's
    live visitor list current."""
    await websocket.accept()

    if not widget_key or not visitor_id or len(visitor_id) > 255:
        await websocket.close(code=_POLICY_VIOLATION)
        return
    org = await get_organization_by_widget_key(db, widget_key)
    if org is None:
        await websocket.close(code=_POLICY_VIOLATION)
        return

    org_id = str(org.id)
    user_agent = websocket.headers.get("user-agent")
    visitor = visitor_tracker.connected(org_id, visitor_id, user_agent[:512] if user_agent else None)
    try:
        while True:
            try:
                event = json.loads(await websocket.receive_text())
            except json.JSONDecodeError:
                continue
            if not isinstance(event, dict) or event.get("type") != "page":
                continue
            page = clean_page(event)
            if page is None:
                continue
            if not visitor_tracker.page_viewed(org_id, visitor_id, page, clean_url(event.get("referrer"))):
                continue
            await _publish_visitor(org_id, visitor)
            conv = await record_page(db, org.id, visitor_id, page)
            if conv is not None:
                await publish_conversation(conv)
    except WebSocketDisconnect:
        pass
    finally:
        left_at = visitor_tracker.disconnected(org_id, visitor_id)
        if left_at is not None:
            task = asyncio.create_task(_expire_later(org_id, visitor_id, left_at))
            _expiring.add(task)
            task.add_done_callback(_expiring.discard)
