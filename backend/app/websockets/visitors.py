import json

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.visitor_tracker import visitor_tracker
from app.services.organization import get_organization_by_widget_key
from app.services.realtime import publish_conversation
from app.services.visitors import clean_page, clean_url, record_page

router = APIRouter()

_POLICY_VIOLATION = 1008


@router.websocket("/ws/visitors")
async def visitor_ws(
    websocket: WebSocket,
    widget_key: str | None = Query(default=None),
    visitor_id: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Opened by the widget on every page of the customer's site, chat or not.
    It reports the pages the visitor moves through."""
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
    visitor_tracker.connected(org_id, visitor_id, user_agent[:512] if user_agent else None)
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
            conv = await record_page(db, org.id, visitor_id, page)
            if conv is not None:
                await publish_conversation(conv)
    except WebSocketDisconnect:
        pass
    finally:
        visitor_tracker.disconnected(org_id, visitor_id)
