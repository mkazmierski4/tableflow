from collections.abc import Callable, Coroutine
from typing import Annotated, Any

from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import API_V1_PREFIX, Settings
from src.core.database import get_session
from src.core.exceptions import AuthenticationError, PermissionDeniedError
from src.core.security import decode_access_token
from src.models import User, UserRole

SessionDep = Annotated[AsyncSession, Depends(get_session)]

# auto_error=False so a missing token yields our own uniform error body.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{API_V1_PREFIX}/auth/login", auto_error=False)


def get_settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


SettingsDep = Annotated[Settings, Depends(get_settings)]


async def get_current_user(
    request: Request,
    settings: SettingsDep,
    token: Annotated[str | None, Depends(oauth2_scheme)],
) -> User:
    if token is None:
        raise AuthenticationError("Not authenticated", code="not_authenticated")
    user_id = decode_access_token(token, settings)

    # A dedicated short-lived session: the request session must stay untouched so a
    # service can begin its transaction with the lock (see reservation_service).
    session: AsyncSession
    async with request.app.state.session_factory() as session:
        user: User | None = await session.get(User, user_id)
    if user is None or not user.is_active:
        raise AuthenticationError("Invalid or expired token", code="invalid_token")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: UserRole) -> Callable[..., Coroutine[Any, Any, User]]:
    async def dependency(user: CurrentUser) -> User:
        if user.role not in roles:
            raise PermissionDeniedError("You do not have permission to do this")
        return user

    return dependency


AdminUser = Annotated[User, Depends(require_roles(UserRole.ADMIN))]
StaffUser = Annotated[User, Depends(require_roles(UserRole.STAFF, UserRole.ADMIN))]
