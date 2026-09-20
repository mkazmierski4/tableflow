"""create restaurants tables reservations

Revision ID: 0001
Revises:
Create Date: 2026-09-20 16:54:00.719878
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "restaurants",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("opens_at", sa.Time(), nullable=False),
        sa.Column("closes_at", sa.Time(), nullable=False),
        sa.Column("default_duration_minutes", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "default_duration_minutes > 0", name=op.f("ck_restaurants_positive_duration")
        ),
        sa.CheckConstraint("opens_at < closes_at", name=op.f("ck_restaurants_opens_before_closes")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_restaurants")),
    )
    op.create_table(
        "tables",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("restaurant_id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=32), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("capacity > 0", name=op.f("ck_tables_positive_capacity")),
        sa.ForeignKeyConstraint(
            ["restaurant_id"],
            ["restaurants.id"],
            name=op.f("fk_tables_restaurant_id_restaurants"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tables")),
        sa.UniqueConstraint("restaurant_id", "label", name=op.f("uq_tables_restaurant_id")),
    )
    op.create_table(
        "reservations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("table_id", sa.Integer(), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("party_size", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "pending",
                "confirmed",
                "seated",
                "completed",
                "cancelled",
                "no_show",
                name="reservationstatus",
                native_enum=False,
                length=16,
            ),
            nullable=False,
        ),
        sa.Column("guest_name", sa.String(length=120), nullable=False),
        sa.Column("guest_email", sa.String(length=254), nullable=False),
        sa.Column("guest_phone", sa.String(length=32), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("end_at > start_at", name=op.f("ck_reservations_end_after_start")),
        sa.CheckConstraint("party_size > 0", name=op.f("ck_reservations_positive_party_size")),
        sa.ForeignKeyConstraint(
            ["table_id"],
            ["tables.id"],
            name=op.f("fk_reservations_table_id_tables"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_reservations")),
    )
    with op.batch_alter_table("reservations", schema=None) as batch_op:
        batch_op.create_index(
            "ix_reservations_table_id_start_at", ["table_id", "start_at"], unique=False
        )

    # Last line of defence against double-booking: PostgreSQL rejects overlapping
    # active reservations for the same table, whatever the application does.
    if op.get_bind().dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
        op.execute(
            "ALTER TABLE reservations ADD CONSTRAINT no_overlapping_reservations "
            "EXCLUDE USING gist (table_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&) "
            "WHERE (status IN ('pending', 'confirmed', 'seated'))"
        )


def downgrade() -> None:
    with op.batch_alter_table("reservations", schema=None) as batch_op:
        batch_op.drop_index("ix_reservations_table_id_start_at")

    op.drop_table("reservations")
    op.drop_table("tables")
    op.drop_table("restaurants")
