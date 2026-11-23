import shutil
from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from pydantic import TypeAdapter, ValidationError
from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.exc import IntegrityError

from database import get_connection
from models import AddExistingDVDRequest, DVDResponse
from routes import texture_routes

router = APIRouter()

DVD_SELECT = """
    SELECT d.dvd_id::text AS dvd_id, d.title, d.actors, d.directors,
           d.description,
           ARRAY(
               SELECT t.texture_set_id::text
               FROM texture_sets AS t
               WHERE t.dvd_id = d.dvd_id
               ORDER BY t.texture_set_id
           ) AS texture_set_ids
    FROM dvds AS d
"""

ACCOUNTS_DVD_SELECT = """
    SELECT d.dvd_id::text AS dvd_id, d.title, d.actors, d.directors,
           d.description, ARRAY[ad.texture_set_id::text] AS texture_set_ids
    FROM accounts AS a
    JOIN account_dvds AS ad ON ad.user_id = a.user_id
    JOIN dvds AS d ON d.dvd_id = ad.dvd_id
    WHERE a.username = :username
    ORDER BY d.title, d.dvd_id
"""

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
NAMES_ADAPTER = TypeAdapter(list[str])


@router.delete("/user/{username}/{dvd_id}", status_code=204)
def remove_user_dvd(
    username: str, dvd_id: UUID, connection: Connection = Depends(get_connection)
):
    with connection.begin():
        removed = connection.execute(
            text(
                "DELETE FROM account_dvds AS ad USING accounts AS a "
                "WHERE ad.user_id = a.user_id AND a.username = :username "
                "AND ad.dvd_id = :dvd_id RETURNING ad.dvd_id"
            ),
            {"username": username, "dvd_id": dvd_id},
        ).scalar_one_or_none()
        if removed is None:
            raise HTTPException(status_code=404, detail="DVD not found on this shelf")
    return Response(status_code=204)

#user adds a dvd to their account

@router.post("/addExistingDVD", response_model=DVDResponse, status_code=201)
def add_existing_dvd(
    payload: AddExistingDVDRequest, connection: Connection = Depends(get_connection)
):
    # validate the username is not blank
    if not payload.username.strip():
        raise HTTPException(status_code=422, detail="Username must not be blank")

    # validate the dvd id and texture set id are not blank and exist in the database
    with connection.begin():
        user_id = connection.execute(
            text("SELECT user_id FROM accounts WHERE username = :username FOR KEY SHARE"),
            {"username": payload.username},
        ).scalar_one_or_none()
        if user_id is None:
            raise HTTPException(status_code=404, detail="User not found")
        #verify that dvd/textures exist
        row = connection.execute(
            text(
                "SELECT d.dvd_id::text AS dvd_id, d.title, d.actors, d.directors, d.description "
                "FROM dvds AS d JOIN texture_sets AS t ON t.dvd_id = d.dvd_id "
                "WHERE d.dvd_id = :dvd_id AND t.texture_set_id = :texture_id "
                "FOR KEY SHARE OF d, t"
            ),
            {"dvd_id": payload.dvd_id, "texture_id": payload.texture_set_id},
        ).mappings().one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="DVD or texture set not found")

        # add the dvd to the user's shelf
        added = connection.execute(
            text(
                "INSERT INTO account_dvds (user_id, dvd_id, texture_set_id) "
                "VALUES (:user_id, :dvd_id, :texture_id) "
                "ON CONFLICT (user_id, dvd_id) DO NOTHING RETURNING dvd_id"
            ),
            {"user_id": user_id, "dvd_id": payload.dvd_id, "texture_id": payload.texture_set_id},
        ).scalar_one_or_none()
        if added is None:
            raise HTTPException(status_code=409, detail="DVD is already on this shelf")

    return DVDResponse(**row, texture_set_ids=[str(payload.texture_set_id)])


#used to add a brand new dvd to the data base and associate it with a user's shelf
@router.post("/addDVD", response_model=DVDResponse, status_code=201)
def add_dvd(
    username: Annotated[str, Form()],
    title: Annotated[str, Form()],
    actors: Annotated[str, Form()],
    directors: Annotated[str, Form()],
    front_face: Annotated[UploadFile, File()],
    back_face: Annotated[UploadFile, File()],
    spine: Annotated[UploadFile, File()],
    description: Annotated[str, Form()] = "",
    connection: Connection = Depends(get_connection),
):
    try:
        actor_names = NAMES_ADAPTER.validate_json(actors)
        director_names = NAMES_ADAPTER.validate_json(directors)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail="Actors and directors must be JSON arrays of strings") from exc

    if not username.strip() or not title.strip() or any(
        not name.strip() for name in actor_names + director_names
    ):
        raise HTTPException(status_code=422, detail="Username, title and names must not be blank")

    uploads = {"front_face": front_face, "back_face": back_face, "spine": spine}
    extensions = {face: Path(upload.filename or "").suffix.lower() for face, upload in uploads.items()}
    if any(extension not in IMAGE_EXTENSIONS for extension in extensions.values()):
        raise HTTPException(status_code=422, detail="Textures must be PNG, JPEG, WebP or GIF files")

    directory = None
    committed = False
    try:
        with connection.begin():
            user_id = connection.execute(
                text("SELECT user_id FROM accounts WHERE username = :username"),
                {"username": username},
            ).scalar_one_or_none()
            if user_id is None:
                raise HTTPException(status_code=404, detail="User not found")

            dvd_id = connection.execute(
                text("INSERT INTO dvds (title, actors, directors, description) "
                     "VALUES (:title, :actors, :directors, :description) RETURNING dvd_id"),
                {"title": title, "actors": actor_names, "directors": director_names, "description": description},
            ).scalar_one()

            texture_id = uuid4()
            paths = {face: f"uploads/{texture_id}/{face}{extensions[face]}" for face in uploads}
            connection.execute(
                text("INSERT INTO texture_sets (texture_set_id, dvd_id, front_face, back_face, spine) "
                     "VALUES (:texture_id, :dvd_id, :front_face, :back_face, :spine)"),
                {"texture_id": texture_id, "dvd_id": dvd_id, **paths},
            )
            texture_root = texture_routes.TEXTURE_DIRECTORY
            uploads_directory = texture_root / "uploads"
            uploads_directory.mkdir(parents=True, exist_ok=True)
            new_directory = uploads_directory / str(texture_id)
            new_directory.mkdir()
            directory = new_directory
            for face, upload in uploads.items():
                with (texture_root / paths[face]).open("xb") as destination:
                    shutil.copyfileobj(upload.file, destination)
                    if destination.tell() == 0:
                        raise HTTPException(status_code=422, detail=f"{face} must not be empty")

            connection.execute(
                text("INSERT INTO account_dvds (user_id, dvd_id, texture_set_id) "
                     "VALUES (:user_id, :dvd_id, :texture_id)"),
                {"user_id": user_id, "dvd_id": dvd_id, "texture_id": texture_id},
            )
        committed = True
    except IntegrityError as exc:
        if getattr(getattr(exc.orig, "diag", None), "constraint_name", None) == "dvds_identity_idx":
            raise HTTPException(status_code=409, detail="DVD already exists") from exc
        raise
    finally:
        if directory is not None and not committed and directory.is_dir():
            shutil.rmtree(directory)

    return DVDResponse(
        dvd_id=str(dvd_id), title=title, actors=actor_names, directors=director_names,
        description=description, texture_set_ids=[str(texture_id)],
    )


@router.get("/", response_model=list[DVDResponse])
def get_all_dvds(connection: Connection = Depends(get_connection)):
    rows = connection.execute(text(DVD_SELECT + " ORDER BY d.title, d.dvd_id"))
    return [DVDResponse(**row) for row in rows.mappings()]


@router.get("/{dvd_id}", response_model=DVDResponse)
def get_dvd(dvd_id: UUID, connection: Connection = Depends(get_connection)):
    row = connection.execute(
        text(DVD_SELECT + " WHERE d.dvd_id = CAST(:dvd_id AS uuid)"),
        {"dvd_id": str(dvd_id)},
    ).mappings().one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="DVD not found")
    return DVDResponse(**row)


@router.get("/user/{username}", response_model=list[DVDResponse])
def get_user_dvds(username: str, connection: Connection = Depends(get_connection)):
    rows = connection.execute(
        text(ACCOUNTS_DVD_SELECT),
        {"username": username},
    )
    return [DVDResponse(**row) for row in rows.mappings()]
