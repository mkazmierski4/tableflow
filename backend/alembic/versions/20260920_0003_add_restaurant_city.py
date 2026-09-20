"""add restaurant city

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-20
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Existing rows get an empty city (they are not listed by /restaurants/cities);
    # the default only exists to backfill and is dropped right after.
    with op.batch_alter_table("restaurants", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("city", sa.String(length=80), nullable=False, server_default="")
        )
        batch_op.create_index(batch_op.f("ix_restaurants_city"), ["city"], unique=False)
    with op.batch_alter_table("restaurants", schema=None) as batch_op:
        batch_op.alter_column("city", existing_type=sa.String(length=80), server_default=None)


def downgrade() -> None:
    with op.batch_alter_table("restaurants", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_restaurants_city"))
        batch_op.drop_column("city")
