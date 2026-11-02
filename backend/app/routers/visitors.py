from fastapi import APIRouter, Depends

from app.core.deps import require_verified_user
from app.core.visitor_tracker import visitor_tracker
from app.models.user import User
from app.schemas.visitor import LiveVisitorResponse

router = APIRouter(prefix="/visitors", tags=["visitors"])


@router.get("", response_model=list[LiveVisitorResponse])
async def list_live(current_user: User = Depends(require_verified_user)) -> list[LiveVisitorResponse]:
    """Everyone on the site right now. Updates follow on the dashboard socket."""
    return [v for v in visitor_tracker.online(str(current_user.organization_id)) if v.pages]
