from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Label = Annotated[str, Field(min_length=1, max_length=32)]
Capacity = Annotated[int, Field(ge=1, le=50, strict=True)]


def _non_blank(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("label must not be blank")
    return value


class TableCreate(BaseModel):
    label: Label
    capacity: Capacity

    _label = field_validator("label")(_non_blank)


class TableUpdate(BaseModel):
    """Partial update: only the fields that are sent change; `null` is not a valid value."""

    label: Label | None = None
    capacity: Capacity | None = None
    is_active: bool | None = None

    @field_validator("label")
    @classmethod
    def _label(cls, value: str | None) -> str | None:
        return None if value is None else _non_blank(value)

    @model_validator(mode="after")
    def _no_explicit_nulls(self) -> Self:
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"{field} must not be null")
        return self


class TableRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    restaurant_id: int
    label: str
    capacity: int
    is_active: bool
