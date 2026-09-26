"""Apply backend/schema.sql to the database in DATABASE_URL — a Python stand-in for `psql -f`.

    python init_db.py                # create the database if missing, apply schema if not yet applied
    python init_db.py --reset        # DEV ONLY: drop every table/type/row and re-apply the schema
    python init_db.py --reset --yes  # same, without the confirmation prompt
"""

import argparse
import sys
from pathlib import Path

import psycopg
from psycopg import sql
from sqlalchemy.engine import make_url

from app.config import get_settings

SCHEMA_FILE = Path(__file__).resolve().parent / "schema.sql"
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}


def conn_kwargs(dbname: str) -> dict:
    # DATABASE_URL is in SQLAlchemy form (postgresql+psycopg://...); psycopg wants plain parts.
    url = make_url(get_settings().database_url)
    return {
        "host": url.host or "localhost",
        "port": url.port or 5432,
        "user": url.username,
        "password": url.password,
        "dbname": dbname,
    }


def ensure_database(dbname: str) -> None:
    # CREATE DATABASE can't run inside a transaction, hence autocommit, and it has to be
    # issued from a different database — the built-in "postgres" one always exists.
    with psycopg.connect(**conn_kwargs("postgres"), autocommit=True) as conn:
        exists = conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (dbname,)).fetchone()
        if not exists:
            conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(dbname)))
            print(f"Created database {dbname!r}.")


def schema_applied(conn: psycopg.Connection) -> bool:
    return conn.execute("SELECT to_regclass('public.users') IS NOT NULL").fetchone()[0]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--reset", action="store_true", help="drop everything in the public schema and re-apply schema.sql")
    parser.add_argument("--yes", action="store_true", help="skip the --reset confirmation prompt")
    args = parser.parse_args()

    url = make_url(get_settings().database_url)
    dbname = url.database
    if not dbname:
        print("DATABASE_URL has no database name.", file=sys.stderr)
        return 1

    if args.reset:
        if (url.host or "localhost") not in LOCAL_HOSTS:
            print(f"Refusing to --reset a non-local database (host={url.host}).", file=sys.stderr)
            return 1
        if not args.yes:
            answer = input(f"This deletes ALL tables and data in {dbname!r} on {url.host}. Type 'yes' to continue: ")
            if answer.strip().lower() != "yes":
                print("Aborted.")
                return 1

    ensure_database(dbname)

    # One transaction for the whole run: if any statement in schema.sql fails, nothing is left half-created.
    with psycopg.connect(**conn_kwargs(dbname)) as conn:
        if args.reset:
            # Dropping the schema (not table-by-table) also removes enum types and the uuid-ossp extension,
            # which schema.sql recreates.
            conn.execute("DROP SCHEMA public CASCADE")
            conn.execute("CREATE SCHEMA public")
            print("Dropped and recreated schema 'public'.")
        elif schema_applied(conn):
            # schema.sql uses plain CREATE TYPE / CREATE TABLE, which fail if run twice.
            print("Schema already applied (table 'users' exists). Use --reset to rebuild from scratch.")
            return 0

        # With no parameters, psycopg sends this as a simple query, so the multi-statement file runs as-is.
        conn.execute(SCHEMA_FILE.read_text(encoding="utf-8"))
        conn.commit()

    print(f"Applied {SCHEMA_FILE.name} to {dbname!r}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
