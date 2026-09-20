from fastapi import APIRouter, Response, status

from src.api.deps import AdminUser, SessionDep
from src.schemas import TableRead, TableUpdate
from src.services import table_service

router = APIRouter(prefix="/tables", tags=["tables"])


@router.patch("/{table_id}", response_model=TableRead)
async def update_table(
    table_id: int, data: TableUpdate, session: SessionDep, _admin: AdminUser
) -> TableRead:
    table = await table_service.update_table(session, table_id, data)
    return TableRead.model_validate(table)


@router.delete("/{table_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_table(table_id: int, session: SessionDep, _admin: AdminUser) -> Response:
    """Soft delete: deactivates the table, keeping reservation history."""
    await table_service.delete_table(session, table_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
