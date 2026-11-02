"""Who is on each organization's website right now, kept in memory like the
WebSocket rooms. A visitor stays listed while any of their tabs has the widget loaded."""
from dataclasses import dataclass, field
from datetime import datetime, timezone

# Pages kept per visitor, newest last.
MAX_PAGES = 20


@dataclass
class LiveVisitor:
    visitor_id: str
    user_agent: str | None
    arrived_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    # Where they came to the site from, as the first page reported it.
    referrer: str | None = None
    # {"url", "title", "at"}
    pages: list[dict] = field(default_factory=list)
    connections: int = 0


class VisitorTracker:
    def __init__(self) -> None:
        # { organization_id: { visitor_id: LiveVisitor } }
        self._orgs: dict[str, dict[str, LiveVisitor]] = {}

    def connected(self, org_id: str, visitor_id: str, user_agent: str | None) -> LiveVisitor:
        visitors = self._orgs.setdefault(org_id, {})
        visitor = visitors.get(visitor_id)
        if visitor is None:
            visitor = visitors[visitor_id] = LiveVisitor(visitor_id, user_agent)
        visitor.connections += 1
        return visitor

    def disconnected(self, org_id: str, visitor_id: str) -> bool:
        """Returns True once the visitor's last tab has gone."""
        visitors = self._orgs.get(org_id, {})
        visitor = visitors.get(visitor_id)
        if visitor is None:
            return False
        visitor.connections -= 1
        if visitor.connections > 0:
            return False
        del visitors[visitor_id]
        if not visitors:
            self._orgs.pop(org_id, None)
        return True

    def page_viewed(self, org_id: str, visitor_id: str, page: dict, referrer: str | None) -> bool:
        """Returns False when it's the page they were already on, e.g. a second tab."""
        visitor = self._orgs.get(org_id, {}).get(visitor_id)
        if visitor is None:
            return False
        if visitor.referrer is None and not visitor.pages:
            visitor.referrer = referrer
        if visitor.pages and visitor.pages[-1]["url"] == page["url"]:
            return False
        visitor.pages = [*visitor.pages, page][-MAX_PAGES:]
        return True

    def get(self, org_id: str, visitor_id: str) -> LiveVisitor | None:
        return self._orgs.get(org_id, {}).get(visitor_id)

    def online(self, org_id: str) -> list[LiveVisitor]:
        return list(self._orgs.get(org_id, {}).values())


visitor_tracker = VisitorTracker()
