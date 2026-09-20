"""Who may see or manage which reservations.

Guests only reach their own reservations, staff those of their restaurant and admins
all of them. A reservation the caller may not access is reported as "not found" so
its existence is not leaked.
"""

from sqlalchemy import ColumnElement, false

from src.models import DiningTable, Reservation, User, UserRole


def can_access_reservation(user: User, reservation: Reservation) -> bool:
    """`reservation.table` must be loaded."""
    if user.role == UserRole.ADMIN:
        return True
    if user.role == UserRole.STAFF:
        return user.restaurant_id is not None and (
            reservation.table.restaurant_id == user.restaurant_id
        )
    return reservation.user_id == user.id


def can_manage_reservation(user: User, reservation: Reservation) -> bool:
    """Staff-level actions (status changes, moving tables): staff of the venue or admins."""
    return user.role != UserRole.GUEST and can_access_reservation(user, reservation)


def reservation_scope(user: User) -> ColumnElement[bool] | None:
    """SQL condition limiting a `Reservation JOIN DiningTable` query to what `user` may see."""
    if user.role == UserRole.ADMIN:
        return None
    if user.role == UserRole.STAFF:
        if user.restaurant_id is None:
            return false()
        return DiningTable.restaurant_id == user.restaurant_id
    return Reservation.user_id == user.id
