import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_verified_user
from app.models.user import User
from app.schemas.canned_response import (
    CannedResponseResponse,
    CreateCannedResponseRequest,
    UpdateCannedResponseRequest,
)
from app.services.canned_response import (
    create_canned_response,
    delete_canned_response,
    get_canned_response,
    get_canned_responses,
    update_canned_response,
)

router = APIRouter(prefix="/canned-responses", tags=["canned-responses"])


@router.get("", response_model=list[CannedResponseResponse])
async def list_all(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_verified_user),
) -> list[CannedResponseResponse]:
    return await get_canned_responses(db, current_user.organization_id)


@router.post("", response_model=CannedResponseResponse, status_code=status.HTTP_201_CREATED)
async def create(
    body: CreateCannedResponseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_verified_user),
) -> CannedResponseResponse:
    return await create_canned_response(db, current_user.organization_id, body.title, body.content)


@router.patch("/{response_id}", response_model=CannedResponseResponse)
async def update(
    response_id: uuid.UUID,
    body: UpdateCannedResponseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_verified_user),
) -> CannedResponseResponse:
    response = await get_canned_response(db, response_id)
    if response is None or response.organization_id != current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Canned response not found")
    return await update_canned_response(db, response, body.title, body.content)


@router.delete("/{response_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    response_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_verified_user),
) -> None:
    response = await get_canned_response(db, response_id)
    if response is None or response.organization_id != current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Canned response not found")
    await delete_canned_response(db, response)
