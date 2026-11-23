import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.engine import Connection

from database import get_connection
from models import AccountResponse, CreateAccountRequest

router = APIRouter()

# List all accounts, used to allow the user to choose an account
@router.get("/", response_model=list[AccountResponse])
def list_accounts(connection: Connection = Depends(get_connection)):
    rows = connection.execute(text("SELECT username FROM accounts ORDER BY username"))
    return [AccountResponse(**row) for row in rows.mappings()]


@router.post("/", response_model=AccountResponse, status_code=201)
def create_account(payload: CreateAccountRequest, connection: Connection = Depends(get_connection)):
    username = payload.username.strip()
    #validate the username against the allowed pattern
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", username):
        raise HTTPException(
            status_code=422,
            detail="Username must be 1-64 letters, numbers, underscores, or hyphens",
        )
    #actually create the account in the database
    with connection.begin():
        created = connection.execute(
            text(
                "INSERT INTO accounts (username) VALUES (:username) "
                "ON CONFLICT (username) DO NOTHING RETURNING username"
            ),
            {"username": username},
        ).scalar_one_or_none()
        #check if the account was actually created, if not it means it already exists
        if created is None:
            raise HTTPException(status_code=409, detail="Username already exists")
    return AccountResponse(username=created)
