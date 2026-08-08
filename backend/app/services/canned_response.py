import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.canned_response import CannedResponse


async def create_canned_response(
    db: AsyncSession, organization_id: uuid.UUID, title: str, content: str
) -> CannedResponse:
    response = CannedResponse(organization_id=organization_id, title=title, content=content)
    db.add(response)
    await db.commit()
    await db.refresh(response)
    return response


async def get_canned_responses(db: AsyncSession, organization_id: uuid.UUID) -> list[CannedResponse]:
    result = await db.execute(
        select(CannedResponse)
        .where(CannedResponse.organization_id == organization_id)
        .order_by(CannedResponse.title.asc())
    )
    return list(result.scalars().all())


async def get_canned_response(db: AsyncSession, response_id: uuid.UUID) -> CannedResponse | None:
    return await db.get(CannedResponse, response_id)


async def update_canned_response(
    db: AsyncSession,
    response: CannedResponse,
    title: str | None,
    content: str | None,
) -> CannedResponse:
    if title is not None:
        response.title = title
    if content is not None:
        response.content = content
    await db.commit()
    await db.refresh(response)
    return response


async def delete_canned_response(db: AsyncSession, response: CannedResponse) -> None:
    await db.delete(response)
    await db.commit()
