"""Who is on each organization's website right now, kept in memory like the
WebSocket rooms. A visitor stays listed while any of their tabs has the widget loaded."""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from urllib.parse import urlparse

# Pages kept per visitor, newest last.
MAX_PAGES = 20
# On a site without client-side routing every click reloads the widget, so a
# visitor only counts as gone once no tab has reconnected for this long.
GRACE_SECONDS = 30


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
    # When their last tab closed; None while connected.
    left_at: datetime | None = None


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
        visitor.left_at = None
        return visitor

    def disconnected(self, org_id: str, visitor_id: str) -> datetime | None:
        """Returns when the visitor's last tab closed, for passing to expire()
        after the grace period, or None while other tabs are still open."""
        visitor = self.get(org_id, visitor_id)
        if visitor is None:
            return None
        visitor.connections -= 1
        if visitor.connections > 0:
            return None
        visitor.left_at = datetime.now(timezone.utc)
        return visitor.left_at

    def expire(self, org_id: str, visitor_id: str, left_at: datetime) -> bool:
        """Forgets the visitor unless they came back since leaving at left_at."""
        visitors = self._orgs.get(org_id, {})
        visitor = visitors.get(visitor_id)
        if visitor is None or visitor.left_at != left_at:
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
        if not visitor.pages and referrer and urlparse(referrer).netloc != urlparse(page["url"]).netloc:
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
