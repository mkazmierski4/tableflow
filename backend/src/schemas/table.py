from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TableCreate(BaseModel):
    label: Annotated[str, Field(min_length=1, max_length=32)]
    capacity: Annotated[int, Field(ge=1, le=50, strict=True)]

    @field_validator("label")
    @classmethod
    def _strip_label(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("label must not be blank")
        return value


class TableRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    restaurant_id: int
    label: str
    capacity: int
    is_active: bool
