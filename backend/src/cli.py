"""Management commands.

    python -m src.cli create-admin --email you@example.com --name "You"
    python -m src.cli export-openapi [--output openapi.json]

The admin password is read from the TABLEFLOW_ADMIN_PASSWORD environment variable
(non-interactive use) or prompted for; it is never accepted as an argument.
"""

import argparse
import asyncio
import getpass
import json
import os
import sys
from collections.abc import Sequence
from pathlib import Path

from src.core.config import Settings
from src.core.database import create_engine, create_session_factory
from src.core.exceptions import DomainError
from src.main import create_app
from src.models import UserRole
from src.services import user_service

MIN_PASSWORD_LENGTH = 8


async def create_admin(email: str, name: str, password: str, settings: Settings) -> int:
    engine = create_engine(settings.database_url)
    try:
        async with create_session_factory(engine)() as session:
            user = await user_service.create_user(
                session, email=email, password=password, full_name=name, role=UserRole.ADMIN
            )
            return user.id
    finally:
        await engine.dispose()


def _read_password() -> str:
    password = os.environ.get("TABLEFLOW_ADMIN_PASSWORD")
    if password is None:
        password = getpass.getpass("Password: ")
        if password != getpass.getpass("Repeat password: "):
            raise SystemExit("Passwords do not match")
    if len(password) < MIN_PASSWORD_LENGTH:
        raise SystemExit(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    return password


def render_openapi() -> str:
    """The API contract as stable JSON (sorted keys), the source of the frontend's types."""
    return json.dumps(create_app(Settings()).openapi(), indent=2, sort_keys=True) + "\n"


def _run_create_admin(args: argparse.Namespace) -> int:
    password = _read_password()
    try:
        user_id = asyncio.run(create_admin(args.email, args.name, password, Settings()))
    except DomainError as exc:
        print(f"error: {exc.message}", file=sys.stderr)
        return 1
    print(f"Created admin {args.email} (id={user_id})")
    return 0


def _run_export_openapi(args: argparse.Namespace) -> int:
    Path(args.output).write_text(render_openapi(), encoding="utf-8", newline="\n")
    print(f"Wrote {args.output}")
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m src.cli")
    commands = parser.add_subparsers(dest="command", required=True)

    admin = commands.add_parser("create-admin", help="create an administrator account")
    admin.add_argument("--email", required=True)
    admin.add_argument("--name", required=True, help="full name")
    admin.set_defaults(run=_run_create_admin)

    openapi = commands.add_parser("export-openapi", help="write the OpenAPI schema to a file")
    openapi.add_argument("--output", default="openapi.json")
    openapi.set_defaults(run=_run_export_openapi)

    args = parser.parse_args(argv)
    return int(args.run(args))


if __name__ == "__main__":
    raise SystemExit(main())
