from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm

from src.api.deps import CurrentUser, SessionDep, SettingsDep
from src.core.security import create_access_token
from src.schemas import TokenRead, UserRead, UserRegister
from src.services import user_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(data: UserRegister, session: SessionDep) -> UserRead:
    user = await user_service.register_guest(session, data)
    return UserRead.model_validate(user)


@router.post("/login", response_model=TokenRead)
async def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    session: SessionDep,
    settings: SettingsDep,
) -> TokenRead:
    """OAuth2 password flow: `username` is the user's e-mail."""
    user = await user_service.authenticate(session, form.username, form.password)
    return TokenRead(access_token=create_access_token(user.id, settings))


@router.get("/me", response_model=UserRead)
async def me(user: CurrentUser) -> UserRead:
    return UserRead.model_validate(user)
