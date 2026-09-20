from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from src.models.user import UserRole

Password = Annotated[str, Field(min_length=8, max_length=128)]
FullName = Annotated[str, Field(min_length=1, max_length=120)]


def _normalise_email(value: str) -> str:
    return value.strip().lower()


class UserRegister(BaseModel):
    email: EmailStr
    password: Password
    full_name: FullName

    @field_validator("email")
    @classmethod
    def _lowercase_email(cls, value: str) -> str:
        return _normalise_email(value)

    @field_validator("full_name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("full_name must not be blank")
        return value


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    restaurant_id: int | None
    created_at: datetime


class UserUpdate(BaseModel):
    """Admin-only changes. `restaurant_id` may be explicitly null, hence `model_fields_set`."""

    role: UserRole | None = None
    is_active: bool | None = None
    restaurant_id: int | None = None


class TokenRead(BaseModel):
    access_token: str
    token_type: str = "bearer"
