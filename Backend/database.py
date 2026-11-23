from pathlib import Path
from collections.abc import Iterator

from fastapi import Request
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import create_engine
from sqlalchemy.engine import Connection, Engine, URL


class DatabaseSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parent / "DB" / ".env",
        extra="ignore",
    )

    postgres_password: str
    postgres_host: str = "127.0.0.1"
    postgres_port: int = 5432
    postgres_user: str = "virtual_dvd_shelf"
    postgres_db: str = "virtual_dvd_shelf"


def create_database_engine() -> Engine:
    settings = DatabaseSettings()
    url = URL.create(
        "postgresql+psycopg2",
        username=settings.postgres_user,
        password=settings.postgres_password,
        host=settings.postgres_host,
        port=settings.postgres_port,
        database=settings.postgres_db,
    )
    return create_engine(url, pool_pre_ping=True)


def get_connection(request: Request) -> Iterator[Connection]:
    with request.app.state.db_engine.connect() as connection:
        yield connection
