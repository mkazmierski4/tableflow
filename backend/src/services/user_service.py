from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import (
    AuthenticationError,
    EmailAlreadyRegisteredError,
    InvalidUserUpdateError,
    NotFoundError,
)
from src.core.security import hash_password_async, verify_password_async
from src.models import Restaurant, User, UserRole
from src.schemas.user import UserRegister, UserUpdate


async def create_user(
    session: AsyncSession,
    *,
    email: str,
    password: str,
    full_name: str,
    role: UserRole = UserRole.GUEST,
    restaurant_id: int | None = None,
) -> User:
    email = email.strip().lower()
    if await session.scalar(select(User.id).where(User.email == email)) is not None:
        raise EmailAlreadyRegisteredError("A user with this e-mail already exists")

    user = User(
        email=email,
        password_hash=await hash_password_async(password),
        full_name=full_name,
        role=role,
        restaurant_id=restaurant_id,
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError as exc:  # concurrent registration of the same e-mail
        await session.rollback()
        raise EmailAlreadyRegisteredError("A user with this e-mail already exists") from exc
    return user


async def register_guest(session: AsyncSession, data: UserRegister) -> User:
    """Self-service registration always yields a guest; roles are granted by admins."""
    return await create_user(
        session, email=data.email, password=data.password, full_name=data.full_name
    )


async def authenticate(session: AsyncSession, email: str, password: str) -> User:
    user = await session.scalar(select(User).where(User.email == email.strip().lower()))
    password_ok = await verify_password_async(password, user.password_hash if user else None)
    if user is None or not password_ok or not user.is_active:
        # One message for every failure so callers cannot probe which e-mails exist.
        raise AuthenticationError("Incorrect e-mail or password")
    return user


async def get_user(session: AsyncSession, user_id: int) -> User:
    user = await session.get(User, user_id)
    if user is None:
        raise NotFoundError(f"User {user_id} not found")
    return user


async def update_user(session: AsyncSession, actor: User, user_id: int, data: UserUpdate) -> User:
    user = await get_user(session, user_id)

    new_role = data.role if data.role is not None else user.role
    new_active = data.is_active if data.is_active is not None else user.is_active
    new_restaurant_id = (
        data.restaurant_id if "restaurant_id" in data.model_fields_set else user.restaurant_id
    )

    if user.id == actor.id and (new_role != user.role or not new_active):
        raise InvalidUserUpdateError("Admins cannot demote or deactivate themselves")

    if new_role == UserRole.STAFF:
        if new_restaurant_id is None:
            raise InvalidUserUpdateError("Staff must be assigned to a restaurant")
        if await session.get(Restaurant, new_restaurant_id) is None:
            raise NotFoundError(f"Restaurant {new_restaurant_id} not found")
    else:
        new_restaurant_id = None

    user.role = new_role
    user.is_active = new_active
    user.restaurant_id = new_restaurant_id
    await session.commit()
    return user
