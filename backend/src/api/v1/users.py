from fastapi import APIRouter

from src.api.deps import AdminUser, SessionDep
from src.schemas import UserRead, UserUpdate
from src.services import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: int, data: UserUpdate, session: SessionDep, admin: AdminUser
) -> UserRead:
    """Grant roles, assign staff to a restaurant, or (de)activate an account."""
    user = await user_service.update_user(session, admin, user_id, data)
    return UserRead.model_validate(user)
